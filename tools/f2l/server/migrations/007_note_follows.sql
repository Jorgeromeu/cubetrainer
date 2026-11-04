-- Notes follow typed links instead of a symmetry: `follows` lists the link kinds (catalog
-- LinkKind, comma-separated, '' for none) the note spreads along from the alg it was
-- written on. The old symmetries map onto them: lr -> the left-right mirror, fb -> the
-- front-back mirror, both -> both mirrors and the 180° turn (a rotation link), linked ->
-- every kind.

CREATE TABLE notes_new (
  id           TEXT PRIMARY KEY,
  alg_kind     TEXT NOT NULL CHECK (alg_kind IN ('catalog', 'user')),
  alg_id       TEXT NOT NULL,
  slot_case_id TEXT NOT NULL,
  follows      TEXT NOT NULL,
  text         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
INSERT INTO notes_new
SELECT id, alg_kind, alg_id, slot_case_id,
  CASE symmetry
    WHEN 'none' THEN ''
    WHEN 'lr' THEN 'mirrorLR'
    WHEN 'fb' THEN 'mirrorFB'
    WHEN 'both' THEN 'mirrorLR,mirrorFB,rotation'
    ELSE 'mirrorLR,mirrorFB,rotation,transpose'
  END,
  text, created_at, updated_at
FROM notes;
DROP TABLE notes;
ALTER TABLE notes_new RENAME TO notes;
CREATE INDEX notes_alg ON notes (alg_kind, alg_id);
