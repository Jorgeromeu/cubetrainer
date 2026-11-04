-- Excluding a solve instead of deleting it: it stays out of every stat, but stays in the
-- table, so a re-import (which skips solves already here) can't bring it back.
ALTER TABLE solves ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1));
ALTER TABLE solves ADD COLUMN excluded_reason TEXT NOT NULL DEFAULT '';
