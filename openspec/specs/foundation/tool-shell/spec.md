# foundation/tool-shell Specification

## Purpose
The shared frame every tool runs in (`packages/ui/shell`, `packages/ui/tool.ts`): the tool contract, top bar, tool menu, hash routing, and the small shared pieces tools reuse (drill history, picks, keys and navigation, solve-time maths, dismissable popovers).

## Requirements

### Requirement: Tool contract
Each tool SHALL give the shell exactly: an `id`, a `name` (top bar and tool menu), a one-line `description` (tool menu), a `View` that receives the route path under `#/<id>/`, an optional `Crumb` (its part of the top bar, also given the path), an optional `Settings` section (its own settings) and optional `sharedSettings` (the shared library sections that apply to it; see foundation/settings). A tool SHALL use the shell only through this contract and SHALL NOT import from the shell or from other tools' app code; it MAY import other tools' `contract.ts` (see foundation/architecture, "Reading exposed calls").

#### Scenario: Tool without settings
- **WHEN** the current tool has neither `Settings` nor `sharedSettings`
- **THEN** it has no section in the settings window, and the gear still opens it (for the app-wide sections)

#### Scenario: Tool without crumb
- **WHEN** the current tool has no `Crumb`
- **THEN** the top bar shows only the brand and tool switch (plus the gear, if any)

#### Scenario: Reading another tool's contract
- **WHEN** a tool imports another tool's `contract.ts`
- **THEN** the import boundary check accepts it, while an import of that tool's `app/` files fails the build

### Requirement: Tool registry and order
The host passes the shell its tools (`app/src/tools.ts`) in menu order; the first is the default tool. The order SHALL be: Timer (`timer`), F2L (`f2l`).

#### Scenario: Menu order
- **WHEN** the tool menu opens
- **THEN** it lists Timer, F2L in that order, each with its name and description

### Requirement: Hash routing
The app SHALL route on the URL hash as `#/<toolId>/<path...>`, with the path split on `/` and empty parts dropped, so it works as plain static files. A hash that is empty (`#/`) or whose first part is not a tool id SHALL go to the default tool's home. Links into a tool SHALL be built as `#/<id>/<path...>` with empty parts dropped.

#### Scenario: Known tool
- **WHEN** the hash is `#/f2l/f2l-c-11-12/f2l-11-FR`
- **THEN** F2L is shown with path `["f2l-c-11-12", "f2l-11-FR"]`

#### Scenario: Empty or unknown hash
- **WHEN** the hash is `#/` or `#/nothing-here`
- **THEN** the timer's home is shown (path `[]`)

#### Scenario: Hash changes
- **WHEN** the hash changes (link, back/forward)
- **THEN** the shell re-reads the route without a reload

### Requirement: Scroll on tool switch
The shell SHALL scroll the page to the top when the current tool changes, and SHALL NOT do so for path changes within the same tool.

#### Scenario: Switching tool
- **WHEN** the user goes from F2L to the timer
- **THEN** the page is scrolled to the top

### Requirement: Tab title
The document title SHALL be `Cubetrainer · <tool name>`. Before the app loads the title SHALL be `Cubetrainer`.

#### Scenario: Title follows tool
- **WHEN** the F2L tool is shown
- **THEN** the tab title is `Cubetrainer · F2L`

### Requirement: Sticky top bar
The shell SHALL show a top bar, sticky at the top of the page (52 px high, content max 1200 px wide), containing in order: the brand with the tool switch, the branch badge (see foundation/dev-workflow), the current tool's `Crumb` if any, and the settings gear (see foundation/settings), pushed to the right end. The tool's `View` SHALL render below it, and the app-wide move hint layer (see library/cube-notation) SHALL be mounted once for all tools.

#### Scenario: Scrolling a long page
- **WHEN** the user scrolls down a tool page
- **THEN** the top bar stays visible at the top

### Requirement: Brand link
The brand text SHALL link to the current tool's home (`#/<currentId>`).

#### Scenario: Clicking the brand
- **WHEN** the user clicks the brand while in a F2L cluster
- **THEN** the hash becomes `#/f2l` and the F2L overview shows

### Requirement: Tool switch menu
The current tool's name SHALL sit after the brand with a chevron; hovering or keyboard-focusing it SHALL open a menu of all tools (name in bold, description under it), with the current tool's name in the select colour. Choosing an entry SHALL navigate to that tool's home and close the menu.

