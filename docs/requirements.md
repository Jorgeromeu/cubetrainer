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
- Timing / statistics in the F2L trainer (planned for after stage 3, see §2). The PLL trainer has them (§4).

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
| **Alg links** | How two algs of a cluster relate, from their local forms (the alg done at `FR`, rotations taken out, wide/slice moves as a face turn plus a rotation): **rotation** (same local form: the same alg in another grip or slot, e.g. `y' U R' …` and `d R' …`), **left-right / front-back mirror** (mirror-image local forms in the neighbouring slot) and **transpose** (mirror-image local forms in the same slot: the mirror case done with F-U moves instead of R-U ones). Notes follow chosen kinds; the family map groups main algs by the kinds you count as the same. |
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

- Shows a scramble for a random case from the selected ones; Next (button, → or Enter) deals another, never the same case twice in a row. ← goes back through the scrambles dealt this session (up to 200), → forward again. "Show case" (R) reveals a scramble's case.
- Timing without inspection: you scramble under the table, press Space, and a countdown runs (1–5 s, Settings → PLL, 3 s by default; ticks and a beep at 0, never in stealth). At 0 the timer starts and you lift the cube, recognise and solve; any key (or a tap on the timer) stops it. The lift is in every time, so times read a little higher than execution-only ones, but compare fairly. The scramble is hidden while the timer runs. Esc throws the countdown or solve away.
- Optional hold-to-start instead (Settings → PLL → Start: Hold), as on csTimer: hold Space (or press on the timer) until it turns green (0.3 s), release to start. Released too early, nothing starts. You can see the case before starting, so it's for when scrambling under the table is too much hassle.
- After a solve its time is saved for that case, the case is revealed with the time, and the next scramble comes up. "Remove" (Backspace) drops a botched one. Going back to a timed scramble shows its case and time.
- Standard timer features: a penalty per solve, OK / +2 / DNF (buttons on the solve shown, keys 2 and D toggle them, or on any solve in the list). Stats, the same for all solves and for each case: best single, ao5, ao12 and ao100 WCA-style (best and worst dropped, 5% each end for ao100; DNFs count as the worst, so one more than is dropped makes the average DNF; ao100 only shows once there are 100 solves, so in practice overall), mean of the finished solves, count and DNFs. Overall ao5 / ao12 (and ao100) sit next to the controls; the solve just timed shows its case's stats under it. A Solves list, newest first, with the overall stats on top, where any solve's penalty can be changed or the solve removed. Not yet: comments on solves, separate sessions.
- The timer keeps the last result on screen (with the next scramble already up) until Next, which clears it.
- Per-case stats live in the case selector (to find the weak spots): each card shows its case's pace (ao5, or the mean until it has 5 solves) tinted on a fast → slow colour scale (green → red, muted in stealth; no legend) across the timed cases, with its solve count; hovering a card gives all its stats. The cards are laid out by group or "Slowest first" (remembered per browser).
- Case selector, collapsible (open by default, collapsed in stealth): the 21 cases as top-view icons (plain SVG), grouped as edges only / adjacent corner swap / diagonal corner swap. All selected by default; the selection is kept per browser.
- Data: `catalog/pll.json`, built by `catalog-builder/src/build-pll.ts` from SpeedCubeDB. Scrambles are inverses of the case's algs rewritten as face turns only, with a random AUF before and after, checked with cubing.js.
- Stealth: icons in greys (last layer black, four distinct side greys), dimmed until hovered.

### PLL compare (v0)

A separate trainer (`#/pll-compare`) for finding recognition tricks: PLL cases side by side, seen from the same angle.

- A board of cubes, empty at first, beside a sidebar (« hides it, » brings it back): the cases (click one to add a cube with it), then the view, columns and sets. × removes a cube, and each cube's case can be changed. Up to 24.
- The board fits the window: every cube shows, as big as the space allows, never scrolling (except on a phone, one a row). The columns are whichever count gives the biggest cubes, or chosen (1–6). Small cards show their controls over the cube on hover.
- Each cube is turned on its own by dragging it; let go, it snaps to the nearest two-sided view (40° round from a side, 30° down: mostly one side, a little of the next), never the top (PLL is read from the sides). Over a cube, ←/→ turn its view a quarter (→ as the y rotation, keeping the lean). Turning the view adds no case of its own (a y is variant +1 and turn −1, with the side colours relabelled), but is quicker than counting U turns. The presets set every cube's view at once: F + R (as you recognise), F + L. Scrolling over a cube (or + / −) zooms them all.
- Each cube has two dials, in quarter turns. Its setup is `U^variant · case · U^turn`:
  - **Turn** (U' / U2 / U, or u / Shift+u over the cube; animated): spins the solved-up last layer, so you see another pair of sides: a different pattern.
  - **Variant** (‹ ›, or ↑/↓ over the cube): a U before the case. The same pattern (bars, headlights, adjacent/opposite colours) with its colours shifted against the centres and F2L, for tricks that use them.
  - Shift+↑/↓ steps through all 16 states (turn first, then variant). ↺ goes back to the case as drawn (its icon).
- For making pictures of the differences between cases. A card is just the cube, its case name (click it to change the case) and its captions; the cube's controls (variant, turn, ↺, ×) lie over its top while it's hovered.
- Blocks: some stickers of one cube (not necessarily touching), framed in one colour, with a caption in that colour under the case name. Four colours (picked in the sidebar or with 1–4), chosen to stand out from every sticker colour and from each other on the black plastic; the frame leaves black between it and the sticker. Shift+click a sticker to paint it the current colour (again to unpaint; painting it another colour moves it), type the caption under the cube, × by a caption unpaints its block. A block is on the stickers themselves, so it moves with them as the cube is turned. Changing a cube's case clears its blocks.
- Copy as image: puts a PNG on the clipboard with just the cubes (cropped, as on screen), their case names and captions, on white, in the board's columns. Captions are the colours' darker shades there (4.5:1 on white).
- The board is in the URL (`#/pll-compare/Ga.1.3,Gb,T.0.2.0e7-c14~headlights`: case name, then variant and turn when not 0, then any blocks: colour, stickers, ~ caption), so it can be bookmarked.
- Named sets ("Ra Rb T", "Y V E"), kept by the server, blocks included: save the board under a name (the same name updates it), click a set to load it, × deletes it. The set the board currently is is highlighted. Without the server the board still works, without sets.
- Data: `catalog/pll.json`'s `setup` per case: face turns giving exactly the case as its icon draws it.
- Stealth: the cubes get one grey per side (opposite faces must differ, as on the PLL icons) and are dimmed until the board is hovered. They don't lie flat: comparing angles is the point.

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
                   shape_id                 # hash of the local form: the alg at FR, rotations out, wide/slice moves split
                   mirror_shape_id          # the local form's mirror image: links to mirrors and transposes
                   side?                    # R or F: the side the local form mostly turns (names a transpose)
                   recommended_by?          # jperm | cubeskills: on that sheet with exactly these moves
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
UserAlg            id: uuid, slot_case_id, moves, created_at        # algs you add yourself, checked on the cube by the app
SlotCaseProgress   slot_case_id (PK), main_alg_id, main_alg_kind: catalog|user, updated_at
AlgState           (alg_kind, alg_id) (PK), slot_case_id, status: wanted|learning|learnt, updated_at
Note               id (uuid PK), alg_kind, alg_id, slot_case_id, follows: [mirrorLR|mirrorFB|rotation|transpose],
                   text, created_at, updated_at   # also shown on every alg the `follows` links reach
VideoLink          (alg_kind, alg_id) (PK), slot_case_id, url (http/https), updated_at   # one video per alg
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
