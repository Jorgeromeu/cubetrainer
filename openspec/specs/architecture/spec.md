# architecture Specification

## Purpose
How Cubetrainer is split into an app, a user-data server, shared types and a generated catalog, and the contract every tool follows so tools stay independent of each other.

## Requirements

### Requirement: Single-user local app
The system SHALL be a personal web app for one user, run locally, with no accounts, login or multi-user support.

#### Scenario: No sign-in
- **WHEN** the user opens the app
- **THEN** every tool is usable straight away, without any account or authentication

### Requirement: Repository parts
The repository SHALL consist of `app/` (the web app), `server/` (the user-data API), `shared/` (types shared by app, server and catalog builder), `catalog/` (generated alg catalogs, committed) and `catalog-builder/` (the one-off tool that produces `catalog/`). The app SHALL NOT depend on catalog-builder at build or run time; it only reads the committed `catalog/*.json`.

#### Scenario: Building the app without the builder
- **WHEN** the app is built with `catalog-builder/` never run on this machine
- **THEN** the build succeeds using the committed `catalog/f2l.json` and `catalog/pll.json`

### Requirement: Catalog bundled into the app
The app SHALL bundle the catalog JSON files (`catalog/f2l.json`, `catalog/pll.json`) at build time, so catalog data (cases, setups, algs) never comes from the server.

#### Scenario: Catalog without a server
- **WHEN** the app runs with no server reachable
- **THEN** all F2L cases, PLL cases, setups and algs are still shown

### Requirement: App works without the server
The app SHALL work as a plain explorer and trainer when the server is unreachable: features that need stored user data are hidden or disabled, a short notice says there is no server, and the app keeps retrying in the background and on window focus, so that starting the server later restores user data without a page reload.

#### Scenario: F2L without server
- **WHEN** the F2L tool loads and the API is unreachable
- **THEN** cases and algs are browsable, progress UI is hidden, and a "No server · progress not loaded" notice shows in the bottom-right corner

#### Scenario: Server started later
- **WHEN** the server becomes reachable after the app has loaded
- **THEN** a retry (timer or window focus) loads the user data and the progress UI appears without a reload

#### Scenario: Other tools without server
- **WHEN** the PLL tool runs with no server
- **THEN** scrambles and timing still work and a "No server · times not saved yet" notice shows
- **AND** PLL compare's board works without named sets ("No server: sets can't be loaded or saved")

### Requirement: Telling refusal apart from no server
The app's API client SHALL distinguish "the server refused the request" (an HTTP error carrying a JSON `{ error }` string) from "there is no server" (network failure, a 5 s timeout, a proxy error, an error without a JSON error message, or a success response that is not JSON, such as a static host returning `index.html`). Only the first is shown as a save error; the second puts the tool into its offline state.

#### Scenario: Server refuses a save
- **WHEN** a save gets a 400 with `{ "error": "Unknown PLL case pll-X" }`
- **THEN** the app treats it as a refusal and shows that message, staying online

#### Scenario: Request times out
- **WHEN** a request gets no answer within 5 seconds
- **THEN** the app treats the server as not reachable

### Requirement: Tool modularity
Each tool SHALL be self-contained: an app folder `app/src/trainers/<id>/` and, only if it stores data, a server folder `server/src/trainers/<id>/`, each listed by one line in its registry (`app/src/shell/trainers.ts`, `server/src/trainers.ts`). Tools SHALL NOT import from each other or from the app shell; shared code lives in `app/src/common/` (which imports only from `shared/`) and `shared/` (which imports nothing from the other parts).

#### Scenario: Adding a tool
- **WHEN** a new tool is added
- **THEN** it needs only its own folder(s), one registry line in the app (and one in the server if it stores data), and its own types under `shared/<id>/`
- **AND** no existing tool's code changes

#### Scenario: Tool without stored data
- **WHEN** a tool stores nothing on the server
- **THEN** it has no server folder and no server registry entry

