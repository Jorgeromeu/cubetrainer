# app

The trainers, as one app: the F2L Algorithm Explorer (a viewer over `../catalog/f2l.json`,
plus progress tracking: a main alg per slot-case; per alg a learning/learnt status and
notes, stored by `../server`) and the PLL scramble trainer (`../catalog/pll.json`; timed
solves without inspection, per-case times stored by `../server`, see `src/trainers/pll/`), and PLL
compare (cases side by side under one shared camera, each with its own U turns; named sets
stored by `../server`, see `src/trainers/pll-compare/`), and Stats (solve history, charted: progress,
ao12/ao100 with the spread of the same solves, spread over time, warm-up, solves per day; see `src/trainers/stats/`). Excluded solves (a DB
mark that keeps re-imports from bringing them back) never reach the page.

## Layout

Each trainer is standalone; what they have in common lives in `common/`.

| Path | What | May import |
|---|---|---|
| `src/shell/` | Top bar, trainer menu, settings menu, routing (`#/<trainerId>/...`). `trainers.ts` lists the trainers. | everything |
| `src/trainers/<id>/` | One trainer, all its logic and views. `index.ts` exports its `Trainer` (`common/trainer.ts`): name, `View`, `Crumb`, `Settings` (the whole settings menu while it's open: only its own settings, plus shared sections that apply to it). | `common/`, `../shared/` |
| `src/common/` | Shared by trainers: `cube/` (cubing.js player, flat 2D cube, stealth colours (a per-side palette for PLL), cube display settings and their menu section, which trainers showing 3D cubes add to their own Settings), `notation/` (move markup, rotations, triggers), `pll/` (the PLL case icon), `ui/` (settings rows), `stealth.ts`, `solveTime.ts` (penalties, averages, time formatting), `persisted.ts` (localStorage prefs), `api.ts` (server requests), `trainer.ts` (the trainer contract). | `../shared/` only |
| `../shared/` | Contracts with server/ and catalog-builder/: `cube.ts` (slots, triggers), `f2l/`, `pll/`. | nothing |

Trainers never import from each other or from `shell/`. Adding one: a folder under
`src/trainers/`, listed in `src/shell/trainers.ts`. Its CSS goes in `index.css` for now,
under its own heading.

```sh
npm install
npm run dev      # http://localhost:5173; also run `npm run dev` in ../server (Vite proxies /api to it)
npm run build    # static files in dist/; `npm start` in ../server then serves them on :3001
```

A Vite + React app. The catalog JSON is bundled at build time and `cubing`
(TwistyPlayer) renders the cubes. Progress comes from the server's API
(`src/trainers/f2l/progress.ts`). Without the server the app works as a plain explorer: all progress
UI is hidden, a small "No server" notice sits in the bottom-right corner, and it keeps
retrying (and on window focus), so starting the server later brings progress back
without a reload. Set `API_URL` to proxy to a server on another port (default `:3001`).

- Progress: in a cluster, ☆ on an alg makes it the slot-case's main alg (F), the circle
  next to it cycles its status: nothing → learning → learnt (K), and the note button opens
  the alg's notes under the row (N on the selected alg, Esc closes). An alg can have several
  notes; each one's little map of the cluster shows where it shows, and opens a picker for
  the link kinds it follows (none by default: just this alg).
- Linked algs: typed links between algs of a cluster, derived from the catalog's `shapeId`
  / `mirrorShapeId` (`linksOf` in src/trainers/f2l/catalog.ts): rotation (the same alg in
  another grip or slot: a rotation, a `d` move or the 180° turn apart), left-right mirror,
  front-back mirror and transpose (the mirror case in the same slot, F-U moves instead of
  R-U). Notes spread along the kinds they follow, any number of steps (`noteReach`).
- Family map: cells whose main algs are linked by the kinds you count as the same
  ("Count as linked" above the map, or Settings → F2L; mirrors and rotation by default)
  share a tint (`groupAlgs`); a main linked to nothing stays plain. Hovering a cell lists
  its main's links to the other mains. "Go to equivalent" (G) turns the map into a picker:
  each cell leads to the alg most like the selected one there (`equivalentIn`: your main
  if it's linked at all, else the fewest links away). The overview counts main and learnt
  algs as algs → shapes → ideas (ideas by the same "count as linked" kinds).
- Picks: J Perm's and CubeSkills' recommended F2L sheets (`RECOMMENDERS` in shared/f2l/catalog.ts;
  collected by catalog-builder's fetch/parse-recommended, each alg placed by the case it solves).
  A row's JP / CS pill is solid when it's the sheet's exact moves for that slot, outlined when
  it's the same alg (same shape) written with another grip in that slot (`recommendationsOf`).
  Picks never carry over to other slots: CubeSkills' sheet covers all four; J Perm's only
  front-right, so other slots have no JP pills.
- Better algs: each row shows the alg's own SpeedCubeDB votes (▲) and, quieter with the
  left-right mirror mark, its exact left-right mirror's. "More popular" (`popularity`)
  adds the two (votes outside FR are sparse; the mirror is the same motion). Rotation moves (x, y, z) are
  coloured orange in alg text and the player's move strip (src/common/notation/). When
  a clearly more popular alg with no more rotations than your main exists (+5 votes and
  +25%), it's shown under the main alg, as ↑ on its slot-map cell and as ↑N on the overview
  card (`betterAlg` in src/trainers/f2l/catalog.ts). It doesn't change what counts as learnt.
- Closing triggers: an alg's closing trigger is in parentheses, `U F R' F' R U (R U R')`.
  Hovering it names it (insert / sledgehammer / hedgeslammer), says which basic case it
  solves on its own, and shows the notes that case's alg shows (its own, plus mirrored and
  linked ones as each note's links allow). It's a one-way link (this alg ends with that
  one), so it isn't one of the alg links (`AlgMoves` in src/trainers/f2l/Moves.tsx; data from the
  catalog's `insert`).
- Focus on what's missing (Settings → F2L, remembered per browser): learnt slot-cases are
  greyed out but still clickable (cluster cards, cubes, slot-map cells, family links); a
  learnt one being viewed is greyed a little less, as is the big cube. A case opens on its
  first missing slot, and the overview shows a "Focus: N missing" chip with × to turn it
  off. Learning counts as missing. PLL is unaffected. Status and notes are
  per alg, independent of which alg is main. The overview shows per-case slot grids,
  per-cluster and per-group counts, and the overall total.

- `#/` (or `#/f2l`) lists the 22 mirror clusters (19 pairs + 3 self-mirror), grouped by case group.
- `#/f2l/<clusterId>/<slotCaseId>/<algId>` shows a cluster: its 4 or 8 slot-cases, a large
  cube for the selected one, the setup, and the algs. Mirror links jump to the
  mirrored alg on the partner slot-case.

Cubes are shown with the cross on the bottom (`z2` before the setup: white D, green F),
a custom sticker mask greys out the last layer, and cubing's control panel is replaced
by custom controls (move strip, scrubber, speed; keys: space, ←/→, Home/End). See `src/common/cube/Cube.tsx`.
