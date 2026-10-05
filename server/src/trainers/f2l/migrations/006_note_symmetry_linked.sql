-- A fifth note symmetry, 'linked': the note shows everywhere the alg's idea does (its
-- mirrored/turned versions and the same execution after a rotation, and so on). SQLite
-- can't change a CHECK constraint in place, so the table is rebuilt.

CREATE TABLE notes_new (
  id           TEXT PRIMARY KEY,
  alg_kind     TEXT NOT NULL CHECK (alg_kind IN ('catalog', 'user')),
  alg_id       TEXT NOT NULL,
  slot_case_id TEXT NOT NULL,
  symmetry     TEXT NOT NULL CHECK (symmetry IN ('none', 'lr', 'fb', 'both', 'linked')),
  text         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
INSERT INTO notes_new SELECT id, alg_kind, alg_id, slot_case_id, symmetry, text, created_at, updated_at FROM notes;
DROP TABLE notes;
ALTER TABLE notes_new RENAME TO notes;
CREATE INDEX notes_alg ON notes (alg_kind, alg_id);
