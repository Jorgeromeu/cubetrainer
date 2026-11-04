// Cube helpers on top of cubing.js: F2L checks, alg normalising, mirroring and
// relabelling faces for a y rotation.
import { Alg, Move } from "cubing/alg";
import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";

export const AUFS = ["", "U", "U2", "U'"];
export const Y_ROTATIONS = ["", "y", "y2", "y'"];
const ROTATIONS = ["", "x", "x2", "x'", "z", "z'"].flatMap((a) => Y_ROTATIONS.map((b) => `${a} ${b}`.trim()));

const kpuzzle: KPuzzle = await cube3x3x3.kpuzzle();
export const solved = kpuzzle.defaultPattern();

// F2L pieces = every piece that a U move leaves in place (cross, slots, centers).
const f2lPieces: Record<string, number[]> = {};
{
  const afterU = solved.applyMove("U");
  for (const [orbit, data] of Object.entries(solved.patternData)) {
    f2lPieces[orbit] = data.pieces
      .map((_, i) => i)
      .filter((i) => afterU.patternData[orbit].pieces[i] === i && !afterU.patternData[orbit].orientation[i]);
  }
}

function isF2LSolved(p: KPattern): boolean {
  return Object.entries(f2lPieces).every(([orbit, idxs]) =>
    idxs.every((i) => p.patternData[orbit].pieces[i] === i && !p.patternData[orbit].orientation[i]),
  );
}

/** Count of F2L pieces out of place, for the rotation that minimises it. */
export function disturbedF2LPieces(p: KPattern): Record<string, number> {
  const counts = ROTATIONS.map((r) => countDisturbed(r ? p.applyAlg(r) : p));
  const total = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
  return counts.sort((a, b) => total(a) - total(b))[0];
}

function countDisturbed(p: KPattern): Record<string, number> {
  return Object.fromEntries(
    Object.entries(f2lPieces).map(([orbit, idxs]) => [
      orbit,
      idxs.filter((i) => p.patternData[orbit].pieces[i] !== i || p.patternData[orbit].orientation[i]).length,
    ]),
  );
}

/** F2L solved, allowing for a net whole-cube rotation left by the alg. */
function isF2LSolvedUpToRotation(p: KPattern): boolean {
  return ROTATIONS.some((r) => isF2LSolved(r ? p.applyAlg(r) : p));
}

/** Returns the AUF that makes setup + AUF + alg solve F2L, or null. */
export function solvingAuf(setup: string, alg: string): string | null {
  const start = solved.applyAlg(setup);
  for (const u of AUFS) {
    if (isF2LSolvedUpToRotation(start.applyAlg(u).applyAlg(alg))) return u;
  }
  return null;
}

/** True if `alg` solves the F2L state reached by `setup` (allowing a pre-AUF); never throws. */
export function solves(setup: string, alg: string): boolean {
  try {
    return solvingAuf(setup, alg) !== null;
  } catch {
    return false;
  }
}

export const conjugate = (rot: string, setup: string) =>
  rot ? `${rot} ${setup} ${new Alg(rot).invert()}` : setup;

const mapMoves = (alg: string, f: (m: Move) => Move) =>
  new Alg(
    [...new Alg(alg).experimentalExpand()].map((node) => {
      const move = node.as(Move);
      if (!move) throw new Error(`unsupported alg node "${node}" in "${alg}"`);
      return f(move);
    }),
  ).toString();

/** Canonical spelling: `R2'` -> `R2`, single spaces. */
export const normaliseAlg = (alg: string) =>
  mapMoves(alg, (m) => (Math.abs(m.amount) === 2 ? m.modified({ amount: 2 }) : m));

// Mirroring through a plane: moves turning around the axis perpendicular to it swap
// sides but keep their absolute direction (M plane: R -> L', M -> M, x -> x); every
// other move keeps its face and reverses direction (U -> U', y -> y').
// M plane = left <-> right, S plane = front <-> back.
const MIRROR_PLANES = {
  M: {
    swap: { R: "L", L: "R", r: "l", l: "r", Rw: "Lw", Lw: "Rw" } as Record<string, string>,
    axis: new Set(["R", "L", "r", "l", "Rw", "Lw", "M", "m", "x"]),
  },
  S: {
    swap: { F: "B", B: "F", f: "b", b: "f", Fw: "Bw", Bw: "Fw" } as Record<string, string>,
    axis: new Set(["F", "B", "f", "b", "Fw", "Bw", "S", "s", "z"]),
  },
};

