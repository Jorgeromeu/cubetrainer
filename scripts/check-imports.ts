// Import boundary check (openspec/specs/foundation/architecture, "Import boundaries"). Every import of our
// own code must follow an allowed edge between zones; bare package imports are limited per zone.
// Run: npm run check:imports (also part of the app build). Exits 1 listing each bad edge.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SCAN = ["packages", "tools", "app/src", "app/vite.config.ts", "server/src", "scripts"];
const CODE = /\.(ts|tsx|mts)$/;

/** Which zone a repo-relative path belongs to, e.g. "core", "ui", "tool-app:f2l". */
function zoneOf(path: string): string | undefined {
  const p = path.split(sep).join("/");
  let m: RegExpMatchArray | null;
  if (p.endsWith(".test.ts")) return "test";
  if (p.startsWith("packages/core/")) return "core";
  if (p.startsWith("packages/ui/")) return "ui";
  if ((m = p.match(/^tools\/([^/]+)\/contract\.ts$/))) return `contract:${m[1]}`;
  if ((m = p.match(/^tools\/([^/]+)\/catalog\/builder\//))) return `tool-builder:${m[1]}`;
  if ((m = p.match(/^tools\/([^/]+)\/catalog\//))) return `tool-catalog:${m[1]}`;
  if ((m = p.match(/^tools\/([^/]+)\/app\//))) return `tool-app:${m[1]}`;
  if ((m = p.match(/^tools\/([^/]+)\/server\//))) return `tool-server:${m[1]}`;
  if (p === "server/src/tool.ts") return "server-tool-interface";
  if (p.startsWith("app/")) return "app-host";
  if (p.startsWith("server/")) return "server-host";
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
      return to === "core" || (sameTool && kind(to) === "tool-catalog");
    case "tool-catalog":
      return to === "core";
    case "tool-builder":
      return to === "core" || (sameTool && kind(to) === "tool-catalog");
    case "tool-app":
      return ["core", "ui", "contract"].includes(kind(to)) || (sameTool && ["tool-app", "tool-catalog"].includes(kind(to)));
    case "tool-server":
      // Any tool's contract: its own types, and other tools' exposed calls (read via ctx.read).
      return to === "core" || to === "server-tool-interface" || kind(to) === "contract" || (sameTool && kind(to) === "tool-catalog");
    case "app-host":
      return ["core", "ui", "tool-app", "scripts"].includes(kind(to));
    case "server-host":
      return ["core", "tool-server", "server-tool-interface", "scripts"].includes(kind(to));
    case "scripts":
      return to === "core";
    case "server-tool-interface":
      return to === "core";
    case "test":
      return true;
    default:
      return false;
  }
}

/** Third-party imports a zone may make: none in core and contracts, Node built-ins on the server. */
function allowedBare(from: string, spec: string): boolean {
  switch (kind(from)) {
    case "core":
    case "contract":
    case "tool-catalog":
      return false;
    case "tool-server":
    case "server-host":
    case "server-tool-interface":
    case "scripts":
    case "test":
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

// `import x from "…"`, `export … from "…"`, `import "…"` and `import("…")`. Not the word
// "import" just before a closing quote in a string: a side-effect import needs a space.
const IMPORT = /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;])import(?:\s+|\s*\(\s*)['"]([^'"]+)['"]/gm;

/**
 * The source with every template literal's text blanked (expressions inside `${}` kept, and
 * nested templates handled): template text holds no imports, e.g. new-tool.ts's file templates.
 */
function withoutTemplates(src: string): string {
  let out = "";
  let i = 0;
  const template = (): void => {
    // At the opening backtick.
    out += "`";
    i++;
    while (i < src.length && src[i] !== "`") {
      if (src[i] === "\\") i += 2;
      else if (src.startsWith("${", i)) {
        out += "${";
        i += 2;
        expression();
        out += "}";
      } else i++;
    }
    out += "`";
    i++;
  };
  const expression = (): void => {
    // Inside ${ ... }: code, until its closing brace.
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === "`") template();
      else if (c === "'" || c === '"') {
        const q = c;
        out += c;
        i++;
        while (i < src.length && src[i] !== q) {
          if (src[i] === "\\") out += src[i++];
          out += src[i++];
        }
        out += q;
        i++;
      } else if (c === "{") {
        depth++;
        out += c;
        i++;
      } else if (c === "}") {
        if (depth === 0) {
          i++;
          return;
        }
        depth--;
        out += c;
        i++;
      } else {
        out += c;
        i++;
      }
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === "`") template();
    else if (c === "'" || c === '"') {
      const q = c;
      out += c;
      i++;
      while (i < src.length && src[i] !== q && src[i] !== "\n") {
        if (src[i] === "\\") out += src[i++];
        out += src[i++];
      }
      out += src[i] ?? "";
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const problems: string[] = [];
let checked = 0;
for (const scanned of SCAN) {
  for (const file of files(scanned)) {
    const rel = file.split(sep).join("/");
    const from = zoneOf(rel);
    const source = readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
    const code = withoutTemplates(source);
    for (const m of code.matchAll(IMPORT)) {
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
