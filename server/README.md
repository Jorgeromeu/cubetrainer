# server

The user-data API: one module per trainer, each with its own routes under `/api/<id>/`
and its own SQLite file `data/<id>.sqlite`: F2L's progress (main algs, alg statuses, notes, video links)
PLL's timed solves, and PLL compare's named sets.

```sh
npm run dev      # API on http://localhost:3001, restarts on change (run app/'s npm run dev too)
npm start        # same, no watch; also serves app/dist if it's been built
```

No dependencies: `node:http` + `node:sqlite`, `.ts` run directly. Requires Node ≥ 23.6.

| Env | Default |
|---|---|
| `PORT` | `3001` |
| `DATA_DIR` | `../data` (gitignored; its `*.sqlite` files **are** your progress, back them up) |

## Layout

| Path | What |
|---|---|
| `src/main.ts` | HTTP server: sends `/api/<id>/...` to that trainer's routes, serves `app/dist`. |
| `src/trainer.ts` | What a trainer provides: `ServerTrainer` (id + routes), `ApiRoute`. |
| `src/trainers.ts` | The list of trainers. |
| `src/http.ts` | JSON helpers, `InvalidRequest` (→ 400), route matching. |
| `src/db.ts` | Opens a trainer's DB and applies its migrations. |
| `src/trainers/<id>/` | One trainer: `index.ts` (its routes), its repository, `migrations/`. |

Trainers are isolated:

- A trainer only sees the routes under its prefix and its own DB file, so it can't touch
  another's data, and its migration numbers are its own.
- If one fails at startup (a bad migration, a missing catalog), only it is disabled: its
  routes answer 503 and the server log says why; the other trainers and the app keep working.
  A failed migration is rolled back.

### Adding a trainer's server part

1. `src/trainers/<id>/index.ts` exporting a `ServerTrainer` with the same `id` as the
   app's trainer. In `routes({ openDb, repoRoot })`, call
   `openDb(join(import.meta.dirname, "migrations"))` if it stores anything.
2. `src/trainers/<id>/migrations/001_*.sql`, …
3. Its request/response types in `../shared/<id>/`.
4. List it in `src/trainers.ts`.

## F2L API

Types in `../shared/f2l/progress.ts`.

| | |
|---|---|
| `GET /api/f2l/progress` | `{ progress: SlotCaseProgress[], algs: AlgState[], notes: Note[], videos: VideoLink[], userAlgs: UserAlg[] }` |
| `PUT /api/f2l/progress/:slotCaseId` | body `{ mainAlg: { kind, id } \| null }`; returns the saved entry, or `null` when `mainAlg` is null (clears it) |
| `PATCH /api/f2l/algs/:kind/:id` | body `{ status: "learning" \| "learnt" \| null }`; returns the `AlgState`, or `null` when cleared |
| `PUT /api/f2l/notes/:id` | body `{ alg, symmetry: "none" \| "lr" \| "fb" \| "both" \| "linked", text }`, id = a client-made uuid; creates or updates, returns the `Note`, or `null` when `text` is empty (deletes it) |
| `PUT /api/f2l/videos/:kind/:id` | body `{ url: string \| null }` (an http(s) link); returns the `VideoLink`, or `null` when `url` is null (removes it) |
| `PUT /api/f2l/user-algs/:id` | body `{ slotCaseId, moves }` (space-separated moves, up to 200 characters), id = a client-made uuid; adds an alg of your own and returns the `UserAlg`. Saving the same alg again returns it as it was; moves the catalog (or you) already have for that slot-case are refused. Only the notation is checked here: the app checks on the cube that it solves the case |
| `DELETE /api/f2l/user-algs/:id` | deletes it, and with it its main-alg row, status, notes and video link; `null` |

A main alg is an `AlgRef`: `{ kind: "catalog", id }` for an alg in `catalog/f2l.json`,
or `{ kind: "user", id }` for a custom alg in `user_algs`. The server checks the alg
exists and belongs to that slot-case (for both endpoints).

## PLL API

Types in `../shared/pll/solves.ts`.

| | |
|---|---|
| `GET /api/pll/solves` | `{ solves: Solve[] }`, oldest first |
| `PUT /api/pll/solves/:id` | body `{ caseId, ms, scramble, penalty? }` (penalty `"ok"` \| `"+2"` \| `"dnf"`, default ok), id = a client-made uuid; returns the `Solve`. Saving an existing id again returns it as it was (so retries are safe) |
| `PATCH /api/pll/solves/:id` | body `{ penalty }`; returns the `Solve` |
| `DELETE /api/pll/solves/:id` | removes it; `null` |

