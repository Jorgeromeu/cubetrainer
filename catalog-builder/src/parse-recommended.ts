// Parses the recommended-algs PDFs (fetch-recommended.ts) into data/recommended-f2l.json:
// every line of either sheet that reads as an alg, with where it was. Nothing here knows
// the cases: the sheets don't print case numbers in their text (they're pictures), so
// build-catalog finds each alg's slot-case by checking which one it solves. Lines that
// aren't algs (headings, notes) are dropped; advanced cases, which aren't in the catalog,
// are kept here and dropped by build-catalog.
//
// Both sheets are laid out in two columns. A PDF's text comes as positioned fragments
// (CubeSkills splits `U2'` into `U`, `2`, `'`), so fragments are grouped into lines by
// column and height, and joined in order, with a space wherever they don't touch.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { Alg } from "cubing/alg";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { RECOMMENDED_SOURCES } from "./fetch-recommended.ts";
import { normaliseMoves } from "./types.ts";

const OUT_PATH = "data/recommended-f2l.json";

/** What the sheets are, for the app's badges (packages/core/catalog/f2l.ts RECOMMENDERS). */
const NOTES: Record<(typeof RECOMMENDED_SOURCES)[number]["id"], string> = {
  jperm:
    "J Perm, Best F2L Algorithms (updated 2021-08-08). FR: the left column is the case, the right column its mirror case " +
    "done with a y and the left hand. Highlighted algs (that need another slot empty) solve no case as-is.",
  cubeskills:
    "CubeSkills F2L Algorithms – All Four Slot Angles, by Feliks Zemdegs and Andy Klise: FR, BR, FL, BL. The sheet marks " +
    "one alg per case as suggested by layout, which its text doesn't carry: every alg on it counts as recommended.",
};

export interface RecommendedAlg {
  /** As printed, whitespace-normalised (parentheses kept). */
  moves: string;
  page: number;
  column: 0 | 1;
}

export interface RecommendedDataset {
  collectedAt: string;
  sources: { id: string; note: string; algs: RecommendedAlg[] }[];
}

/** A line of move notation: moves, primes, digits, parentheses (and nothing else). */
const ALG_LINE = /^[RLUDFBrludfbMESxyz0-9'()\s]+$/;

async function algLines(path: string): Promise<RecommendedAlg[]> {
  const doc = await getDocument({ data: new Uint8Array(await readFile(path)), verbosity: 0 }).promise;
  const out: RecommendedAlg[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const middle = page.getViewport({ scale: 1 }).width / 2;
    const items = (await page.getTextContent()).items.flatMap((it) =>
      "str" in it && it.str ? [{ text: it.str, x: it.transform[4], y: it.transform[5], width: it.width }] : [],
    );
    // Lines: per column, fragments within 2pt of height of each other.
    const lines: { column: 0 | 1; y: number; parts: typeof items }[] = [];
    for (const it of items) {
      const column = it.x < middle ? 0 : 1;
      const line = lines.find((l) => l.column === column && Math.abs(l.y - it.y) <= 2);
      if (line) line.parts.push(it);
      else lines.push({ column, y: it.y, parts: [it] });
    }
    lines.sort((a, b) => a.column - b.column || b.y - a.y);
    const texts = lines.map(({ column, y, parts }) => {
      parts.sort((a, b) => a.x - b.x);
      let text = "";
      let end = -Infinity;
      for (const part of parts) {
        if (text && part.x - end > 1.5 && !/\s$/.test(text) && !/^\s/.test(part.text)) text += " ";
        text += part.text;
        end = part.x + part.width;
      }
      return { column, y, text: normaliseMoves(text) };
    });
    // A long alg wraps: a line that leaves a parenthesis open goes on in the line just
    // below it, in the same column.
    const open = (text: string) => (text.match(/\(/g)?.length ?? 0) > (text.match(/\)/g)?.length ?? 0);
    for (let i = 0; i < texts.length - 1; i++) {
      const [line, next] = [texts[i], texts[i + 1]];
      if (open(line.text) && next.column === line.column && line.y - next.y < 20) {
        line.text = `${line.text} ${next.text}`;
        texts.splice(i + 1, 1);
        i--;
      }
    }
    for (const { column, text: moves } of texts) {
      if (!ALG_LINE.test(moves) || !/[RLUDFBrludfbMES]/.test(moves)) continue;
      try {
        new Alg(moves);
      } catch {
        continue;
      }
      out.push({ moves, page: p, column });
    }
  }
  return out;
}

async function main() {
  const sources = [];
  let collectedAt = "";
  for (const { id, path } of RECOMMENDED_SOURCES) {
    const algs = await algLines(path);
    console.log(`${id}: ${algs.length} alg lines`);
    sources.push({ id, note: NOTES[id], algs });
    const { mtime } = await stat(path);
    if (mtime.toISOString() > collectedAt) collectedAt = mtime.toISOString();
  }
  const dataset: RecommendedDataset = { collectedAt, sources };
  await mkdir("data", { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(dataset, null, 1) + "\n");
  console.log(`Wrote ${OUT_PATH}.`);
}

if (import.meta.main) await main();
