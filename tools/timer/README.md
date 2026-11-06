# Timer

Times solves and keeps every full solve, timed here or imported from another timer's export,
each tagged with its `source` (and its import). Its stats page charts them all. Behaviour:
`openspec/specs/tools/timer`.

- `contract.ts`: API request and response types, limits, exposed calls (`timerExposes`)
- `app/`: the timer page (`TimerView.tsx`, `useTimer.ts`), the stats page (`Stats.tsx`,
  `Charts.tsx`, `analysis.ts`), the shared client state (`solves.ts`); `app/index.ts` exports
  the `Tool`
- `server/`: routes (`server/index.ts` exports the `ServerTool`), repositories, `migrations/`

## Pages

| | |
|---|---|
| `#/timer` | Hold Space (or press the time) until it's green, release to start, any key stops. The last solve can be marked OK / +2 / DNF or deleted. ao5, ao12, ao100 and the latest 12 solves of every source. |
| `#/timer/stats` | Every solve, charted (see `openspec/specs/tools/timer`). |

## Clients

The web app only, for now. A phone client (the hosted web app, later an iOS app) is planned:
once it uses this API, the API only grows (openspec/specs/foundation/architecture, "Clients").

## API

Types in `contract.ts`.

| | |
|---|---|
| `GET /api/timer/solves` | `{ solves: Solve[] }`, oldest first, excluded ones included |
| `PUT /api/timer/solves/:id` | body `{ ms, penalty, scramble, solvedAt }`, id = an app-made uuid; saves a solve timed here (`source: "timer"`); saving it again returns it unchanged |
| `PATCH /api/timer/solves/:id` | body `{ excluded?, reason?, penalty? }`; excludes a solve from the stats (it stays in the DB, so re-imports skip it) or includes it again, and/or sets its penalty (then known); returns the `Solve` |
| `DELETE /api/timer/solves/:id` | deletes a solve timed here; imported ones are refused (exclude them, or undo their import); `null` |
| `POST /api/timer/import` | body `{ format: "cubetime", text, fileName?, handScrambled?, penaltiesUnreliable? }` (the export file's contents; the two flags default to false and mark every solve in it); adds its solves in one transaction, skipping ones already there (same source, `solved_at` and `ms`), records the import; returns `{ import, added, skipped }` (`import` null when nothing was added) |
| `GET /api/timer/imports` | `{ imports: Import[] }`, oldest first |
| `DELETE /api/timer/imports/:id` | undoes an import: removes it and every solve it added; `null` |
| `GET /api/timer/milestones` | `{ milestones: Milestone[] }`, by start day |
| `PUT /api/timer/milestones/:id` | body `{ label, startDay, endDay? }` (days like `"2026-09-05"`, both included; no `endDay` for a single day), id = a client-made uuid; creates or replaces it, returns the `Milestone` |
| `DELETE /api/timer/milestones/:id` | removes it; `null` |

Imports are one-off (the app has no import UI), e.g.

```sh
jq -Rs '{format:"cubetime",text:.,fileName:"session.csv",handScrambled:true,penaltiesUnreliable:true}' session.csv \
  | curl -X POST -H 'Content-Type: application/json' -d @- localhost:3001/api/timer/import
```

## Exposed to other tools

| Call | Result |
|---|---|
| `timerExposes.solves` (`GET /api/timer/exposed/solves`) | `{ solves: Solve[] }`: every solve, oldest first, excluded ones included and marked |

## Schema (`data/timer.sqlite`)

- `solves` (migration 001): one row per solve (`id`, `ms`, `penalty`, `scramble`, `comment`,
  `solved_at`, `source`, `created_at`), unique on (`source`, `solved_at`, `ms`).
- `scrambled_by` (migration 002): `timer`, or `hand` when the timer's `scramble` wasn't
  used (it's kept anyway). `penalty_known`: 0 when +2s and DNFs weren't reliably marked.
  002 marked every solve until then as `hand` and 0. The `thecubeapp` rows (151, July to
  September) were added straight into the DB, not through the import endpoint.
- `excluded`, `excluded_reason` (migration 003): a solve left out of every stat. Exclude
  instead of deleting: a deleted solve comes back with the next import of its file.
- `milestones` (migration 004): days or ranges of days on the timeline (`label`,
  `start_day`, `end_day` or NULL, `created_at`), drawn on the stats page's date charts.
- `imports`, `solves.import_id` (migration 005): one row per import (`source`, `file_name`,
  `imported_at`, `added`, `skipped`); solves timed here have no import. The solves from
  before 005 point to one `before-<source>` import per source.

001–004 were the stats tool's (`data/stats.sqlite`). That file was renamed to
`data/timer.sqlite` by hand; a checkout that still has `data/stats.sqlite` needs the same
rename (server stopped) before starting, or the timer starts empty.