## PLL compare API

Types in `../shared/pll-compare/sets.ts`.

| | |
|---|---|
| `GET /api/pll-compare/sets` | `{ sets: CompareSet[] }`, by name |
| `PUT /api/pll-compare/sets/:id` | body `{ name, cubes: [{ caseId, variant, turn, blocks? }] }` (1–24 cubes; variant and turn 0–3; blocks: up to 4 `{ color, caption, stickers }`, one a colour 0–3, caption up to 60 characters, stickers such as `"e7"`, `"c14"`, `"m2"` (see `isSticker`), each in one block). Sets saved with the older `marks` (plain stickers) are read back as one block in colour 0, id = a client-made uuid; creates or replaces it, returns the `CompareSet`. Names are unique ignoring case (400 if another set has it) |
| `DELETE /api/pll-compare/sets/:id` | removes it; `null` |

## Stats API

Types in `../shared/stats/solves.ts`. Imports are one-off (the app has no import UI), e.g.
`jq -Rs '{format:"cubetime",text:.,handScrambled:true,penaltiesUnreliable:true}' export.csv | curl -X POST -H 'Content-Type: application/json' -d @- localhost:3001/api/stats/import`.

| | |
|---|---|
| `GET /api/stats/solves` | `{ solves: Solve[] }`, oldest first |
| `PATCH /api/stats/solves/:id` | body `{ excluded, reason? }`; excludes a solve from the stats (it stays in the DB, so re-imports skip it) or includes it again; returns the `Solve` |
| `GET /api/stats/milestones` | `{ milestones: Milestone[] }`, by start day |
| `PUT /api/stats/milestones/:id` | body `{ label, startDay, endDay? }` (days like `"2026-09-05"`, both included; no `endDay` for a single day), id = a client-made uuid; creates or replaces it, returns the `Milestone` |
| `DELETE /api/stats/milestones/:id` | removes it; `null` |
| `POST /api/stats/import` | body `{ format: "cubetime", text, handScrambled?, penaltiesUnreliable? }` (the export file's contents; the two flags default to false and mark every solve in it); adds its solves in one transaction, skipping ones already there (same source, `solved_at` and `ms`); returns `{ added, skipped }` |

## Stats schema (`data/stats.sqlite`)

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

## PLL compare schema (`data/pll-compare.sqlite`)

- `sets` (migration 001): one row per named set (`id`, `name` unique without case, `cubes` as
  JSON, `created_at`, `updated_at`).

## PLL schema (`data/pll.sqlite`)

- `solves` (migration 001): one row per timed solve (`id`, `case_id` from `catalog/pll.json`,
  `ms` as timed, `scramble`, `created_at`). `penalty` (migration 002): `ok`, `+2` or `dnf`.

## F2L schema (`data/f2l.sqlite`)

`src/trainers/f2l/migrations/NNN_*.sql`, applied in order on startup (`src/db.ts`), tracked
by the DB's `PRAGMA user_version`. Never edit an applied migration; add a new file.

- `slot_case_progress`: slot-case id, main alg (`main_alg_kind`, `main_alg_id`), `updated_at`.
- `alg_state` (migration 003): one row per alg with a status (`alg_kind`, `alg_id`,
  `slot_case_id`, `status`, `updated_at`). It replaced `learnt_algs` (migration 002).
- `notes` (migration 005): one row per note (`id`, `alg_kind`, `alg_id`, `slot_case_id`,
  `follows`, `text`, timestamps). `follows` (migration 007, replacing 005/006's `symmetry`)
  is the comma-separated link kinds (catalog `LinkKind`) the note spreads along; the app
  shows it on the alg it was written on and every alg those links reach, transitively.
  005 also moved the old per-alg note column into it and dropped 004's short-lived `family_notes`.
- `video_links` (migration 008): one row per alg with a video link (`alg_kind`, `alg_id`,
  `slot_case_id`, `url`, `updated_at`).
- `user_algs` (migration 001): algs you added yourself (`id`, `slot_case_id`, `moves`,
  `created_at`). Main alg, status, notes and video links refer to them as `kind: "user"`;
  deleting one deletes those rows too.

Catalog alg ids are derived from the alg's content, so they survive catalog rebuilds. If
a rebuild drops an alg that's someone's main alg, the progress row stays and the app
shows "No longer in the catalog".
