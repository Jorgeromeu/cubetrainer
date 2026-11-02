# Proposal: user data on a hosted server, for more than one client

## Why

A phone client is planned (web tech or native, not decided). It can't reach a server that only
runs on the laptop, and it will often be offline. Today the server has no auth, deletes leave no
trace, there's no way to ask "what changed", the app drops writes made with no server, and
choices you'd want on every device (PLL case selection, saved F2L filters) live in one browser.
The client-made ids and idempotent saves we already have make this a small step, not a rewrite.

## What Changes

- The server can be self-hosted (home machine over Tailscale, or a small VPS) behind one
  single-user access token. Locally, with no token configured, it stays open but only on
  loopback.
- Clients have a configurable API location and token, so the web app, a PWA and a native app
  can all point at the same server.
- The HTTP API is the client-neutral contract: plain JSON, only additive changes, breaking ones
  under a new route. A small server info endpoint tells clients which tools are up and which
  catalog versions the server validates against.
- Offline writes are kept in an outbox on the client and replayed in order when the server is back.
- Deletes leave tombstones, and each tool has a change feed, so a second client can catch up.
- Conflicts: last write wins, per record, in server receive order.
- Each tool has JSON export and import, which replaces "copy the SQLite files" as the backup.
- Synced preferences: choices that belong to you, not to a device, move to the server, per tool.
  Device preferences (stealth, cube display, tempo, timer start mode, layout) stay per browser.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `architecture`: hosted single-user deployment, access token, configurable API location,
  client-neutral API, additive API changes, server info, offline outbox.
- `user-data`: tombstones, change feed, last write wins, export/import (replaces manual backups),
  synced preferences.
- `tool-shell`: preferences split into device and synced.

## Impact

- Server: auth check, bind address, `GET /api/info`, per-tool `changes`, `export`, `import`,
  `prefs` routes; migrations adding `deleted_at`/`updated_at` where missing.
- Clients: outbox and replay in core's API client; settings UI for server location and token
  (device preference).
- Tools: PLL selection and F2L saved filters/link kinds move from `localStorage` to `prefs`,
  imported once from the browser on first load.
- Depends on `restructure-workspaces` (contracts and core API client).
- Stealth impact: the server settings section and the "pending changes" indicator follow
  stealth-mode (monochrome chrome).
