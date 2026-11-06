# foundation/deployment Specification

## Purpose
The server is meant to be hosted some day (so a phone, or a future iOS app, can reach it), but isn't yet. Until then, these requirements keep it deployable: nothing in it may depend on running from this machine's checkout. The host, packaging and sign-in are picked when hosting is needed.

## Requirements

### Requirement: One self-contained process
The server SHALL run as one Node process with no npm packages at runtime, serving the tools' APIs and, when built (`app/dist`), the web app from the same origin. It SHALL be configured only by environment variables (`PORT`, `DATA_DIR`) and SHALL keep all its state in `DATA_DIR`: one SQLite file per tool plus `_settings.sqlite`. Migrations run when it starts (see foundation/user-data), so a new version started on the same `DATA_DIR` keeps every record, and an empty one gets fresh DBs.

#### Scenario: A new version on old data
- **WHEN** a newer server starts with an existing `DATA_DIR`
- **THEN** pending migrations are applied and every stored solve, setting and progress record is still there

#### Scenario: Empty data
- **WHEN** the server starts with an empty `DATA_DIR`
- **THEN** every tool's DB is created by its migrations and the app works, with no data yet

### Requirement: Dev workflow is optional
The dev workflow (worktree data copies, picked ports, the branch badge; see foundation/dev-workflow) SHALL only switch on inside a git checkout. Without one, the server SHALL use `PORT` and `DATA_DIR` as given, copy no data, and report no branch in `/api/_/info`, so the app shows no badge.

#### Scenario: Running outside a checkout
- **WHEN** the server runs from a copy of the repository with no `.git`
- **THEN** it starts on `PORT` with `DATA_DIR`, and the app shows no branch badge

### Requirement: Before going public
A server reachable from the internet SHALL sit behind HTTPS and require sign-in for every API request (one secret is enough: there's one user). Neither is built yet; both come with hosting. Clients other than the web app use the same APIs (see foundation/architecture, "Clients").
<!-- REVIEW: once a hosted server logs solves, its DB becomes the real one, and data:pull/data:push should copy from and push to it instead of the main checkout's data/. Decide when hosting is picked. -->

#### Scenario: Hosting it
- **WHEN** the server is first put on a public host
- **THEN** HTTPS and sign-in are added in that change, and nothing else in the server needs to change
