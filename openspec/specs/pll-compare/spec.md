# pll-compare Specification

## Purpose
PLL compare (`#/pll-compare`) shows PLL cases side by side as 3D cubes, each turned on its own, so the user can find recognition tricks, mark the stickers that tell cases apart, copy the board as an image and keep named sets on the server.

## Requirements

### Requirement: Tool registration
The system SHALL register the PLL compare tool with id `pll-compare`, name "PLL Compare" and description "PLL cases side by side under one camera, to spot recognition tricks", reachable at `#/pll-compare`, with the crumb "Compare cases" and no settings section (see tool-shell). Its server module SHALL serve its API under `/api/pll-compare` (see architecture).

#### Scenario: Opening the tool
- **WHEN** the user picks "PLL Compare" in the tool switch menu
- **THEN** the URL becomes `#/pll-compare` and an empty board shows "Pick a case to start"

### Requirement: Cube model
Each cube on the board SHALL be a PLL case (a `catalog/pll.json` id) with two dials in quarter turns, `variant` and `turn` (0 to 3), and optional blocks. Its state SHALL be the case's catalog `setup` (face turns giving exactly the case as its icon draws it) preceded by `U^variant` and followed by `U^turn`, shown with the cross on D (see cube-rendering). Its label SHALL read like "U · Ga · U2", leaving out zero turns.

#### Scenario: Cube as drawn
- **WHEN** a Ga cube has variant 0 and turn 0
- **THEN** it shows Ga exactly as its PLL icon draws it

### Requirement: Adding and removing cubes
The sidebar SHALL list all 21 cases as icon buttons ("Add a cube"); clicking one SHALL add a cube with that case, variant 0 and turn 0, at the end of the board. The board SHALL hold at most 24 cubes: when full the heading reads "Full (24 cubes)" and the buttons are disabled. Each cube SHALL have a × to remove it, and "Clear the board" SHALL remove all cubes.

#### Scenario: Board full
- **WHEN** the board has 24 cubes
- **THEN** the case buttons are disabled and no cube can be added

### Requirement: Changing a cube's case
Each card SHALL show its case name as a drop-down of all cases grouped by PLL group; choosing another case SHALL keep the cube's variant and turn and clear its blocks.

#### Scenario: Case change clears blocks
- **WHEN** a cube with painted stickers is switched from Ra to Rb
- **THEN** it shows Rb with the same variant and turn and no blocks

### Requirement: Turn dial
The system SHALL let the user turn a cube's top layer with U', U2 and U buttons, or u (U) and Shift+u (U') with the pointer over the cube. A turn change SHALL animate the top layer turning (about three times cubing.js's default speed); any other change SHALL jump.

#### Scenario: Turn with the keyboard
- **WHEN** the pointer is over a cube with turn 0 and the user presses u
- **THEN** the top layer animates a U and the cube's turn becomes 1

### Requirement: Variant dial
The system SHALL let the user step a cube's variant with ‹ and › (shown as v1 to v4), or ↑ and ↓ with the pointer over the cube, wrapping round. A variant SHALL show the same pattern with its colours shifted against the centres and F2L.

#### Scenario: Variant wraps
- **WHEN** a cube is at v4 and the user presses ›
- **THEN** it goes to v1

### Requirement: Step through all states
With the pointer over a cube, Shift+↑ and Shift+↓ SHALL step through all 16 (variant, turn) states, the turn changing first and then the variant, wrapping round. A ↺ button SHALL reset variant and turn to 0 and SHALL be disabled when both already are.

#### Scenario: Turn first
- **WHEN** a cube is at variant 0, turn 3 and the user presses Shift+↑
- **THEN** it goes to variant 1, turn 0

### Requirement: Per-cube view with snapping
Each cube SHALL be turned on its own by dragging it. When the drag ends and the cube's glide has stopped (no camera movement for 80 ms), it SHALL glide (about 180 ms, easing out) to the nearest two-sided view: 30° above (or below, if it was below), 40° round from the nearest side towards where it was, never the top. With the pointer over a cube, ← and → SHALL turn its view a quarter turn (→ as a y rotation), keeping the two-sided lean.

