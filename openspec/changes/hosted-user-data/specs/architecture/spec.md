## MODIFIED Requirements

### Requirement: Single-user local app
The system SHALL serve exactly one user, with no accounts, login or multi-user support. It SHALL run either locally or self-hosted on a machine reachable from the user's other devices, protected by one access token (see "Access token").

#### Scenario: No sign-in
- **WHEN** the user opens the app against a local server with no token configured
- **THEN** every tool is usable straight away, without any account or authentication

#### Scenario: Hosted
- **WHEN** the server runs on a home machine or VPS with a token configured
- **THEN** the user's laptop and phone both use it, each having been given the token once

### Requirement: App works without the server
The app SHALL work as a plain explorer/tool when the server is unreachable. Data it has already loaded stays visible, and changes are kept in the outbox (see user-data, "Offline outbox") instead of being lost. A short notice says there is no server and how many changes are waiting. The app keeps retrying in the background and on window focus, so starting the server later sends the waiting changes and loads user data without a page reload.

#### Scenario: F2L without server
- **WHEN** the F2L tool loads and the API is unreachable and nothing was ever loaded on this device
- **THEN** cases and algs are browsable, progress UI is hidden, and a "No server · progress not loaded" notice shows in the bottom-right corner

#### Scenario: Server started later
- **WHEN** the server becomes reachable after the app has loaded
- **THEN** a retry (timer or window focus) sends any waiting changes, loads the user data, and the progress UI appears without a reload

#### Scenario: Timing offline
- **WHEN** the PLL tool times three solves with no server
- **THEN** the solves show in the session as usual, the notice says "No server · 3 changes not sent yet", and they are saved once the server is back

#### Scenario: Other tools without server
- **WHEN** PLL compare runs with no server and has never loaded its sets on this device
- **THEN** the board works without named sets ("No server: sets can't be loaded or saved")

### Requirement: Server process
The server SHALL be a single Node process with no npm dependencies (`node:http` and `node:sqlite`, `.ts` files run directly, Node 23.6 or later), listening on `HOST` (default `127.0.0.1`) and `PORT` (default 3001) and answering `/api/<id>/...` with that tool's routes. It SHALL refuse to start on a non-loopback `HOST` unless an access token is configured.

#### Scenario: Start
- **WHEN** `npm start` runs in `server/`
- **THEN** the log lists each tool with its route count, the data directory, the bind address and whether a token is required

#### Scenario: Exposed without a token
- **WHEN** the server is started with `HOST=0.0.0.0` and no `API_TOKEN`
- **THEN** it exits with an error saying a token is required to listen beyond loopback

## ADDED Requirements

### Requirement: Access token
When `API_TOKEN` is set, every `/api/*` request SHALL carry `Authorization: Bearer <token>`. A missing or wrong token SHALL be answered with 401 `{ "error": "Unauthorized" }` and logged without the token. The built app's static files are served without a token.

#### Scenario: Wrong token
- **WHEN** a request to `/api/pll/solves` carries a wrong token
- **THEN** the server answers 401 and the app shows "Server refused the token" in its server settings, not the offline notice

#### Scenario: No token configured
- **WHEN** `API_TOKEN` is unset and the server runs on loopback
- **THEN** requests need no `Authorization` header

### Requirement: Configurable API location
Every client SHALL let the user set the server location and token per device. The web app SHALL default to its own origin with no token. Both are device preferences (see tool-shell) and are never sent anywhere but that server.

#### Scenario: Phone pointing at home server
- **WHEN** the user sets the server to `https://cube.tailnet.example` and enters the token on their phone
- **THEN** every tool on the phone reads and writes that server's data

### Requirement: Client-neutral API
The HTTP API SHALL be the only way any client reaches user data. Bodies SHALL be plain JSON defined in each tool's contract. No endpoint is specific to the web app, and no behaviour a client depends on lives only in web app code.

#### Scenario: Native client
- **WHEN** a native client is written against the tools' contracts and the user-data spec
- **THEN** it can read, write, sync, export and import everything the web app can

### Requirement: Additive API changes
Changes to an existing endpoint SHALL only add things: new optional request fields, new response fields, new endpoints. Clients SHALL ignore response fields they don't know. Removing or changing the meaning of a field SHALL use a new route path, keeping the old one until no client uses it.

#### Scenario: New response field
- **WHEN** the PLL solves response gains a `comment` field
- **THEN** an older client keeps working and ignores it

### Requirement: Server info
The server SHALL answer `GET /api/info` with its API version, each tool's id and state (`up` or `disabled`), and the version of each catalog file it validates against. Clients SHALL use it to tell a disabled tool from no server, and a stale bundled catalog from a current one.

#### Scenario: Stale catalog on a client
- **WHEN** the phone's bundled `f2l` catalog version differs from the one in `/api/info`
- **THEN** the client says its catalog is out of date and keeps working
