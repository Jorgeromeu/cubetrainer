## MODIFIED Requirements

### Requirement: Repository parts
The repository SHALL consist of `packages/core` (pure shared logic and types), `packages/ui` (shared React UI), `tools/<id>/` (one folder per tool), `app/` (the web host), `server/` (the user-data API host), `catalog/` (generated alg catalogs, committed) and `catalog-builder/` (the one-off tool that produces `catalog/`). The app SHALL NOT depend on catalog-builder at build or run time; it only reads the committed `catalog/*.json`.

#### Scenario: Building the app without the builder
- **WHEN** the app is built with `catalog-builder/` never run on this machine
- **THEN** the build succeeds using the committed `catalog/f2l.json` and `catalog/pll.json`

#### Scenario: One install
- **WHEN** `npm install` runs once at the repository root
- **THEN** the app, server and catalog builder all have their dependencies

### Requirement: Tool modularity
Each tool SHALL be self-contained in `tools/<id>/`: a `contract.ts`, an `app/` folder with its view, and, only if it stores data, a `server/` folder with its routes, repository and migrations. A tool SHALL be listed by one line in the app registry and, if it has a `server/` folder, one line in the server registry. Removing a tool SHALL take deleting its folder and its registry lines.

#### Scenario: Adding a tool
- **WHEN** a new tool is added
- **THEN** it needs only its own `tools/<id>/` folder and one registry line per host it runs in
- **AND** no existing tool's code and no shared library changes

#### Scenario: Tool without stored data
- **WHEN** a tool stores nothing on the server
- **THEN** it has no `server/` folder and no server registry entry

#### Scenario: Removing a tool
- **WHEN** `tools/pll-compare/` and its two registry lines are deleted
- **THEN** the app and server build and run, and every other tool works unchanged

## REMOVED Requirements

### Requirement: Shared types
**Reason**: `shared/` is split up. Per-tool API types move to each tool's `contract.ts`, and cross-cutting types (slots, triggers, solves, penalties) move to `packages/core`.
**Migration**: `shared/cube.ts` goes to `packages/core`. `shared/<id>/*` goes to `tools/<id>/contract.ts`, and `Penalty`/`Solve` basics become one definition in core. See "Tool public contract" and "Shared core library".

## ADDED Requirements

### Requirement: Tool public contract
Each tool's `contract.ts` SHALL define its HTTP API's request and response bodies as plain JSON types and its validation limits. App and server code of that tool SHALL both compile against it.

#### Scenario: Changing an API body
- **WHEN** a tool's request body type changes
- **THEN** the change is made in its `contract.ts` and both its app and server compile against it

### Requirement: What a tool exposes
A tool's contract SHALL list in an `exposes` section the calls other tools may use: each a named, typed, read-only function over one of its API endpoints. Everything not exposed is private to the tool, even though it is reachable over HTTP. Exposing nothing is the default: a contract without an `exposes` section exposes nothing.

#### Scenario: Private endpoint
- **WHEN** another tool wants data from an endpoint that is not in the provider's `exposes`
- **THEN** it cannot call it; the provider must first expose it

#### Scenario: No writes across tools
- **WHEN** a tool wants to change another tool's data
- **THEN** there is no way to do so; only the owning tool writes its data

### Requirement: Exposed calls are stable
Changes to an exposed call SHALL only add things (new optional parameters, new result fields). Removing or changing the meaning of an exposed call SHALL be done by exposing a new call and updating its users in the same change.

#### Scenario: Adding a field
- **WHEN** PLL adds a `comment` field to the solves it exposes
- **THEN** stats keeps compiling and working without changes

### Requirement: Shared core library
`packages/core` SHALL hold logic and types used by more than one tool or host: cube and slot model, notation parsing and move info, solve and penalty types and averages, drill history and picks, catalog types and the API client. It SHALL have no third-party runtime dependencies, use no DOM or React, and import nothing else in the repository.

#### Scenario: Server uses core
- **WHEN** the server validates a PLL solve's penalty
- **THEN** it uses the same penalty definition as the app, from core, and the server still has no npm dependencies

#### Scenario: One definition
- **WHEN** two tools need the concept of a timed solve with a penalty
- **THEN** both use core's definition instead of declaring their own

### Requirement: Shared UI library
`packages/ui` SHALL hold the React UI shared by tools: the shell (see tool-shell), cube rendering (see cube-rendering), notation display and move hints (see cube-notation), icons, settings building blocks and stealth (see stealth-mode). It MAY depend on React, cubing.js and three, and SHALL import only core from the repository.

#### Scenario: A new tool shows a cube
- **WHEN** a new tool needs a 3D cube with notation and stealth support
- **THEN** it imports them from `packages/ui` and writes no rendering code of its own

### Requirement: Import boundaries
The allowed imports SHALL be: core imports nothing in the repo; ui imports core; a tool's contract imports core; a tool's app imports core, ui, its contract and other tools' contracts; a tool's server imports core, its contract and the server host's tool interface; hosts import their registries' tools. A check SHALL fail the build on any other edge.

#### Scenario: Tool imports another tool's view
- **WHEN** `tools/stats/app/` imports a file from `tools/pll/app/`
- **THEN** the build fails naming the file and the forbidden edge

#### Scenario: Core imports React
- **WHEN** a file in `packages/core` imports `react`
- **THEN** the build fails

### Requirement: Using what other tools expose
A tool MAY use another tool's exposed calls, on the client only, over the HTTP API. The consumer SHALL keep working when a call fails (no server, provider disabled or not installed), treating it as no data from that tool.

#### Scenario: Stats shows PLL solves
- **WHEN** a stats view uses `pll`'s exposed `listSolves`
- **THEN** it goes through the same HTTP API any other client would

#### Scenario: Provider missing
- **WHEN** the PLL tool is disabled or not installed
- **THEN** the consumer shows its own data without PLL's, and no error blocks it
