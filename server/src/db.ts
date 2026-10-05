// Opens a trainer's SQLite file and brings its schema up to date.
//
// Each trainer has its own DB and its own migrations: the numbered files in its
// migrations folder (001_*.sql, 002_*.sql, ...), each applied once, in order, inside a
// transaction. The DB's PRAGMA user_version records the last one applied. Never edit an
// applied migration: add a new one.
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDb(path: string, migrationsDir: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(db, migrationsDir, basename(path));
  return db;
}

function migrate(db: DatabaseSync, migrationsDir: string, dbName: string) {
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  const migrations = readdirSync(migrationsDir)
    .map((file) => ({ file, version: Number(file.match(/^(\d+)_.*\.sql$/)?.[1]) }))
    .filter((m) => m.version > 0)
    .sort((a, b) => a.version - b.version);

  for (const { file, version } of migrations) {
    if (version <= current) continue;
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(join(migrationsDir, file), "utf8"));
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec("COMMIT");
      console.log(`${dbName}: applied migration ${file}`);
    } catch (e) {
      db.exec("ROLLBACK");
      throw new Error(`${dbName}: migration ${file} failed`, { cause: e });
    }
  }
}
