// Builds ../catalog/f2l.json (the app's catalog, shared/f2l/catalog.ts) from data/speedcubedb-f2l.json.
//
// - Setups: SpeedCubeDB's FR setup (or, if it uses wide/slice moves, the inverse of the
//   best face-turn-only FR alg), relabelled for the other slots. Every derived setup is
//   checked to equal the y-conjugated FR setup.
// - Algs: normalised, deduplicated, and kept only if they solve their slot-case's setup.
// - Mirrors: the mirror of case N's FR setup is an FL state; the case whose FL algs solve
//   it is N's mirror.
// - Alg families: each alg mirrored left-right, mirrored front-back and turned 180° lands
//   on another slot; it's linked there when the catalog has those exact moves. Each alg
//   also gets a familyId: the id of its front-right version (present in the catalog or not).
// - Executions: algs of a case whose moves match once a leading y rotation is taken off
//   are the same hand motions; they share an executionId.
// - Edge orientation: good/bad edge per slot-case, from its setup. Checked to be the same
//   across each alg family (mirrors and the 180° turn keep R/L/U/D moves R/L/U/D).
// - Inserts: the trigger an alg ends with (X U* X', sledgehammer, hedgeslammer), with
//   the slot-case it solves on its own: the case it would be with nothing before it.
// - Triggers: each alg's named triggers (TRIGGER_NAMES): its closing insert, or for an
//   alg written out in data/triggers.json, its groups in parentheses there (each must
//   have a named trigger's shape).
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Alg } from "cubing/alg";
import { FRONT_BACK_SLOT, MIRROR_SLOT, OPPOSITE_SLOT, SLOTS, type AlgTrigger, type Slot, type TriggerKind } from "../../shared/cube.ts";
import type { AlgInsert, Case, Catalog, CatalogAlg, Cluster, InsertKind, SlotCase } from "../../shared/f2l/catalog.ts";
import {
  conjugate,
  disturbedF2LPieces,
  isFaceTurnsOnly,
  mirrorAlg,
  normaliseAlg,
  pairEdgeOriented,
  relabelSides,
  samePattern,
  solved,
  solvingAuf,
  solves,
  turnAlg,
} from "./cube.ts";
import type { SourceDataset } from "./types.ts";

const OUT_PATH = "../catalog/f2l.json";

/** FR -> slot: the y rotation to conjugate by, and the equivalent side-face relabelling. */
const SLOT_TRANSFORM: Record<Slot, { rotation: string; steps: number }> = {
  FR: { rotation: "", steps: 0 },
  FL: { rotation: "y'", steps: -1 },
  BR: { rotation: "y", steps: 1 },
  BL: { rotation: "y2", steps: 2 },
};

const caseId = (n: number) => `f2l-${n}`;
const slotCaseId = (n: number, slot: Slot) => `f2l-${n}-${slot}`;
const algId = (scId: string, moves: string) =>
  `${scId}-${createHash("sha1").update(moves).digest("hex").slice(0, 8)}`;

/** The case plus the moves after any leading y rotation: the same hands, whatever the grip. */
const executionId = (caseNumber: number, moves: string) =>
  `${caseId(caseNumber)}-x-${createHash("sha1").update(moves.replace(/^(y2|y'|y) /, "")).digest("hex").slice(0, 8)}`;

const SIDE_QUARTER = /^[RLFB]'?$/;
const inverseMove = (m: string) => (m.endsWith("'") ? m.slice(0, -1) : `${m}'`);

/**
 * `R' F R F'` and its inverse `F R' F' R`, in every slot and mirror. Seen from another
 * slot one turns into the other, so they're named by how they're written: starting with
 * R or L it's a sledgehammer, with F or B a hedgeslammer (FR: R' F R F' / F R' F' R).
 */
const SLEDGE_SHAPES = new Set(
  [0, 1, 2, 3].flatMap((steps) => [relabelSides("R' F R F'", steps), relabelSides("F R' F' R", steps)]),
);
SLEDGE_SHAPES.forEach((a) => SLEDGE_SHAPES.add(mirrorAlg(a)));

