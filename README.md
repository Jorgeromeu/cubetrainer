# Cubetrainer

A personal web app for learning Rubik's cube algorithms. It runs locally, has one user and no accounts.

- **F2L explorer.** All 41 F2L cases in all four slots, grouped into mirror clusters, with 3D
  cubes, setups and algs from SpeedCubeDB. You can pick a main alg per case, mark algs as
  learning or learnt, and keep notes that carry over to an alg's mirrored versions.
- **PLL trainer.** Scrambles for the PLL cases you pick.
- **Stealth mode.** Press `` ` `` (or use the button next to the brand) and the page turns grey
  and stops looking like a cubing app.

## Quick start

Requires Node ≥ 23.6 (the server and catalog builder run `.ts` files directly).

```sh
cd app && npm install && npm run build   # build the app into app/dist
cd ../server && npm start                # http://localhost:3001: API + the built app
```

For development, run `npm run dev` in both `server/` (API on :3001) and `app/` (Vite on :5173,
proxying `/api` to the server). Without the server the app still works as a plain explorer,
just without progress.

## Layout

| Path | What |
|---|---|
| [`app/`](app/README.md) | The web app (Vite + React + [cubing.js](https://js.cubing.net/cubing/)): a shell, `src/common/` (cube rendering, notation, UI) and one folder per trainer in `src/trainers/`. |
| [`server/`](server/README.md) | User-data API, no dependencies (`node:http` + `node:sqlite`). One module, API prefix (`/api/<trainer>/`) and SQLite file per trainer. |
| `shared/` | Types shared by app, server and catalog builder: `cube.ts`, `f2l/`, `pll/`. |
| `catalog/` | The alg catalogs the app ships with (`f2l.json`, `pll.json`), generated and committed. |
| [`catalog-builder/`](catalog-builder/README.md) | A one-off tool that scrapes the alg sources, checks every alg with cubing.js and writes `catalog/`. |
| [`docs/requirements.md`](docs/requirements.md) | What the app is meant to do, the concepts, and the data model. |

Trainers are independent of each other. A new one is a folder under `app/src/trainers/` (and
`server/src/trainers/` if it stores data), plus one line in each registry. See the app and
server READMEs.

## Your data

Progress lives in `data/<trainer>.sqlite` (e.g. `data/f2l.sqlite`). It's gitignored, so back it
up yourself. Stop the server first (or copy the `-wal` file along with it), or the copy may
miss recent changes.

## Credits

The F2L and PLL algs and votes come from [SpeedCubeDB](https://speedcubedb.com).
[CubicDB](https://github.com/isaacvr/cubicdb)'s alg database is used to cross-check them.
Cube rendering and alg handling use [cubing.js](https://github.com/cubing/cubing.js).
