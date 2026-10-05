-- User data (requirements §5.2). Never wiped; change it only through new migrations.

-- Custom algs the user adds when the catalog lacks one they like (stage 2).
CREATE TABLE user_algs (
  id           TEXT PRIMARY KEY,           -- uuid
  slot_case_id TEXT NOT NULL,              -- catalog slot-case id, e.g. "f2l-12-FR"
  moves        TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX user_algs_slot_case ON user_algs (slot_case_id);

-- One row per slot-case that has a main alg. The main alg is either a catalog alg
-- (id from catalog/f2l.json, not a foreign key: the catalog lives outside the DB) or a
-- user alg. Catalog alg ids are content-derived, so they survive catalog rebuilds.
CREATE TABLE slot_case_progress (
  slot_case_id  TEXT PRIMARY KEY,
  main_alg_kind TEXT NOT NULL CHECK (main_alg_kind IN ('catalog', 'user')),
  main_alg_id   TEXT NOT NULL,
  learnt        INTEGER NOT NULL DEFAULT 0 CHECK (learnt IN (0, 1)),
  updated_at    TEXT NOT NULL
);
