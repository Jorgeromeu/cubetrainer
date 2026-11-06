# foundation/architecture Specification

## Purpose
How Cubetrainer is built: standalone tools that each own their data, two shared libraries, two thin hosts (the web app and the server), a generated catalog, and the one way tools read each other's data (exposed calls and capabilities).

## Requirements

### Requirement: Single-user local app
The system SHALL be a personal web app for one user, run locally, with no accounts, login or multi-user support.

#### Scenario: No sign-in
- **WHEN** the user opens the app
- **THEN** every tool is usable straight away, without any account or authentication

### Requirement: Repository parts
The repository SHALL consist of `packages/core` (pure shared logic and types), `packages/ui` (shared React UI), `tools/<id>/` (one folder per tool), `app/` (the web host), `server/` (the user-data host) and `scripts/` (the import check). One `npm install` at the root SHALL install every part (npm workspaces, including programs inside a tool such as the F2L catalog builder).

#### Scenario: One install
- **WHEN** `npm install` runs once at the repository root
- **THEN** the app, the server and every tool's programs have their dependencies

### Requirement: Tool modularity
Each tool SHALL be self-contained in `tools/<id>/`: a `contract.ts`, an `app/` folder with its view and styles (`app/index.ts` exports its `Tool`, see foundation/tool-shell), only if it stores data a `server/` folder with its routes, repository and migrations (`server/index.ts` exports its `ServerTool`), and only if it ships data a `catalog/` folder (see Data a tool ships with). A tool SHALL be listed by one line in the app registry (`app/src/tools.ts`) and, if it has a `server/` folder, one line in the server registry (`server/src/tools.ts`). Removing a tool SHALL take deleting its folder and its registry lines.

#### Scenario: Adding a tool
- **WHEN** a new tool is added
- **THEN** it needs only its own `tools/<id>/` folder and one registry line per host it runs in
- **AND** no existing tool's code and no shared library changes

#### Scenario: Scaffolding one
- **WHEN** `npm run new-tool <id> -- --server` runs
- **THEN** `tools/<id>/` and its registry lines exist, and the build, import check and tests pass with it

#### Scenario: Tool without stored data
- **WHEN** a tool stores nothing on the server
- **THEN** it has no `server/` folder and no server registry entry

#### Scenario: Removing a tool
- **WHEN** `tools/f2l/` and its two registry lines are deleted
- **THEN** the app and server build and run, and the timer works unchanged

### Requirement: Same id in app and server
A tool's id SHALL be the same in app and server, consist only of lowercase letters, digits and dashes, and be used as its hash-route prefix (`#/<id>/`), its API prefix (`/api/<id>/`) and its database file name (`data/<id>.sqlite`). Current ids: `timer`, `f2l`.

#### Scenario: Invalid or duplicate server id
- **WHEN** a server tool's id has other characters, or two server tools share an id
- **THEN** the server refuses to start with an error naming the id

### Requirement: A tool owns its data
Each tool SHALL be the only writer of its data: its own SQLite file and the routes under its API prefix (see foundation/user-data). Other tools SHALL read it only through the calls it exposes (see What a tool exposes), never through its routes, tables or files.

#### Scenario: No writes across tools
- **WHEN** a tool wants to change another tool's data
- **THEN** there is no way to do so; only the owning tool writes its data

### Requirement: Tool public contract
Each tool's `contract.ts` SHALL define its HTTP API's request and response bodies as plain JSON types, its validation limits, and the calls it exposes. App and server code of that tool SHALL both compile against it. It imports only core.

#### Scenario: Changing an API body
- **WHEN** a tool's request body type changes
- **THEN** the change is made in its `contract.ts` and both its app and server compile against it

### Requirement: Clients
The web app SHALL be one client of the tools' HTTP APIs, with no access to tool data the APIs don't give. Any other client (a native iOS app, a script) SHALL use the same APIs, each defined only by the tool's `contract.ts` as plain JSON, and SHALL implement only the tools it needs: a tool doesn't declare which clients it has. A client SHALL follow the same rules as the web app: client-made ids and idempotent requests, so it can work offline with an outbox (see App works without the server), and the token when the server requires one (see foundation/deployment). A tool's README SHALL say when a client other than the web app uses its API; from then on that API only grows (new optional fields, new endpoints): changing or removing anything takes a new endpoint, since an installed app isn't updated with the server.

