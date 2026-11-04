// npm run data:pull | data:diff | data:push, from a worktree (see devenv.ts, CLAUDE.md).
//   pull   replace this worktree's data with a fresh copy of main's (stop its server first)
//   diff   what this worktree's data has that main's doesn't
//   push   add that to main's data (after merging and restarting main's server); backs up first
import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { branch, checkout, copyMainData, isToolDb, mainDataDir } from "./devenv.ts";
import { diff, push } from "./datasync.ts";

const co = checkout(resolve(import.meta.dirname, ".."));
const dataDir = process.env.DATA_DIR ?? join(co.root, "data");
const mainDir = mainDataDir(co);
const command = process.argv[2];

if (resolve(dataDir) === resolve(mainDir)) {
  console.error("This is main's data: run the data scripts from a worktree.");
  process.exit(1);
}

function printDiff() {
  const diffs = diff(dataDir, mainDir);
  if (!diffs.length) return console.log("Nothing here that main's data doesn't have.");
  for (const d of diffs) {
    console.log(`${d.file}${d.newDb ? " (new: main has no such DB)" : ""}: ${d.rows} new row(s)` + (d.newDb ? "" : `, migration ${d.version} (main ${d.mainVersion})`));
    for (const t of d.tables) console.log(`  ${t.table}: ${t.rows}`);
  }
}

switch (command) {
  case "diff":
    printDiff();
    break;
  case "pull": {
    if (existsSync(dataDir) && readdirSync(dataDir).some(isToolDb)) {
      const aside = `${dataDir}-before-pull-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      renameSync(dataDir, aside);
      console.log(`Kept this worktree's previous data in ${aside}`);
    }
    mkdirSync(dataDir, { recursive: true });
    const files = copyMainData(co, dataDir);
    console.log(`Copied ${files.length} DB(s) from ${mainDir}: ${files.join(", ")}`);
    break;
  }
  case "push": {
    printDiff();
    const { backups, pushed } = push(dataDir, mainDir, branch(co).replace(/[^\w-]/g, "_"));
    for (const b of backups) console.log(`Backed up ${b}`);
    console.log(pushed.length ? `Pushed into ${mainDir}.` : "Nothing to push.");
    break;
  }
  default:
    console.error("Usage: node scripts/data.ts pull | diff | push");
    process.exit(1);
}
