# Cubetrainer

A personal web app for learning Rubik's cube algorithms. It runs locally, has one user and no accounts.

- **F2L explorer.** All 41 F2L cases in all four slots, grouped into mirror clusters, with 3D
  cubes, setups and algs from SpeedCubeDB. You can pick a main alg per case, mark algs as
  learning or learnt, keep notes that carry over to an alg's mirrored versions, and add algs
  of your own (only ones that solve the case are accepted).
- **PLL trainer.** Timed scrambles for the PLL cases you pick.
- **PLL compare.** PLL cases side by side under one camera, each with its own U turns, to spot
  recognition tricks. Comparisons can be saved under a name.
- **Stats.** Your solve history, imported from timer exports: progress with running averages,
  how consistent you are, solves per day, and every solve in a table.
- **Stealth mode.** Press `` ` `` (or use the button next to the brand) and the page turns grey
  and stops looking like a cubing app.

What each part does, precisely: [`openspec/specs/`](openspec/specs/).

## Quick start

Requires Node ≥ 23.6 (the server and catalog builder run `.ts` files directly).

```sh
npm install              # once, at the root: installs every workspace
npm run build            # type check, import check, build the app into app/dist
npm start -w server      # http://localhost:3001: API + the built app
```

For development, run `npm run server` (API on :3001) and `npm run dev` (Vite on :5173,
proxying `/api` to the server). Without the server the app still works read-only.

## Layout

| Path | What |
|---|---|
| `tools/<id>/` | One tool each: `contract.ts` (its API types), `app/` (its view and styles), `server/` (routes, repository, migrations; only if it stores data), `README.md` (its API and schema). |
| `packages/core/` | Pure shared logic and types: cube and slot model, catalog types, notation, solves and averages, drill picks, the API client. No dependencies, no DOM. |
| `packages/ui/` | Shared React UI: the shell, 3D/flat cube, notation display, move hint, icons, settings blocks, stealth, `ui.css`. |
| [`app/`](app/README.md) | The web host: the tool registry and the Vite build. |
| [`server/`](server/README.md) | The user-data host: `node:http` + `node:sqlite`, no dependencies. One API prefix and SQLite file per tool. |
| `catalog/` | The alg catalogs the app ships with (`f2l.json`, `pll.json`), generated and committed. |
| [`catalog-builder/`](catalog-builder/README.md) | A one-off tool that scrapes the alg sources, checks every alg with cubing.js and writes `catalog/`. |
| `scripts/check-imports.ts` | The import boundary check (part of the build). |
| `openspec/` | Specs (current behaviour) and changes (planned work). |

### Import rules

Checked on every build (`npm run check:imports`); see `openspec/specs/architecture`.

| Code in | May import from the repo |
|---|---|
| `packages/core` | nothing |
| `packages/ui` | core |
| `tools/<id>/contract.ts` | core |
| `tools/<id>/app/` | core, ui, its own contract, other tools' `contract.ts`, `catalog/` |
| `tools/<id>/server/` | core, its own contract, `server/src/tool.ts` |
| `app/` | core, ui, `tools/*/app` (the registry) |
| `server/` | core, `tools/*/server` (the registry) |
| `catalog-builder/` | core, `catalog/` |

Third-party packages: none in core and contracts; only `node:*` on the server side.

### Adding a tool

1. `tools/<id>/app/index.ts` exporting a `Tool` (`packages/ui/tool.ts`), listed in `app/src/tools.ts`.
2. If it stores data: `tools/<id>/contract.ts` with its API types, `tools/<id>/server/index.ts`
   exporting a `ServerTool` (`server/src/tool.ts`) plus `migrations/`, listed in `server/src/tools.ts`.
3. Its styles in `tools/<id>/app/<id>.css`, imported by its `index.ts`.

Removing a tool is deleting its folder and its registry lines.

## Your data

Progress lives in `data/<tool>.sqlite` (e.g. `data/f2l.sqlite`). It's gitignored, so back it
up yourself. Stop the server first (or copy the `-wal` file along with it), or the copy may
miss recent changes.

## Credits

The F2L and PLL algs and votes come from [SpeedCubeDB](https://speedcubedb.com).
[CubicDB](https://github.com/isaacvr/cubicdb)'s alg database is used to cross-check them.
Cube rendering and alg handling use [cubing.js](https://github.com/cubing/cubing.js).
