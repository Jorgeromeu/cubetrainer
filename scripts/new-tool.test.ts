// Keeps the scaffold in step with the real APIs: it creates a tool in this repo, then the
// import check, both type checks and its own tests must pass. Everything is removed after.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createTool } from "./new-tool.ts";

const ROOT = resolve(import.meta.dirname, "..");
const ID = "zz-scaffold-check";
const REGISTRIES = ["app/src/tools.ts", "server/src/tools.ts"];
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: "pipe" });

test("a scaffolded tool with a server builds, passes the import check and its tests", { timeout: 120_000 }, () => {
  const saved = REGISTRIES.map((f) => readFileSync(join(ROOT, f), "utf8"));
  try {
    createTool(ROOT, ID, { server: true, name: "Scaffold check" });
    assert.match(readFileSync(join(ROOT, "app/src/tools.ts"), "utf8"), /zzScaffoldCheckTool\]/);
    assert.match(readFileSync(join(ROOT, "server/src/tools.ts"), "utf8"), /zzScaffoldCheckTool\]/);
    run("node", ["scripts/check-imports.ts"]);
    run("node_modules/.bin/tsc", ["-p", "server/tsconfig.json"]);
    run("node_modules/.bin/tsc", ["-p", "app/tsconfig.app.json"]);
    run("node", ["--disable-warning=ExperimentalWarning", "--test", `tools/${ID}/server/items.test.ts`]);
  } finally {
    rmSync(join(ROOT, "tools", ID), { recursive: true, force: true });
    REGISTRIES.forEach((f, i) => writeFileSync(join(ROOT, f), saved[i]));
  }
});