#### Scenario: Switch via hover
- **WHEN** the user hovers the tool name and clicks "F2L"
- **THEN** the app goes to `#/f2l` and the menu closes

#### Scenario: Keyboard access
- **WHEN** the tool name button receives keyboard focus
- **THEN** the menu opens and its entries are reachable by Tab

### Requirement: Drill history
Drills SHALL keep the items dealt this session as a history of at most 200 entries (oldest dropped). ← SHALL step back (not before the first), → SHALL step forward, and → at the newest entry SHALL deal a new one. Dealing SHALL draw from the tool's own draw function given the newest entry and the history; if it draws nothing, the history and position SHALL stay. A tool MAY change the entry being shown. History is not persisted.

#### Scenario: Back then forward
- **WHEN** the user goes ← twice and → once
- **THEN** they see the second-newest entry, unchanged, and no new item is dealt

#### Scenario: History cap
- **WHEN** a 201st item is dealt
- **THEN** the oldest is dropped and ← can reach back 199 items

### Requirement: Drill picks
Shared random picks SHALL include: a pick that avoids the previous id whenever there is more than one to choose from (never the same twice in a row), and a pick in rounds, where each id comes up once in random order before any repeats, a new round never starts with the id just dealt, and changing the id set mid-round carries on (ids already dealt this round wait). The position within the current round (1 for a round's first) SHALL be available for display.

#### Scenario: Rounds
- **WHEN** 4 ids are drilled in rounds
- **THEN** the first 4 picks are all different, and the 5th differs from the 4th

#### Scenario: Single id
- **WHEN** only one id is selected
- **THEN** it is dealt every time

### Requirement: Drill keys
Drills SHALL share keys: Enter, → or `n` for the next item, ← or `p` for the previous one. These keys SHALL be ignored while typing in a text field (input, textarea, select, contenteditable), and SHALL be left to the control when focus is on a button or link.

#### Scenario: Typing in a field
- **WHEN** focus is in a text input and the user presses `n`
- **THEN** no new item is dealt

#### Scenario: Focused button
- **WHEN** a button has focus and the user presses Enter
- **THEN** the button is activated, not the drill's Next

### Requirement: Drill navigation row
Drills SHALL share a navigation row: a ← button (disabled with nothing before, titled "Previous <noun> (←)"), a "Next →" button (titled "Next <noun> (→)"), then the tool's own buttons. The whole row MAY be disabled (e.g. while a timer runs).

#### Scenario: First item
- **WHEN** the first dealt item is shown
- **THEN** the ← button is disabled and "Next →" is enabled

### Requirement: Solve penalties and averages
Shared solve-time maths SHALL apply penalties as: OK = the time, +2 = time + 2 s, DNF = worse than any time. An average of n (ao5, ao12, ao100) SHALL use the last n solves, drop the best and worst 5% each end (at least one each end: 1 for ao5/ao12, 5 for ao100) and take the mean of the rest; DNFs count as worst, so more DNFs than are dropped makes the average DNF. With fewer than n solves the average SHALL be undefined.

#### Scenario: One DNF in ao5
- **WHEN** the last 5 solves include exactly one DNF
- **THEN** ao5 is the mean of the middle three finished times

#### Scenario: Two DNFs in ao5
- **WHEN** the last 5 solves include two DNFs
- **THEN** ao5 is DNF

### Requirement: Time formatting
Times SHALL be written in seconds with hundredths, truncated not rounded (`1234 ms` → `1.23`), and as `m:ss.hh` from a minute on (`62340 ms` → `1:02.34`). A solve SHALL be written with its penalty: `+2` as the time with 2 s added and a trailing `+` (`3.23+`), DNF as `DNF`. An average SHALL show `DNF` when it is DNF and `–` when there are not enough solves.

#### Scenario: Plus two
- **WHEN** a 1.23 s solve has a +2 penalty
- **THEN** it is shown as `3.23+`

### Requirement: Dismissable popovers
Shared popovers and modes SHALL close on a pointer down outside them or on Escape (which is consumed), except for pointer downs on elements the popover names as ignored (such as the toggle that opened it).

#### Scenario: Clicking the toggle
- **WHEN** a popover is open and the user clicks its own toggle button
- **THEN** the toggle's own click decides, and the outside-click rule does not close it first
