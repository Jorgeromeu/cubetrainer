# Proposal: one folder per tool, shared core and UI libraries

## Why

Adding a tool today touches three trees (`app/src/trainers/<id>`, `server/src/trainers/<id>`,
`shared/<id>`), and shared code is split by accident: types in `shared/`, pure logic (averages,
notation parsing, drill history) in `app/src/common/` where nothing but the web app can use it.
Duplication has started (`Penalty`/`Solve` in both `shared/pll` and `shared/stats`), and tools
have no sanctioned way to read each other's data. We are still building the foundation, and a
second client (see `hosted-user-data`) is planned, so this is the time to fix the shape.

## What Changes

- Each tool lives in one folder, `tools/<id>/`, with `contract.ts` (its public API types
  and what other tools may read), `app/` (its React view) and, if it stores data, `server/`
  (routes, repository, migrations).
- Shared code moves into two libraries with one-way dependencies:
  - `packages/core`: pure TypeScript with no third-party runtime dependencies: cube and slot model,
    notation parsing and move info, solve/penalty types and averages, drill history and picks,
    catalog types, the API client.
  - `packages/ui`: React, cubing.js and three: shell, 3D/flat cube, notation display, move hint,
    icons, settings building blocks, stealth.
- `app/` and `server/` become thin hosts: a tool registry plus the web build / the HTTP and
  database plumbing.
- **BREAKING (internal only)**: `shared/`, `app/src/common/`, `app/src/shell/`, `app/src/trainers/`
  and `server/src/trainers/` go away. No user-visible behaviour, URL, API path or database file
  changes.
- Tools may read another tool's data, optionally, only through that tool's published
  contract over the HTTP API.
- The import rules become checked by a script, not just by convention.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `architecture`: repository layout, tool modularity, shared libraries, the tool contract
  module, what a tool exposes and how others use it, enforced import boundaries.
- `tool-shell`: the tool contract allows importing other tools' contracts.

## Impact

- Every source file moves; imports are rewritten. No behaviour change, so every other spec
  stays as it is.
- Root `package.json` with npm workspaces for dependency installs; `app/` and `server/` keep
  their scripts.
- Docs: root, app and server READMEs; `docs/requirements.md` is retired in favour of
  `openspec/specs/`.
- Stealth impact: none (no visual change).
