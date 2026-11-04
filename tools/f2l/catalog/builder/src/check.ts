// Sanity-checks the collected data with cubing.js and writes data/check-report.json.
//
// For every (source, case, slot, alg): find an AUF u such that
//   setup(slot) + u + alg
// leaves the cross and all four F2L slots solved (whole-cube rotations in the alg
// are allowed). Sources only publish FR setups, so the setup for another slot is
// the FR setup conjugated by a y rotation; which rotation maps FR to which slot is
// found from the data and reported, not assumed.
import { readFile, writeFile } from "node:fs/promises";
import { conjugate, disturbedF2LPieces, solved, solvingAuf, Y_ROTATIONS } from "./cube.ts";
import { SLOTS, type Slot, type SourceDataset } from "./types.ts";

interface Failure {
  case: number;
  slot: Slot;
  rank: number;
  moves: string;
  votes?: number;
  reason: string;
}

async function checkDataset(path: string, ref?: SourceDataset) {
  const ds: SourceDataset = JSON.parse(await readFile(path, "utf8"));
  const refSetup = (n: number) => ref?.cases.find((c) => c.number === n)?.setups.FR;

  // 1. Which y-conjugation of the FR setup gives each slot? Vote over all algs.
  const slotRotation: Partial<Record<Slot, string>> = { FR: "" };
  for (const slot of SLOTS.filter((s) => s !== "FR")) {
    const score = new Map(Y_ROTATIONS.map((r) => [r, 0]));
    for (const c of ds.cases) {
      const setup = refSetup(c.number) ?? c.setups.FR!;
      for (const a of (c.algs[slot] ?? []).slice(0, 4)) {
        for (const r of Y_ROTATIONS) {
          try {
            if (solvingAuf(conjugate(r, setup), a.moves) !== null) score.set(r, score.get(r)! + 1);
          } catch {}
        }
      }
    }
    const best = [...score].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) slotRotation[slot] = best[0];
  }

  // 2. Check every alg against its slot's setup.
  const failures: Failure[] = [];
  const stats: Record<string, { total: number; ok: number; nonZeroAuf: number }> = {};
  const caseIssues: string[] = [];
  for (const c of ds.cases) {
    const frSetup = refSetup(c.number) ?? c.setups.FR;
    if (!frSetup) {
      caseIssues.push(`case ${c.number}: no FR setup`);
      continue;
    }
    // The setup should only disturb the U layer and one corner + one edge of F2L.
    const disturbed = disturbedF2LPieces(solved.applyAlg(frSetup));
    if ((disturbed.CORNERS ?? 0) > 1 || (disturbed.EDGES ?? 0) > 1 || (disturbed.CENTERS ?? 0) > 0) {
      caseIssues.push(`case ${c.number}: setup disturbs more than one pair ${JSON.stringify(disturbed)}`);
    }
    for (const slot of SLOTS) {
      const algs = c.algs[slot];
      if (!algs) continue;
      const s = (stats[slot] ??= { total: 0, ok: 0, nonZeroAuf: 0 });
      if (algs.length === 0) caseIssues.push(`case ${c.number} ${slot}: no algs`);
      const rot = slotRotation[slot];
      for (const a of algs) {
        s.total++;
        if (rot === undefined) {
          failures.push({ case: c.number, slot, rank: a.rank, moves: a.moves, votes: a.votes, reason: "no setup for slot" });
          continue;
        }
        let auf: string | null;
        try {
          auf = solvingAuf(conjugate(rot, frSetup), a.moves);
        } catch (err) {
          failures.push({ case: c.number, slot, rank: a.rank, moves: a.moves, votes: a.votes, reason: `parse error: ${(err as Error).message}` });
          continue;
        }
        if (auf === null) {
          failures.push({ case: c.number, slot, rank: a.rank, moves: a.moves, votes: a.votes, reason: "does not solve F2L" });
        } else {
          s.ok++;
          if (auf) s.nonZeroAuf++;
        }
      }
    }
  }

  return { source: ds.source, slotRotation, stats, caseIssues, failures };
}

const scdb = await checkDataset("data/speedcubedb-f2l.json");
const scdbData: SourceDataset = JSON.parse(await readFile("data/speedcubedb-f2l.json", "utf8"));
// cubicdb algs are checked against SpeedCubeDB's setups, which also confirms
// both sources use the same case numbering.
const cubicdb = await checkDataset("data/cubicdb-f2l.json", scdbData);

const report = { checkedAt: new Date().toISOString(), results: [scdb, cubicdb] };
await writeFile("data/check-report.json", JSON.stringify(report, null, 2) + "\n");

for (const r of report.results) {
  console.log(`\n== ${r.source} ==`);
  console.log("slot setup = FR setup conjugated by:", JSON.stringify(r.slotRotation));
  for (const [slot, s] of Object.entries(r.stats)) {
    console.log(`  ${slot}: ${s.ok}/${s.total} algs verified (${s.nonZeroAuf} need a pre-AUF)`);
  }
  if (r.caseIssues.length) console.log("  case issues:", r.caseIssues);
  console.log(`  ${r.failures.length} failures (see data/check-report.json)`);
}