export const mirrorAlg = (alg: string, plane: keyof typeof MIRROR_PLANES = "M") => {
  const { swap, axis } = MIRROR_PLANES[plane];
  return normaliseAlg(
    mapMoves(alg, (m) => {
      const family = swap[m.family] ?? m.family;
      const keepDirection = axis.has(m.family) && !(m.family in swap);
      return m.modified({ family, amount: keepDirection ? m.amount : -m.amount });
    }),
  );
};

/** The alg seen from the other side of the cube (a y2 turn): both mirrors combined. */
export const turnAlg = (alg: string) => mirrorAlg(mirrorAlg(alg, "M"), "S");

const SIDE_FACES = ["F", "R", "B", "L"];

/** Relabels side faces by `steps` quarter turns (F->R->B->L), for face-turn-only algs. */
export const relabelSides = (alg: string, steps: number) =>
  mapMoves(alg, (m) => {
    const i = SIDE_FACES.indexOf(m.family);
    if (i === -1) {
      if (m.family === "U" || m.family === "D") return m;
      throw new Error(`relabelSides only supports face turns, got "${m}"`);
    }
    return m.modified({ family: SIDE_FACES[(i + steps + 4) % 4] });
  });

type Face = "U" | "D" | "F" | "B" | "R" | "L";
const FACES: Face[] = ["U", "D", "F", "B", "R", "L"];

/**
 * Each whole-cube rotation as the face cycle it makes, in the direction of its face turn
 * (x like R, y like U, z like F): after the rotation, a position holds the face that sat
 * one step before it in the cycle.
 */
const ROTATION_CYCLES: Record<string, Face[]> = { x: ["F", "U", "B", "D"], y: ["R", "F", "L", "B"], z: ["U", "R", "D", "L"] };

/**
 * Wide and slice moves as a face turn plus a whole-cube rotation, so they come out as face
 * turns: a wide move turns the opposite face the same way and rotates the cube with it
 * (`r` = `L x`, `d` = `U y'`), a slice turns both faces back and rotates (`M` = `R L' x'`).
 * Each entry: the face turns (amount multiplier) and the rotation (same).
 */
const SPLIT: Record<string, { turns: [Face, number][]; rotation: [string, number] }> = {
  R: { turns: [["L", 1]], rotation: ["x", 1] },
  L: { turns: [["R", 1]], rotation: ["x", -1] },
  U: { turns: [["D", 1]], rotation: ["y", 1] },
  D: { turns: [["U", 1]], rotation: ["y", -1] },
  F: { turns: [["B", 1]], rotation: ["z", 1] },
  B: { turns: [["F", 1]], rotation: ["z", -1] },
  M: { turns: [["R", 1], ["L", -1]], rotation: ["x", -1] },
  E: { turns: [["U", 1], ["D", -1]], rotation: ["y", -1] },
  S: { turns: [["F", -1], ["B", 1]], rotation: ["z", 1] },
};

/** The alg's moves with wide and slice moves split into face turns and rotations (see SPLIT). */
function splitWideAndSlice(alg: string): Move[] {
  return [...new Alg(alg).experimentalExpand()].flatMap((node) => {
    const m = node.as(Move);
    if (!m) throw new Error(`unsupported alg node "${node}" in "${alg}"`);
    const wide = /^[RLUDFB]w$/.test(m.family) || /^[rludfb]$/.test(m.family);
    const key = wide ? m.family[0].toUpperCase() : m.family;
    if (!wide && !"MES".includes(key)) return [m];
    const { turns, rotation } = SPLIT[key];
    return [
      ...turns.map(([face, k]) => new Move(face, m.amount * k)),
      new Move(rotation[0], m.amount * rotation[1]),
    ];
  });
}

/** Opposite faces, in the order a canonical alg writes them when they're turned together. */
const AXES: Face[][] = [["U", "D"], ["R", "L"], ["F", "B"]];

