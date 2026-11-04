-- Milestones on the timeline: a day ("first sub-20") or a range of days ("learning PLL"),
-- drawn on the date charts. Days are local calendar days, both ends included.
CREATE TABLE milestones (
  id         TEXT PRIMARY KEY,            -- uuid
  label      TEXT NOT NULL,
  start_day  TEXT NOT NULL,               -- "2026-09-05"
  end_day    TEXT,                        -- NULL for a single day
  created_at TEXT NOT NULL,
  CHECK (end_day IS NULL OR end_day >= start_day)
);
