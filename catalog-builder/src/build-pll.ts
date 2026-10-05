// Builds catalog/pll.json from SpeedCubeDB's PLL page (raw/speedcubedb/PLL.html,
// fetched on first run): the 21 cases with their group, a few algs, rotation-free
// scrambles and what to draw for each case's icon.
//
// Scrambles are the inverses of the case's algs, rewritten without rotations, wide or
// slice moves (so they can be read and done with the cube held still), and checked with
// cubing.js: F2L stays solved, the last layer stays oriented, and every scramble gives
// the same case (up to AUF).
import { mkdir, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import { Alg, Move } from "cubing/alg";
import type { KPattern } from "cubing/kpuzzle";
import type { PllArrow, PllCase, PllCatalog } from "../../shared/pll/catalog.ts";
import { cube3x3x3 } from "cubing/puzzles";
import { fetchCached, forceFlag } from "./http.ts";

const URL = "https://speedcubedb.com/a/3x3/PLL";
const RAW_PATH = "raw/speedcubedb/PLL.html";
const OUT_PATH = "../catalog/pll.json";
/** Scrambles kept per case (one per alg that checks out). */
const MAX_SCRAMBLES = 4;
const MAX_ALGS = 3;

const GROUPS: Record<string, string> = {
  EPLL: "Edges only",
  "Adj Swap": "Adjacent corner swap",
  "Opp Swap": "Diagonal corner swap",
};

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

// --- Rewriting an alg as face turns only ----------------------------------------------

type Face = "U" | "D" | "R" | "L" | "F" | "B";
/** Which face (of the cube held as at the start) each face name currently refers to. */
type Frame = Record<Face, Face>;

/** One quarter turn of each rotation: the face that ends up at each position. */
const ROTATE: Record<"x" | "y" | "z", Partial<Record<Face, Face>>> = {
  x: { U: "F", F: "D", D: "B", B: "U" },
  y: { F: "R", R: "B", B: "L", L: "F" },
  z: { R: "U", U: "L", L: "D", D: "R" },
};

/** Wide and slice moves as face turns (same direction as the move) plus a rotation. */
const AS_FACES: Record<string, { faces: [Face, number][]; rotation: "x" | "y" | "z"; sign: number }> = {
  r: { faces: [["L", 1]], rotation: "x", sign: 1 },
  l: { faces: [["R", 1]], rotation: "x", sign: -1 },
  u: { faces: [["D", 1]], rotation: "y", sign: 1 },
  d: { faces: [["U", 1]], rotation: "y", sign: -1 },
  f: { faces: [["B", 1]], rotation: "z", sign: 1 },
  b: { faces: [["F", 1]], rotation: "z", sign: -1 },
  M: { faces: [["R", 1], ["L", -1]], rotation: "x", sign: -1 },
  E: { faces: [["U", 1], ["D", -1]], rotation: "y", sign: -1 },
  S: { faces: [["F", -1], ["B", 1]], rotation: "z", sign: 1 },
};

const mod4 = (n: number) => ((n % 4) + 4) % 4;
const moveText = (face: Face, amount: number) => face + ["", "", "2", "'"][mod4(amount)];

function stripRotations(alg: string): string {
  let frame: Frame = { U: "U", D: "D", R: "R", L: "L", F: "F", B: "B" };
  const out: [Face, number][] = [];
  const rotate = (axis: "x" | "y" | "z", amount: number) => {
    for (let i = 0; i < mod4(amount); i++) {
      const next = { ...frame };
      for (const [to, from] of Object.entries(ROTATE[axis])) next[to as Face] = frame[from];
      frame = next;
    }
  };
  const push = (face: Face, amount: number) => {
    const physical = frame[face];
    const last = out.at(-1);
    if (last?.[0] === physical) {
      last[1] = mod4(last[1] + amount);
      if (last[1] === 0) out.pop();
    } else if (mod4(amount)) out.push([physical, mod4(amount)]);
  };

  for (const node of new Alg(alg).experimentalExpand()) {
    const move = node.as(Move);
    if (!move) throw new Error(`Unsupported alg node in "${alg}": ${node}`);
    const family = move.family.endsWith("w") ? move.family[0].toLowerCase() : move.family;
    const amount = move.amount;
    if ("UDRLFB".includes(family) && family.length === 1) push(family as Face, amount);
    else if (family === "x" || family === "y" || family === "z") rotate(family, amount);
    else if (AS_FACES[family]) {
      const { faces, rotation, sign } = AS_FACES[family];
      for (const [face, dir] of faces) push(face, dir * amount);
      rotate(rotation, sign * amount);
    } else throw new Error(`Unsupported move "${move}" in "${alg}"`);
  }
  return out.map(([face, amount]) => moveText(face, amount)).join(" ");
}

// --- Checks ---------------------------------------------------------------------------

const AUFS = ["", "U", "U2", "U'"];

/** Pieces a U turn leaves alone: F2L and the centres. */
const isLastLayer = (orbit: string, i: number) => {
  const afterU = solved.applyMove("U").patternData[orbit];
  return afterU.pieces[i] !== i;
};

function isPll(p: KPattern): boolean {
  return Object.entries(p.patternData).every(([orbit, { pieces, orientation }]) =>
    pieces.every((piece, i) => !orientation[i] && (isLastLayer(orbit, i) || piece === i)),
  );
}

const same = (a: KPattern, b: KPattern) => a.isIdentical(b);
const scrambled = (scramble: string) => solved.applyAlg(scramble);

/** Same case: an AUF before and after the scramble turns one into the other. */
const sameCase = (scramble: string, target: KPattern) =>
  AUFS.some((pre) => AUFS.some((post) => same(solved.applyAlg(pre).applyAlg(scramble).applyAlg(post), target)));

const movedPieces = (p: KPattern) =>
  Object.values(p.patternData).reduce((n, { pieces }) => n + pieces.filter((piece, i) => piece !== i).length, 0);

function longestCycle(p: KPattern): number {
  let longest = 0;
  for (const { pieces } of Object.values(p.patternData)) {
    const seen = new Set<number>();
    pieces.forEach((_, start) => {
      let length = 0;
      for (let i = start; !seen.has(i); i = pieces[i], length++) seen.add(i);
      longest = Math.max(longest, length);
    });
  }
  return longest;
}

/** How the case is usually drawn: fewest pieces moving, then shortest cycles (G perms: two 3-cycles). */
const drawScore = (p: KPattern) => movedPieces(p) * 10 + longestCycle(p);

// --- Drawing data ---------------------------------------------------------------------

/** cubing.js's piece positions, named by their stickers' faces in order. */
const EDGES = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"];
const CORNERS = ["UFR", "URB", "UBL", "ULF", "DRF", "DFL", "DLB", "DBR"];

/** Top view, back at the top: [col, row] of each last-layer position on the 3x3 face. */
const CELL: Record<string, [number, number]> = {
  UBL: [0, 0], UB: [1, 0], URB: [2, 0],
  UL: [0, 1], UR: [2, 1],
  ULF: [0, 2], UF: [1, 2], UFR: [2, 2],
};

/**
 * The case as a 5x5 grid (rows joined by "/"): the U face in the middle, the top row of
 * each side folded out around it, "." in the corners. Letters are the face each sticker
 * belongs on, so the app can colour them.
 */
function stickerGrid(p: KPattern): string {
  const grid = Array.from({ length: 5 }, () => Array<string>(5).fill("."));
  for (const [names, orbit] of [[EDGES, "EDGES"], [CORNERS, "CORNERS"]] as const) {
    const { pieces, orientation } = p.patternData[orbit];
    names.forEach((name, position) => {
      if (!name.startsWith("U")) return;
      const identity = names[pieces[position]];
      const [col, row] = CELL[name];
      [...name].forEach((face, i) => {
        const shown = identity[(i + orientation[position]) % name.length];
        const [c, r] =
          face === "U" ? [col + 1, row + 1]
          : face === "B" ? [col + 1, 0]
          : face === "F" ? [col + 1, 4]
          : face === "L" ? [0, row + 1]
          : [4, row + 1];
        grid[r][c] = shown;
      });
    });
  }
  grid[2][2] = "U";
  return grid.map((row) => row.join("")).join("/");
}

/** Where each moved piece has to go to be solved, for the case solved without AUF. */
function arrows(p: KPattern): PllArrow[] {
  const out: PllArrow[] = [];
  for (const [names, orbit] of [[EDGES, "EDGES"], [CORNERS, "CORNERS"]] as const) {
    const { pieces } = p.patternData[orbit];
    const target = new Map<number, number>();
    pieces.forEach((identity, position) => identity !== position && target.set(position, identity));
    for (const [from, to] of target) {
      const both = target.get(to) === from;
      if (both && to < from) continue;
      out.push({ from: CELL[names[from]], to: CELL[names[to]], ...(both ? { both } : {}) });
    }
  }
  return out;
}

// --- Build ----------------------------------------------------------------------------

async function main() {
  const $ = cheerio.load(await fetchCached(URL, RAW_PATH, { force: forceFlag }));
  const cases: PllCase[] = [];

  for (const el of $(".singlealgorithm").toArray()) {
    const $case = $(el);
    const name = $case.attr("data-alg")!.trim();
    const subgroup = $case.attr("data-subgroup")!.trim();
    const group = GROUPS[subgroup];
    if (!group) throw new Error(`${name}: unknown subgroup "${subgroup}"`);
    const algs = [...new Set($case.find(".formatted-alg").toArray().map((a) => $(a).text().replace(/\s+/g, " ").trim()))];

    // The case at the angle (and AUF) it's usually drawn at.
    const main = new Alg(stripRotations(algs[0])).invert().toString();
    const casePattern = AUFS.flatMap((pre) => AUFS.map((post) => scrambled(`${pre} ${main} ${post}`)))
      .map((p) => ({ p, score: drawScore(p) }))
      .reduce((best, x) => (x.score < best.score ? x : best)).p;
    if (!isPll(casePattern) || same(casePattern, solved)) throw new Error(`${name}: top alg isn't a PLL: ${algs[0]}`);

    const scrambles: string[] = [];
    const goodAlgs: string[] = [];
    for (const alg of algs) {
      let scramble: string;
      try {
        scramble = stripRotations(new Alg(alg).invert().toString());
      } catch (err) {
        console.warn(`  ${name}: skipping "${alg}": ${(err as Error).message}`);
        continue;
      }
      if (!isPll(scrambled(scramble)) || !sameCase(scramble, casePattern)) {
        console.warn(`  ${name}: skipping "${alg}": not the same case`);
        continue;
      }
      goodAlgs.push(alg);
      if (!scrambles.includes(scramble)) scrambles.push(scramble);
      if (scrambles.length >= MAX_SCRAMBLES) break;
    }

    cases.push({
      id: `pll-${name}`,
      name,
      group,
      algs: goodAlgs.slice(0, MAX_ALGS),
      // Shortest first: slice-move algs turn into longer, clunkier face-turn scrambles.
      scrambles: scrambles.sort((a, b) => a.split(" ").length - b.split(" ").length),
      stickers: stickerGrid(casePattern),
      arrows: arrows(casePattern),
    });
    console.log(`${name.padEnd(3)} ${group.padEnd(22)} ${scrambles.length} scrambles  ${stickerGrid(casePattern)}`);
  }

  if (cases.length !== 21) throw new Error(`Expected 21 PLL cases, got ${cases.length}`);
  const order = Object.values(GROUPS);
  cases.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name));

  await mkdir("../catalog", { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), caseSet: { id: "pll", name: "PLL" }, cases } satisfies PllCatalog, null, 1) + "\n",
  );
  console.log(`Wrote ${cases.length} cases to ${OUT_PATH}`);
}

if (import.meta.main) await main();
