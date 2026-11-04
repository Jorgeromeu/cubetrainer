# library/cube-rendering Specification

## Purpose
Shared cube visuals for every tool (`packages/ui/cube`): the 3D cube and player built on cubing.js, its F2L sticker
masks (drawn as the showing tool asks), camera, and the one cube setting every tool shares: playback speed.

## Requirements

### Requirement: 3D cube built on cubing.js
The system SHALL render 3D cubes with cubing.js's `TwistyPlayer` (3x3x3, no background, no built-in control panel),
at a given pixel size (square, never wider than its container), with a camera distance of 5 (closer than cubing.js's
default 6). A cube shows a `setup` and optionally an `alg` to play from it.

#### Scenario: Showing a case
- **WHEN** a tool renders a cube with a setup and an alg
- **THEN** the cube shows the setup's state, resting before the alg by default
- **AND** with `at="end"` it rests after the alg (used to preview moves as they're typed)

### Requirement: Cross-on-D orientation
The system SHALL show every cube with the white cross on D and green in front, by prefixing every setup with `z2`.
Catalog moves assume this orientation.

#### Scenario: Solved setup
- **WHEN** a cube is shown with an empty setup
- **THEN** white is on the bottom, yellow on top, green in front

### Requirement: F2L sticker mask
The system SHALL mask stickers by piece identity (not position): the last-layer pieces and the last-layer centre are
greyed out. With "Highlight pair" on, only the `pairSlot`'s home corner and edge are in full colour and the rest of F2L,
centres included, is dimmed; off, F2L keeps its normal colours. `pairSlot` defaults to `slot`.

#### Scenario: Highlight pair on
- **WHEN** a cube for an FR case is shown with "Highlight pair" on
- **THEN** only the FR corner and edge are in full colour, other F2L pieces dimmed, the last layer grey

#### Scenario: Highlight pair off
- **WHEN** `display.highlightPair` is off
- **THEN** all F2L pieces show normal colours and the last layer stays grey

### Requirement: Hint stickers
The system SHALL show floating hint stickers (copies of hidden faces) only on the big interactive cube, never on small
cubes. `display.hints` picks Off, Pair (only the pair's pieces) or All F2L; `display.hintDistance` sets how
far they float.

#### Scenario: Pair hints
- **WHEN** hints are "Pair" on the big player
- **THEN** only the pair's corner and edge have floating hint stickers

#### Scenario: Small cube
- **WHEN** a small (non-interactive) cube is shown with hints "All F2L"
- **THEN** no hint stickers are shown

### Requirement: Display is the tool's choice
The cube SHALL take how it's drawn as its `display` prop (`CubeDisplay`: `highlightPair`, `hints` `off|pair|all`, `hintDistance` 0.8–1.6 in cubing.js units), plain by default (normal colours, no hints). These are the showing tool's settings, not a shared one: F2L keeps them in its own settings (see tools/f2l) and passes them through `F2lCube`.

#### Scenario: A tool that doesn't choose
- **WHEN** a tool shows a `Cube` without `display`
- **THEN** F2L shows in its normal colours with no hint stickers

#### Scenario: F2L's choice
- **WHEN** the user turns "Highlight pair" off in F2L's settings
- **THEN** every cube on the F2L pages updates at once, and the choice is kept (see foundation/settings)

### Requirement: Slot camera
The system SHALL aim the camera toward the cube's slot, never more than 30° from straight at the front face:
longitude FR 20°, FL -20°, BR 30°, BL -30°. The first placement is instant; later slot changes animate over 450 ms
with an ease-out, the shortest way round from wherever the user dragged the view. A newer camera move cancels an older one.

#### Scenario: Switching slot
- **WHEN** the shown case changes from an FR to a BL slot-case
- **THEN** the camera turns from wherever it is to longitude -30° over 450 ms

### Requirement: Interactive cube
The system SHALL let an interactive cube be turned by dragging. With wheel zoom enabled, the wheel or a trackpad pinch
over the cube changes the camera distance within 3.5–12 instead of scrolling the page; a new player starts at the
default distance. With controls disabled, the cube can still be dragged but shows no player controls.

#### Scenario: Zooming
- **WHEN** the user scrolls the wheel over a zoomable cube
- **THEN** the cube zooms and the page does not scroll

### Requirement: Player transport
The system SHALL give an interactive cube with controls a player: a move strip, a scrubber, transport buttons (restart,
step back, play/pause, step forward, end) and a speed choice. Play is disabled when there are no moves; restart and
step back are disabled at the start, step forward and end at the end. Playing from either end starts over from the
other end.

#### Scenario: Play at the end
- **WHEN** the player is at the end and the user presses play
- **THEN** playback restarts from the start

### Requirement: Stepping between stops
The system SHALL let the cube rest only between moves (the start and the end of each move). Stepping glides to the
previous or next stop at a fixed speed faster than any playback speed, speeding up while several steps are queued,
and stays put at either end rather than wrapping. Dragging the scrubber is free; on release the cube glides to the
nearest stop.

#### Scenario: Stepping at the end
- **WHEN** the player is at the end and the user steps forward
- **THEN** nothing happens

#### Scenario: Releasing the scrubber mid-move
- **WHEN** the user releases the scrubber between two stops
- **THEN** the cube glides to the nearest stop

### Requirement: Move strip
The system SHALL list the alg's moves above the scrubber, each marked done, current or pending by playback position,
coloured by kind as in cube-notation (rotations and marked triggers in their colours, except the current move), and each
carrying `data-move` for the move hint. Clicking a move pauses and jumps to just after it.

#### Scenario: Clicking a move
- **WHEN** the user clicks the third move in the strip
- **THEN** playback pauses and the cube shows the state after the third move

### Requirement: Player keyboard
The system SHALL handle these keys while a player with controls is shown: space play/pause, ←/→ step, Home/End jump to
start/end. Keys with Alt, Ctrl, Meta or Shift are left to the page (e.g. Shift+arrows for F2L's cluster navigation),
and text fields keep their keys. The keys work even when a player button or the scrubber has focus.

#### Scenario: Shift+arrow
- **WHEN** the user presses Shift+→ with the player shown
- **THEN** the player does not step

#### Scenario: Typing
- **WHEN** focus is in a text input and the user presses space
- **THEN** the player does not toggle playback

### Requirement: Playback speed
The system SHALL offer three playback speeds, Slow (tempo 0.75), Normal (1.5, default) and Fast (3), kept as `ui.cube`'s
`tempo` setting and applied to every player at once. A stored value that is not one of the three falls back to Normal.

#### Scenario: Remembered speed
- **WHEN** the user picks Fast and reloads, or opens another browser
- **THEN** players play at Fast
