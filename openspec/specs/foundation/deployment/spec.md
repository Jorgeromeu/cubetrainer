# foundation/deployment Specification

## Purpose
Running the server somewhere other than this machine, so other clients (the web app on a phone, a future iOS app) can reach it: one container on any host with a persistent disk, behind the host's HTTPS, signed in with one token. Provider-agnostic: the host is picked when it's needed (`Dockerfile`, `server/src/auth.ts`).

## Requirements

### Requirement: One container
The repository SHALL build one container image (`Dockerfile`) that runs the server serving both its API and the built web app, with no npm packages at runtime. It SHALL keep its data in `DATA_DIR` (`/data`, a volume that must persist across deploys), listen on `PORT` (8080), and leave HTTPS to the host or a proxy in front of it. Migrations run when it starts, as anywhere (see foundation/user-data).

#### Scenario: Deploying a new version
- **WHEN** a new image is started with the same `/data` volume
- **THEN** pending migrations are applied and every stored solve, setting and progress record is still there

#### Scenario: First deploy
- **WHEN** the image starts with an empty `/data`
- **THEN** every tool's DB is created by its migrations and the app works, with no data yet

### Requirement: Signing in
When `AUTH_TOKEN` is set, every API request SHALL need that token, as `Authorization: Bearer <token>` (apps, scripts) or the cookie that `GET /login?token=<token>` sets (HttpOnly, a year, `Secure` behind HTTPS) before redirecting to the app; a wrong or missing token gets 401 `{ "error": "Not signed in: …" }`, compared in constant time. The app's files stay public (they hold no data). Without `AUTH_TOKEN` nothing changes, so local use needs no sign-in. A hosted server SHALL always set it, to a long random value.

#### Scenario: Opening the hosted app on a phone
- **WHEN** the user opens `https://<host>/login?token=<token>` once on the phone
- **THEN** the app opens signed in, and stays so in that browser

#### Scenario: No token
- **WHEN** a request to `/api/timer/solves` comes without the token
- **THEN** it gets 401, and no data

### Requirement: Health check
`GET /api/_/health` SHALL answer 200 `{ "ok": true }` without signing in, for the host's health checks; the image declares it as its `HEALTHCHECK`.

#### Scenario: Host probing
- **WHEN** the host requests `/api/_/health` without a token
- **THEN** it gets 200

### Requirement: Deployed is not a checkout
A server running without a git checkout (deployed) SHALL report no branch in `/api/_/info`, so the app shows no branch badge (see foundation/dev-workflow), and SHALL never copy data from elsewhere at start.

#### Scenario: Badge on the hosted app
- **WHEN** the hosted app is opened
- **THEN** there is no branch badge and the title is `Cubetrainer · <tool>`

### Requirement: Where the real data is
Until the hosted server becomes the place solves are logged, the main checkout's `data/` SHALL stay the user's real data (worktrees copy it, see foundation/dev-workflow). A first hosted deploy SHALL be seeded by copying the main checkout's tool DBs (`data/*.sqlite`, the server stopped or copied with `VACUUM INTO`) into its `/data`; after that, keeping the two in step is by hand.
<!-- REVIEW: once the phone logs solves on the hosted server, the hosted DB becomes the real one: data:pull/data:push should then copy from and push to it (an authenticated export/import endpoint) instead of the main checkout's data/. Decide when hosting is picked. -->

#### Scenario: Seeding the first deploy
- **WHEN** the main checkout's `timer.sqlite`, `f2l.sqlite` and `_settings.sqlite` are copied into an empty `/data` before the first start
- **THEN** the hosted app shows the same solves, progress and settings
