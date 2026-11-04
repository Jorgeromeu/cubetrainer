# foundation/settings Specification

## Purpose
How the app remembers what the user picks. Three kinds, each kept in one place: settings (picked once, the same everywhere, in the settings menu), view state (how a page was left, per browser) and user data (a tool's records, in its DB). Settings have an owner: a tool for its own, a shared library for those every tool using it shares (app-wide); all of them are edited in one settings window (`packages/core/settings.ts`, `packages/ui/settings/`, `server/src/settings/`).

## Requirements

### Requirement: Three kinds of remembered things
The system SHALL keep settings with `setting()` (`packages/ui/settings/setting.ts`), view state with `viewState()` (`packages/ui/settings/viewState.ts`) and user data in the owning tool's DB (see foundation/user-data). A value the user expects on every device and checkout and picks in the settings window is a setting; how a page was left (filters, chart toggles, a picked range) is view state; records the user makes are user data. No tool SHALL use `localStorage` directly.

#### Scenario: A filter on the overview
- **WHEN** the user filters F2L's overview by status
- **THEN** the filter is view state: kept in that browser, not shown in the settings window

### Requirement: Settings owners
Every settings store SHALL have one owner, declared once: a tool's id for that tool's own settings (`setting('f2l', ...)`), private to it; or `<library>.<name>` for settings a shared library owns (`setting('ui.cube', ...)`), which every tool using that library shares. A setting two tools need SHALL belong to the library they share, not to either tool; a tool SHALL NOT read another tool's settings.

#### Scenario: Playback speed
- **WHEN** the user sets a cube player to Fast in one tool
- **THEN** every tool's players play at Fast, because `ui.cube` owns that setting

#### Scenario: F2L's cube display
- **WHEN** the user turns on hint stickers for all F2L pieces
- **THEN** that is an F2L setting (`f2l`): it changes F2L's cubes, not another tool's

#### Scenario: Two declarations
- **WHEN** two modules declare settings for the same owner
- **THEN** the app throws at load, naming the owner

### Requirement: Settings store
The server host SHALL keep settings in `data/_settings.sqlite` (not a tool's DB; copied into worktrees with the rest, see foundation/dev-workflow): one JSON object per owner, served whole at `GET /api/_/settings` (`{ settings: { <owner>: object } }`) and replaced whole by `PUT /api/_/settings/<owner>`. It SHALL refuse an owner that is neither a tool id nor `<library>.<name>`, a body that isn't a JSON object, and one over 64 KB as JSON. It SHALL NOT validate the contents: the owner's code does when it reads them.

#### Scenario: Saving
- **WHEN** the app puts `{ "focusMissing": true, ... }` for `f2l`
- **THEN** the next `GET /api/_/settings` returns it under `f2l`

### Requirement: Reading and changing settings
A settings store SHALL start from its last value in this browser's cache (so it applies at once and without a server), then take the server's value once it loads; a stored value is merged over the defaults and used only if it passes the owner's check (else the defaults or the current value stay). A change SHALL apply at once everywhere it's read, be cached, and be sent to the server shortly after (once a slider settles); a change made before the server's value arrived SHALL win over it; unsent changes SHALL be retried on window focus and when back online. When the server has nothing for an owner yet, what this browser had SHALL be sent as the first value.

#### Scenario: New browser
- **WHEN** a browser that never ran the app opens it while the server holds settings
- **THEN** the cubes, the player's speed and each tool's settings come up as stored

#### Scenario: No server
- **WHEN** a setting is changed with the server down
- **THEN** it applies and is kept in this browser, and reaches the server once it's back

### Requirement: View state
View state SHALL be kept per browser in `localStorage` under `cubetrainer.view.<key>` (key: `<tool id>.<what>`), merged over its defaults, validated, optionally migrated from an older shape or an older key, and shared live; unreadable, invalid or unavailable storage gives the defaults, and a failed write is silent.

#### Scenario: Private mode
- **WHEN** localStorage throws on write
- **THEN** the change still applies for the session and no error is shown

### Requirement: Settings window
The shell SHALL show every settings section in one window over the current page, like a desktop app's preferences, opened with Ctrl+, (⌘, on a Mac) or the gear at the right of the top bar (shown whenever any section exists), at the current tool's own section (or, without one, the first shared section it uses). It is not a route: the page behind it stays as it is. Its left pane lists "App-wide": each shared library section any tool lists, once, with which tools share it; and "Tools": each tool's own section under the tool's name, with which app-wide sections also apply to it. A tool's own section only renders its settings; the shell adds the headings. Changes apply live, without a save step. Escape, the × button, a pointer down outside the window or Ctrl+, again SHALL close it.

#### Scenario: From F2L
- **WHEN** the user presses Ctrl+, on an F2L page
- **THEN** the settings window opens over it at F2L's section, listing F2L under Tools (and any shared library section under App-wide), and Escape closes it, leaving the page as it was

#### Scenario: A tool without its own settings
- **WHEN** the gear is clicked in the timer, which only uses shared settings or none
- **THEN** the window opens at its first section

### Requirement: Shared settings sections
A shared library that owns settings the user picks in the window SHALL offer its settings UI as a `SharedSettings` (`{ title, View }`), which tools list in `sharedSettings`; it shows once under App-wide. A setting belongs here only if it means the same in every tool that uses the library; one shaped by a tool's subject (F2L's highlight pair and hint stickers) is that tool's. None exist yet: `ui.cube`'s one setting, the playback speed, is set from the player's own buttons (smart cube settings will be the first).

#### Scenario: No shared section
- **WHEN** no tool lists a shared section
- **THEN** the window has no App-wide group

### Requirement: Settings building blocks
Settings sections SHALL be built from shared pieces (`packages/ui/settings/blocks.tsx`) so every section looks the same: a section heading, a labelled row with an optional small hint line under the label and an optional disabled state, a segmented row of mutually exclusive buttons, an On/Off control, and link-style reset buttons.

#### Scenario: Disabled row
- **WHEN** a setting depends on another that is off (e.g. hint distance with hints off)
- **THEN** its row is shown disabled