#### Scenario: An iOS timer
- **WHEN** an iOS app logs solves
- **THEN** it saves them with `PUT /api/timer/solves/<its uuid>` like the web app, they appear in the web app's stats, and the iOS app knows nothing about F2L

#### Scenario: A field rename
- **WHEN** a tool whose API an iOS app uses wants to rename a response field
- **THEN** it adds the new field and keeps the old one, or adds a new endpoint, instead

### Requirement: What a tool exposes
A tool's contract SHALL declare the calls other tools may read, each with `exposed<Result, Args>(tool, name)` from `packages/core/exposed.ts` (or `provides(tool, name, capability)`, see Capabilities), and its server SHALL implement them (`implement(call, handler)`, returned from `start()` next to its routes). Calls are read-only; arguments are strings (they travel as a query string); names are lowercase letters, digits and dashes. Everything not declared is private to the tool, even if reachable over HTTP. A tool SHALL only implement its own calls. Exposed today: `timer` → `solves` (see tools/timer), `f2l` → `active-cases` (see tools/f2l).

#### Scenario: Private endpoint
- **WHEN** another tool wants data from an endpoint that is not an exposed call
- **THEN** it cannot read it; the owner must first expose it

#### Scenario: Implementing another tool's call
- **WHEN** a tool's `start()` returns an implementation of a call declared for another tool id
- **THEN** that tool fails to start (and only it is disabled)

### Requirement: Reading exposed calls
Exposed calls SHALL be readable two ways with the same result: by another tool's server in-process with `ctx.read(call, args)`, and by any tool's app over HTTP with `GET /api/<tool>/exposed/<name>?args` (`readExposed` in `packages/ui/exposed.ts`). A server reader SHALL list the tool in its `uses`, or the read throws. A provider that isn't installed or failed to start SHALL read as no data (undefined in-process, 404 over HTTP), and the reader SHALL keep working. `exposed` is a reserved path under each tool's prefix.

#### Scenario: Server-side read
- **WHEN** a tool with `uses: ["timer"]` calls `ctx.read(timerExposes.solves)` while handling a request
- **THEN** it gets the timer's `{ solves }` without an HTTP round trip

#### Scenario: Undeclared read
- **WHEN** a tool reads `f2l`'s call without `"f2l"` in its `uses`
- **THEN** the read throws, naming the missing use

#### Scenario: Provider missing
- **WHEN** the provider is not installed
- **THEN** `ctx.read` returns undefined and `GET /api/<tool>/exposed/<name>` answers 404, and the reader shows its own data without it

### Requirement: Capabilities
A capability SHALL be an interface that several tools can provide, typed once in core (`Capabilities` in `packages/core/exposed.ts`). Readers SHALL get every running provider's result, tagged with its tool id: in-process with `ctx.gather(capability, args)` (the capability in `uses`) or over HTTP with `GET /api/_/capabilities/<name>?args` (`{ results: [{ tool, result }] }`, `gatherCapability` in `packages/ui/exposed.ts`). `_` is a reserved API prefix (also used by `GET /api/_/info`, see foundation/dev-workflow, and `/api/_/settings`, see foundation/settings). The first capability is `case-observations` (`packages/core/observations.ts`): a case met (its catalog case set and id), when, recognition and execution time, the moves, the matched catalog alg if any, and whether it was met in a solve or a drill. No tool provides it yet.

#### Scenario: Two providers
- **WHEN** two installed tools provide `case-observations`
- **THEN** a gather returns both results, each with its tool id

#### Scenario: No provider
- **WHEN** no installed tool provides a capability
- **THEN** a gather returns no results, and that is not an error

### Requirement: Exposed calls are stable
Changes to an exposed call or capability SHALL only add things (new optional arguments, new result fields). Removing or changing the meaning of one SHALL be done by exposing a new call and updating its readers in the same change.

