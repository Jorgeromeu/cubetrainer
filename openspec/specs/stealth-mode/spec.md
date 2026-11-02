# stealth-mode Specification

## Purpose
An app-wide work-disguise switch: someone glancing at the screen should not immediately tell it is a cubing app. When enabled the theme changes, cubes become greyscale, and obvious cubing things are hidden, e.g. by avoiding isometric cubes and preferring flat orthographic views.

## Requirements

### Requirement: App-wide switch
The system SHALL offer one stealth switch for the whole app: the button after the brand in the top bar, or the `` ` `` key (ignored while typing in a text field or with Alt/Ctrl/Meta held). It SHALL be stored per browser (`cubetrainer.stealth`, off by default) and applied before the first paint, so nothing flashes on reload.

#### Scenario: Hotkey
- **WHEN** the user presses `` ` `` with no text field focused
- **THEN** stealth flips in every tool at once

#### Scenario: Typing
- **WHEN** the user types `` ` `` into a note or alg field
- **THEN** the character is typed and stealth does not change

#### Scenario: Reload in stealth
- **WHEN** the page is reloaded with stealth on
- **THEN** the first paint is already in stealth

### Requirement: Every visual feature handles stealth
Every visual feature MUST define how it looks in stealth, following the rules in this spec. Stealth state SHALL be available as `data-stealth` on `<html>` for CSS and as a live hook for components.

#### Scenario: New feature
- **WHEN** a feature adds a visual (a chart, an icon, a cube, a coloured mark)
- **THEN** it ships its stealth look in the same change

### Requirement: Neutral brand
In stealth the brand SHALL read `Workbench` instead of `Cubetrainer`, in the top bar and the tab title, and the stealth toggle SHALL look like a plain theme switch. Other text (tool names, case names, counts) stays as it is.

#### Scenario: Title
- **WHEN** stealth is on in the PLL tool
- **THEN** the tab reads `Workbench · PLL`

### Requirement: Greyscale theme
In stealth the UI SHALL use a black/white greyscale theme, in light and dark mode: backgrounds, text, borders and everything that carries no state (selection, current item, buttons, tags, links at rest) are grey or ink, not the accent colour.

#### Scenario: Selected item
- **WHEN** an item is selected in stealth
- **THEN** it is marked in ink on grey, not in the accent colour

### Requirement: Semantic colours stay
Colours that carry meaning SHALL keep their colour in stealth: states (learnt, learning, wanted), errors, fast/slow scales, chart series, notation marks and similar. They MAY be toned down, but MUST stay distinguishable.

#### Scenario: Learnt mark
- **WHEN** an alg is learnt and stealth is on
- **THEN** its learnt mark is still green

### Requirement: No cube colours
In stealth no cube sticker colours SHALL be shown. A cube or cube icon that must be shown SHALL be in greys, with the sides that need telling apart in different greys.

#### Scenario: Cube in stealth
- **WHEN** a 3D cube or a PLL icon is shown in stealth
- **THEN** it is drawn in greys, with no white, yellow, red, orange, green or blue stickers

### Requirement: Cubes kept out of sight
Where it is sensible, cubes in stealth SHALL be shown flat (an orthographic view, straight on) and dimmed, and turn into their normal 3D view only on hover or interaction. A tool MAY keep cubes in 3D when flattening would defeat its purpose.

#### Scenario: Overview card
- **WHEN** stealth is on and an F2L overview card is not hovered
- **THEN** its cube is shown flat and dimmed, and hovering it shows the 3D cube

#### Scenario: Comparing angles
- **WHEN** stealth is on in PLL compare
- **THEN** cubes stay 3D, because comparing angles is the tool's purpose

### Requirement: Text instead of cubes
Where a name is enough, a tool MAY replace a cube or cube icon in stealth with plain text. The text SHALL still identify the case on its own.

#### Scenario: PLL cases
- **WHEN** stealth is on in the PLL case selector
- **THEN** cases may show as just their names ("Ra", "Ga") with no icon
