-- Learnt is a property of an alg, not of a slot-case: you can know several algs for a
-- case, and knowing one says nothing about another. A row = "I know this alg".

CREATE TABLE learnt_algs (
  alg_kind     TEXT NOT NULL CHECK (alg_kind IN ('catalog', 'user')),
  alg_id       TEXT NOT NULL,
  slot_case_id TEXT NOT NULL,              -- the alg's slot-case, kept for per-slot-case queries
  learnt_at    TEXT NOT NULL,
  PRIMARY KEY (alg_kind, alg_id)
);
CREATE INDEX learnt_algs_slot_case ON learnt_algs (slot_case_id);

-- Carry over: a learnt slot-case meant its main alg was learnt.
INSERT INTO learnt_algs (alg_kind, alg_id, slot_case_id, learnt_at)
  SELECT main_alg_kind, main_alg_id, slot_case_id, updated_at FROM slot_case_progress WHERE learnt = 1;

ALTER TABLE slot_case_progress DROP COLUMN learnt;
