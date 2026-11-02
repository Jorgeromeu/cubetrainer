## MODIFIED Requirements

### Requirement: Per-browser preferences
Device preferences SHALL be kept per browser in `localStorage`, under a `cubetrainer.`-prefixed key, as a JSON object merged over the defaults. A stored value SHALL be optionally migrated from an older shape, then validated; if storage is unavailable, unreadable or invalid the defaults SHALL be used. Synced preferences use the same interface but live in the tool's server `prefs` record, with a device cache (see user-data, "Synced preferences").

#### Scenario: Corrupt stored value
- **WHEN** `cubetrainer.pllSettings` holds invalid JSON or values that fail validation
- **THEN** the tool starts with the default PLL settings

#### Scenario: Synced preference offline
- **WHEN** a synced preference is read with no server
- **THEN** the device's cached copy is used, or the default if there is none

### Requirement: Known preference keys
The device keys SHALL be: `cubetrainer.stealth` (see stealth-mode), `cubetrainer.cubeSettings` and `cubetrainer.tempo` (see cube-rendering), `cubetrainer.f2lSettings` (see f2l-catalog), `cubetrainer.pllSettings` (see pll-trainer), `cubetrainer.statsProgress` and `cubetrainer.statsSolvesPer` (see stats), and `cubetrainer.server` (server location and token, see architecture). PLL case selection and F2L saved filters, link kinds and focus SHALL be synced preferences instead.

#### Scenario: Clearing site data
- **WHEN** the browser's site data is cleared
- **THEN** device preferences return to their defaults, synced preferences come back from the server, and no server data is affected
<!-- REVIEW: `cubetrainer.stealth` ('on'/'off' string) and `cubetrainer.tempo` (a number) are stored by hand rather than through the shared persisted helper. -->
