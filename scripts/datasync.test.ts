import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDb } from "../server/src/db.ts";
import { solvesRepository } from "../tools/timer/server/solves.ts";
import { diff, push } from "./datasync.ts";

const MIGRATIONS = join(import.meta.dirname, "../tools/timer/server/migrations");
const solve = (ms: number) => ({ ms, penalty: "ok", scramble: "R U", solvedAt: new Date(Date.UTC(2026, 10, 4, 0, 0, ms % 60)).toISOString() });

/** main/ with one timed solve, and wt/ a copy of it. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "datasync-"));
  const main = openDb(join(dir, "main", "timer.sqlite"), MIGRATIONS);
  solvesRepository(main).put(crypto.randomUUID(), solve(10_000));
  main.close();
  openDb(join(dir, "wt", "x.sqlite"), MIGRATIONS).close(); // creates wt/
  copyFileSync(join(dir, "main", "timer.sqlite"), join(dir, "wt", "timer.sqlite"));
  return { dir, mainDir: join(dir, "main"), wtDir: join(dir, "wt") };
}

test("diff counts rows main doesn't have, and DBs it doesn't have", () => {
  const { mainDir, wtDir } = setup();
  const wt = openDb(join(wtDir, "timer.sqlite"), MIGRATIONS);
  solvesRepository(wt).put(crypto.randomUUID(), solve(12_000));
  wt.close();
  const d = diff(wtDir, mainDir);
  assert.deepEqual(
    d.map((x) => [x.file, x.newDb, x.rows]),
    [
      ["timer.sqlite", false, 1],
      ["x.sqlite", true, 0],
    ],
  );
});

test("push adds the new rows, backs main up, and leaves main's own rows alone", () => {
  const { mainDir, wtDir } = setup();
  const wt = openDb(join(wtDir, "timer.sqlite"), MIGRATIONS);
  const wtSolves = solvesRepository(wt);
  wtSolves.put(crypto.randomUUID(), solve(12_000));
  wtSolves.import({ format: "cubetime", text: "Time,Date\n15.00,2026-09-19 12:09:02 PM +0000\n" }); // import row + its solve (FK)
  wt.close();

  const { backups } = push(wtDir, mainDir, "test");
  assert.equal(backups.length, 1);
  const main = openDb(join(mainDir, "timer.sqlite"), MIGRATIONS);
  const solves = solvesRepository(main);
  assert.equal(solves.list().length, 3);
  assert.equal(solves.imports().filter((i) => i.source === "cubetime").length, 1);
  main.close();
  assert.equal(diff(wtDir, mainDir).filter((d) => !d.newDb).length, 0); // nothing left to push
});

test("push refuses when the migration versions differ", () => {
  const { mainDir, wtDir } = setup();
  const wt = openDb(join(wtDir, "timer.sqlite"), MIGRATIONS);
  solvesRepository(wt).put(crypto.randomUUID(), solve(12_000));
  wt.exec("PRAGMA user_version = 6");
  wt.close();
  assert.throws(() => push(wtDir, mainDir, "test"), /restart main's server/);
});
