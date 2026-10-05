# Cubetrainer — Requirements

Status: draft v0.1 · Last updated: 2026-10-04

## Goals

A personal web app for learning and drilling F2L:

- A browsable **catalog** of all F2L cases, in all four slots, with visual (3D/2D) rendering of setups and algorithms.
- Personal **alg selection and progress tracking**: pick a main alg per case, mark cases as learnt.
- A **trainer** that generates scrambles for a chosen subset of cases.

Primarily used locally by one person, but structured so it could be hosted / extended later without a rewrite.

### Non-goals (for now)

- Multi-user support, accounts, auth.
- Other alg sets (OLL, ZBLL, ...) beyond the PLL scramble trainer (§4). Each trainer is its own UI behind the trainer menu.
- Timing / statistics in the trainer (planned for after stage 3, see §2).

## Concepts

| Term | Meaning |
|---|---|
| **Case** | One of the 41 standard F2L cases (numbered 1–41, following the common SpeedCubeDB / Algdb numbering). Defined relative to the front-right slot. |
| **Slot** | Which F2L slot the pair is inserted into: `FR`, `FL`, `BR`, `BL`. |
| **Slot-case** | A (case, slot) pair. 41 × 4 = **164** slot-cases. This is the unit everything in the app is keyed on. |
| **Alg** | A move sequence that solves a slot-case (e.g. `U R U' R'`). |
| **Setup** | A move sequence that, applied to a solved cube, produces the slot-case. |
| **AUF** | "Adjust U Face": a `U`, `U2`, `U'` or no move. Cases are defined *up to AUF*: the same case with the U layer turned is still the same case. |
| **Main alg** | The alg the user has chosen as their own for a slot-case. |
| **Learnt** | User-set flag on a slot-case meaning "I know my main alg for this". |
| **Mirror** | The left↔right reflection of a case, slot or alg. Case N in `FR` mirrors to some case M in `FL` (and `FL`↔`FR`, `BR`↔`BL`). Mirroring an alg swaps `R`↔`L` and inverts every move's direction. |
| **Alg family** | An alg carried to the other three slots: mirrored left↔right (`FR`↔`FL`, mirror case), mirrored front↔back (`FR`↔`BR`, swaps `F`↔`B`, mirror case), and both at once, which is the same alg with the cube turned 180° (`FR`↔`BL`, same case). Turning the cube never changes the case; only a reflection does. |
| **Mirror cluster** | The top-level unit of the catalog: a case together with its mirror partner, across all slots. 2 cases × 4 slots = 8 slot-cases; self-mirror cases (M = N) form a cluster of 4. |

Important about mirrors. There are 41 F2L cases, of which theare are 19 mirror pairs and 3 cases that are symmetric, and are their own mirror. So this is the fundamental unit of browsing, the 19 mirror cases and the 3 ones that dont have a mirror appear as individual

## 4. Features

### Data collection

Not a feature in its own sense, but a Prerequisite. We need to scrape speedcubedb or some other source to get the algorithms for each case, as well as the list of cases. Fully handled separately form project in `catalog-builder/`

### Algorithm Explorer

A viewer over the catalog. This is the most important feature of the app. It should let us explore the catalog of all cases clustered as: 19 cases of 8, and the 3 cases with no mirror with 4 slots each.

1. Main overview view, shows the 19+3 "super-cases" each with visualization, and a icon (3D-render of cube)
2. Once clicked we open the panel for this individual meta, case. show all 4/8 sub-cases and show the 3D-cube in large. Allow switching between the 4/8 sub-cases which update the single large cube. For each case selected display the available algos, as well as setup moves to configure my cube to here

### PLL trainer (v0)

A separate trainer, picked from the menu on the trainer name in the top bar (`#/pll`). It shares only the shell (top bar, stealth, styling) with F2L.

- Shows a scramble for a random case from the selected ones; Next (button, Space or →) deals another, never the same case twice in a row. No timing.
- Case selector, collapsible (open by default, collapsed in stealth): the 21 cases as top-view icons (plain SVG), grouped as edges only / adjacent corner swap / diagonal corner swap. All selected by default; the selection is kept per browser.
- Data: `catalog/pll.json`, built by `catalog-builder/src/build-pll.ts` from SpeedCubeDB. Scrambles are inverses of the case's algs rewritten as face turns only, with a random AUF before and after, checked with cubing.js.
- Stealth: icons in greys (last layer black, four distinct side greys), dimmed until hovered.

### Stealth mode

