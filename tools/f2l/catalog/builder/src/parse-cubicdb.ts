// Parses cubicdb's algs.db into data/cubicdb-f2l.json (FR slot only).
import { statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Alg } from "cubing/alg";
import { ALGS_DB_PATH } from "./fetch-cubicdb.ts";
import { normaliseMoves, type SourceCase, type SourceDataset } from "./types.ts";

const OUT_PATH = "data/cubicdb-f2l.json";

interface CubicdbEntry {
  name: string;
  parentPath: string;
  scramble: string;
  solutions?: { moves: string; votes: number }[];
}

async function main() {
  const entries = (await readFile(ALGS_DB_PATH, "utf8"))
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as CubicdbEntry)
    .filter((e) => e.parentPath === "333/f2l" && /^F2L \d+$/.test(e.name));

  const cases: SourceCase[] = entries
    .map((e) => ({
      number: Number.parseInt(e.name.slice(4)),
      name: e.name,
      // "scramble" is actually one of the solving algs, so the setup is its inverse.
      setups: { FR: new Alg(normaliseMoves(e.scramble)).invert().toString() },
      algs: { FR: (e.solutions ?? []).map((s, rank) => ({ moves: normaliseMoves(s.moves), rank })) },
    }))
    .sort((a, b) => a.number - b.number);

  const dataset: SourceDataset = {
    source: "cubicdb",
    sourceUrl: "https://github.com/isaacvr/cubicdb/blob/HEAD/src/database/algs.db",
    collectedAt: statSync(ALGS_DB_PATH).mtime.toISOString(),
    notes: [
      "FR slot only. No votes (all 0) or other metadata.",
      "cubicdb's \"scramble\" field is a solving alg; setups here are its inverse.",
    ],
    cases,
  };

  await mkdir("data", { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(dataset, null, 2) + "\n");
  const total = cases.reduce((n, c) => n + c.algs.FR!.length, 0);
  console.log(`Wrote ${OUT_PATH}: ${cases.length} cases, ${total} algs.`);
}

if (import.meta.main) await main();
