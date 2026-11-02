# catalog-builder Specification

## Purpose
The one-off tool that collects F2L and PLL algs from public sources, verifies every setup and alg with cubing.js, and writes the committed catalogs `catalog/f2l.json` and `catalog/pll.json` whose contract (in `shared/`) the app and server rely on.

## Requirements

### Requirement: Separate one-off tool
The catalog builder SHALL be a standalone Node tool (`catalog-builder/`, Node 23.6 or later, `.ts` run directly) whose only output used by the app is the committed `catalog/*.json`. Its steps SHALL be runnable separately: `fetch`, `parse`, `check`, `build-catalog` (F2L), and `build-pll` (PLL); `collect` runs fetch, parse, check and build-catalog in order.

#### Scenario: Full F2L run
- **WHEN** `npm run collect` runs
- **THEN** sources are fetched (from cache when present), parsed, checked, and `catalog/f2l.json` is rewritten

<!-- REVIEW: `collect` does not run `build-pll`; PLL is rebuilt only by running `npm run build-pll` on its own. -->

### Requirement: Polite cached fetching
Every downloaded source SHALL be cached on disk under `raw/` (gitignored), so a re-run only fetches missing files; `--force` refetches. Requests SHALL be spaced at least 2 s apart, send an identifying User-Agent, and retry up to 3 attempts with growing back-off.

#### Scenario: Re-run
- **WHEN** fetch runs again with all files in `raw/`
- **THEN** no network request is made

