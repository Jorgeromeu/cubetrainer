# Design

## Context

Three registries of code today: `app/` (Vite + React + cubing.js), `server/` (`node:http` +
`node:sqlite`, `.ts` run directly by Node's type stripping, no npm dependencies) and `shared/`
(types, imported by relative path from both). Tools already follow a contract on each side
(`app/src/common/tool.ts`, `server/src/tool.ts`) and are listed in one registry each. The iOS
client is undecided (web tech or native), and the data will move to a hosted server
(`hosted-user-data`).

## Goals / Non-Goals

**Goals:**
- A new tool is one new folder plus one line in each host registry.
- Pure logic is reusable by any JavaScript client and by the server; UI is reusable by any web
  client (browser, PWA, a Capacitor wrap).
- A native client can work from the contracts alone: every API body is a plain JSON type in a
  `contract.ts`, with no logic hidden in the web app.
- A tool can expose read-only calls to others; using them is never required.

**Non-Goals:**
- No behaviour change. No new features, no API or schema change.
- No server-side cross-tool reads, no shared tables, no central solve log (yet).
- No publishing packages to a registry; they are workspace folders.

## Decisions

### Layout

```
packages/core/     no third-party runtime deps; imports nothing else in the repo
packages/ui/       React, cubing.js, three; imports core
tools/<id>/
  contract.ts      types + route list + `exposes`; imports core only
  app/             imports core, ui, ./contract, other tools' contract.ts
  server/          imports core, ./contract, the server host's tool interface
app/               web host: registry, main.tsx, index.html, vite config
server/            server host: registry, http, db, main
catalog/           generated, shared by tools (pll.json serves pll and pll-compare)
catalog-builder/   imports core
```

*Why per-tool folders and not packages per layer:* the unit of change is the tool. Deleting
a tool should be `rm -r tools/<id>` plus two registry lines.

*Why `core` has no third-party deps:* the server stays dependency-free, and `core` stays usable
by any runtime. cubing.js work (rendering, checking an alg on a cube) lives in `ui`; the server's
move-notation check already doesn't use cubing.js.

*Alternatives considered:* keeping `app/ server/ shared/` and only moving pure logic into
`shared/`. Less churn, but a tool stays spread over three trees and the "what is public"
question has no home.

### Imports

Our own code is imported by relative path with `.ts` extensions, as today. That sidesteps Node's
refusal to strip types under `node_modules`. Root npm workspaces exist only to install
third-party dependencies once, hoisted to the root `node_modules`. Vite's `server.fs.allow`
widens to the repo root; `tsconfig` includes `packages/` and `tools/`.

A small check script (`npm run check:imports`) parses imports and fails on any edge not in the
table above. It runs as part of `npm run build`.

### Styles live with their code

`app/src/index.css` today holds everything: theme tokens, shell, stealth, cube, drill card and
every tool's views. It splits along the same lines as the code: theme tokens, base elements and
the styles of shared components go to `packages/ui` (one CSS file next to each component, or
one `ui.css`), and each tool's styles go to `tools/<id>/app/<id>.css`, imported by its view.
Stealth rules move with what they restyle. Class names don't change. The app host imports only
ui's base stylesheet.

*Why:* without this, deleting a tool leaves its styles behind, and a tool's look can depend on
another tool's rules by accident.

### Room for more packages

Smart cube support (Bluetooth connection, move stream) is coming in a later change. Code like
that becomes its own `packages/<name>` with its own row in the import table, rather than being
squeezed into `core` (which must stay runtime-neutral) or `ui`.

### Tool contract module

`tools/<id>/contract.ts` replaces `shared/<id>/`. It holds the request and response types,
limits (e.g. max lengths), and an `exposes` section: typed functions built on core's API client
for the endpoints other tools may call. Anything not in `exposes` is private to the tool even
though it is reachable over HTTP. Nothing is exposed until a consumer needs it, so this change
only defines the mechanism: no tool reads another's data yet.

### What a tool exposes

Client-side only, over HTTP, through the provider's `exposes`. A consumer treats a failure (no
server, tool disabled, tool not installed) like "no data" and degrades. This gives every
client the same mechanism, including a future native one, and keeps server modules isolated.

## Risks / Trade-offs

- Big mechanical move: one commit per step (core, ui, each tool) keeps it reviewable, and
  `npm run build` plus a manual smoke test of each tool gates each step.
- `core`'s no-deps rule may pinch later (e.g. wanting cubing.js on the server). Then we add a
  third package rather than loosen the rule.
- Cross-reads over HTTP cost a round trip per read. That's fine for one user. A server-side read
  interface can be added later without changing contracts.
