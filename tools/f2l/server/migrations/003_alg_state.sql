-- Everything about an alg except whether it's main (that stays per slot-case in
-- slot_case_progress): a learning status and a personal note. Replaces learnt_algs.
-- A row only exists while it holds something (a status or a non-empty note).

CREATE TABLE alg_state (
  alg_kind     TEXT NOT NULL CHECK (alg_kind IN ('catalog', 'user')),
  alg_id       TEXT NOT NULL,
  slot_case_id TEXT NOT NULL,              -- the alg's slot-case, kept for per-slot-case queries
  status       TEXT CHECK (status IN ('learning', 'learnt')),   -- NULL: no status
  note         TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (alg_kind, alg_id)
);
CREATE INDEX alg_state_slot_case ON alg_state (slot_case_id);

INSERT INTO alg_state (alg_kind, alg_id, slot_case_id, status, updated_at)
  SELECT alg_kind, alg_id, slot_case_id, 'learnt', learnt_at FROM learnt_algs;

DROP TABLE learnt_algs;
