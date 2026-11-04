// npm run new-tool <id> [-- --server] [--name "Name"]: a new tool following the conventions
// in openspec/specs/foundation (architecture, tool-shell, settings, user-data): its folder
// tools/<id>/ and its lines in the app (and, with --server, server) registries. What it
// writes is the smallest tool that builds; new-tool.test.ts type-checks it, so this stays in
// step with the real APIs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface ToolOptions {
  /** Shown in the top bar and the tool menu; default: from the id ("smart-timer" -> "Smart timer"). */
  name?: string;
  /** It stores data: a server/ with routes, a migration and a test. */
  server?: boolean;
}

const ID = /^[a-z][a-z0-9-]*$/;
const camel = (id: string) => id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const pascal = (id: string) => camel(id).replace(/^./, (c) => c.toUpperCase());

/** The new tool's files, by path under the repo root. */
export function scaffold(id: string, options: ToolOptions = {}): Record<string, string> {
  if (!ID.test(id)) throw new Error(`Tool id must start with a letter and be lowercase letters, digits and dashes: ${id}`);
  const name = options.name ?? (id.charAt(0).toUpperCase() + id.slice(1)).replace(/-/g, " ");
  const c = camel(id);
  const P = pascal(id);
  const dir = `tools/${id}`;
  const files: Record<string, string> = {};

  files[`${dir}/contract.ts`] = options.server
    ? `// The ${name} tool's contract: its API between server/ and app/, and the calls it exposes to
// other tools (${c}Exposes, at the end). Imports core only.
import { exposed } from "../../packages/core/exposed.ts";

/** Something this tool stores. */
export interface Item {
  /** uuid, made by the app */
  id: string;
  label: string;
  /** ISO timestamp, set by the server */
  createdAt: string;
}

/** Longest label accepted. */
export const MAX_LABEL_LENGTH = 80;

// GET /api/${id}/items
export interface ItemsResponse {
  /** Oldest first. */
  items: Item[];
}

// PUT /api/${id}/items/:id -> Item. Saving the same id again returns it unchanged.
export interface PutItemBody {
  label: string;
}

// Exposed to other tools (packages/core/exposed.ts): read-only, only ever grows.
export const ${c}Exposes = {
  items: exposed<ItemsResponse>("${id}", "items"),
};
`
    : `// The ${name} tool's contract: API types and exposed calls, once it stores data (see the
// timer's contract.ts). Imports core only.
export {};
`;

  files[`${dir}/app/index.ts`] = `// The ${name} tool.
import type { Tool } from '../../../packages/ui/tool.ts'
import { ${P}Crumb, ${P}View } from './${P}View.tsx'
import { ${P}Settings } from './${P}Settings.tsx'
import './${id}.css'

export const ${c}Tool: Tool = {
  id: '${id}',
  name: '${name}',
  description: 'One line for the tool menu',
  View: ${P}View,
  Crumb: ${P}Crumb,
  Settings: ${P}Settings,
  // Shared library sections that apply to it, e.g. cubeDisplaySettings if it shows 3D cubes.
  sharedSettings: [],
}
`;

  if (options.server)
    files[`${dir}/app/items.ts`] = `// The ${name} tool's items, held by its server and mirrored here through serverData
// (packages/ui/serverData.ts): shown at once, sent in order, kept while there's no server.
import { request } from '../../../packages/core/api.ts'
import { serverData } from '../../../packages/ui/serverData.ts'
import type { Item, ItemsResponse, PutItemBody } from '../contract.ts'

const API = '/api/${id}'

const items = serverData<Item[]>({
  owner: '${id}',
  fetch: async () => (await request<ItemsResponse>(\`\${API}/items\`)).items,
  empty: [],
})

export const useItems = items.use

export function addItem(label: string) {
  const item: Item = { id: crypto.randomUUID(), label, createdAt: new Date().toISOString() }
  items.change((list) => [...list, item], { method: 'PUT', url: \`\${API}/items/\${item.id}\`, body: { label } satisfies PutItemBody })
}
`;

  files[`${dir}/app/${P}View.tsx`] = `// The ${name} tool's page (#/${id}/<path...>) and its part of the top bar.
import type { ToolProps } from '../../../packages/ui/tool.ts'
${options.server ? "import { ServerNotice } from '../../../packages/ui/ServerNotice.tsx'\n" : ""}import { use${P}Settings } from './settings.ts'
${options.server ? "import { addItem, useItems } from './items.ts'\n" : ""}
export function ${P}Crumb() {
  return (
    <nav className="crumb">
      <h1>${name}</h1>
    </nav>
  )
}

export function ${P}View({ path }: ToolProps) {
  const { example } = use${P}Settings()
${options.server ? `  const { load, data, error } = useItems()
` : ""}  return (
    <div className="${id}">
      <p className="${id}-empty">
        ${name} {example ? 'is on' : 'is off'}{path.length > 0 && \` · \${path.join('/')}\`}
      </p>
${options.server ? `      {load === 'ready' && (
        <>
          <ul>
            {data.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
          <button onClick={() => addItem(\`Item \${data.length + 1}\`)}>Add</button>
        </>
      )}
      <ServerNotice load={load} error={error} offline="No server · items not loaded" />
` : ""}    </div>
  )
}
`;

  files[`${dir}/app/settings.ts`] = `// The ${name} tool's settings (picked once, the same everywhere, in its settings section) and
// view state (how a page was left, per browser). See openspec/specs/foundation/settings.
import { setting } from '../../../packages/ui/settings/setting.ts'
import { viewState } from '../../../packages/ui/settings/viewState.ts'

export interface ${P}SettingsValue {
  example: boolean
}

const settings = setting<${P}SettingsValue>('${id}', { example: true }, (s) => typeof s.example === 'boolean')

export const use${P}Settings = settings.use
export const update${P}Settings = settings.update

export interface ${P}ViewState {
  /** e.g. a filter the page was left with. */
  filter: string
}

const view = viewState<${P}ViewState>('${id}.page', { filter: '' }, (s) => typeof s.filter === 'string')

export const use${P}View = view.use
export const update${P}View = view.update
`;

  files[`${dir}/app/${P}Settings.tsx`] = `// The ${name} tool's own section of the settings window (the shell adds its heading).
import { OnOff, Setting } from '../../../packages/ui/settings/blocks.tsx'
import { update${P}Settings, use${P}Settings } from './settings.ts'

export function ${P}Settings() {
  const { example } = use${P}Settings()
  return (
    <Setting label="Example" hint="What it changes">
      <OnOff value={example} onChange={(on) => update${P}Settings({ example: on })} />
    </Setting>
  )
}
`;

  files[`${dir}/app/${id}.css`] = `/* The ${name} tool. Loaded after packages/ui/ui.css; classes prefixed with ${id}-. Values only
   from packages/ui/tokens.css; layout as panes (packages/ui/panes.tsx): openspec/specs/library/design. */
.${id}-empty {
  color: var(--muted);
}
`;

  if (options.server) {
    files[`${dir}/server/index.ts`] = `// The ${name} tool's API (types in ../contract.ts).
//
//   GET /api/${id}/items        -> ItemsResponse
//   PUT /api/${id}/items/:id    PutItemBody -> Item
//
// Exposed (${c}Exposes): items -> ItemsResponse
import { join } from "node:path";
import { ${c}Exposes, type ItemsResponse } from "../contract.ts";
import { implement, type ServerTool } from "../../../server/src/tool.ts";
import { itemsRepository } from "./items.ts";

export const ${c}Tool: ServerTool = {
  id: "${id}",
  // Tool ids and capabilities whose exposed calls it reads with ctx.read / ctx.gather.
  uses: [],
  start({ openDb }) {
    const items = itemsRepository(openDb(join(import.meta.dirname, "migrations")));
    return {
      routes: [
        { method: "GET", path: "/items", handle: () => ({ items: items.list() }) satisfies ItemsResponse },
        { method: "PUT", path: "/items/:id", handle: ({ params, body }) => items.put(params.id, body) },
      ],
      exposes: [implement(${c}Exposes.items, () => ({ items: items.list() }))],
    };
  },
};
`;
    files[`${dir}/server/items.ts`] = `// The only module that touches the items table.
import type { DatabaseSync } from "node:sqlite";
import { type Item, MAX_LABEL_LENGTH, type PutItemBody } from "../contract.ts";
import { bodyOf, InvalidRequest } from "../../../server/src/tool.ts";

interface ItemRow {
  id: string;
  label: string;
  created_at: string;
}

const toItem = (row: ItemRow): Item => ({ id: row.id, label: row.label, createdAt: row.created_at });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function itemsRepository(db: DatabaseSync) {
  const all = db.prepare("SELECT * FROM items ORDER BY created_at");
  const one = db.prepare("SELECT * FROM items WHERE id = ?");
  const insert = db.prepare("INSERT INTO items (id, label, created_at) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING");
  return {
    list: (): Item[] => (all.all() as unknown as ItemRow[]).map(toItem),

    /** Saves an item; saving the same id again returns it unchanged (retries are safe). */
    put(id: string, body: unknown): Item {
      if (!UUID.test(id)) throw new InvalidRequest("id must be a uuid");
      const { label } = parsePutBody(body);
      insert.run(id, label, new Date().toISOString());
      return toItem(one.get(id) as unknown as ItemRow);
    },
  };
}

/** Strict bodies: only the documented fields (bodyOf), each checked. */
function parsePutBody(body: unknown): PutItemBody {
  const { label } = bodyOf(body, ["label"]);
  if (typeof label !== "string" || !label.trim() || label.length > MAX_LABEL_LENGTH)
    throw new InvalidRequest(\`label must be 1 to \${MAX_LABEL_LENGTH} characters\`);
  return { label: label.trim() };
}
`;
    files[`${dir}/server/items.test.ts`] = `import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { openDb } from "../../../server/src/db.ts";
import { itemsRepository } from "./items.ts";

const fresh = () => itemsRepository(openDb(":memory:", join(import.meta.dirname, "migrations")));

test("an item is saved once; a retry returns it unchanged", () => {
  const items = fresh();
  const id = crypto.randomUUID();
  const saved = items.put(id, { label: "first" });
  assert.deepEqual(items.put(id, { label: "other" }), saved);
  assert.equal(items.list().length, 1);
});

test("unknown fields and bad ids are refused", () => {
  const items = fresh();
  assert.throws(() => items.put(crypto.randomUUID(), { label: "x", extra: 1 }), /Unknown field/);
  assert.throws(() => items.put("abc", { label: "x" }), /uuid/);
});
`;
    files[`${dir}/server/migrations/001_items.sql`] = `-- The ${name} tool's data (data/${id}.sqlite). Never wiped; once on main, change it only
-- through new migrations.
CREATE TABLE items (
  id         TEXT PRIMARY KEY,   -- uuid, made by the app
  label      TEXT NOT NULL,
  created_at TEXT NOT NULL       -- ISO timestamp, set by the server
);
`;
  }

  files[`${dir}/README.md`] = `# ${name}

What it is, in a line. Behaviour: \`openspec/specs/tools/${id}\`.

- \`contract.ts\`: API types, limits, exposed calls
- \`app/\`: the view (\`app/index.ts\` exports the \`Tool\`), its settings (\`app/settings.ts\`) and stylesheet
${options.server ? `- \`server/\`: routes (\`server/index.ts\` exports the \`ServerTool\`), repository, \`migrations/\`

## API

| | |
|---|---|
| \`GET /api/${id}/items\` | \`{ items: Item[] }\`, oldest first |
| \`PUT /api/${id}/items/:id\` | body \`{ label }\`, id = an app-made uuid; returns the \`Item\` (unchanged if already saved) |

## Exposed to other tools

| Call | Result |
|---|---|
| \`${c}Exposes.items\` | \`{ items: Item[] }\` |

## Schema (\`data/${id}.sqlite\`)

- \`items\` (migration 001): \`id\`, \`label\`, \`created_at\`.
` : ""}`;
  return files;
}

/** Adds the tool's lines to the app and (with a server) server registries under `root`. */
function register(root: string, id: string, server: boolean) {
  const c = camel(id);
  const add = (file: string, importLine: string) => {
    const path = join(root, file);
    let s = readFileSync(path, "utf8");
    if (s.includes(importLine)) return;
    const imports = [...s.matchAll(/^import .*$/gm)];
    const last = imports[imports.length - 1];
    s = s.slice(0, last.index + last[0].length) + "\n" + importLine + s.slice(last.index + last[0].length);
    s = s.replace(/(export const TOOLS: \w+\[\] = \[)([^\]]*)\]/, (_, head: string, list: string) => `${head}${list.trim() ? list.trimEnd() + ", " : ""}${c}Tool]`);
    writeFileSync(path, s);
  };
  add("app/src/tools.ts", `import { ${c}Tool } from '../../tools/${id}/app/index.ts'`);
  if (server) add("server/src/tools.ts", `import { ${c}Tool } from "../../tools/${id}/server/index.ts";`);
}

/** Writes the files and registers the tool. Refuses an id that already has a folder. */
export function createTool(root: string, id: string, options: ToolOptions = {}): string[] {
  if (existsSync(join(root, "tools", id))) throw new Error(`tools/${id} already exists`);
  const files = scaffold(id, options);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  register(root, id, !!options.server);
  return Object.keys(files);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--"));
  const nameAt = args.indexOf("--name");
  if (!id) {
    console.error('Usage: npm run new-tool <id> [-- --server] [--name "Name"]');
    process.exit(1);
  }
  const server = args.includes("--server");
  const files = createTool(resolve(import.meta.dirname, ".."), id, { server, name: nameAt >= 0 ? args[nameAt + 1] : undefined });
  console.log(`Created tools/${id}/ (${files.length} files) and registered it in app/src/tools.ts${server ? " and server/src/tools.ts" : ""}:`);
  for (const f of files) console.log(`  ${f}`);
  console.log(`Next: describe it in openspec/specs/tools/${id}/spec.md; conventions in openspec/specs/foundation/.`);
}
