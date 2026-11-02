-- Named sets of cubes for the PLL compare trainer. Never wiped; change it only through new
-- migrations.

-- cubes is a JSON array of { caseId, variant, turn } (shared/pll-compare/sets.ts); case
-- ids are catalog/pll.json's (not foreign keys: the catalog lives outside the DB).
CREATE TABLE sets (
  id         TEXT PRIMARY KEY,                  -- uuid, made by the client
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  cubes      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