/** The trigger shape the alg's moves end with, by shape alone (checked on the cube later). */
function endingTrigger(moves: string): { kind: InsertKind; length: 3 | 4; moves: string } | undefined {
  const m = moves.split(" ");
  const last4 = m.slice(-4).join(" ");
  if (m.length >= 4 && SLEDGE_SHAPES.has(last4))
    return { kind: /^[RL]/.test(last4) ? "sledgehammer" : "hedgeslammer", length: 4, moves: last4 };
  const [x, u, y] = m.slice(-3);
  if (m.length >= 3 && SIDE_QUARTER.test(x) && /^U[2']?$/.test(u) && y === inverseMove(x))
    return { kind: "insert", length: 3, moves: `${x} ${u} ${y}` };
}

/** The named trigger these moves are, by shape alone, if any (see TRIGGER_NAMES). */
function triggerKindOf(moves: string[]): TriggerKind | undefined {
  const text = moves.join(" ");
  if (moves.length === 4 && SLEDGE_SHAPES.has(text)) return /^[RL]/.test(text) ? "sledgehammer" : "hedgeslammer";
  const [x, u, y, v] = moves;
  if (moves.length === 3 && SIDE_QUARTER.test(x) && /^U[2']?$/.test(u) && y === inverseMove(x)) return "insert";
  // The sexy move turns U the way it turns the side: R U R' U', L' U' L U (never R U' R' U).
  if (moves.length === 4 && SIDE_QUARTER.test(x) && u === (x.endsWith("'") ? "U'" : "U") && y === inverseMove(x) && v === inverseMove(u))
    return "sexy";
}

/**
 * An alg written with its triggers in parentheses, e.g. "U (R U R' U') (R U' R')": the
 * moves without them, and each group's named trigger (it must be one).
 */
function parseMarked(text: string): { moves: string; triggers: AlgTrigger[] } {
  const moves: string[] = [];
  const triggers: AlgTrigger[] = [];
  for (const [, group, plain] of text.matchAll(/\(([^()]*)\)|([^\s()]+)/g)) {
    if (plain) {
      moves.push(plain);
      continue;
    }
    const groupMoves = group.trim().split(/\s+/);
    const kind = triggerKindOf(groupMoves) ?? fail(`trigger marks: "(${group})" in "${text}" isn't a named trigger`);
    triggers.push({ kind, start: moves.length, length: groupMoves.length as 3 | 4 });
    moves.push(...groupMoves);
  }
  return { moves: moves.join(" "), triggers };
}

function fail(msg: string): never {
  throw new Error(msg);
}

async function main() {
  const src: SourceDataset = JSON.parse(await readFile("data/speedcubedb-f2l.json", "utf8"));
  const warnings: string[] = [];

  // 1. Setups and algs per slot-case.
  const setups = new Map<string, string>(); // slotCaseId -> setup
  const algsBySlotCase = new Map<string, CatalogAlg[]>();

  for (const c of src.cases) {
    const published = normaliseAlg(c.setups.FR ?? fail(`case ${c.number}: no FR setup`));
    const frAlgs = c.algs.FR ?? [];
    let frSetup = published;
    if (!isFaceTurnsOnly(published)) {
      const faceAlg = frAlgs
        .map((a) => normaliseAlg(a.moves))
        .find((m) => isFaceTurnsOnly(m) && solves(published, m));
      if (!faceAlg) fail(`case ${c.number}: no face-turn-only FR alg to derive a setup from`);
      frSetup = normaliseAlg(new Alg(faceAlg).invert().toString());
    }
    const d = disturbedF2LPieces(solved.applyAlg(frSetup));
    if (d.CORNERS > 1 || d.EDGES > 1 || d.CENTERS > 0) fail(`case ${c.number}: setup disturbs more than one pair`);

    for (const slot of SLOTS) {
      const { rotation, steps } = SLOT_TRANSFORM[slot];
      const setup = relabelSides(frSetup, steps);
      if (!samePattern(setup, conjugate(rotation, frSetup))) fail(`case ${c.number} ${slot}: relabelled setup mismatch`);
      const scId = slotCaseId(c.number, slot);
      setups.set(scId, setup);

      const seen = new Set<string>();
      const algs: CatalogAlg[] = [];
      for (const a of c.algs[slot] ?? []) {
        let moves: string;
        try {
          moves = normaliseAlg(a.moves);
        } catch {
          warnings.push(`${scId}: unparsable alg "${a.moves}"`);
          continue;
        }
        if (seen.has(moves)) continue;
        if (!solves(setup, moves)) {
          warnings.push(`${scId}: dropped "${moves}" (does not solve)`);
          continue;
        }
        seen.add(moves);
        algs.push({
          id: algId(scId, moves),
          slotCaseId: scId,
          moves,
          source: src.source,
          rank: a.rank,
          votes: a.votes,
          stm: a.stm,
          etm: a.etm,
          familyId: "", // set in step 5, once mirrors are known
          executionId: executionId(c.number, moves),
        });
      }
      if (!algs.length) fail(`${scId}: no verified algs`);
      algsBySlotCase.set(scId, algs);
    }
  }

  // 2. Mirror cases: mirror(FR setup of N) is an FL state; find the case whose FL algs solve it.
  const numbers = src.cases.map((c) => c.number);
  const mirrorOf = new Map<number, number>();
  for (const n of numbers) {
    const mirrored = mirrorAlg(setups.get(slotCaseId(n, "FR"))!);
    const matches = numbers.filter((m) =>
      algsBySlotCase.get(slotCaseId(m, "FL"))!.some((a) => solves(mirrored, a.moves)),
    );
    if (matches.length !== 1) fail(`case ${n}: expected 1 mirror case, found [${matches}]`);
    mirrorOf.set(n, matches[0]);
  }
  for (const [n, m] of mirrorOf) {
    if (mirrorOf.get(m) !== n) fail(`mirror not symmetric: ${n} -> ${m} -> ${mirrorOf.get(m)}`);
  }

  // 3. Clusters, cases, slot-cases.
  const clusters: Cluster[] = [];
  const clusterIdOf = new Map<number, string>();
  for (const n of numbers) {
    if (clusterIdOf.has(n)) continue;
    const members = [...new Set([n, mirrorOf.get(n)!])].sort((a, b) => a - b);
    const id = `f2l-c-${members.join("-")}`;
    members.forEach((m) => clusterIdOf.set(m, id));
    clusters.push({ id, caseIds: members.map(caseId) });
  }

  const cases: Case[] = src.cases.map((c) => ({
    id: caseId(c.number),
    number: c.number,
    clusterId: clusterIdOf.get(c.number)!,
    group: c.group ?? "Unknown",
    mirrorCaseId: caseId(mirrorOf.get(c.number)!),
  }));

  const slotCases: SlotCase[] = src.cases.flatMap((c) =>
    SLOTS.map((slot) => {
      const id = slotCaseId(c.number, slot);
      return {
        id,
        caseId: caseId(c.number),
        slot,
        setup: setups.get(id)!,
        mirrorSlotCaseId: slotCaseId(mirrorOf.get(c.number)!, MIRROR_SLOT[slot]),
        edgeOriented: pairEdgeOriented(setups.get(id)!),
        algIds: algsBySlotCase.get(id)!.map((a) => a.id),
      };
    }),
  );

  // 4. Alg families. Each transform carries a slot-case's setup to another slot-case;
  //    check that slot-case's algs really solve it, then link the algs whose exact
  //    transformed moves are there.
  const transforms = [
    { name: "left-right", slots: MIRROR_SLOT, mirrorCase: true, apply: (alg: string) => mirrorAlg(alg, "M") },
    { name: "front-back", slots: FRONT_BACK_SLOT, mirrorCase: true, apply: (alg: string) => mirrorAlg(alg, "S") },
    { name: "turned", slots: OPPOSITE_SLOT, mirrorCase: false, apply: turnAlg },
  ];
  const numberOf = new Map(cases.map((c) => [c.id, c.number]));
  const linkCounts = new Map<string, number>();
  for (const sc of slotCases) {
    const n = numberOf.get(sc.caseId)!;
    for (const { name, slots, mirrorCase, apply } of transforms) {
      const slot = slots[sc.slot];
      const targetId = slotCaseId(mirrorCase ? mirrorOf.get(n)! : n, slot);
      const targetAlgs = algsBySlotCase.get(targetId)!;
      if (slotCases.find((t) => t.id === targetId)!.edgeOriented !== sc.edgeOriented)
        fail(`${sc.id}: edge orientation differs from its ${name} family member ${targetId}`);
      if (!targetAlgs.some((a) => solves(apply(sc.setup), a.moves))) fail(`${sc.id}: transform to ${targetId} does not match`);
      const byMoves = new Map(targetAlgs.map((a) => [a.moves, a.id]));
      for (const a of algsBySlotCase.get(sc.id)!) {
        const id = byMoves.get(apply(a.moves));
        if (!id) continue;
        (a.familyAlgIds ??= {})[slot] = id;
        linkCounts.set(name, (linkCounts.get(name) ?? 0) + 1);
      }
    }
  }

  // 5. Family ids: carry each alg to front-right (the same transforms: each is its own
  //    inverse) and take the id it has there.
  const toFrontRight: Record<Slot, { mirrorCase: boolean; apply: (alg: string) => string }> = {
    FR: { mirrorCase: false, apply: (alg) => alg },
    FL: { mirrorCase: true, apply: (alg) => mirrorAlg(alg, "M") },
    BR: { mirrorCase: true, apply: (alg) => mirrorAlg(alg, "S") },
    BL: { mirrorCase: false, apply: turnAlg },
  };
  for (const sc of slotCases) {
    const n = numberOf.get(sc.caseId)!;
    const { mirrorCase, apply } = toFrontRight[sc.slot];
    const frId = slotCaseId(mirrorCase ? mirrorOf.get(n)! : n, "FR");
    for (const a of algsBySlotCase.get(sc.id)!) a.familyId = algId(frId, apply(a.moves));
  }
  const allAlgs = new Map(slotCases.flatMap((sc) => algsBySlotCase.get(sc.id)!).map((a) => [a.id, a]));
  for (const a of allAlgs.values()) {
    for (const id of Object.values(a.familyAlgIds ?? {}))
      if (allAlgs.get(id)!.familyId !== a.familyId) fail(`${a.id}: family member ${id} has another familyId`);
    if (a.slotCaseId.endsWith("-FR") && a.familyId !== a.id) fail(`${a.id}: front-right alg's familyId isn't its own id`);
  }

  // 6. Inserts: the alg's closing trigger, and the one slot-case it solves on its own.
  const insertCache = new Map<string, Omit<AlgInsert, "kind" | "length"> | null>();
  const insertKinds = new Map<string, number>();
  for (const a of allAlgs.values()) {
    const trigger = endingTrigger(a.moves);
    if (!trigger) continue;
    if (!insertCache.has(trigger.moves)) {
      const matches = slotCases.flatMap((sc) => {
        const auf = solvingAuf(sc.setup, trigger.moves);
        return auf === null ? [] : [{ sc, auf }];
      });
      if (matches.length !== 1) fail(`trigger "${trigger.moves}" solves ${matches.length} slot-cases`);
      const { sc, auf } = matches[0];
      const algId = algsBySlotCase.get(sc.id)!.find((x) => x.moves === `${auf} ${trigger.moves}`.trim())?.id;
      insertCache.set(trigger.moves, { slotCaseId: sc.id, auf, ...(algId && { algId }) });
    }
    a.insert = { kind: trigger.kind, length: trigger.length, ...insertCache.get(trigger.moves)! };
    insertKinds.set(trigger.kind, (insertKinds.get(trigger.kind) ?? 0) + 1);
  }

  // 7. Triggers: the closing insert, unless the alg is written out by hand with its
  // triggers in parentheses (data/triggers.json): then exactly those.
  const algsByMoves = new Map([...allAlgs.values()].map((a) => [a.moves, a]));
  for (const a of allAlgs.values())
    if (a.insert) a.triggers = [{ kind: a.insert.kind, start: a.moves.split(" ").length - a.insert.length, length: a.insert.length }];
  const marked: string[] = JSON.parse(await readFile("data/triggers.json", "utf8")).algs;
  for (const text of marked) {
    const { moves, triggers } = parseMarked(text);
    const a = algsByMoves.get(moves) ?? fail(`trigger marks: no alg "${moves}"`);
    if (triggers.length) a.triggers = triggers;
    else delete a.triggers;
  }

  const catalog: Catalog = {
    version: 1,
    generatedAt: new Date().toISOString(),
    caseSet: { id: "f2l", name: "F2L" },
    clusters,
    cases,
    slotCases,
    algs: slotCases.flatMap((sc) => algsBySlotCase.get(sc.id)!),
  };

  await mkdir("../catalog", { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(catalog, null, 1) + "\n");

  const selfMirror = clusters.filter((c) => c.caseIds.length === 1).map((c) => c.caseIds[0]);
  console.log(
    `Wrote ${OUT_PATH}: ${clusters.length} clusters (${clusters.length - selfMirror.length} pairs, ` +
      `self-mirror: ${selfMirror.join(", ")}), ${slotCases.length} slot-cases, ${catalog.algs.length} algs, ` +
      `family links: ${transforms.map(({ name }) => `${name} ${linkCounts.get(name) ?? 0}`).join(", ")}, ` +
      `closing triggers: ${[...insertKinds].map(([k, n]) => `${k} ${n}`).join(", ")}.`,
  );
  if (warnings.length) console.log(`${warnings.length} warnings:\n  ${warnings.join("\n  ")}`);
}

if (import.meta.main) await main();