#### Scenario: Snap after drag
- **WHEN** the user drags a cube to look from 10° above, 70° round from the front, and lets go
- **THEN** it glides to 30° above, 50° round (the right side's view leaning to the front)

#### Scenario: Never from the top
- **WHEN** the user drags a cube to look straight down and lets go
- **THEN** it snaps to a view 30° above the sides

### Requirement: View presets
The sidebar SHALL offer view presets that set every cube's view at once: "F + R" (30° above, 40° round to the right; the starting view) and "F + L" (30° above, 40° to the left). Views SHALL not be saved.

#### Scenario: Preset resets every cube
- **WHEN** cubes are turned to different views and the user clicks "F + L"
- **THEN** every cube looks at its front and left sides

### Requirement: Shared zoom
Zoom SHALL be shared by all cubes: + and − buttons (factor 1.15), "Zoom" resets it to the default distance, and scrolling over a cube zooms smoothly. The camera distance SHALL stay between 4 and 10. Zoom SHALL not be saved.
<!-- REVIEW: docs/requirements.md says the + / − keys zoom too; only the buttons and the scroll wheel do in code. -->

#### Scenario: Scroll zooms all
- **WHEN** the user scrolls over one cube
- **THEN** every cube zooms by the same amount

### Requirement: Board fits the window
The board SHALL show every cube at once, as big as the space allows, without scrolling. With columns on "Fit" (default) it SHALL use the column count giving the biggest cubes; the user MAY choose 1 to 6 columns instead (never more than the cubes). The column choice SHALL not be saved.

#### Scenario: Fit picks columns
- **WHEN** four cubes are on a wide, short board with columns on Fit
- **THEN** they are laid out in the column count that makes them biggest, without scrolling

### Requirement: Card sizing
The board SHALL leave room under each cube for its name and as many caption lines as the most captioned cube has, so rows line up. Cubes SHALL be at least 80 px. On a narrow screen (640 px or less) the board SHALL default to one cube a row and scroll.

#### Scenario: Phone
- **WHEN** the window is 400 px wide with columns on Fit
- **THEN** the cubes are one a row and the page scrolls

### Requirement: Card controls on hover
A card SHALL be just the cube, its case name and its captions; the variant, turn, ↺ and × controls SHALL lie over the top of the cube only while the pointer is over the card. The hovered card SHALL be the one keyboard shortcuts act on.

#### Scenario: Controls hidden
- **WHEN** the pointer is not over a card
- **THEN** its controls are not visible

### Requirement: Collapsible sidebar
The sidebar (cases, marks, view, columns, sets) SHALL be hidden with « and brought back with ». It SHALL be open each time the tool opens.

#### Scenario: Hide the sidebar
- **WHEN** the user clicks «
- **THEN** only the board and a » button remain

### Requirement: Blocks of painted stickers
A block SHALL be a set of stickers of one cube (not necessarily touching) in one of 4 colours with a caption of up to 60 characters. A cube SHALL have at most one block per colour and a sticker SHALL be in at most one block; blocks with no stickers SHALL be dropped, blocks SHALL be kept sorted by colour and stickers by name.

#### Scenario: Last sticker unpainted
- **WHEN** the only sticker of a block is unpainted
- **THEN** the block and its caption disappear

### Requirement: Sticker names
Stickers SHALL be named by orbit letter and index in cubing.js's 3x3x3 numbering (`e0`–`e23` edges, `c0`–`c23` corners, `m0`–`m5` centres), so a block stays on its stickers when the cube is turned.

#### Scenario: Block follows the turn
- **WHEN** a sticker on the top layer is painted and the cube's turn changes
- **THEN** the frame moves with that sticker

### Requirement: Painting stickers
The system SHALL let the user pick the paint colour in the sidebar or with keys 1 to 4 (default the first), and Shift+click a sticker to paint it that colour. Shift+clicking a sticker already in that colour SHALL unpaint it; painting a sticker of another colour SHALL move it.

#### Scenario: Repaint moves the sticker
- **WHEN** a sticker in colour 1 is Shift+clicked with colour 2 selected
- **THEN** it leaves block 1 and joins block 2

### Requirement: Sticker frames
A painted sticker SHALL show as a frame of the block's colour on the black plastic around it, with black left between frame and sticker. The four frame colours SHALL stand out from all six sticker colours and from each other, and SHALL be kept in stealth.

#### Scenario: Frame drawn
- **WHEN** a sticker is painted in colour 1
- **THEN** a magenta frame surrounds it on the plastic without covering the sticker

### Requirement: Captions
Each block SHALL have a caption field under the case name, in the block's colour, and a × that unpaints the whole block.

#### Scenario: Remove a block
- **WHEN** the user clicks × beside a caption
- **THEN** all stickers of that block are unpainted and the caption is removed

### Requirement: Copy as image
"Copy as image" SHALL put a PNG on the clipboard with only the cubes as drawn on screen (each cropped to its visible pixels, grey if stealth is on), each with its case name and non-empty captions under it, on white, in the board's current columns, with cube bottoms aligned per row. Captions SHALL use darker shades of the block colours readable on white (4.5:1).

#### Scenario: Copy
- **WHEN** the board has three cubes in two columns and the user clicks "Copy as image"
- **THEN** the clipboard holds a PNG of the three cubes with names and captions in two columns on white

### Requirement: Copy feedback
The copy button SHALL show "Copied" for 1.5 s on success or "Couldn't copy: <reason>" on failure, and SHALL be disabled when the board is empty or a copy is in progress.

#### Scenario: Empty board
- **WHEN** the board has no cubes
- **THEN** "Copy as image" is disabled

### Requirement: Board in the URL
The board SHALL be kept in the URL as `#/pll-compare/<cubes>`, updated as the board changes without adding history entries; navigating to another board link SHALL replace the board.

#### Scenario: Bookmark
- **WHEN** the user opens `#/pll-compare/Ga.1.3,Gb`
- **THEN** the board shows a Ga at variant 1, turn 3 and a Gb at 0, 0

### Requirement: Board path format
The board path SHALL list cubes separated by `,`, each the case name, then `.variant.turn` when either is non-zero or blocks exist, then `.` and the blocks separated by `_`. A block SHALL be its colour digit, its stickers joined by `-` and, if captioned, `~` and the caption with everything but letters and digits percent-encoded. Example: `Ga.1.3,Gb,T.0.2.0e7-c14~headlights`.

#### Scenario: Block in the path
- **WHEN** a T at variant 0, turn 2 has stickers e7 and c14 in colour 0 captioned "headlights"
- **THEN** its part of the path is `T.0.2.0e7-c14~headlights`

### Requirement: Lenient board parsing
Parsing a board path SHALL drop unknown case names, invalid stickers and colours, take variant and turn modulo 4, read a blocks field without a colour digit as colour 0 (links from before colours), and keep at most 24 cubes.

#### Scenario: Unknown case
- **WHEN** the path is `Ga,Xx,Gb`
- **THEN** the board shows Ga and Gb only

### Requirement: Named sets
The sidebar SHALL list the named sets kept by the server, sorted by name ignoring case. Clicking a set SHALL load its cubes (blocks included) onto the board and put its name in the name field. The set equal to the board (same cubes, order, dials and blocks) SHALL be highlighted. × SHALL delete a set after a confirmation.

#### Scenario: Load a set
- **WHEN** the user clicks the set "Y V E"
- **THEN** the board shows its cubes and the set is highlighted

### Requirement: Saving a set
Typing a name and saving SHALL store the board under it. If a set has that name (ignoring case) the button SHALL read "Update" and replace that set. Saving SHALL be disabled when the board already equals that set, the board is empty or the name is blank.

#### Scenario: Update an existing set
- **WHEN** the user types "ra rb t" while a set "Ra Rb T" exists and the board differs from it
- **THEN** the button reads "Update" and saving replaces that set's cubes

### Requirement: Sets without the server
Without a reachable server the board SHALL still work fully; the sets section SHALL say "No server: sets can't be loaded or saved", the name field and save button SHALL be disabled, and loading SHALL be retried every 30 s, on window focus and when the browser goes online. Save or delete failures SHALL show "Couldn't save: <reason>" / "Couldn't delete: <reason>".

#### Scenario: Server down
- **WHEN** the server is not running
- **THEN** cubes can be added and turned and the sets section shows the no-server note

### Requirement: Sets API
The server SHALL expose `GET /api/pll-compare/sets` returning `{ sets }` sorted by name ignoring case; `PUT /api/pll-compare/sets/:id` with `{ name, cubes }` creating or replacing the set (name trimmed, `createdAt` kept on replace, `updatedAt` set) and returning it; `DELETE /api/pll-compare/sets/:id` returning null.

#### Scenario: Replace keeps creation time
- **WHEN** an existing set is saved again
- **THEN** its createdAt is unchanged and its updatedAt is the time of the save

### Requirement: Set validation
The server SHALL reject as an invalid request (400): an id that is not a uuid; unknown fields at any level; a name that is empty or over 80 characters after trimming; a name already used by another set, ignoring case; cubes that are not a list of 1 to 24; a cube whose case is not in `catalog/pll.json` or whose variant or turn is not a whole number 0 to 3.

#### Scenario: Duplicate name
- **WHEN** a new set is saved as "y v e" while "Y V E" exists with another id
- **THEN** the server rejects it saying there is already a set with that name

### Requirement: Block validation
The server SHALL reject more than 4 blocks on a cube, a block colour outside 0–3 or repeated, a caption over 60 characters, a block with no stickers, an invalid sticker name, or a sticker in two blocks. It SHALL store captions trimmed, blocks sorted by colour and stickers sorted.

#### Scenario: Sticker in two blocks
- **WHEN** a cube's blocks 0 and 1 both contain e7
- **THEN** the server rejects the set

### Requirement: Set storage
The server SHALL keep sets in the PLL compare tool's own SQLite database, table `sets` (id, name unique ignoring case, cubes as JSON, created_at, updated_at), created and changed only through numbered migrations and never wiped (see user-data). Sets saved before blocks existed, with a cube field `marks` (a list of stickers), SHALL be read as one block of colour 0 with an empty caption.

#### Scenario: Old set with marks
- **WHEN** a stored cube has `marks: ["e7"]` and no blocks
- **THEN** the API returns it with one block of colour 0, caption "" and sticker e7

### Requirement: Stealth look
In stealth mode (see stealth-mode) the cubes SHALL use one grey per side, with opposite faces different (the "sides" stealth palette, set while this tool is open), and SHALL be dimmed until the board is hovered; they SHALL not lie flat. The case buttons' icons SHALL brighten on hover. Sticker frames SHALL keep their colours.

#### Scenario: Stealth on
- **WHEN** stealth mode is on and the pointer is away from the board
- **THEN** the cubes show in greys, dimmed, at their 3D angle
