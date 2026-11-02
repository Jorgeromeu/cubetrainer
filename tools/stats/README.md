# Stats

Your solve history, imported from timers' exports, as charts and a table. Behaviour: `openspec/specs/stats`.

- `contract.ts`: API request and response types, limits
- `app/`: the view (`app/index.ts` exports the `Tool`), its stylesheet and client state
- `server/`: routes (`server/index.ts` exports the `ServerTool`), repository, `migrations/`

## API

Types in `contract.ts`. Imports are one-off (the app has no import UI), e.g.
`jq -Rs '{format:"cubetime",text:.,handScrambled:true,penaltiesUnreliable:true}' export.csv | curl -X POST -H 'Content-Type: application/json' -d @- localhost:3001/api/stats/import`.

| | |
|---|---|
| `GET /api/stats/solves` | `{ solves: Solve[] }`, oldest first |
| `PATCH /api/stats/solves/:id` | body `{ excluded, reason? }`; excludes a solve from the stats (it stays in the DB, so re-imports skip it) or includes it again; returns the `Solve` |
| `GET /api/stats/milestones` | `{ milestones: Milestone[] }`, by start day |
| `PUT /api/stats/milestones/:id` | body `{ label, startDay, endDay? }` (days like `"2026-09-05"`, both included; no `endDay` for a single day), id = a client-made uuid; creates or replaces it, returns the `Milestone` |
| `DELETE /api/stats/milestones/:id` | removes it; `null` |
| `POST /api/stats/import` | body `{ format: "cubetime", text, handScrambled?, penaltiesUnreliable? }` (the export file's contents; the two flags default to false and mark every solve in it); adds its solves in one transaction, skipping ones already there (same source, `solved_at` and `ms`); returns `{ added, skipped }` |

## Schema (`data/stats.sqlite`)

- `solves` (migration 001): one row per imported solve (`id`, `ms`, `penalty`, `scramble`,
  `comment`, `solved_at` from the timer, `source` (the export format), `created_at`),
  unique on (`source`, `solved_at`, `ms`).
- `scrambled_by` (migration 002): `timer`, or `hand` when the timer's `scramble` wasn't
  used (it's kept anyway). `penalty_known`: 0 when +2s and DNFs weren't reliably marked.
  002 marked every solve until then as `hand` and 0. The `thecubeapp` rows (151, July to
  September) were added straight into the DB, not through the import endpoint.
- `excluded`, `excluded_reason` (migration 003): a solve left out of every stat. Exclude
  instead of deleting: a deleted solve comes back with the next import of its file.
- `milestones` (migration 004): days or ranges of days on the timeline (`label`,
  `start_day`, `end_day` or NULL, `created_at`), drawn on the app's date charts.
