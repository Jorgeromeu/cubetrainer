import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { openDb } from "../../../server/src/db.ts";
import { solvesRepository } from "./solves.ts";

const fresh = () => solvesRepository(openDb(":memory:", join(import.meta.dirname, "migrations")));
const id = () => crypto.randomUUID();
const EXPORT = `Time,Comment,Scramble,Date
12.34,,R U R',2026-09-19 12:09:02 PM +0000
DNF,misfire,F R U,2026-09-19 12:10:00 PM +0000
`;

test("a solve timed here is saved once, with source timer and no import", () => {
  const solves = fresh();
  const sid = id();
  const body = { ms: 15234, penalty: "ok", scramble: "R U F", solvedAt: "2026-11-04T10:00:00.000Z" };
  const saved = solves.put(sid, body);
  assert.equal(saved.source, "timer");
  assert.equal(saved.importId, null);
  assert.equal(saved.penaltyKnown, true);
  assert.deepEqual(solves.put(sid, { ...body, ms: 1 }), saved); // a retry returns it as it was
  assert.equal(solves.list().length, 1);
});

test("penalties can be set, and only solves timed here can be deleted", () => {
  const solves = fresh();
  const sid = id();
  solves.put(sid, { ms: 9000, penalty: "ok", scramble: "", solvedAt: "2026-11-04T10:00:00.000Z" });
  assert.equal(solves.patch(sid, { penalty: "+2" }).penalty, "+2");
  solves.import({ format: "cubetime", text: EXPORT });
  const imported = solves.list().find((s) => s.source === "cubetime")!;
  assert.throws(() => solves.remove(imported.id), /exclude them/);
  solves.remove(sid);
  assert.equal(solves.list().length, 2);
});

test("an import is recorded and tags its solves; re-importing adds nothing; undoing removes them", () => {
  const solves = fresh();
  const first = solves.import({ format: "cubetime", text: EXPORT, fileName: "session.csv" });
  assert.equal(first.added, 2);
  assert.equal(first.import?.fileName, "session.csv");
  assert.ok(solves.list().every((s) => s.importId === first.import!.id && s.source === "cubetime"));

  const again = solves.import({ format: "cubetime", text: EXPORT });
  assert.deepEqual([again.added, again.skipped, again.import], [0, 2, null]);
  assert.equal(solves.imports().length, 1);

  solves.patch(solves.list()[0].id, { excluded: true, reason: "test" });
  solves.removeImport(first.import!.id);
  assert.equal(solves.list().length, 0);
  assert.equal(solves.imports().length, 0);
});
