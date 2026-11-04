-- A third alg status before learning: wanted ("want to learn"). SQLite can't change a
-- CHECK constraint, so alg_state is rebuilt with the wider one.

CREATE TABLE alg_state_new (
  alg_kind     TEXT NOT NULL CHECK (alg_kind IN ('catalog', 'user')),
  alg_id       TEXT NOT NULL,
  slot_case_id TEXT NOT NULL,              -- the alg's slot-case, kept for per-slot-case queries
  status       TEXT CHECK (status IN ('wanted', 'learning', 'learnt')),   -- NULL: no status
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (alg_kind, alg_id)
);

INSERT INTO alg_state_new (alg_kind, alg_id, slot_case_id, status, updated_at)
  SELECT alg_kind, alg_id, slot_case_id, status, updated_at FROM alg_state;

DROP TABLE alg_state;
ALTER TABLE alg_state_new RENAME TO alg_state;
CREATE INDEX alg_state_slot_case ON alg_state (slot_case_id);
