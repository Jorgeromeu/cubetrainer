-- Timed PLL solves. Never wiped; change it only through new migrations.

-- One row per timed solve. case_id is a catalog/pll.json case id (not a foreign key: the
-- catalog lives outside the DB).
CREATE TABLE solves (
  id         TEXT PRIMARY KEY,           -- uuid, made by the client
  case_id    TEXT NOT NULL,              -- e.g. "pll-Ua"
  ms         INTEGER NOT NULL CHECK (ms > 0),
  scramble   TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX solves_case ON solves (case_id, created_at);
