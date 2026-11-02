-- A video for an alg (a tutorial, an example solve): one http(s) link per alg. A row only
-- exists while the alg has a link.

CREATE TABLE video_links (
  alg_kind     TEXT NOT NULL CHECK (alg_kind IN ('catalog', 'user')),
  alg_id       TEXT NOT NULL,
  slot_case_id TEXT NOT NULL,              -- the alg's slot-case, kept for per-slot-case queries
  url          TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (alg_kind, alg_id)
);
