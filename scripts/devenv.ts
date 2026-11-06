// Where this checkout runs: the main checkout or a git worktree, its branch, its ports and
// its data. Used by the server (server/src/main.ts), Vite (app/vite.config.ts) and the data
// scripts (data.ts). No dependencies: node: built-ins only.
//
// In a worktree, on the first `npm run dev` / `npm run server`:
//   - data: main's DBs are copied into the worktree's own data/ (copyMainData), so it works
//     on your data without ever writing to it. `npm run data:push` brings new rows back.
//   - ports: a free pair is picked and kept in <worktree>/.dev.json, so two checkouts run
//     side by side. The main checkout keeps 3001 / 5173.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface Checkout {
  root: string;
  isWorktree: boolean;
  /** The main checkout's folder (root itself when this is it). */
  mainRoot: string;
  /** This checkout's git dir, where HEAD is. */
  gitDir: string;
}

export function checkout(root: string): Checkout {
  const dotGit = join(root, ".git");
  if (!existsSync(dotGit) || statSync(dotGit).isDirectory()) return { root, isWorktree: false, mainRoot: root, gitDir: dotGit };
  // A worktree's .git is a file: "gitdir: <main>/.git/worktrees/<name>".
  const raw = readFileSync(dotGit, "utf8").match(/^gitdir:\s*(.+)$/m)?.[1].trim() ?? "";
  const gitDir = isAbsolute(raw) ? raw : resolve(root, raw);
  return { root, isWorktree: true, mainRoot: dirname(dirname(dirname(gitDir))), gitDir };
}

/** The checked-out branch, read now (so switching branches shows without a restart); undefined without a git checkout (deployed). */
export function branch(co: Checkout): string | undefined {
  try {
    const head = readFileSync(join(co.gitDir, "HEAD"), "utf8").trim();
    return head.match(/^ref: refs\/heads\/(.+)$/)?.[1] ?? head.slice(0, 8);
  } catch {
    return undefined;
  }
}

export const mainDataDir = (co: Checkout) => process.env.MAIN_DATA_DIR ?? join(co.mainRoot, "data");

export interface Ports {
  server: number;
  app: number;
}

const MAIN_PORTS: Ports = { server: 3001, app: 5173 };
const PORTS_FILE = ".dev.json";

const readPorts = (root: string): Ports | undefined => {
  try {
    const p = JSON.parse(readFileSync(join(root, PORTS_FILE), "utf8")) as Ports;
    return Number.isInteger(p.server) && Number.isInteger(p.app) ? p : undefined;
  } catch {
    return undefined;
  }
};

const isFree = (port: number) =>
  new Promise<boolean>((done) => {
    const s = createServer();
    s.once("error", () => done(false));
    s.listen(port, () => s.close(() => done(true)));
  });

/** Every worktree's folder, from the main checkout's .git/worktrees/<name>/gitdir. */
function worktreeRoots(co: Checkout): string[] {
  const dir = join(co.mainRoot, ".git", "worktrees");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    try {
      return [dirname(readFileSync(join(dir, name, "gitdir"), "utf8").trim())];
    } catch {
      return [];
    }
  });
}

/**
 * This checkout's ports: 3001 / 5173 in the main checkout; in a worktree the pair kept in its
 * .dev.json, or the first free pair (3002 / 5174, 3003 / 5175, ...) no other worktree claims.
 */
export async function devPorts(co: Checkout): Promise<Ports> {
  if (!co.isWorktree) return MAIN_PORTS;
  const kept = readPorts(co.root);
  if (kept) return kept;
  const claimed = new Set(worktreeRoots(co).flatMap((r) => (r === co.root ? [] : [readPorts(r)?.server, readPorts(r)?.app])));
  for (let k = 1; k < 100; k++) {
    const p = { server: MAIN_PORTS.server + k, app: MAIN_PORTS.app + k };
    if (claimed.has(p.server) || claimed.has(p.app)) continue;
    if ((await isFree(p.server)) && (await isFree(p.app))) {
      writeFileSync(join(co.root, PORTS_FILE), JSON.stringify(p, null, 2) + "\n");
      return p;
    }
  }
  throw new Error("No free ports for this worktree");
}

/** A tool's DB file, or the host's (`_settings.sqlite`); not a backup, not a WAL file. */
export const isToolDb = (file: string) => /^_?[a-z0-9-]+\.sqlite$/.test(file) && !file.startsWith("backup");

const COPIED_FILE = ".from-main.json";

/** When this data folder was copied from main, if it was. */
export function copiedAt(dataDir: string): string | undefined {
  try {
    return (JSON.parse(readFileSync(join(dataDir, COPIED_FILE), "utf8")) as { at: string }).at;
  } catch {
    return undefined;
  }
}

/** A consistent copy of a SQLite file, even while another process writes to it. */
export function copyDb(from: string, to: string) {
  const db = new DatabaseSync(from, { readOnly: true });
  try {
    db.exec(`VACUUM INTO '${to.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
}

/** Copies main's tool DBs into `dataDir` (which must hold none yet). Returns the files copied. */
export function copyMainData(co: Checkout, dataDir: string): string[] {
  const from = mainDataDir(co);
  const files = existsSync(from) ? readdirSync(from).filter(isToolDb) : [];
  for (const f of files) copyDb(join(from, f), join(dataDir, f));
  writeFileSync(join(dataDir, COPIED_FILE), JSON.stringify({ from, at: new Date().toISOString(), branch: branch(co) ?? null }, null, 2) + "\n");
  return files;
}

export const hasToolDbs = (dataDir: string) => existsSync(dataDir) && readdirSync(dataDir).some(isToolDb);
