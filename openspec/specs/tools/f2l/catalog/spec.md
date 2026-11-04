# tools/f2l/catalog Specification

## Purpose
The F2L tool's alg catalog (`tools/f2l/catalog/f2l.json`, types in `catalog.ts`) and the one-off program that builds it (`builder/`): every F2L case in every slot, with setups and verified algs from public sources. Owned by the F2L tool. Deliberately loose for now; specified properly when the tool is reworked.

## Requirements

### Requirement: What the catalog holds
The catalog SHALL hold the 41 F2L cases, each in all four slots (FR, FL, BR, BL): a **slot-case** is a case in one slot. Each slot-case SHALL have a face-turns-only setup (cross on D, see library/cube-rendering) and algs that solve it, each checked on a cube with cubing.js. Cases SHALL be grouped into **mirror clusters**: a case with its left-right mirror, or a self-mirror case alone.

#### Scenario: Size
- **WHEN** the catalog is built
- **THEN** it has 41 cases and 164 slot-cases

### Requirement: Stable content-derived ids
Catalog ids SHALL be derived from content only, so rebuilds keep them stable for the user data that refers to them (see foundation/user-data): case `f2l-<n>`, slot-case `f2l-<n>-<slot>`, cluster `f2l-c-<sorted case numbers joined by ->`, alg `<slotCaseId>-<first 8 hex of sha1(normalised moves)>`.

#### Scenario: Rebuild with new votes
- **WHEN** the catalog is rebuilt after a source's votes and order change
- **THEN** every alg that is still present keeps its id

### Requirement: Built once, committed
The builder SHALL be a standalone Node program (`tools/f2l/catalog/builder/`, `.ts` run directly) that fetches its sources into a gitignored cache (`raw/`), parses them into committed datasets (`data/`), checks every alg and writes `f2l.json`. The app and server SHALL only read the committed `f2l.json`, never run the builder.

#### Scenario: Building the app without the builder
- **WHEN** the app is built with the builder never run on this machine
- **THEN** the build succeeds using the committed `f2l.json`
