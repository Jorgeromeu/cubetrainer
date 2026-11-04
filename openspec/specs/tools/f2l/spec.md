# tools/f2l Specification

## Purpose
The F2L tool: an explorer and drill over the F2L catalog, with the user's progress on it. Deliberately loose for now; its behaviour is specified properly when the tool is reworked.

## Requirements

### Requirement: F2L tool
The system SHALL provide an F2L tool with id `f2l` (see foundation/architecture) whose routes under `#/f2l/` are an overview of every case, a page per mirror cluster (`#/f2l/<clusterId>[/<slotCaseId>[/<algId>]]`) and a train view (`#/f2l/train`).

#### Scenario: Opening a cluster
- **WHEN** the user opens `#/f2l/f2l-c-7-8`
- **THEN** that cluster's cases are shown with their cubes and algs

### Requirement: Explore the catalog
The tool SHALL show every case of `catalog/f2l.json` in every slot, with its setup on a 3D cube (see library/cube-rendering) and its algs (see library/cube-notation), and SHALL work as a read-only explorer without the server.

#### Scenario: No server
- **WHEN** the server is not running
- **THEN** cases and algs can still be browsed, and progress is hidden

### Requirement: Progress
The user SHALL be able to keep, per slot-case, a main alg, a status per alg (wanted, learning, learnt), notes, video links and algs of their own (accepted only if they solve the case). These SHALL be stored by the F2L tool's server in `data/f2l.sqlite`, under `/api/f2l/`, referring to catalog items by id (see foundation/user-data).

#### Scenario: Picking a main alg
- **WHEN** the user marks an alg as main for a slot-case
- **THEN** it is saved and still marked after a reload

### Requirement: F2L settings
F2L's own settings (`setting('f2l', ...)`, see foundation/settings) SHALL include, besides its view choices, how its cubes are drawn: highlight pair, hint stickers (Off, Pair, All F2L) and hint distance, passed to every F2L cube (`F2lCube`, see library/cube-rendering).

#### Scenario: Turning hints off
- **WHEN** hint stickers are set to Off in F2L's settings
- **THEN** no F2L cube shows hint stickers

### Requirement: Train
The train view SHALL deal cases from the user's selection at random angles, showing the alg on request.

#### Scenario: Next case
- **WHEN** the user asks for the next case
- **THEN** another selected case is dealt

### Requirement: Exposed active cases
The tool SHALL expose `active-cases` (`f2lExposes.activeCases`, see foundation/architecture): the slot-cases that have a main alg or an alg with a status, with that main alg and those statuses.

#### Scenario: Another tool reads them
- **WHEN** a tool with `uses: ["f2l"]` reads `f2lExposes.activeCases`
- **THEN** it gets one entry per slot-case the user is working on
