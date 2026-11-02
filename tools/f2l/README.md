# F2L

The F2L alg explorer: every case in every slot over `catalog/f2l.json`, with your main algs, statuses, notes, video links and algs of your own. Behaviour: `openspec/specs/f2l-catalog`, `user-data`.

- `contract.ts`: API request and response types, limits
- `app/`: the view (`app/index.ts` exports the `Tool`), its stylesheet and client state
- `server/`: routes (`server/index.ts` exports the `ServerTool`), repository, `migrations/`

## API

Types in `contract.ts`.

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

## Schema (`data/f2l.sqlite`)

`server/migrations/NNN_*.sql`, applied in order on startup (`server/src/db.ts`), tracked
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