An app-wide switch (eye button next to the brand, or the `` ` `` key) so that someone glancing at the screen can't tell it's a cubing app. Visual only: text such as "F2L 12" stays. Kept per browser.

- Cubes are grey: last layer black, white stays white, green/blue one grey, red/orange another (a pair's two sides are never opposite faces, so they always differ).
- Away from the pointer, cubes are dimmed and lie flat: small cubes seen from straight above, the big cube from the nearest straight-on side. Hovering (overview card, family-map cell, or the big cube itself) turns a cube back to its normal view at full strength, including wherever the big cube was dragged to.

**Every new visual feature must ship its stealth variant.** Hook into `data-stealth` on `<html>` from CSS, or `useStealth()` (`app/src/common/stealth.ts`) from components.

## 5. Data

There are two kinds of data, stored and versioned separately.

### 5.1 Catalog data (static, read-only to the app)

Produced by the catalog builder (§4.1) as a JSON file committed to the repo (e.g. `catalog/f2l.json`). At startup the server loads or upserts it into catalog tables. The app never edits catalog data.

Required content:

```
CaseSet            id: "f2l", name
Cluster            id: "f2l-c-11-12", set_id, case_ids: [1 or 2 case ids]
Case               id: "f2l-12", set_id, cluster_id, number: 12, name?, group,
                   mirror_case_id          # partner case; equals id for self-mirror cases
SlotCase           id: "f2l-12-FR", case_id, slot: FR|FL|BR|BL,
                   setup: string,           # canonical setup from solved
                   mirror_slot_case_id      # e.g. f2l-12-FR -> f2l-11-FL
                   edge_oriented: bool      # good edge: solvable with R/L/U/D, no rotation
CatalogAlg         id: stable, slot_case_id, moves: string,
                   source: "speedcubedb" | ..., rank/order?, tags?,
                   family_alg_ids?          # slot -> catalog alg there with this alg's exact mirrored/turned moves
                   family_id                # id of the alg's front-right version (mirrors/180° share it)
                   execution_id             # case + moves without a leading y (rotation versions share it)
                   insert?                  # closing trigger (X U* X', sledgehammer, hedgeslammer): kind, length,
                                            # the slot-case it solves on its own + AUF, and that case's alg for it
                   triggers?                # named triggers only (3-move insert, sledgehammer, hedgeslammer, sexy move):
                                            # the closing insert + hand marks (catalog-builder/data/triggers.json); kind, start, length
```

Notes:
- **IDs must be stable strings** derived from content (case number + slot, and for algs a hash of the normalised move string), so re-importing a corrected catalog never breaks the user data that references it.
- One canonical setup per slot-case. More setups can be added later as extra rows if needed.
- Algs are per slot-case, not per case: back-slot algs are usually completely different, not just rotated versions of the front ones.
- No AUF variants are stored; AUF only exists in the trainer.
- Cluster and mirror relationships are stored explicitly (cluster, case, slot-case and alg level). They're computed and verified once by the catalog builder, so the app never has to re-derive them. Cluster IDs are built from their sorted case numbers, so they stay stable.

### 5.2 User data (mutable, the only data that really needs persistence)

```
UserAlg            id: uuid, slot_case_id, moves, created_at        # later: custom algs
SlotCaseProgress   slot_case_id (PK), main_alg_id, main_alg_kind: catalog|user, updated_at
AlgState           (alg_kind, alg_id) (PK), slot_case_id, status: learning|learnt, updated_at
Note               id (uuid PK), alg_kind, alg_id, slot_case_id, symmetry: none|lr|fb|both|linked,
                   text, created_at, updated_at   # also shown on the mirrors `symmetry` picks
```

Later, for timed training: `TrainerAttempt (id, slot_case_id, scramble, time_ms?, created_at)`.

### 5.3 Storage

> Implemented in `server/` (see its README): `node:sqlite`, numbered SQL migrations,
> one module, API prefix (`/api/<trainer>/`) and DB file per trainer. Differences from below: the catalog stays a JSON file (the
> server reads it to validate alg ids) instead of being seeded into catalog tables, and
> export/import isn't built yet.

- One SQLite file per trainer (`data/<trainer>.sqlite`, e.g. `data/f2l.sqlite`, gitignored), accessed only by the server through that trainer's repository layer.
- Catalog tables and user tables live in the same DB file but are clearly separated. Catalog tables can be dropped and re-seeded at any time. User tables are migrated and never wiped.
- Schema changes go through versioned migrations.
- **Export/import of user data as JSON** (stage 2). It makes backups easy and keeps the data independent of the storage technology.
