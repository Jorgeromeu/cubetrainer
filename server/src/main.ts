// The server: each tool's API under /api/<id>/ (tools.ts lists them, tool.ts says
// what one provides), each with its own SQLite file in the data dir. Tools read each
// other's data only through exposed calls (registry.ts), also served here:
//   GET /api/<tool>/exposed/<name>?args       -> that call's result (404 if not there)
//   GET /api/_/capabilities/<name>?args       -> CapabilityResponse: every provider's
//   GET /api/_/info                           -> DevInfo: branch, checkout and data (the shell's badge)
//   GET /api/_/health                         -> { ok: true }, without signing in (hosts' health checks)
//   GET /login?token=...                      -> signs this browser in (only with AUTH_TOKEN; auth.ts)
//   GET /api/_/settings, PUT /api/_/settings/<owner>   the settings store (settings/store.ts)
//
// In a git worktree, the first start copies main's data and picks free ports (scripts/devenv.ts).
//
// When ../app/dist exists (after `npm run build`), it also serves the built app, so one
// process runs everything. In development Vite proxies /api here instead.
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { DEV_INFO_PATH, type DevInfo } from "../../packages/core/devInfo.ts";
import { SETTINGS_PATH } from "../../packages/core/settings.ts";
import type { CapabilityName, CapabilityResponse } from "../../packages/core/exposed.ts";
import { unpushedRows } from "../../scripts/datasync.ts";
import { branch, checkout, copiedAt, copyMainData, devPorts, hasToolDbs, mainDataDir } from "../../scripts/devenv.ts";
import { auth } from "./auth.ts";
import { openDb } from "./db.ts";
import { json, matchRoute, readJson } from "./http.ts";
import { Registry } from "./registry.ts";
import { SETTINGS_MIGRATIONS, settingsDbPath, settingsStore } from "./settings/store.ts";
import { InvalidRequest } from "./tool.ts";
import { TOOLS } from "./tools.ts";

const ROOT = join(import.meta.dirname, "../..");
const CHECKOUT = checkout(ROOT);
const PORT = Number(process.env.PORT ?? (await devPorts(CHECKOUT)).server);
const DATA_DIR = resolve(process.env.DATA_DIR ?? join(ROOT, "data"));
const MAIN_DATA_DIR = resolve(mainDataDir(CHECKOUT));
const DIST = join(ROOT, "app/dist");
const AUTH = auth(process.env.AUTH_TOKEN || undefined);
/** For a host's health checks: answered without signing in. */
const HEALTH_PATH = "/api/_/health";

// A worktree's first start: its own copy of main's data, before any tool opens a DB.
if (CHECKOUT.isWorktree && DATA_DIR !== MAIN_DATA_DIR && !hasToolDbs(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
  const files = copyMainData(CHECKOUT, DATA_DIR);
  console.log(`Worktree: copied ${files.length} DB(s) from ${MAIN_DATA_DIR} into ${DATA_DIR} (npm run data:pull refreshes it)`);
}

const devInfo = (): DevInfo => ({
  branch: branch(CHECKOUT),
  checkout: CHECKOUT.isWorktree ? "worktree" : "main",
  root: ROOT,
  dataDir: DATA_DIR,
  mainDataDir: MAIN_DATA_DIR,
  copiedAt: copiedAt(DATA_DIR),
  unpushed: DATA_DIR === MAIN_DATA_DIR ? 0 : unpushedRows(DATA_DIR, MAIN_DATA_DIR),
  serverPort: PORT,
});

const settings = settingsStore(openDb(settingsDbPath(DATA_DIR), SETTINGS_MIGRATIONS));

const registry = new Registry(TOOLS, (id) => ({
  repoRoot: ROOT,
  openDb: (migrationsDir) => openDb(join(DATA_DIR, `${id}.sqlite`), migrationsDir),
}));
for (const [id, mounted] of registry.mounted)
  if (!("failure" in mounted))
    console.log(`Tool ${id}: ${mounted.routes.length} routes${mounted.exposes.size ? `, exposes ${[...mounted.exposes.keys()].join(", ")}` : ""}`);

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  const path = url.pathname;
  const method = req.method ?? "GET";
  const args = Object.fromEntries(url.searchParams);

  if (path === DEV_INFO_PATH) return json(res, 200, devInfo());
  if (path === SETTINGS_PATH) {
    if (method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, settings.list());
  }
  const owner = path.startsWith(SETTINGS_PATH + "/") ? decodeURIComponent(path.slice(SETTINGS_PATH.length + 1)) : undefined;
  if (owner !== undefined) {
    if (method !== "PUT") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, settings.put(owner, await readJson(req)));
  }

  const capability = path.match(/^\/api\/_\/capabilities\/([a-z0-9-]+)$/)?.[1];
  if (capability) {
    if (method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, { results: registry.gather(capability as CapabilityName, args) } satisfies CapabilityResponse<CapabilityName>);
  }

  const [, id, rest = ""] = path.match(/^\/api\/([^/]+)(\/.*)?$/) ?? [];
  const tool = id ? registry.mounted.get(id) : undefined;
  if (!tool) return json(res, 404, { error: "Not found" });
  if ("failure" in tool) return json(res, 503, { error: tool.failure });

  const exposedName = rest.match(/^\/exposed\/([^/]+)$/)?.[1];
  if (exposedName) {
    const impl = tool.exposes.get(exposedName);
    if (!impl) return json(res, 404, { error: "Not found" });
    if (method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, impl.handle(args) ?? null);
  }

  const match = matchRoute(tool.routes, method, rest);
  if (!("route" in match)) return match.methodMismatch ? json(res, 405, { error: "Method not allowed" }) : json(res, 404, { error: "Not found" });
  const body = method === "GET" || method === "DELETE" ? undefined : await readJson(req);
  json(res, 200, (await match.route.handle({ params: match.params, body })) ?? null);
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

async function serveApp(res: ServerResponse, path: string) {
  // Hash routing: every page is index.html, so only real files need resolving.
  const file = join(DIST, normalize(path === "/" ? "/index.html" : path));
  try {
    const body = await readFile(file.startsWith(DIST) ? file : join(DIST, "index.html"));
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}

const serveDist = existsSync(DIST);

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  try {
    if (path === "/login") return AUTH.login(req, res, url);
    if (path === HEALTH_PATH) return json(res, 200, { ok: true });
    if (path.startsWith("/api/") && !AUTH.allows(req)) return json(res, 401, { error: "Not signed in: open /login?token=<token> once" });
    if (path.startsWith("/api/")) await handleApi(req, res, url);
    else if (serveDist) await serveApp(res, path);
    else res.writeHead(404).end("No built app (run npm run build in app/), API only");
  } catch (e) {
    if (e instanceof InvalidRequest) return json(res, 400, { error: e.message });
    console.error(e);
    json(res, 500, { error: "Internal error" });
  }
}).listen(PORT, () => {
  console.log(`Cubetrainer server on http://localhost:${PORT} (${branch(CHECKOUT) ? `branch ${branch(CHECKOUT)}` : "deployed"}, data: ${DATA_DIR})`);
  if (AUTH.enabled) console.log("Signing in required (AUTH_TOKEN): the API answers 401 without the token");
  if (serveDist) console.log(`Serving the built app from ${DIST}`);
});