### Requirement: Sources
The builder SHALL use: SpeedCubeDB as the primary F2L source (the `/a/3x3/F2L` listing with name, group, FR setup and top algs per slot tab, plus each case-slot's "More Algorithms" fragment: 1 + 164 requests), its PLL page for the PLL catalog, cubicdb's `algs.db` (FR only) as an independent cross-check that is not put into the catalog, and two recommendation PDFs: J Perm's "Best F2L Algorithms" (FR) and CubeSkills' "F2L Algorithms – All Four Slot Angles" (all four slots).

#### Scenario: cubicdb is only a check
- **WHEN** the F2L catalog is built
- **THEN** no alg in it has cubicdb as its source

### Requirement: Collected datasets
Parsing SHALL turn raw files into one normalised JSON per source under `data/` (committed): `speedcubedb-f2l.json` and `cubicdb-f2l.json` hold, per case 1–41, its name, group, published setups and per-slot algs with their rank in source order (plus source id, votes, ETM/STM, face moves and video URL where the source has them). Moves are whitespace-collapsed and typographic primes turned into `'`.

#### Scenario: Typographic primes
- **WHEN** a source writes `R’ U R`
- **THEN** the dataset stores `R' U R`

### Requirement: Recommended dataset
Parsing the recommendation PDFs SHALL write `data/recommended-f2l.json`: every line of either sheet that parses as an alg, with its page and column and no case number (the sheets show cases only as pictures). Headings and notes are dropped; advanced cases are kept here and dropped later by build-catalog.

#### Scenario: Split fragments
- **WHEN** a PDF splits `U2'` into separate text fragments
- **THEN** they are joined back into one move on one line

### Requirement: Verification check
The `check` step SHALL verify every alg of every collected F2L dataset with cubing.js: after some AUF, the alg must leave cross and all four F2L slots solved from its slot's setup (whole-cube rotations allowed). Non-FR setups are the FR setup y-conjugated, with the rotation per slot found from the data, not assumed. cubicdb is checked against SpeedCubeDB's setups.

#### Scenario: Junk alg
- **WHEN** a collected alg does not solve its case
- **THEN** it is reported as a failure with reason "does not solve F2L"

### Requirement: Verification report
The `check` step SHALL write `data/check-report.json` with, per source, the rotation used per slot, per-slot counts (total, verified, needing a pre-AUF), failures with their reason, and case issues (a missing setup, a slot without algs, a setup disturbing more than one pair).

#### Scenario: Report written
- **WHEN** `npm run check` finishes
- **THEN** `data/check-report.json` has one result for SpeedCubeDB and one for cubicdb

### Requirement: F2L setups
Each slot-case SHALL have one setup made of face turns only, applied to a solved cube with the cross on D. The FR setup is SpeedCubeDB's; when that uses wide or slice moves, it is the inverse of the best face-turn-only FR alg that solves it. Other slots' setups are the FR setup with side faces relabelled, and the build SHALL fail unless each equals the y-conjugated FR setup (FL `y'`, BR `y`, BL `y2`) and the setup disturbs at most one F2L pair.

#### Scenario: Case with a wide-move setup
- **WHEN** the published FR setup of case 8 contains a wide move
- **THEN** the catalog setup is the inverse of its best face-turn-only FR alg

### Requirement: F2L algs kept only when verified
For each slot-case the build SHALL normalise every alg (single spaces, `U2'` written `U2`), drop unparsable ones and duplicates, and keep only algs that solve the slot-case's setup (allowing a pre-AUF), recording each drop as a warning. A slot-case with no verified alg SHALL fail the build. Each alg keeps source, rank, votes, STM and ETM; a slot-case's `algIds` are in source order (best first) with sheet-added algs after them.

#### Scenario: Duplicate moves
- **WHEN** SpeedCubeDB lists the same moves twice for a slot-case
- **THEN** the catalog has one alg for them

### Requirement: Stable content-derived ids
Catalog ids SHALL be derived from content only, so rebuilds keep them stable for user data (see user-data): case `f2l-<n>`, slot-case `f2l-<n>-<slot>`, cluster `f2l-c-<sorted case numbers joined by ->` (`f2l-c-11-12`, `f2l-c-37`), alg `<slotCaseId>-<first 8 hex of sha1(normalised moves)>`, PLL case `pll-<name>`.

#### Scenario: Rebuild with new votes
- **WHEN** the catalog is rebuilt after SpeedCubeDB's votes and order change
- **THEN** every alg that is still present keeps its id

### Requirement: Mirror cases and clusters
The build SHALL find each case's mirror on the cube: case M mirrors N when M's FL algs solve the left-right mirror of N's FR setup; exactly one match is required and the relation SHALL be symmetric, else the build fails. Clusters are a case with its mirror partner (2 cases, 8 slot-cases) or a self-mirror case alone (4 slot-cases), ordered by lowest case number. Each slot-case records its mirror slot-case (mirror case, `MIRROR_SLOT`: FR↔FL, BR↔BL).

#### Scenario: Current result
- **WHEN** the catalog is built from the current data
- **THEN** it has 22 clusters: 19 pairs and self-mirror cases 31, 32 and 37

### Requirement: Case groups
Each case SHALL carry SpeedCubeDB's group (`Free Pairs`, `Connected Pairs`, `Disconnected Pairs`, `Corner In Slot`, `Edge In Slot`, `Pieces In Slot`), or `Unknown` if the source gives none.

#### Scenario: Group of case 1
- **WHEN** the catalog is built
- **THEN** `f2l-1` has group `Free Pairs`

### Requirement: Edge orientation
Each slot-case SHALL record `edgeOriented`: true when, holding the cube as is, the pair's edge can be solved with R/L/U/D turns only (good edge). The build SHALL fail if it differs between a slot-case and its alg-family members (left-right mirror, front-back mirror, 180° turn).

#### Scenario: Family consistency
- **WHEN** `f2l-1-FR` is a good edge
- **THEN** its family slot-cases `f2l-2-FL`, `f2l-2-BR` and `f2l-1-BL` are good edges too

### Requirement: Alg families
Each alg SHALL be carried to the other three slots by left-right mirror (`MIRROR_SLOT`, mirror case), front-back mirror (`FRONT_BACK_SLOT`, mirror case) and 180° turn (`OPPOSITE_SLOT`, same case), and linked in `familyAlgIds[slot]` only when the catalog has exactly those moves there; nothing is derived or added. Each transform SHALL first be checked to carry the setup onto the target slot-case.

#### Scenario: Exact mirror present
- **WHEN** `U R U' R'` at `f2l-1-FR` has its exact left-right mirror among `f2l-2-FL`'s algs
- **THEN** its `familyAlgIds.FL` is that alg's id

### Requirement: Shapes for alg links
Each alg SHALL get a `shapeId` (hash of its local form: the alg as done at front-right with whole-cube rotations taken out and wide/slice moves split into a face turn plus a rotation), a `mirrorShapeId` (hash of the local form's left-right mirror), and `side` R or F when one clearly dominates the local form. Links (rotation, mirrorLR, mirrorFB, transpose) are not stored; the app derives them (see f2l-catalog).

#### Scenario: Same alg, another grip
- **WHEN** `y' U R' ...` and `d R' ...` have the same local form
- **THEN** they have the same `shapeId`

### Requirement: Shape checks
The build SHALL fail unless every local form solves its case at FR, its mirror solves the mirror case, mirroring twice gives the form back, no local form is shared by two cases, no two forms hash alike, every exact family link matches the link kind its shapes give, and every derived link is mutual.

#### Scenario: Broken mirror
- **WHEN** an alg's mirrored local form does not solve the mirror case
- **THEN** the build fails naming the alg

### Requirement: Closing inserts
An alg ending in a 3-move insert (`X U* X'`, X a side face) or a 4-move `R' F R F'` / `F R' F' R` in any slot or mirror (starting with R/L: sledgehammer; with F/B: hedgeslammer) SHALL get `insert` with its kind, length, the one slot-case those moves solve on their own after an AUF (`slotCaseId`, `auf`, empty for none), and that slot-case's alg id with exactly AUF plus the trigger when the catalog has it. The build SHALL fail if the trigger solves other than exactly one slot-case.

#### Scenario: Basic insert
- **WHEN** an alg ends in `R U R'`
- **THEN** its `insert` names the slot-case `R U R'` solves after an AUF, with kind `insert` and length 3

### Requirement: Marked triggers
Each alg's `triggers` SHALL be its closing insert as one trigger (kind, 0-based start, length 3 or 4), unless the alg is listed in `data/triggers.json` written with parentheses around its trigger groups: then exactly those groups are its triggers (none if written without parentheses). Triggers are never detected from moves beyond this.

#### Scenario: Hand-marked alg
- **WHEN** `data/triggers.json` lists `(R U R' U') (R U R' U') (R U R')`
- **THEN** that alg's triggers are two sexy moves and an insert, at starts 0, 4 and 8

### Requirement: Trigger mark checks
Each parenthesised group in `data/triggers.json` SHALL be a named trigger by shape (3-move insert, sledgehammer, hedgeslammer, or sexy move with U turning the way the side does: `R U R' U'`, `L' U' L U`), and each listed alg SHALL exist in the catalog; otherwise the build fails.

#### Scenario: Not a named trigger
- **WHEN** a listed alg marks `(R U' R' U)`
- **THEN** the build fails saying it isn't a named trigger

### Requirement: Recommendation marks
Every alg from the recommendation sheets SHALL be placed by checking on the cube which slot-case it solves. If that slot is one the sheet covers (J Perm: FR only; CubeSkills: all four), the catalog alg with those exact moves gets the sheet in `recommendedBy`, or the alg is added with the sheet as its `source`. Sheet names and URLs are `RECOMMENDERS` in `shared/f2l/catalog.ts`.

#### Scenario: Sheet alg missing from SpeedCubeDB
- **WHEN** a CubeSkills alg solves `f2l-5-BL` and no catalog alg there has its moves
- **THEN** it is added to `f2l-5-BL` with `source: "cubeskills"` and `recommendedBy: ["cubeskills"]`

<!-- REVIEW: an added sheet alg's `rank` is its index in the whole sheet list, not a position among that slot-case's algs. -->

### Requirement: Skipped recommendations
Sheet algs that solve no basic case as-is (advanced cases, algs needing another slot empty) or land on a slot the sheet does not cover SHALL be skipped (the latter with a warning); a sheet alg that solves more than one slot-case SHALL fail the build.

#### Scenario: Advanced case
- **WHEN** a J Perm sheet alg solves none of the 164 slot-cases
- **THEN** it is skipped and counted as skipped in the build summary

### Requirement: F2L catalog contract
`catalog/f2l.json` SHALL match `Catalog` in `shared/f2l/catalog.ts`: `version: 1`, `generatedAt`, `caseSet` `{ id: "f2l", name: "F2L" }`, `clusters` (id, caseIds), `cases` (id, number, clusterId, group, mirrorCaseId, equal to id when self-mirror), `slotCases` (id, caseId, slot, setup, mirrorSlotCaseId, edgeOriented, algIds) and `algs`. It holds 41 cases × 4 slots = 164 slot-cases, and no AUF variants.

#### Scenario: Every slot-case has algs
- **WHEN** the app reads the catalog
- **THEN** each of the 164 slot-cases has at least one alg id

### Requirement: F2L alg contract
Each catalog alg SHALL have id, slotCaseId, moves, source, rank, shapeId and mirrorShapeId, and optionally votes, stm, etm, familyAlgIds, side, recommendedBy, insert and triggers, as described in the requirements above.

#### Scenario: Alg without family
- **WHEN** no exact mirror or turned version of an alg exists in the catalog
- **THEN** the alg has no `familyAlgIds`

### Requirement: PLL catalog
`build-pll` SHALL build `catalog/pll.json` (`PllCatalog` in `shared/pll/catalog.ts`, `version: 1`, `caseSet` `{ id: "pll", name: "PLL" }`) from SpeedCubeDB's PLL page with exactly 21 cases (else it fails), ordered by group (`Edges only`, `Adjacent corner swap`, `Diagonal corner swap`) then name. Per case: id `pll-<name>`, name, group, up to 3 algs as written, up to 4 scrambles, a setup, a sticker grid and arrows.

#### Scenario: Case count
- **WHEN** the page yields 20 cases
- **THEN** the build fails and the old catalog is kept

### Requirement: PLL scrambles
PLL scrambles SHALL be inverses of the case's algs rewritten as face turns only (no rotations, wide or slice moves, adjacent same-face turns merged), kept only if the result leaves F2L solved and the last layer oriented and gives the same case as the top alg up to AUF before and after; duplicates are dropped and the rest sorted shortest first. The tool adds AUFs (see pll-trainer).

#### Scenario: Slice-move alg
- **WHEN** a case's alg is `M2 U M2 U2 M2 U M2`
- **THEN** its scramble is written with R, L, F, B, U, D turns only

### Requirement: PLL setup
Each PLL case SHALL have a `setup`: face turns giving exactly the case as drawn, no AUF needed (the shortest scramble with the AUFs before and after that produce the drawn state, cancelled). The drawn angle SHALL be the AUF pair with the fewest moved pieces, then the shortest cycles (so G perms show two 3-cycles).

#### Scenario: Setup matches icon
- **WHEN** a solved cube gets a case's `setup`
- **THEN** its last layer matches the case's `stickers` exactly

### Requirement: PLL icon data
Each PLL case SHALL have `stickers`, a 5×5 grid (rows joined by `/`, `.` in the corners) of the face letter each U-layer sticker belongs on, with the U face in the middle, each side's top row around it, and back at the top; and `arrows`, from each moved piece's position to where it belongs (`[col, row]` on the top face, back row first), a 2-cycle drawn as one arrow with `both: true`.

#### Scenario: H perm
- **WHEN** the H perm is built
- **THEN** its arrows are two double-headed arrows swapping opposite edges
