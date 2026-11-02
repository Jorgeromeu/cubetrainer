# user-data Specification

## Purpose
How the server stores and protects the user's own data (progress, solves, sets, milestones): one SQLite file per tool, forward-only migrations, catalog references by stable id, and the HTTP API conventions every tool module follows.

## Requirements

### Requirement: One database per tool
Each server tool that stores data SHALL have its own SQLite file `<DATA_DIR>/<id>.sqlite` (`DATA_DIR` defaults to `data/` at the repo root and is gitignored), opened in WAL mode with foreign keys on. A tool SHALL only be able to open its own file and SHALL NOT read or write another tool's data.

#### Scenario: Separate files
- **WHEN** the server has started with all tools
- **THEN** `data/f2l.sqlite`, `data/pll.sqlite`, `data/pll-compare.sqlite` and `data/stats.sqlite` exist, one per tool
- **AND** the data directory is created if missing

### Requirement: Versioned migrations
A tool's schema SHALL change only through numbered SQL files in its own `migrations/` folder (`001_*.sql`, `002_*.sql`, ...), applied at startup in numeric order, each once, each inside a transaction, with the last applied number recorded in the database's `PRAGMA user_version`. Migration numbers are per tool. An applied migration SHALL never be edited; changes go in a new file.

#### Scenario: New migration
- **WHEN** the server starts and the F2L database is at version 8 while `009_wanted_status.sql` exists
- **THEN** only migration 009 runs, `user_version` becomes 9, and the log says it was applied

#### Scenario: Failing migration
- **WHEN** a migration throws
- **THEN** it is rolled back, `user_version` is unchanged, and that tool fails to start

### Requirement: User data is never wiped
User tables SHALL never be dropped or emptied by startup, rebuilds or migrations; a migration that reshapes a table SHALL copy its rows into the new table (e.g. rebuilding `alg_state` to widen a CHECK constraint). Deleting user data happens only through an explicit API request.

#### Scenario: Catalog rebuild
- **WHEN** `catalog/f2l.json` is regenerated and the server restarted
- **THEN** every row in `data/f2l.sqlite` is still there

### Requirement: Tool failure isolation
If a tool fails at startup (failed migration, missing or unreadable catalog file), the server SHALL disable only that tool: its API answers 503 with `{ "error": "The <id> tool failed to start (see the server log)" }`, the log says why, and every other tool and the served app keep working.

#### Scenario: Missing PLL catalog
- **WHEN** `catalog/pll.json` is missing at startup
- **THEN** `/api/pll/...` and `/api/pll-compare/...` answer 503, and `/api/f2l/progress` still answers 200

### Requirement: Catalog stays outside the database
Catalog data SHALL NOT be copied into the databases. Each server tool that references catalog items SHALL read the relevant `catalog/*.json` once at startup and use it only to validate writes.

#### Scenario: Catalog changed while running
- **WHEN** the catalog file changes while the server runs
- **THEN** validation keeps using the catalog read at startup until the server restarts

<!-- REVIEW: docs/requirements.md §5.3 still describes catalog tables seeded into each DB; the code keeps the catalog as JSON only. -->

### Requirement: Stable catalog references
User data SHALL reference catalog items only by their stable, content-derived ids (see catalog-builder): F2L slot-case ids (`f2l-12-FR`), F2L alg ids (`<slotCaseId>-<hash>`), PLL case ids (`pll-Ua`). These references are plain text columns, not foreign keys. An alg reference is an `AlgRef` `{ kind: "catalog" | "user", id }` so that user-added algs can be referenced the same way as catalog algs.

#### Scenario: Alg dropped by a rebuild
- **WHEN** a catalog rebuild drops an alg that a stored main alg, status, note or video link refers to
- **THEN** the stored row stays in the database and is still returned by the API

<!-- REVIEW: server/README.md says the app then shows "No longer in the catalog"; no such text exists in app/src, so how the app shows orphaned references is unspecified. -->

### Requirement: Writes validated against the catalog
Every write that references the catalog SHALL be checked against the catalog read at startup and refused with 400 if the id is unknown or inconsistent (e.g. an alg that belongs to another slot-case, an unknown PLL case id). Reads SHALL NOT filter by the catalog.

