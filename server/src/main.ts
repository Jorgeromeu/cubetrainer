// The server: each trainer's API under /api/<id>/ (trainers.ts lists them, trainer.ts says
// what one provides), each with its own SQLite file in the data dir.
//
// When ../app/dist exists (after `npm run build` in app/), it also serves the built app,
// so one process runs everything. In development Vite proxies /api here instead.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { openDb } from "./db.ts";
import { InvalidRequest, compileRoute, json, matchRoute, readJson, type CompiledRoute } from "./http.ts";
import { TRAINERS } from "./trainers.ts";

const ROOT = join(import.meta.dirname, "../..");
const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = process.env.DATA_DIR ?? join(ROOT, "data");
const DIST = join(ROOT, "app/dist");

/** Each trainer's routes, or why it couldn't start (then only it is down: 503s). */
const mounted = new Map<string, { routes: CompiledRoute[] } | { failure: string }>();

for (const trainer of TRAINERS) {
  const { id } = trainer;
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Trainer id must be lowercase letters, digits and dashes: ${id}`);
  if (mounted.has(id)) throw new Error(`Two trainers with id ${id}`);
  try {
    const routes = trainer
      .routes({ repoRoot: ROOT, openDb: (migrationsDir) => openDb(join(DATA_DIR, `${id}.sqlite`), migrationsDir) })
      .map(compileRoute);
    mounted.set(id, { routes });
    console.log(`Trainer ${id}: ${routes.length} routes under /api/${id}`);
  } catch (e) {
    console.error(`Trainer ${id} failed to start and is disabled:`, e);
    mounted.set(id, { failure: `The ${id} trainer failed to start (see the server log)` });
  }
}

async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
  const [, id, rest = ""] = path.match(/^\/api\/([^/]+)(\/.*)?$/) ?? [];
  const trainer = id ? mounted.get(id) : undefined;
  if (!trainer) return json(res, 404, { error: "Not found" });
  if ("failure" in trainer) return json(res, 503, { error: trainer.failure });

  const method = req.method ?? "GET";
  const match = matchRoute(trainer.routes, method, rest);
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
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  try {
    if (path.startsWith("/api/")) await handleApi(req, res, path);
    else if (serveDist) await serveApp(res, path);
    else res.writeHead(404).end("No built app (run npm run build in app/), API only");
  } catch (e) {
    if (e instanceof InvalidRequest) return json(res, 400, { error: e.message });
    console.error(e);
    json(res, 500, { error: "Internal error" });
  }
}).listen(PORT, () => {
  console.log(`Cubetrainer server on http://localhost:${PORT} (data: ${DATA_DIR})`);
  if (serveDist) console.log(`Serving the built app from ${DIST}`);
});