#### Scenario: Adding a field
- **WHEN** the timer adds a field to the solves it exposes
- **THEN** every reader keeps compiling and working without changes

### Requirement: Data a tool ships with
A tool MAY ship generated, committed data (e.g. the F2L alg catalog) in `tools/<id>/catalog/`, with its types and the program that builds it (`catalog/builder/`). The app SHALL bundle it at build time, so it never comes from the server; the tool's server MAY read it from disk at startup. It belongs to that tool: other tools SHALL NOT import it, and read what they need through the tool's exposed calls. When several tools come to need the same data, it moves to a shared package.

#### Scenario: Catalog without a server
- **WHEN** the app runs with no server reachable
- **THEN** all F2L cases, setups and algs are still shown

#### Scenario: Another tool imports it
- **WHEN** `tools/timer/app/` imports `tools/f2l/catalog/f2l.json`
- **THEN** the import check fails the build

### Requirement: Shared core library
`packages/core` SHALL hold logic and types used by more than one tool or host: cube and slot model, notation parsing and move info, solve and penalty types and averages, drill picks, catalog types, the API client, exposed-call and capability types. It SHALL have no third-party runtime dependencies, use no DOM or React, and import nothing else in the repository.

#### Scenario: Server uses core
- **WHEN** the server validates a solve's penalty
- **THEN** it uses the same penalty definition as the app, from core, and the server still has no npm dependencies

#### Scenario: One definition
- **WHEN** two tools need the concept of a timed solve with a penalty
- **THEN** both use core's definition instead of declaring their own

### Requirement: Shared UI library
`packages/ui` SHALL hold the React UI shared by tools: the shell and its building blocks (see foundation/tool-shell), settings and view state (see foundation/settings), server data (`serverData`, see App works without the server), keyboard checks (`keys.ts`), cube rendering (see library/cube-rendering), notation display and move hints (see library/cube-notation), the drill kit, the server notice, reading exposed calls from the app, and the design tokens and pane layout (see library/design). It MAY depend on React, cubing.js and three, and SHALL import only core from the repository. Its stylesheet (`ui.css`) holds the theme tokens, base elements and its components' styles; each tool's styles live in `tools/<id>/app/<id>.css`.

#### Scenario: A new tool shows a cube
- **WHEN** a new tool needs a 3D cube with notation
- **THEN** it imports them from `packages/ui` and writes no rendering code of its own

### Requirement: Import boundaries
The allowed imports SHALL be: core imports nothing in the repo; ui imports core; a tool's contract imports core and its own catalog; a tool's catalog imports core; a tool's app imports core, ui, any tool's contract and its own catalog; a tool's server imports core, any tool's contract, its own catalog and the server's tool interface (`server/src/tool.ts`); a tool's catalog builder imports core and its own catalog; the app host imports core, ui and tools' apps; the server host imports core and tools' servers; tests (`*.test.ts`) import anything. Core, contracts and catalogs import no packages, and server code only `node:` built-ins. `npm run check:imports` SHALL check this, as part of the build, failing on any other edge.

#### Scenario: Tool imports another tool's view
- **WHEN** `tools/timer/app/` imports a file from `tools/f2l/app/`
- **THEN** the build fails naming the file and the forbidden edge

#### Scenario: Core imports React
- **WHEN** a file in `packages/core` imports `react`
- **THEN** the build fails

### Requirement: App works without the server
Every tool's app SHALL hold its server data through `serverData()` (`packages/ui/serverData.ts`), so the app works the same way in every tool when the server is away. The snapshot SHALL be fetched at start and again on window focus or when back online, never while changes are unsent. Until it first loads, `load` is `offline` (no server) and features that need stored data are hidden, with a short notice in the bottom-right corner; it SHALL be retried in the background (2 s, 5 s, 10 s, then every 30 s). A change SHALL show at once and its request join the tool's outbox, sent strictly in order, one at a time, and kept in this browser so a reload loses nothing; with no server the data stays shown, the outbox waits, and it is sent once the server answers. A request the server refuses SHALL be dropped, its error shown for a while, and the snapshot fetched again once nothing else is unsent. Requests SHALL therefore be idempotent (PUT, PATCH or DELETE by a client-made id).