#### Scenario: Unknown case
- **WHEN** a PLL solve is saved with `caseId: "pll-Zz"`
- **THEN** the server answers 400 `{ "error": "Unknown PLL case pll-Zz" }` and stores nothing

#### Scenario: Alg from another slot-case
- **WHEN** an F2L main alg is set to an alg of another slot-case
- **THEN** the server answers 400 naming the slot-case the alg belongs to

### Requirement: Strict request bodies
Request bodies SHALL be JSON objects with only the documented fields; unknown fields, wrong types and values past the documented limits SHALL be refused with 400 and a message naming the problem. Text limits live in `shared/` (e.g. note 5000 characters, video URL 2000, user alg 200, solve time up to 10 minutes, set name 80, caption 60, exclude reason 200, milestone label 80).

#### Scenario: Unknown field
- **WHEN** a body contains a field the endpoint does not know
- **THEN** the server answers 400 `Unknown field(s): <names>`

#### Scenario: Body not JSON
- **WHEN** a PUT, PATCH or POST body does not parse as JSON
- **THEN** the server answers 400 `Body must be JSON`

### Requirement: Client-made ids and idempotent saves
Records the client creates (notes, user algs, PLL solves, compare sets, milestones) SHALL be created with `PUT .../<id>` where the id is a client-made UUID; a non-UUID id is refused with 400. Repeating the same PUT SHALL be safe: it either replaces the record (notes, sets, milestones) or returns the record as already stored (PLL solves, an identical user alg), so retries after a lost response never duplicate data. Server-created records (imported stats solves) get server-made UUIDs.

#### Scenario: Retried solve save
- **WHEN** the same `PUT /api/pll/solves/<uuid>` is sent twice
- **THEN** one solve exists and both responses return it as first stored

#### Scenario: Bad id
- **WHEN** a note is saved under id `abc`
- **THEN** the server answers 400 `Note id must be a uuid`

### Requirement: Clearing by null
Endpoints that set an optional value SHALL clear it when given `null` (or empty text for notes) and return `null`, instead of needing a separate DELETE.

#### Scenario: Clearing a main alg
- **WHEN** `PUT /api/f2l/progress/f2l-12-FR` is sent with `{ "mainAlg": null }`
- **THEN** the slot-case's main-alg row is removed and the response body is `null`

### Requirement: Server timestamps
The server SHALL set `created_at` / `updated_at` itself as ISO 8601 UTC strings; clients never send them.

#### Scenario: Saving a note
- **WHEN** a note is created and later edited
- **THEN** `createdAt` stays the first save's time and `updatedAt` is the edit's time

### Requirement: API routing
Each tool's routes SHALL live under `/api/<id>/`, with `:name` path segments passed as URL-decoded parameters. A successful request SHALL answer 200 with a JSON body, `null` when there is nothing to return. List endpoints return the whole collection in one response, wrapped in an object (e.g. `{ solves: [...] }`), in a documented order.

#### Scenario: Delete
- **WHEN** `DELETE /api/pll/solves/<id>` succeeds
- **THEN** the server answers 200 with body `null`

### Requirement: API errors
Errors SHALL be JSON `{ "error": <message> }` with status 400 for invalid requests, 404 for an unknown tool or path, 405 when the path exists for another method, 503 for a disabled tool, and 500 `Internal error` for anything unexpected (logged on the server).

#### Scenario: Wrong method
- **WHEN** `POST /api/pll/solves/<id>` is sent
- **THEN** the server answers 405 `{ "error": "Method not allowed" }`

#### Scenario: Unknown tool
- **WHEN** `GET /api/oll/anything` is sent
- **THEN** the server answers 404 `{ "error": "Not found" }`

### Requirement: Backups are manual
The system SHALL leave backups to the user: the `data/*.sqlite` files are the user's data and are backed up by copying them with the server stopped (or together with their `-wal` file). There is no export/import endpoint for user data.

#### Scenario: Backing up
- **WHEN** the user copies `data/f2l.sqlite` while the server is stopped
- **THEN** the copy holds all F2L progress

<!-- REVIEW: docs/requirements.md plans a JSON export/import of user data (stage 2); not built. Stats has a one-off import endpoint (stats spec), not a general backup. Ad-hoc backup-before-*.sqlite files sit in data/. -->
