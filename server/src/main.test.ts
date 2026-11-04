// The server's public HTTP surface, end to end: the real server (main.ts) on a free port with
// an empty data dir, every tool registered. Tools' own behaviour is tested next to them.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

let server: ChildProcess;
let base = "";
const dataDir = mkdtempSync(join(tmpdir(), "cubetrainer-http-"));

const freePort = () =>
  new Promise<number>((done) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => done(port));
    });
  });

before(async () => {
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn("node", ["--disable-warning=ExperimentalWarning", join(import.meta.dirname, "main.ts")], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise<void>((ready) => server.stdout!.on("data", (d: Buffer) => String(d).includes("Cubetrainer server on") && ready()));
});

after(() => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

const call = async (method: string, path: string, body?: unknown, raw?: string) => {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined || raw ? { "Content-Type": "application/json" } : undefined,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: res.status, body: (await res.json()) as any };
};

test("tool routes answer under /api/<tool>/", async () => {
  const solves = await call("GET", "/api/timer/solves");
  assert.equal(solves.status, 200);
  assert.deepEqual(solves.body, { solves: [] });
  assert.equal((await call("GET", "/api/f2l/progress")).status, 200);
});

test("exposed calls answer over HTTP like the tool's own API", async () => {
  const id = crypto.randomUUID();
  await call("PUT", `/api/timer/solves/${id}`, { ms: 12000, penalty: "ok", scramble: "R U", solvedAt: "2026-11-04T10:00:00.000Z" });
  const exposed = await call("GET", "/api/timer/exposed/solves");
  assert.equal(exposed.status, 200);
  assert.deepEqual(exposed.body, (await call("GET", "/api/timer/solves")).body);
  assert.equal((await call("GET", "/api/timer/exposed/nothing")).status, 404);
  assert.equal((await call("POST", "/api/timer/exposed/solves")).status, 405);
  assert.equal((await call("GET", "/api/f2l/exposed/active-cases")).status, 200);
});

test("a capability nobody provides gathers nothing", async () => {
  assert.deepEqual(await call("GET", "/api/_/capabilities/case-observations"), { status: 200, body: { results: [] } });
});

test("settings are stored per owner and read back whole", async () => {
  assert.equal((await call("PUT", "/api/_/settings/f2l", { focusMissing: true })).status, 200);
  assert.deepEqual((await call("GET", "/api/_/settings")).body.settings.f2l, { focusMissing: true });
  assert.equal((await call("PUT", "/api/_/settings/f2l", [1, 2])).status, 400);
  assert.equal((await call("GET", "/api/_/settings/f2l")).status, 405);
});

test("the info endpoint says which branch and data it runs on", async () => {
  const info = await call("GET", "/api/_/info");
  assert.equal(info.status, 200);
  assert.equal(info.body.dataDir, dataDir);
  assert.equal(typeof info.body.branch, "string");
});

test("errors: unknown tool or path 404, wrong method 405, bad body 400", async () => {
  assert.deepEqual(await call("GET", "/api/nothing/here"), { status: 404, body: { error: "Not found" } });
  assert.equal((await call("GET", "/api/timer/nothing")).status, 404);
  assert.deepEqual(await call("POST", "/api/timer/solves"), { status: 405, body: { error: "Method not allowed" } });
  assert.equal((await call("PUT", `/api/timer/solves/${crypto.randomUUID()}`, undefined, "{not json")).status, 400);
  const extra = await call("PUT", `/api/f2l/progress/f2l-1-FR`, { mainAlg: null, extra: 1 });
  assert.deepEqual(extra, { status: 400, body: { error: "Unknown field(s): extra" } });
});
