// The host's settings store (packages/core/settings.ts): data/_settings.sqlite, one row per
// owner. The server keeps what it's given; the owner's code validates it when it reads it.
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { MAX_SETTINGS_LENGTH, SETTINGS_OWNER, type SettingsResponse } from "../../../packages/core/settings.ts";
import { InvalidRequest } from "../tool.ts";

/** The store's DB file in the data dir: `_` keeps it apart from tools' `<id>.sqlite`. */
const SETTINGS_DB = "_settings.sqlite";
export const SETTINGS_MIGRATIONS = import.meta.dirname;

export function settingsStore(db: DatabaseSync) {
  const all = db.prepare("SELECT owner, value FROM settings ORDER BY owner");
  const put = db.prepare(`
    INSERT INTO settings (owner, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (owner) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
  return {
    list: (): SettingsResponse => ({
      settings: Object.fromEntries((all.all() as { owner: string; value: string }[]).map((r) => [r.owner, JSON.parse(r.value)])),
    }),
    put(owner: string, body: unknown): null {
      if (!SETTINGS_OWNER.test(owner)) throw new InvalidRequest("owner must be a tool id or <library>.<name>");
      if (typeof body !== "object" || body === null || Array.isArray(body)) throw new InvalidRequest("Settings must be a JSON object");
      const value = JSON.stringify(body);
      if (value.length > MAX_SETTINGS_LENGTH) throw new InvalidRequest(`Settings must be at most ${MAX_SETTINGS_LENGTH} characters as JSON`);
      put.run(owner, value, new Date().toISOString());
      return null;
    },
  };
}

export const settingsDbPath = (dataDir: string) => join(dataDir, SETTINGS_DB);
