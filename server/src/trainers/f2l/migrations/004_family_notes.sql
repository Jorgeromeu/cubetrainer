-- The note on an alg's idea, shared by the alg in all four slots (its mirrored and turned
-- versions). Keyed by the catalog's familyId: the id of the family's front-right version.
-- Per-alg notes stay in alg_state.note. A row only exists while its note is non-empty.

CREATE TABLE family_notes (
  family_id  TEXT PRIMARY KEY,
  note       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