/**
 * Canonical face turns: consecutive turns on one axis (opposite faces commute) merged per
 * face, written in AXES order, amounts as -1, 1 or 2. `U D U'` -> `D`, `D U` -> `U D`.
 */
function mergeTurns(moves: Move[]): Move[] {
  let out = moves;
  for (let changed = true; changed; ) {
    changed = false;
    const next: Move[] = [];
    for (let i = 0; i < out.length; ) {
      const axis = AXES.find((a) => a.includes(out[i].family as Face))!;
      let j = i;
      const sum = new Map<string, number>();
      for (; j < out.length && axis.includes(out[j].family as Face); j++)
        sum.set(out[j].family, (sum.get(out[j].family) ?? 0) + out[j].amount);
      for (const face of axis) {
        const turns = (((sum.get(face) ?? 0) % 4) + 4) % 4;
        if (turns) next.push(new Move(face, turns === 3 ? -1 : turns));
      }
      i = j;
    }
    changed = next.length !== out.length || next.some((m, k) => !m.isIdentical(out[k]));
    out = next;
  }
  return out;
}

/**
 * The alg with its whole-cube rotations taken out: as face turns only, on the cube as it
 * was first held (`y R` -> `B`, `d R'` -> `U B'`), in canonical form (see mergeTurns).
 * Wide and slice moves count as a face turn plus a rotation (see SPLIT). The rotation the
 * alg leaves behind is dropped. Algs that turn the cube's layers the same way, whatever
 * their grip, give the same text.
 */
export function rotationless(alg: string): string {
  // at[position] = the face (as first held) now at that position.
  let at = Object.fromEntries(FACES.map((f) => [f, f])) as Record<Face, Face>;
  const out: Move[] = [];
  for (const m of splitWideAndSlice(alg)) {
    const turns = ((m.amount % 4) + 4) % 4;
    const cycle = ROTATION_CYCLES[m.family];
    if (cycle) {
      for (let t = 0; t < turns; t++) {
        const next = { ...at };
        cycle.forEach((pos, i) => (next[cycle[(i + 1) % 4]] = at[pos]));
        at = next;
      }
      continue;
    }
    if (!FACES.includes(m.family as Face)) throw new Error(`rotationless: unsupported move "${m}" in "${alg}"`);
    if (turns) out.push(new Move(at[m.family as Face], m.amount));
  }
  return new Alg(mergeTurns(out)).toString();
}

/**
 * The alg as done on the slot it's for, seen from front-right: rotations taken out and
 * the cube turned so the slot is at front-right (FL `U F U' F'` -> `U R U' R'`). The same
 * alg in any slot, with or without a regrip, has one local form.
 */
export const localForm = (alg: string, slot: "FR" | "FL" | "BR" | "BL") =>
  rotationless(`${LOCAL_ROTATION[slot]} ${alg}`.trim());

/** The y rotation that brings each slot to front-right. */
const LOCAL_ROTATION = { FR: "", FL: "y", BR: "y'", BL: "y2" };

/**
 * A local form's mirror image, also seen from front-right: the alg mirrored left-right
 * (now for front-left) and turned back to front-right. Swaps R and F (`R U R'` ->
 * `F' U' F`) and solves the mirror case.
 */
export const localMirror = (local: string) => localForm(mirrorAlg(local, "M"), "FL");

/**
 * Edge orientation of the pair's edge after `setup`: true ("good edge") if it can be
 * solved with R, L, U and D turns alone, false ("bad edge") if it needs an F/B quarter
 * turn (or a rotation). cubing.js's edge orientation is exactly this: only F and B turns
 * flip edges. A setup that leaves every F2L edge in place has a good edge.
 */
export function pairEdgeOriented(setup: string): boolean {
  const { pieces, orientation } = solved.applyAlg(setup).patternData.EDGES;
  for (const edge of f2lPieces.EDGES) {
    const at = pieces.indexOf(edge);
    if (at !== edge || orientation[at]) return orientation[at] === 0;
  }
  return true;
}

export const isFaceTurnsOnly = (alg: string) => /^[URFDLB2' ]*$/.test(alg);

export const samePattern = (a: string, b: string) => solved.applyAlg(a).isIdentical(solved.applyAlg(b));
