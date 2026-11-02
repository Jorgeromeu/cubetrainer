## MODIFIED Requirements

### Requirement: Tool contract
Each tool SHALL give the shell exactly: an `id`, a `name` (top bar and tool menu), a one-line `description` (tool menu), a `View` that receives the route path under `#/<id>/`, an optional `Crumb` (its part of the top bar, also given the path) and an optional `Settings` component. A tool SHALL use the shell only through this contract and SHALL NOT import from the shell or from other tools' app code; it MAY import other tools' `contract.ts` (see architecture, "Using what other tools expose").

#### Scenario: Tool without settings
- **WHEN** the current tool has no `Settings`
- **THEN** the top bar shows no settings gear

#### Scenario: Tool without crumb
- **WHEN** the current tool has no `Crumb`
- **THEN** the top bar shows only the brand, tool switch and stealth toggle (plus the gear, if any)

#### Scenario: Reading another tool's contract
- **WHEN** a tool imports another tool's `contract.ts`
- **THEN** the import boundary check accepts it, while an import of that tool's `app/` files fails the build
