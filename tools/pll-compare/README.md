# PLL compare

PLL cases side by side under one camera, each with its own U turns, with named sets. Behaviour: `openspec/specs/pll-compare`.

- `contract.ts`: API request and response types, limits
- `app/`: the view (`app/index.ts` exports the `Tool`), its stylesheet and client state
- `server/`: routes (`server/index.ts` exports the `ServerTool`), repository, `migrations/`

## API

Types in `contract.ts`.

| | |
|---|---|
| `GET /api/pll-compare/sets` | `{ sets: CompareSet[] }`, by name |
| `PUT /api/pll-compare/sets/:id` | body `{ name, cubes: [{ caseId, variant, turn, blocks? }] }` (1–24 cubes; variant and turn 0–3; blocks: up to 4 `{ color, caption, stickers }`, one a colour 0–3, caption up to 60 characters, stickers such as `"e7"`, `"c14"`, `"m2"` (see `isSticker`), each in one block). Sets saved with the older `marks` (plain stickers) are read back as one block in colour 0, id = a client-made uuid; creates or replaces it, returns the `CompareSet`. Names are unique ignoring case (400 if another set has it) |
| `DELETE /api/pll-compare/sets/:id` | removes it; `null` |

## Schema (`data/pll-compare.sqlite`)

- `sets` (migration 001): one row per named set (`id`, `name` unique without case, `cubes` as
  JSON, `created_at`, `updated_at`).
