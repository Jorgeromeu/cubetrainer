# library/design Specification

## Purpose
How the app looks: dense, flat panes split by hairlines, like a tool rather than a web page. No cards, no rounded boxes, no wasted space. Every value is a token in `packages/ui/tokens.css`; the layout primitives are `packages/ui/panes.tsx`. Tools follow it in their own CSS, using the tokens, never new values.

## Requirements

### Requirement: Tokens are the only values
Colours, type sizes, spacing, radius and pane dimensions SHALL come from the tokens in `packages/ui/tokens.css` (light and dark), and tool CSS SHALL use them rather than new values. A value worth reusing SHALL become a token there first.

#### Scenario: A tool needs a muted label
- **WHEN** a tool shows a secondary line of text
- **THEN** it uses `--muted` and `--text-small`, not its own grey or size

### Requirement: Panes, not cards
Layout SHALL be panes side by side (`Workspace`, `Pane` in `panes.tsx`), filling the page under the top bar edge to edge and split by 1px hairlines (`--hairline`). A pane SHALL have a thin header bar (`--pane-head-height`, tinted `--pane-head-bg`, `--text-small` with a 600-weight title, an optional quieter note and small `PaneButton` actions) over a scrolling body. Sections inside a pane SHALL be separated by hairlines and headings, never by cards, shadows or rounded boxes. On a workspace page the top bar's content spans the full width too.

#### Scenario: The settings window
- **WHEN** the settings window is open
- **THEN** it shows a 200 px sections pane and the section's pane beside it, each with a thin header bar, split by one hairline, no boxes inside

### Requirement: Floating surfaces
Only menus (the tool menu) and windows over the page (the settings window, `.window` on `.window-backdrop`) SHALL float: a hairline border, `--radius`, `--shadow-float`, and for a window a `--backdrop` dimming the page. Nothing else gets a shadow. A menu's entries are rows split by hairlines.

#### Scenario: The tool menu
- **WHEN** the user hovers the tool name in the top bar
- **THEN** a menu of tools opens with hairlines between them, 4px corners and the float shadow

### Requirement: Radius only on small controls
Only small controls (buttons, chips, inputs, segmented rows) SHALL have rounded corners, of `--radius` (4px). Panes, rows, lists and sections SHALL be square.

#### Scenario: A segmented control
- **WHEN** a setting offers a choice of a few values
- **THEN** it is a `--control-height` segmented row with a hairline border and `--radius`, the picked value in `--accent` on `--accent-soft`

### Requirement: Dense type
Text SHALL be `--text-body` (13px) for content and rows, `--text-small` (12px) for hints, counts, notes and controls, and `--text-label` (11px, uppercase, weight 600, `--label-spacing`, `--muted`) for group headings. Lists SHALL use dense rows (`PaneGroup`, `PaneRow`): a hover tint, and the current row in `--accent` on `--accent-soft`.

#### Scenario: A list of sections
- **WHEN** a pane lists items in groups
- **THEN** each group has an uppercase 11px heading and its items are dense 13px rows, the current one highlighted

### Requirement: Meaningful colour only
Colour SHALL carry meaning (status: `--learnt`, `--learning`, `--wanted`; notation: `--rotation`, `--trigger`; selection and links: `--accent`; errors: `--danger`); everything else is ink (`--text`), `--muted` and the surface greys.

#### Scenario: A status mark
- **WHEN** a case is learnt
- **THEN** its mark uses `--learnt`, the same green everywhere
