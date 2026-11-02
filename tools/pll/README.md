# PLL

The scramble trainer: timed scrambles for the PLL cases you pick, from `catalog/pll.json`. Behaviour: `openspec/specs/pll-trainer`.

- `contract.ts`: API request and response types, limits
- `app/`: the view (`app/index.ts` exports the `Tool`), its stylesheet and client state
- `server/`: routes (`server/index.ts` exports the `ServerTool`), repository, `migrations/`

## API

Types in `contract.ts`.

| | |
|---|---|
| `GET /api/pll/solves` | `{ solves: Solve[] }`, oldest first |
| `PUT /api/pll/solves/:id` | body `{ caseId, ms, scramble, penalty? }` (penalty `"ok"` \| `"+2"` \| `"dnf"`, default ok), id = a client-made uuid; returns the `Solve`. Saving an existing id again returns it as it was (so retries are safe) |
| `PATCH /api/pll/solves/:id` | body `{ penalty }`; returns the `Solve` |
| `DELETE /api/pll/solves/:id` | removes it; `null` |

## Schema (`data/pll.sqlite`)

- `solves` (migration 001): one row per timed solve (`id`, `case_id` from `catalog/pll.json`,
  `ms` as timed, `scramble`, `created_at`). `penalty` (migration 002): `ok`, `+2` or `dnf`.
