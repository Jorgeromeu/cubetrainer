-- The stats tool became the timer tool (data/stats.sqlite -> data/timer.sqlite): solves
-- timed here (source 'timer', import_id NULL) now sit next to the imported ones.
--
-- Each import of an export file is recorded, and its solves point to it, so one import
-- can be told apart from another of the same source, and undone.
CREATE TABLE imports (
  id          TEXT PRIMARY KEY,            -- uuid
  source      TEXT NOT NULL,               -- the solves' source, e.g. 'cubetime'
  file_name   TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL,
  added       INTEGER NOT NULL,
  skipped     INTEGER NOT NULL
);
ALTER TABLE solves ADD COLUMN import_id TEXT REFERENCES imports (id);
CREATE INDEX solves_import ON solves (import_id);

-- Solves imported before imports were recorded: one import per source, from its first one.
INSERT INTO imports (id, source, imported_at, added, skipped)
  SELECT 'before-' || source, source, MIN(created_at), COUNT(*), 0 FROM solves GROUP BY source;
UPDATE solves SET import_id = 'before-' || source;
