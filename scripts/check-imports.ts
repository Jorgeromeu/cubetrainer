// Import boundary check (openspec/specs/architecture, "Import boundaries"). Every import of our
// own code must follow an allowed edge between zones; bare package imports are limited per zone.
// Run: npm run check:imports (also part of the app build). Exits 1 listing each bad edge.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SCAN = ["packages", "tools", "app/src", "app/vite.config.ts", "server/src", "catalog-builder/src", "scripts"];
const CODE = /\.(ts|tsx|mts)$/;

/** Which zone a repo-relative path belongs to, e.g. "core", "ui", "tool-app:f2l". */
function zoneOf(path: string): string | undefined {
  const p = path.split(sep).join("/");
  let m: RegExpMatchArray | null;
  if (p.startsWith("packages/core/")) return "core";
  if (p.startsWith("packages/ui/")) return "ui";
  if ((m = p.match(/^tools\/([^/]+)\/contract\.ts$/))) return `contract:${m[1]}`;
  if ((m = p.match(/^tools\/([^/]+)\/app\//))) return `tool-app:${m[1]}`;
  if ((m = p.match(/^tools\/([^/]+)\/server\//))) return `tool-server:${m[1]}`;
  if (p === "server/src/tool.ts") return "server-tool-interface";
  if (p.startsWith("app/")) return "app-host";
  if (p.startsWith("server/")) return "server-host";
  if (p.startsWith("catalog-builder/")) return "catalog-builder";
  if (p.startsWith("catalog/")) return "catalog";
  if (p.startsWith("scripts/")) return "scripts";
  return undefined;
}

const kind = (zone: string) => zone.split(":")[0];
const owner = (zone: string) => zone.split(":")[1];

/** May code in `from` import our own code in `to`? */
function allowed(from: string, to: string): boolean {
  if (from === to) return true;
  const sameTool = owner(from) !== undefined && owner(from) === owner(to);
  switch (kind(from)) {
    case "core":
      return false;
    case "ui":
      return to === "core";
    case "contract":
      return to === "core";
    case "tool-app":
      return ["core", "ui", "contract", "catalog"].includes(kind(to)) || (sameTool && kind(to) === "tool-app");
    case "tool-server":
      return to === "core" || to === "server-tool-interface" || (sameTool && kind(to) === "contract");
    case "app-host":
      return ["core", "ui", "tool-app"].includes(kind(to));
    case "server-host":
      return ["core", "tool-server", "server-tool-interface"].includes(kind(to));
    case "server-tool-interface":
      return to === "core";
    case "catalog-builder":
      return to === "core" || to === "catalog";
    default:
      return false;
  }
}

/** Third-party imports a zone may make: none in core and contracts, Node built-ins on the server. */
function allowedBare(from: string, spec: string): boolean {
  switch (kind(from)) {
    case "core":
    case "contract":
      return false;
    case "tool-server":
    case "server-host":
    case "server-tool-interface":
    case "scripts":
      return spec.startsWith("node:");
    default:
      return true;
  }
}

function* files(path: string): Generator<string> {
  const full = join(ROOT, path);
  let entries;
  try {
    entries = readdirSync(full, { withFileTypes: true });
  } catch {
    if (CODE.test(path)) yield path;
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const child = join(path, e.name);
    if (e.isDirectory()) yield* files(child);
    else if (CODE.test(e.name)) yield child;
  }
}

const IMPORT = /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*\(?\s*['"]([^'"]+)['"]/gm;

const problems: string[] = [];
let checked = 0;
for (const scanned of SCAN) {
  for (const file of files(scanned)) {
    const rel = file.split(sep).join("/");
    const from = zoneOf(rel);
    const source = readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
    for (const m of source.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2];
      checked++;
      if (!spec.startsWith(".")) {
        if (from && !allowedBare(from, spec)) problems.push(`${rel}: ${from} may not import the package "${spec}"`);
        continue;
      }
      const target = relative(ROOT, resolve(ROOT, dirname(file), spec)).split(sep).join("/");
      const to = zoneOf(target);
      if (!from || !to || !allowed(from, to)) {
        problems.push(`${rel}: imports ${target} (${from ?? "?"} → ${to ?? "outside every zone"} is not allowed)`);
      }
    }
  }
}

if (problems.length) {
  console.error(`Import boundaries: ${problems.length} forbidden edge(s)\n` + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log(`Import boundaries: ${checked} imports OK`);
