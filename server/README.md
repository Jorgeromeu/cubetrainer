# server

The user-data host: it mounts each tool's server part (`tools/<id>/server/`) under
`/api/<id>/`, gives it its own SQLite file `data/<id>.sqlite`, and serves `app/dist` if built.
Each tool's endpoints and schema are in `tools/<id>/README.md`.

```sh
npm run server            # from the repo root: API on http://localhost:3001, restarts on change
npm start -w server       # same, no watch; also serves app/dist if it's been built
```

No npm dependencies: `node:http` + `node:sqlite`, `.ts` run directly. Requires Node ≥ 23.6.
`tsconfig.json` is for type checking only (`npm run typecheck` at the root).

| Env | Default |
|---|---|
| `PORT` | `3001` |
| `DATA_DIR` | `../data` (gitignored; its `*.sqlite` files **are** your progress, back them up) |

## Layout

| Path | What |
|---|---|
| `src/main.ts` | HTTP server: sends `/api/<id>/...` to that tool's routes, serves exposed calls (`/api/<id>/exposed/<name>`) and capabilities (`/api/_/capabilities/<name>`), serves `app/dist`. |
| `src/tool.ts` | The interface tool servers use, and the only host file they may import: `ServerTool` (id, `uses`, `start()` → routes + exposed implementations), `ApiRoute`, `ToolContext` (own DB, `read`, `gather`), `implement`, `InvalidRequest` (→ 400). |
| `src/registry.ts` | Starts every tool and holds its routes and exposed calls; what `ctx.read` / `ctx.gather` go through. Tested in `registry.test.ts` (`npm test`). |
| `src/tools.ts` | The registry: every tool with server-side data. |
| `src/http.ts` | JSON helpers, route matching. |
| `src/db.ts` | Opens a tool's DB and applies its migrations. |

Tools are isolated:

- A tool only sees the routes under its prefix and its own DB file, so it can't touch
  another's data, and its migration numbers are its own. It reads other tools' data only
  through their exposed calls (`ctx.read`, for tools listed in its `uses`), never writes it.
- `exposed` is a reserved path under each prefix, and `_` a reserved prefix.
- If one fails at startup (a bad migration, a missing catalog), only it is disabled: its
  routes answer 503 and the server log says why; the other tools and the app keep working.
  A failed migration is rolled back.

## Migrations

`tools/<id>/server/migrations/NNN_*.sql`, applied in order on startup (`src/db.ts`), tracked
by each DB's `PRAGMA user_version`. Never edit an applied migration; add a new file.
