-- Imported solves, from any timer's export. Never wiped; change it only through new migrations.

CREATE TABLE solves (
  id         TEXT PRIMARY KEY,           -- uuid, made on import
  ms         INTEGER NOT NULL CHECK (ms > 0),
  penalty    TEXT NOT NULL DEFAULT 'ok' CHECK (penalty IN ('ok', '+2', 'dnf')),
  scramble   TEXT NOT NULL,
  comment    TEXT NOT NULL DEFAULT '',
  solved_at  TEXT NOT NULL,              -- ISO timestamp, from the timer
  source     TEXT NOT NULL,              -- the export format, e.g. 'cubetime'
  created_at TEXT NOT NULL,              -- when it was imported
  -- What makes a re-imported solve the same one.
  UNIQUE (source, solved_at, ms)
);
CREATE INDEX solves_solved_at ON solves (solved_at);
