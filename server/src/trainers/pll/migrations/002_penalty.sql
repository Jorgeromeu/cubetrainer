-- A penalty per solve, as on any cubing timer: none, +2 seconds, or DNF.
ALTER TABLE solves ADD COLUMN penalty TEXT NOT NULL DEFAULT 'ok' CHECK (penalty IN ('ok', '+2', 'dnf'));
