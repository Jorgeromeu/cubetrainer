// Bringing a worktree's data back into main's: what's new (diff) and adding it (push).
// Only additions: a row whose primary key main doesn't have, and whole DBs main doesn't
// have (a tool new in the worktree). Rows main already has are never overwritten, and
// nothing is deleted, so edits to existing records stay behind.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { copyDb, isToolDb } from "./devenv.ts";

export interface TableDiff {
  table: string;
  /** Rows here whose primary key main doesn't have. */
  rows: number;
}

export interface DbDiff {
  file: string;
  /** Main has no such DB: the whole file is new. */
  newDb: boolean;
  /** Both DBs' migration versions (PRAGMA user_version). */
  version: number;
  mainVersion: number | null;
  tables: TableDiff[];
  rows: number;
}

const version = (db: DatabaseSync) => (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;

const tablesOf = (db: DatabaseSync) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(
    (t) => t.name,
  );

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** A table's primary key columns, or all its columns when it has none. */
function keyOf(db: DatabaseSync, table: string): string[] {
  const cols = db.prepare(`PRAGMA table_info(${q(table)})`).all() as { name: string; pk: number }[];
  const pk = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
  return (pk.length ? pk : cols).map((c) => c.name);
}

const keyString = (row: Record<string, unknown>, key: string[]) => JSON.stringify(key.map((k) => row[k]));

/** The rows of `table` in `db` that `main` doesn't have, by primary key. */
function missingRows(db: DatabaseSync, main: DatabaseSync | undefined, table: string): Record<string, unknown>[] {
  const rows = db.prepare(`SELECT * FROM ${q(table)}`).all() as Record<string, unknown>[];
  if (!main || !tablesOf(main).includes(table)) return rows;
  const key = keyOf(db, table);
  const have = new Set(
    (main.prepare(`SELECT ${key.map(q).join(", ")} FROM ${q(table)}`).all() as Record<string, unknown>[]).map((r) => keyString(r, key)),
  );
  return rows.filter((r) => !have.has(keyString(r, key)));
}

/** What `dataDir` has that `mainDir` doesn't, per tool DB. */
export function diff(dataDir: string, mainDir: string): DbDiff[] {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir)
    .filter(isToolDb)
    .map((file) => {
      const db = new DatabaseSync(join(dataDir, file), { readOnly: true });
      const mainPath = join(mainDir, file);
      const main = existsSync(mainPath) ? new DatabaseSync(mainPath, { readOnly: true }) : undefined;
      try {
        const tables = tablesOf(db)
          .map((table) => ({ table, rows: missingRows(db, main, table).length }))
          .filter((t) => t.rows > 0);
        return {
          file,
          newDb: !main,
          version: version(db),
          mainVersion: main ? version(main) : null,
          tables,
          rows: tables.reduce((n, t) => n + t.rows, 0),
        };
      } finally {
        db.close();
        main?.close();
      }
    })
    .filter((d) => d.rows > 0 || d.newDb);
}

export const unpushedRows = (dataDir: string, mainDir: string) => diff(dataDir, mainDir).reduce((n, d) => n + d.rows, 0);

/**
 * Adds what `diff` reports to main's data: new DBs are copied whole, missing rows inserted
 * (one transaction per DB, foreign keys checked at the end). Each main DB it changes is
 * backed up first, next to it. Refuses when versions differ: main's server must have run
 * the same migrations (restart it after merging), or the worktree is behind main.
 */
export function push(dataDir: string, mainDir: string, label: string): { backups: string[]; pushed: DbDiff[] } {
  const diffs = diff(dataDir, mainDir);
  const mismatch = diffs.find((d) => !d.newDb && d.version !== d.mainVersion);
  if (mismatch)
    throw new Error(
      `${mismatch.file}: this data is at migration ${mismatch.version}, main's at ${mismatch.mainVersion}. ` +
        (mismatch.version > (mismatch.mainVersion ?? 0)
          ? "Merge the branch and restart main's server first, so main's DB gets the same migrations."
          : "Main is ahead: start this worktree's server once on the merged code so its DB catches up."),
    );
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backups: string[] = [];
  for (const d of diffs) {
    const mainPath = join(mainDir, d.file);
    if (d.newDb) {
      copyDb(join(dataDir, d.file), mainPath);
      continue;
    }
    const backup = join(mainDir, `backup-before-push-${label}-${stamp}-${d.file}`);
    copyDb(mainPath, backup);
    backups.push(backup);
    const db = new DatabaseSync(join(dataDir, d.file), { readOnly: true });
    const main = new DatabaseSync(mainPath);
    try {
      main.exec("PRAGMA foreign_keys = OFF");
      main.exec("BEGIN");
      try {
        for (const { table } of d.tables) {
          for (const row of missingRows(db, main, table)) {
            const cols = Object.keys(row);
            main.prepare(`INSERT OR IGNORE INTO ${q(table)} (${cols.map(q).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(
              ...(cols.map((c) => row[c]) as never[]),
            );
          }
        }
        const broken = main.prepare("PRAGMA foreign_key_check").all();
        if (broken.length) throw new Error(`${d.file}: pushed rows would break ${broken.length} foreign key(s); nothing was pushed`);
        main.exec("COMMIT");
      } catch (e) {
        main.exec("ROLLBACK");
        throw e;
      }
    } finally {
      db.close();
      main.exec("PRAGMA foreign_keys = ON");
      main.close();
    }
  }
  return { backups, pushed: diffs };
}