#### Scenario: F2L without server
- **WHEN** the F2L tool loads and the API is unreachable
- **THEN** cases and algs are browsable, progress UI is hidden, and a "No server · progress not loaded" notice shows

#### Scenario: Server gone mid-session
- **WHEN** the server stops while the user marks an alg learnt, then starts again
- **THEN** the alg stays marked learnt on screen, and the change reaches the server once it's back

#### Scenario: Timing with no server, then reloading
- **WHEN** a solve is timed and its penalty set with the server down, and the page is reloaded
- **THEN** both requests are still queued, and the solve with its penalty reaches the server, in that order, once it answers

#### Scenario: Refused change
- **WHEN** the server refuses a change
- **THEN** its message shows, and what's shown goes back to what the server has

### Requirement: Telling refusal apart from no server
Requests to the server SHALL be JSON with a 5 s timeout (`request` in `packages/core/api.ts`), and SHALL distinguish "the server refused the request" (an HTTP error carrying a JSON `{ error }` string) from "there is no server" (network failure, timeout, a proxy error, an error without a JSON error message, or a success response that is not JSON, such as a static host returning `index.html`). Only the first is shown as a save error; the second puts the tool into its offline state.

#### Scenario: Server refuses a save
- **WHEN** a save gets a 400 with `{ "error": "Unknown slot-case f2l-99-FR" }`
- **THEN** the app treats it as a refusal and shows that message, staying online

#### Scenario: Static host
- **WHEN** a request returns 200 with an HTML body
- **THEN** it is treated as no server, not as data

### Requirement: Server process
The server SHALL be a single Node process with no npm dependencies (`node:http` and `node:sqlite`, `.ts` files run directly, Node 23.6 or later), listening on `PORT` (default 3001 in the main checkout, see foundation/dev-workflow), keeping its databases in `DATA_DIR` (default `data/`), and answering `/api/<id>/...` with that tool's routes and exposed calls. It SHALL start every registered tool once (`start()`); a tool that throws at startup is disabled alone (see foundation/user-data).

#### Scenario: Start
- **WHEN** the server starts
- **THEN** the log lists each tool with its route count and the calls it exposes, and the data directory

### Requirement: Server serves the built app
When `app/dist` exists, the server SHALL serve the built app's files for every non-API path (`/` is `index.html`); a path that escapes `app/dist` is served `index.html`, and a missing file is a 404. Without `app/dist` every non-API path SHALL answer 404 "No built app (run npm run build in app/), API only".

#### Scenario: Production run
- **WHEN** the app was built and the server started with `npm start -w server`
- **THEN** `http://localhost:3001` serves the app and its API from one process

#### Scenario: No build
- **WHEN** `app/dist` does not exist
- **THEN** only the API is served

### Requirement: Development setup
In development the app SHALL run under Vite (`npm run dev`, port 5173, `--port` to change) and proxy `/api` to the server (default `http://localhost:3001`, overridable with `API_URL`), the same proxy applying to `vite preview`; the server's `npm run server` SHALL restart on file changes. `npm run build` SHALL run the import check and type checks before bundling into `app/dist`; `npm test` SHALL run the server and script tests (including the whole HTTP surface, `server/src/main.test.ts`); `npm run check` SHALL run build, lint and tests.

#### Scenario: Dev mode
- **WHEN** `npm run server` and `npm run dev` run at the root
- **THEN** the app on :5173 reaches the API through Vite's `/api` proxy

#### Scenario: A worktree
- **WHEN** `npm run server` and `npm run dev` run in a git worktree
- **THEN** they use the worktree's own ports and data (see foundation/dev-workflow)

### Requirement: Scrambles in the built app
The build SHALL let cubing.js's scramble worker run: cubing.js's static code and Vite's preload helper get chunks of their own and module preload is off (`app/vite.config.ts`), so the worker never loads the app's entry chunk, which needs `document`.

#### Scenario: Scramble in production
- **WHEN** the built app opens the timer
- **THEN** a random-state scramble appears, as in development
