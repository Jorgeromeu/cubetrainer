# Cubetrainer

A personal web app for learning Rubik's cube algorithms. It runs locally, has one user and no accounts.

- **Timer.** Hold Space, release to start, any key stops; random-state scrambles. It keeps
  every solve, timed here or imported from another timer's export (CubeTime), each tagged
  with where it came from, and its **Stats** page charts them all: progress with running
  averages, how consistent you are, solves per day, and every solve in a table.
- **F2L explorer.** All 41 F2L cases in all four slots, grouped into mirror clusters, with 3D
  cubes, setups and algs from SpeedCubeDB. You can pick a main alg per case, mark algs as
  learning or learnt, keep notes that carry over to an alg's mirrored versions, and add algs
  of your own (only ones that solve the case are accepted).

The PLL tools and stealth mode are parked for now (tags `parked/pll` and `archive/consolidate`).

What each part does, precisely: [`openspec/specs/`](openspec/specs/).

## Quick start

Requires Node ≥ 23.6 (the server and the F2L catalog builder run `.ts` files directly).

```sh
npm install              # once, at the root: installs every workspace
npm run build            # type check, import check, build the app into app/dist
npm test                 # server tests
npm start -w server      # http://localhost:3001: API + the built app
```

For development, run `npm run server` (API on :3001) and `npm run dev` (Vite on :5173,
proxying `/api` to the server). Without the server the app still works read-only.

## Layout

| Path | What |
|---|---|
| `tools/<id>/` | One tool each: `contract.ts` (its API types and exposed calls), `app/` (its view and styles), `server/` (routes, repository, migrations; only if it stores data), `catalog/` (data it ships with, and how it's built; F2L's alg catalog), `README.md` (its API and schema). |
| `packages/core/` | Pure shared logic and types: cube and slot model, notation, solves and averages, drill picks, the API client, exposed calls and capabilities. No dependencies, no DOM. |
| `packages/ui/` | Shared React UI: the shell, 3D cube, notation display, move hint, drill kit, settings blocks, reading exposed calls, `ui.css`. |
| [`app/`](app/README.md) | The web host: the tool registry and the Vite build. |
| [`server/`](server/README.md) | The user-data host: `node:http` + `node:sqlite`, no dependencies. One API prefix and SQLite file per tool. |
| `scripts/check-imports.ts` | The import boundary check (part of the build). |
| `openspec/` | Specs (current behaviour) and changes (planned work). |

### Import rules

Checked on every build (`npm run check:imports`); see `openspec/specs/foundation/architecture`.

| Code in | May import from the repo |
|---|---|
| `packages/core` | nothing |
| `packages/ui` | core |
| `tools/<id>/contract.ts` | core, its own `catalog/` |
| `tools/<id>/catalog/` | core (its `builder/`: core, the catalog, any package) |
| `tools/<id>/app/` | core, ui, any tool's `contract.ts`, its own `catalog/` |
| `tools/<id>/server/` | core, any tool's `contract.ts`, its own `catalog/`, `server/src/tool.ts` |
| `app/` | core, ui, `tools/*/app` (the registry) |
| `server/` | core, `tools/*/server` (the registry) |
| `*.test.ts` | anything |

Third-party packages: none in core and contracts; only `node:*` on the server side.

### Adding a tool

`npm run new-tool <id>` (add `-- --server` if it stores data) creates `tools/<id>/` and its
registry lines: the smallest tool that builds, with a contract, a view and crumb, its own
settings (`setting('<id>', ...)`) and view state (`viewState('<id>.<what>', ...)`), and with
a server a first migration, routes, an exposed call and a test. `scripts/new-tool.test.ts`
builds what it generates, so it stays in step with the real APIs.

Removing a tool is deleting its folder and its registry lines.

### Tools reading each other's data

A tool owns its data: only it writes its DB. What other tools may read, it declares in its
`contract.ts` as exposed calls (`exposed()` from `packages/core/exposed.ts`) and implements in
its server (`implement()`, returned from `start()`). Readers:

- another tool's server, in-process: `ctx.read(call, args)`, with the tool in its `uses`
- any tool's app, over HTTP: `readExposed(call, args)` (`packages/ui/exposed.ts`), i.e.
  `GET /api/<tool>/exposed/<name>`

A missing tool reads as no data. A **capability** is an interface several tools can provide
(`provides()`; e.g. `case-observations`, `packages/core/observations.ts`); readers get every
provider's result with `ctx.gather` or `GET /api/_/capabilities/<name>`. Exposed calls only
grow: a breaking change is a new call.

Exposed today: `timer` → `solves`; `f2l` → `active-cases`.

## Worktrees

Develop features in git worktrees: on its first `npm run dev` / `npm run server`, a worktree
copies your data and picks its own ports, so it never writes to your real data, and the top
bar shows its branch. After merging, `npm run data:push` from the worktree brings back what
you saved there (new rows only). Details: `CLAUDE.md`, `openspec/specs/foundation/dev-workflow`.

## Hosting

Not set up yet. The server is built so it can be (one process, everything configured by
`PORT` and `DATA_DIR`, no git checkout needed), and other clients such as an iOS app would use
the same APIs: `openspec/specs/foundation/deployment`, and "Clients" in
`foundation/architecture`.

## Your data

Your data lives in `data/<tool>.sqlite` (`data/timer.sqlite`, `data/f2l.sqlite`; the parked
PLL tools' files stay there untouched). It's gitignored, so back it
up yourself. Stop the server first (or copy the `-wal` file along with it), or the copy may
miss recent changes.

## Credits

The F2L algs and votes come from [SpeedCubeDB](https://speedcubedb.com).
[CubicDB](https://github.com/isaacvr/cubicdb)'s alg database is used to cross-check them.
Cube rendering and alg handling use [cubing.js](https://github.com/cubing/cubing.js).
