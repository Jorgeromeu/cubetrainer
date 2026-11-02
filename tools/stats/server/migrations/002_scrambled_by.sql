-- How far a solve's record can be trusted.
--   scrambled_by: 'timer' (scrambled with its `scramble`) or 'hand' (scrambled by hand;
--     `scramble` is kept, but it's only what the timer showed, not what was solved).
--   penalty_known: 0 when +2s and DNFs weren't reliably marked, so `penalty` may say
--     'ok' for a solve that wasn't.
ALTER TABLE solves ADD COLUMN scrambled_by TEXT NOT NULL DEFAULT 'timer' CHECK (scrambled_by IN ('timer', 'hand'));
ALTER TABLE solves ADD COLUMN penalty_known INTEGER NOT NULL DEFAULT 1 CHECK (penalty_known IN (0, 1));

-- Every solve up to now (CubeTime and the Cube app, July to October 2026) was scrambled
-- by hand, and penalties weren't tracked.
UPDATE solves SET scrambled_by = 'hand', penalty_known = 0;
