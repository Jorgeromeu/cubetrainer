-- Notes become their own thing: an alg can have several, and each says which of the alg's
-- mirrored versions it also applies to (symmetry):
--   none: just this alg · lr: + its left-right mirror · fb: + its front-back mirror
--   both: the alg in all four slots (both mirrors, and the alg turned 180°)
-- Replaces alg_state.note (carried over as symmetry 'none') and the unused family_notes.

CREATE TABLE notes (
  id         TEXT PRIMARY KEY,             -- uuid, chosen by the client
  alg_kind   TEXT NOT NULL CHECK (alg_kind IN ('catalog', 'user')),
  alg_id     TEXT NOT NULL,                -- the alg it was written on
  slot_case_id TEXT NOT NULL,
  symmetry   TEXT NOT NULL CHECK (symmetry IN ('none', 'lr', 'fb', 'both')),
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX notes_alg ON notes (alg_kind, alg_id);

INSERT INTO notes (id, alg_kind, alg_id, slot_case_id, symmetry, text, created_at, updated_at)
  SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
               substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
         alg_kind, alg_id, slot_case_id, 'none', note, updated_at, updated_at
  FROM alg_state WHERE trim(note) != '';

DELETE FROM alg_state WHERE status IS NULL;
ALTER TABLE alg_state DROP COLUMN note;

DROP TABLE family_notes;
