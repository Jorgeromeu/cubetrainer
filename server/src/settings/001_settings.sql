-- Settings, kept by the server host (not a tool): one JSON object per owner (a tool id, or
-- a library's '<library>.<name>'). See packages/core/settings.ts.
CREATE TABLE settings (
  owner      TEXT PRIMARY KEY,
  value      TEXT NOT NULL,           -- JSON object
  updated_at TEXT NOT NULL
);
