# tools/timer Specification

## Purpose
The timer tool: times full solves and owns every full solve, timed here or imported from another timer, with a stats page over them. Deliberately loose for now; its behaviour is specified properly when the tool is reworked.

## Requirements

### Requirement: Timer tool
The system SHALL provide a timer tool with id `timer` (see foundation/architecture), the default tool, with a timer page at `#/timer` and a stats page at `#/timer/stats`.

#### Scenario: Opening the app
- **WHEN** the user opens `#/`
- **THEN** the timer page is shown

### Requirement: Timing
The timer page SHALL time a solve (hold Space until ready, release to start, any key stops), show a random-state scramble for each, let the last solve be marked +2 or DNF or deleted, and show recent averages and solves.

#### Scenario: A solve
- **WHEN** the user holds Space, releases it, and presses a key later
- **THEN** the time is shown and the solve is saved with its scramble

### Requirement: Owner of every full solve
The timer tool SHALL be the only owner of full solves, stored by its server in `data/timer.sqlite` under `/api/timer/`. Each solve SHALL record its time, penalty, scramble, when it was done and its `source` (`timer` for solves timed here, otherwise the timer it was imported from); solves timed here are saved with an id made in the app, so retries never duplicate them (see foundation/user-data).

#### Scenario: Server down while timing
- **WHEN** a solve is timed with the server down
- **THEN** it is kept in the page and saved once the server answers

### Requirement: Imports
Another timer's export (CubeTime for now) SHALL be importable through the API: solves already stored are skipped, each import is recorded and tags the solves it adds, and an import can be undone. An imported solve is excluded from the stats rather than deleted, so a re-import can't bring it back.

#### Scenario: Re-importing
- **WHEN** the same export is imported twice
- **THEN** the second import adds nothing

### Requirement: Stats page
The stats page SHALL chart every solve that isn't excluded (progress, consistency, practice over time) with the timeline milestones, and list them in a table. It is read-only.

#### Scenario: Imported and timed solves together
- **WHEN** some solves were imported and others timed here
- **THEN** the stats page shows them all

### Requirement: Exposed solves
The tool SHALL expose `solves` (`timerExposes.solves`, see foundation/architecture): every solve, excluded ones included and marked.

#### Scenario: Another tool reads them
- **WHEN** a tool with `uses: ["timer"]` reads `timerExposes.solves`
- **THEN** it gets the same solves as the timer's own API
