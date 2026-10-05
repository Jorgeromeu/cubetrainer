# server

The user-data API: one module per trainer, each with its own routes under `/api/<id>/`
and its own SQLite file `data/<id>.sqlite`. Today only F2L stores anything (main algs,
alg statuses, notes); PLL has no server part.

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
| `GET /api/f2l/progress` | `{ progress: SlotCaseProgress[], algs: AlgState[], notes: Note[] }` |
| `PUT /api/f2l/progress/:slotCaseId` | body `{ mainAlg: { kind, id } \| null }`; returns the saved entry, or `null` when `mainAlg` is null (clears it) |
| `PATCH /api/f2l/algs/:kind/:id` | body `{ status: "learning" \| "learnt" \| null }`; returns the `AlgState`, or `null` when cleared |
| `PUT /api/f2l/notes/:id` | body `{ alg, symmetry: "none" \| "lr" \| "fb" \| "both" \| "linked", text }`, id = a client-made uuid; creates or updates, returns the `Note`, or `null` when `text` is empty (deletes it) |

A main alg is an `AlgRef`: `{ kind: "catalog", id }` for an alg in `catalog/f2l.json`,
or `{ kind: "user", id }` for a custom alg in `user_algs`. The server checks the alg
exists and belongs to that slot-case (for both endpoints).

## F2L schema (`data/f2l.sqlite`)

`src/trainers/f2l/migrations/NNN_*.sql`, applied in order on startup (`src/db.ts`), tracked
by the DB's `PRAGMA user_version`. Never edit an applied migration; add a new file.

- `slot_case_progress`: slot-case id, main alg (`main_alg_kind`, `main_alg_id`), `updated_at`.
- `alg_state` (migration 003): one row per alg with a status (`alg_kind`, `alg_id`,
  `slot_case_id`, `status`, `updated_at`). It replaced `learnt_algs` (migration 002).
- `notes` (migration 005): one row per note (`id`, `alg_kind`, `alg_id`, `slot_case_id`,
  `symmetry`, `text`, timestamps). The app shows a note on the alg it was written on and on
  the family members (same catalog `familyId`) its symmetry reaches; `linked` (migration 006)
  reaches the alg's whole idea: family and execution (`executionId`) links, transitively.
  005 also moved the old per-alg note column into it and dropped 004's short-lived `family_notes`.
- `user_algs`: custom algs per slot-case. The table exists, but there are no endpoints
  or UI for it yet. Adding them means: routes in `src/trainers/f2l/index.ts`,
  functions in `src/trainers/f2l/progress.ts`, and showing them in the app's alg list.
  Progress already accepts `kind: "user"` refs.

Catalog alg ids are derived from the alg's content, so they survive catalog rebuilds. If
a rebuild drops an alg that's someone's main alg, the progress row stays and the app
shows "No longer in the catalog".