### Requirement: App tool contract
Every app tool SHALL export a `Tool` with: `id`, `name` (shown in the top bar and tool menu), a one-line `description` (shown in the tool menu), a `View` component receiving the route path under its prefix, an optional `Crumb` (its part of the top bar) and an optional `Settings` component (the whole settings menu while open; no gear is shown without one). The app registry order SHALL be the menu order: F2L, PLL, PLL Compare, Stats.

#### Scenario: Tool without settings
- **WHEN** the current tool has no `Settings`
- **THEN** the top bar shows no settings gear

### Requirement: Same id in app and server
A tool's id SHALL be the same in app and server, consist only of lowercase letters, digits and dashes, and be used as its hash-route prefix (`#/<id>/`), its API prefix (`/api/<id>/`) and its database file name (`data/<id>.sqlite`). Current ids: `f2l`, `pll`, `pll-compare`, `stats`.

#### Scenario: Invalid or duplicate server id
- **WHEN** a server tool's id has other characters, or two server tools share an id
- **THEN** the server refuses to start with an error naming the id

### Requirement: Hash routing
The app SHALL route with the URL hash as `#/<toolId>/<path...>` so it works as plain static files. The path parts after the tool id are the tool's own. `#/`, an empty hash, or a hash whose first part is not a tool id SHALL go to the default tool (F2L) with the whole hash as its path, so older pre-prefix links keep working. Switching tool scrolls to the top.

#### Scenario: Old F2L link
- **WHEN** the user opens `#/f2l-c-1-2/f2l-1-FR`
- **THEN** the F2L tool opens with path `f2l-c-1-2/f2l-1-FR`

#### Scenario: Tool route
- **WHEN** the user opens `#/pll-compare/Ga.1.3`
- **THEN** the PLL compare tool opens with path `Ga.1.3`

### Requirement: Page title
The browser tab title SHALL be `<brand> · <tool name>`, using the neutral stealth brand while stealth mode is on (see stealth-mode).

#### Scenario: Switching tool
- **WHEN** the user switches from F2L to PLL
- **THEN** the title becomes `Cubetrainer · PLL` (or the stealth brand followed by ` · PLL` in stealth)

### Requirement: Shared types
Request/response bodies and catalog contracts SHALL be defined once in `shared/` and used by app, server and catalog builder: `shared/cube.ts` (slots, slot mirrors, named triggers), `shared/f2l/` (catalog, progress), `shared/pll/` (catalog, solves), `shared/pll-compare/` (sets), `shared/stats/` (solves, milestones).

#### Scenario: Changing an API body
- **WHEN** a tool's request body type changes
- **THEN** the change is made in `shared/<id>/` and both app and server compile against it

### Requirement: Server process
The server SHALL be a single Node process with no npm dependencies (`node:http` and `node:sqlite`, `.ts` files run directly, Node 23.6 or later), listening on `PORT` (default 3001) and answering `/api/<id>/...` with that tool's routes.

#### Scenario: Start
- **WHEN** `npm start` runs in `server/`
- **THEN** the log lists each tool with its route count and the data directory

### Requirement: Server serves the built app
When `app/dist` exists, the server SHALL serve the built app's files for every non-API path (`/` is `index.html`); a path that escapes `app/dist` is served `index.html`, and a missing file is a 404. Without `app/dist` every non-API path SHALL answer 404 "No built app (run npm run build in app/), API only".

#### Scenario: Production run
- **WHEN** the app was built and `npm start` runs in `server/`
- **THEN** `http://localhost:3001` serves the app and its API from one process

#### Scenario: No build
- **WHEN** `app/dist` does not exist
- **THEN** only the API is served

### Requirement: Development setup
In development the app SHALL run under Vite on port 5173 and proxy `/api` to the server (default `http://localhost:3001`, overridable with `API_URL`), the same proxy applying to `vite preview`; the server's `npm run dev` SHALL restart on file changes. The app build SHALL type-check (`tsc -b`) before bundling (`vite build`) into `app/dist`.

#### Scenario: Dev mode
- **WHEN** `npm run dev` runs in both `server/` and `app/`
- **THEN** the app on :5173 reaches the API through Vite's `/api` proxy

#### Scenario: Server on another port
- **WHEN** `API_URL=http://localhost:4000` is set for Vite
- **THEN** `/api` requests are proxied to port 4000
