# Design

## Context

Server: one Node process, one SQLite file per tool, client-made UUIDs, idempotent `PUT`s,
server timestamps, strict validation. App: an API client that tells "refused" apart from "no
server", with retries but no queue. The iOS client is undecided, so nothing here may assume the
client is the web app.

## Goals / Non-Goals

**Goals:**
- One server, reachable from any of your devices, safe to expose.
- Any client (web, PWA, Capacitor, native) can work offline and catch up later.
- Backups that don't depend on SQLite.

**Non-Goals:**
- Accounts, multiple users, OAuth, sharing.
- Full local-first replication (a complete database on each device). The outbox plus change feed
  covers one person on two or three devices.
- Real-time push. Clients pull on load, on focus and on a timer.
- Hosting automation. The spec says what the server needs, not where it runs.

## Decisions

### Auth: one bearer token

`API_TOKEN` env var. When set, every `/api/*` request needs `Authorization: Bearer <token>`,
else 401. When unset, the server binds only to loopback (`HOST` defaults to `127.0.0.1`) and
refuses to start on any other address. TLS comes from the host (Tailscale, or a reverse proxy),
not from Node. *Alternative:* basic auth through a proxy only. Rejected, because a native client
would then depend on the proxy setup.

### Outbox in core's API client

Each write call (PUT/PATCH/DELETE/POST) goes into a persisted, ordered queue keyed by a request id.
It is sent at once if the server is up, otherwise replayed in order on reconnect. Idempotent
endpoints make a replay after a lost response safe. A 4xx on replay drops that entry and shows
the error, because it will never succeed. A network failure keeps it. The queue lives in device
storage (localStorage for the web; whatever the platform has for a native client).

Non-idempotent endpoints must become idempotent before they can be queued: `POST /stats/import`
already skips duplicates, and the rest are PUT/PATCH/DELETE by id.

### Change feed and tombstones

Every user table gets `updated_at` (most have it) and `deleted_at`. A delete sets `deleted_at`
instead of removing the row, and normal reads hide tombstoned rows.
`GET /api/<id>/changes?since=<cursor>` returns
`{ cursor, changes: [{ type, id, record | null, updatedAt }] }`. The cursor is an opaque string
(today: the max `updated_at` seen, plus a tiebreak). Tombstones are kept forever: for one user
the cost is nothing, and it means a device offline for months can still catch up.

### Last write wins

The server applies writes in the order it receives them. A replayed stale write overwrites a newer
one from another device. That's accepted: one person rarely edits the same record on two devices
while both are offline. *Alternative:* version checks with 409 on conflict. Possible later
per-endpoint, without changing the feed.

### Export / import

`GET /api/<id>/export` returns `{ tool, formatVersion, exportedAt, data }` with tombstones
included. `POST /api/<id>/import` upserts by id (last write wins on `updatedAt`), so importing the
same file twice is a no-op. `formatVersion` is the tool's migration number, and import
refuses a newer one. The web app gets one "Export everything" button that downloads every
tool's export in one JSON file.

### Synced preferences

Each tool owns a `prefs` record (`GET/PUT /api/<id>/prefs`, a JSON object checked against its
contract). The shell's preference helper gets a second backend: `synced(key)` is read from the
tool's prefs, cached in device storage for offline use, and written through the outbox.

Proposed split (REVIEW):
- synced: `pll.selection`; F2L `savedFilters`, `linkKinds`, `focusMissing`.
- device: stealth, cube display, tempo, PLL start mode and countdown, F2L legend filter in use,
  setup mode, stats chart settings.

## Risks / Trade-offs

- Exposing the server raises the stakes of its validation code. It is already strict. Add a
  request size limit (1 MB, except import) as part of this change.
- The outbox can hold writes the user thinks are saved. A small "N changes not sent yet"
  indicator replaces today's "No server" notice whenever the queue isn't empty.
- Tombstones change every repository's delete and list queries: a mechanical change, but in
  every tool.
- A native client must re-implement the outbox. It is small, and specced in user-data, so
  that's acceptable.
