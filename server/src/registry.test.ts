import assert from "node:assert/strict";
import { test } from "node:test";
import { exposed, provides } from "../../packages/core/exposed.ts";
import type { CaseObservations } from "../../packages/core/observations.ts";
import { Registry } from "./registry.ts";
import { implement, type ServerTool, type ToolContext } from "./tool.ts";

const context = () => ({ repoRoot: "/", openDb: () => assert.fail("no DB in these tests") });

const count = exposed<{ n: number }, { plus?: string }>("counter", "count");
const observed = provides("counter", "observations", "case-observations");
const observation: CaseObservations = {
  observations: [{ set: "pll", caseId: "t", at: "2026-11-04T00:00:00.000Z", executionMs: 1200, moves: "R U R'", context: "drill" }],
};

const counter: ServerTool = {
  id: "counter",
  start: () => ({
    routes: [],
    exposes: [implement(count, ({ plus }) => ({ n: 1 + Number(plus ?? 0) })), implement(observed, () => observation)],
  }),
};

/** A tool that reads `call` while handling its one route, with the given uses. */
function reader(uses: string[], read: (ctx: ToolContext) => unknown): { tool: ServerTool; get: () => unknown } {
  let ctx: ToolContext | undefined;
  return {
    tool: { id: "reader", uses, start: (c) => ((ctx = c), { routes: [] }) },
    get: () => read(ctx!),
  };
}

test("a tool reads another's exposed call in-process, with args", () => {
  const r = reader(["counter"], (ctx) => ctx.read(count, { plus: "2" }));
  new Registry([counter, r.tool], context);
  assert.deepEqual(r.get(), { n: 3 });
});

test("reading a tool that isn't installed gives undefined", () => {
  const r = reader(["counter"], (ctx) => ctx.read(count));
  new Registry([r.tool], context);
  assert.equal(r.get(), undefined);
});

test("reading without declaring the tool in uses throws", () => {
  const r = reader([], (ctx) => ctx.read(count));
  new Registry([counter, r.tool], context);
  assert.throws(r.get, /without "counter" in its uses/);
});

test("gather collects every provider of a capability", () => {
  const other: ServerTool = {
    id: "other",
    start: () => ({ routes: [], exposes: [implement(provides("other", "seen", "case-observations"), () => ({ observations: [] }))] }),
  };
  const r = reader(["case-observations"], (ctx) => ctx.gather("case-observations"));
  new Registry([counter, other, r.tool], context);
  assert.deepEqual(r.get(), [
    { tool: "counter", result: observation },
    { tool: "other", result: { observations: [] } },
  ]);
});

test("a tool can't implement another tool's call, and a failing tool is only disabled", () => {
  const thief: ServerTool = { id: "thief", start: () => ({ routes: [], exposes: [implement(count, () => ({ n: 0 }))] }) };
  const registry = new Registry([thief, counter], context);
  assert.ok("failure" in registry.mounted.get("thief")!);
  assert.deepEqual(registry.call("counter", "count", {}), { n: 1 });
  assert.equal(registry.call("thief", "count", {}), undefined);
});
