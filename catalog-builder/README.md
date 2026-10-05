# catalog-builder

Collects F2L alg data (requirements §4.1, stage 1) from external sources and stores
it locally. It's a one-off tool and is separate from the app.

```sh
npm install
npm run collect      # = fetch + parse + check + build-catalog
npm run fetch        # download sources into raw/ (cached; add -- --force to refetch)
npm run parse        # raw/ -> data/<source>-f2l.json
npm run check        # verify every alg with cubing.js -> data/check-report.json
npm run build-catalog # data/speedcubedb-f2l.json -> ../catalog/f2l.json (the app's catalog)
```

Requires Node ≥ 23.6 (runs the `.ts` files directly, no build step).

## Layout

| Path | What | Committed? |
|---|---|---|
| `src/fetch-*.ts` | Download a source into `raw/`. Every response is cached on disk, so a re-run only fetches missing files. | yes |
| `src/parse-*.ts` | Turn raw files into one normalised JSON per source (`src/types.ts` → `SourceDataset`). | yes |
| `src/check.ts` | cubing.js verification of every setup and alg. | yes |
| `src/build-catalog.ts` | Builds `../catalog/f2l.json` (types in `../shared/f2l/catalog.ts`, slots and triggers in `../shared/cube.ts`). | yes |
| `src/cube.ts` | cubing.js helpers: F2L-solved check, normalise, mirror, relabel, edge orientation (good/bad edge). | yes |
| `raw/` | Untouched source responses (~7 MB of HTML). | no (gitignored) |
| `data/speedcubedb-f2l.json` | **Main dataset.** 41 cases × 4 slots. | yes |
| `data/cubicdb-f2l.json` | Secondary dataset, FR only. | yes |
| `data/check-report.json` | Per-alg verification failures and per-slot stats. | yes |

`data/*.json` is the *collected* data, kept close to its source. `build-catalog` turns
it into the app catalog (`../catalog/f2l.json`):

- **Setups**: face turns only, cross on D. The FR setup is SpeedCubeDB's (for cases 8 and
  13, whose published setups use wide/slice moves, it's the inverse of the best
  face-turn-only alg). Other slots relabel the faces, checked against the `y`-conjugated FR setup.
- **Algs**: normalised (`U2'` → `U2`), deduplicated, and kept only if they solve the setup.
  IDs are `<slotCaseId>-<sha1(moves)[:8]>`, so they stay stable across rebuilds.
- **Mirrors**: case M is N's mirror when M's FL algs solve the mirrored FR setup of N.
  This gives 19 pairs (1↔2, 3↔4, ... matching the numbering) and 3 self-mirror
  cases (31, 32, 37).
- **Alg families**: each alg is mirrored left-right, mirrored front-back and turned 180°
  (`y2`), landing on the other three slots. It's linked to the alg there when the catalog
  has those exact moves; nothing is derived.
- **Closing triggers** (`insert`): an alg ending in `X U* X'` (X a side face) or in
  `R' F R F'` / `F R' F' R` (any slot or mirror: R/L first = sledgehammer, F/B first =
  hedgeslammer) gets the trigger's length, its kind, and the one slot-case the trigger
  solves on its own (with the AUF before it), checked with cubing.js. 1343 of 2304 algs. Each transform is first checked against the
  setups. Links: left-right 936, front-back 586, turned 590 (1080 algs have at least one).

## Result (2026-10-04 run)

| Source | Coverage | Algs | Verified |
|---|---|---|---|
| SpeedCubeDB | 41 cases × 4 slots, every slot-case has ≥ 1 alg | 2311 (FR 1329, FL 345, BR 325, BL 312) | 2310 (the one failure is junk: `l b d`, 0 votes) |
| cubicdb | 41 cases, FR only | 343 | 331 (12 wrong entries) |

- Derived setups work: FL = `y' <FR setup> y`, BR = `y <FR setup> y'`, BL = `y2 <FR setup> y2`.
  Every SpeedCubeDB alg solves its derived setup with no extra AUF.
- cubicdb algs were checked against SpeedCubeDB's setups and pass, so both sources use
  the same case numbering.
- Groups (6): Free Pairs 4, Connected Pairs 10, Disconnected Pairs 10, Corner In Slot 6,
  Edge In Slot 6, Pieces In Slot 5.
- Back slots are thin for some cases (case 18 FL/BR and case 27 BL have a single alg).
  About half of all algs have ≤ 0 votes, and there are 6 duplicate move strings within a slot-case.

## Sources evaluated

### SpeedCubeDB: used (primary)

No public API or export. But the pages are server-rendered, and everything is
reachable through two plain GET URLs (found by deobfuscating the site's `category.js`):

1. `https://speedcubedb.com/a/3x3/F2L`: one page with all 41 cases. For each case it
   gives the name, group (`data-subgroup`: Free Pairs, Connected Pairs, ...), the **FR
   setup**, and four slot tabs (`data-ori` 0..3 = Front Right, Front Left, Back Left,
   Back Right) with the **top 4 algs per slot**. Each alg has its id, community votes,
   ETM/STM move count, face moves (e.g. `2GEN (R U)`) and sometimes a YouTube link.
2. `https://speedcubedb.com/category.algs.php?algname=F2L%201&d=<ori>&cat=F2L`: the
   "More Algorithms" button. It returns an HTML fragment with the remaining algs for
   that (case, slot), in the same markup.

That's 1 + 164 requests. The fetcher spaces them 2s apart with an identifying
User-Agent and caches them, so the site is hit only once. (`robots.txt` is a 404.)
The per-case pages (`/a/3x3/F2L/F2L_1`) return the same full listing, so they add
nothing.

Caveats:
- Only the FR setup is published. Setups for FL/BR/BL have to be derived (the check
  script does this: the FR setup conjugated by a `y` rotation, worked out from the data).
- Algs are written for cross on D. The site shows them with a `z2` setup on a
  white-top cube.
- Anyone can submit algs. Low or negative-vote entries are often silly (e.g. a 20-move
  repetition), so sort or filter by `votes`.

### cubicdb: used (cross-check)

[isaacvr/cubicdb](https://github.com/isaacvr/cubicdb) ships `src/database/algs.db`
(NeDB, one JSON object per line). It has all 41 F2L cases for **FR only**, about 8
algs each, with no votes. Its `scramble` field is actually one of the solving algs,
so the setup is its inverse. It's useful because it's an independent source with the
same numbering, so it confirms that SpeedCubeDB's case numbers and setups match.

### Others considered

- **csTimer**: has F2L training scrambles (case states), but no alg lists.
- **SpeedCubeDB scrapers on GitHub** (e.g. QuantumQream/SpeedCubeDB-WebScraper,
  Niinjoy/cube-alg-to-notion): they don't publish datasets and only scrape the
  visible page, so they miss the per-slot "more algs".
- **Static guide sites** (speedcube.quest, cubequest.site, badmephisto mirror,
  rubiksplace): one or two FR algs per case in prose or HTML tables. They'd be more
  work for less data.
