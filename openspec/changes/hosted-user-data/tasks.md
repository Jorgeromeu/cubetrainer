# Tasks

Requires `restructure-workspaces` to be done first.

## 1. Server: exposure and info

- [ ] 1.1 `HOST` (default `127.0.0.1`), `API_TOKEN`, refuse non-loopback without a token
- [ ] 1.2 Bearer token check on `/api/*`, 401 `Unauthorized`, token never logged
- [ ] 1.3 Request size limit (1 MB; import routes higher)
- [ ] 1.4 `GET /api/info`: API version, tool states, catalog versions (add a version/hash field to `catalog/*.json` in catalog-builder)

## 2. Server: sync primitives

- [ ] 2.1 Migrations per tool: `deleted_at` on every user table, `updated_at` where missing
- [ ] 2.2 Deletes become tombstones; lists and gets skip them; a PUT on a tombstoned id restores it
- [ ] 2.3 `GET /api/<id>/changes?since=` per tool, with an opaque cursor
- [ ] 2.4 `GET /api/<id>/export` and `POST /api/<id>/import` per tool (`formatVersion` = migration number)
- [ ] 2.5 `GET`/`PUT /api/<id>/prefs` for f2l and pll, validated against each contract

## 3. Client: core

- [ ] 3.1 API client: configurable base URL and token, `Authorization` header, 401 told apart from no server
- [ ] 3.2 Persisted outbox, ordered replay, drop-on-4xx with the error surfaced
- [ ] 3.3 Synced preference backend (server record + device cache + outbox), one-off import from old local keys

## 4. Client: app

- [ ] 4.1 Server settings section (location, token, test connection), as a device preference; stealth variant
- [ ] 4.2 Offline notice shows waiting changes ("N changes not sent yet")
- [ ] 4.3 Move PLL selection and F2L saved filters, link kinds and focus to synced preferences
- [ ] 4.4 Tools keep loaded data on screen while offline and write through the outbox
- [ ] 4.5 "Export everything" / "Import" in the settings menu

## 5. Docs and hosting

- [ ] 5.1 Server README: hosting with Tailscale (or a reverse proxy with TLS), env vars, backup via export
- [ ] 5.2 Update the affected main specs on archive; drop the manual-backup notes from the root README
