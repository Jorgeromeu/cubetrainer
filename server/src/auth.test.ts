// Signing in (auth.ts), on the real server started with AUTH_TOKEN: the API needs the token
// (header or cookie), the health check and the app's files don't.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const TOKEN = "test-token-0123456789";
let server: ChildProcess;
let base = "";
const dataDir = mkdtempSync(join(tmpdir(), "cubetrainer-auth-"));

before(async () => {
  const port = await new Promise<number>((done) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => done(port));
    });
  });
  base = `http://localhost:${port}`;
  server = spawn("node", ["--disable-warning=ExperimentalWarning", join(import.meta.dirname, "main.ts")], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, AUTH_TOKEN: TOKEN },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise<void>((ready) => server.stdout!.on("data", (d: Buffer) => String(d).includes("Cubetrainer server on") && ready()));
});

after(() => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

const status = async (path: string, headers: Record<string, string> = {}) => (await fetch(base + path, { headers, redirect: "manual" })).status;

test("the API needs the token, as a bearer header", async () => {
  assert.equal(await status("/api/timer/solves"), 401);
  assert.equal(await status("/api/timer/solves", { Authorization: "Bearer wrong" }), 401);
  assert.equal(await status("/api/timer/solves", { Authorization: `Bearer ${TOKEN}` }), 200);
});

test("/login with the token sets a cookie that signs the browser in", async () => {
  assert.equal(await status("/login?token=wrong"), 401);
  const res = await fetch(`${base}/login?token=${TOKEN}`, { redirect: "manual" });
  assert.equal(res.status, 302);
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  assert.match(res.headers.get("set-cookie")!, /HttpOnly/);
  assert.equal(await status("/api/timer/solves", { Cookie: cookie }), 200);
});

test("the health check answers without signing in", async () => {
  assert.equal(await status("/api/_/health"), 200);
});
