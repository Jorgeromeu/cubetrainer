# foundation/dev-workflow Specification

## Purpose
Developing in git worktrees next to the main checkout without touching the user's real data: each worktree runs on its own ports with its own copy of the data, the app shows which branch and data it runs on, and new data made in a worktree can be brought back into main's after merging (`scripts/devenv.ts`, `scripts/datasync.ts`, `scripts/data.ts`).

## Requirements

### Requirement: Worktree first run
When the server starts in a git worktree with no `DATA_DIR` set and no tool DB in the worktree's `data/`, it SHALL first copy every tool DB of the main checkout's `data/` there (a consistent copy, safe while main's server runs; backups are not copied) and record when. Main's data SHALL never be written by a worktree's server.

#### Scenario: New worktree
- **WHEN** `npm run server` runs for the first time in a new worktree
- **THEN** the log says main's DBs were copied, and the worktree's tools open its own copies

### Requirement: Ports per checkout
The main checkout SHALL use ports 3001 (server) and 5173 (app). A worktree SHALL use the pair kept in its `.dev.json`, or else pick the first pair 3001+k / 5173+k that is free and not kept by another worktree, and keep it. Server and Vite SHALL agree on it; `PORT`, `API_URL` and `--port` still override.

#### Scenario: Two worktrees
- **WHEN** two worktrees start their servers
- **THEN** each gets its own ports, the same ones every time

### Requirement: Branch badge
The server SHALL answer `GET /api/_/info` with the checked-out branch (read on each request), whether it runs in the main checkout or a worktree, its folder, its data folder, main's data folder, when its data was copied, its port, and how many rows its data has that main's doesn't. The shell SHALL show a badge after the tool name with the branch (a colour derived from its name) and "own data" or "main data", the unpushed count if any, and the details as a tooltip, and prefix the tab title with the branch. Both SHALL be hidden when the branch is `main` and the data is main's.

#### Scenario: Feature branch in the main checkout
- **WHEN** the main checkout is on branch `stronger-foundations`
- **THEN** the badge reads "stronger-foundations · main data" and the tab title starts with `stronger-foundations · `

#### Scenario: Normal use
- **WHEN** the main checkout is on `main` with its own data
- **THEN** there is no badge and the title is `Cubetrainer · <tool>`

### Requirement: Refreshing a worktree's data
`npm run data:pull`, run in a worktree, SHALL move the worktree's current data aside and copy main's again.

#### Scenario: After editing an unmerged migration
- **WHEN** the worktree's DB ran an old version of a migration that has since been edited
- **THEN** `data:pull` gives it a fresh copy of main's, and the next start runs the edited migration

### Requirement: Bringing data back
`npm run data:diff`, run in a worktree, SHALL list per DB and table the rows whose primary key main's data doesn't have, and the DBs main doesn't have. `npm run data:push` SHALL add exactly those: copy whole the DBs main doesn't have, and insert the missing rows in one transaction per DB, checking foreign keys before committing, after backing up each main DB it changes next to it. It SHALL never overwrite or delete a row of main's, and SHALL refuse when a DB's migration version differs from main's.

#### Scenario: Solves timed in a worktree
- **WHEN** a solve was timed in a worktree and the branch is merged
- **THEN** `data:push` adds that solve to main's timer DB, and main's other solves are unchanged

#### Scenario: Main not migrated yet
- **WHEN** the worktree's timer DB is at migration 6 and main's at 5
- **THEN** `data:push` refuses and says to restart main's server on the merged code first
