# cube-rendering Specification

## Purpose
Shared cube visuals for every tool: the 3D cube and player built on cubing.js, its F2L sticker masks, camera and
display settings, the flat 2D drawing used in stealth mode, and the 2D icons (PLL case icon, F2L slot icons).

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
Catalog moves (F2L and PLL) assume this orientation.

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
- **WHEN** "Highlight pair" is off
- **THEN** all F2L pieces show normal colours and the last layer stays grey

### Requirement: Hint stickers
The system SHALL show floating hint stickers (copies of hidden faces) only on the big interactive cube, never on small
cubes, and not while the cube lies flat in stealth mode. The "Hint stickers" setting picks Off, Pair (only the pair's
pieces) or All F2L; the hint distance sets how far they float.

#### Scenario: Pair hints
- **WHEN** hints are "Pair" on the big player
- **THEN** only the pair's corner and edge have floating hint stickers

#### Scenario: Small cube
- **WHEN** a small (non-interactive) cube is shown with hints "All F2L"
- **THEN** no hint stickers are shown

### Requirement: Cube display settings storage
The system SHALL keep cube display settings as one per-browser preference (localStorage key `cubetrainer.cubeSettings`),
shared live by every tool: `highlightPair` (default on), `hints` `off|pair|all` (default `pair`) and `hintDistance`
0.8–1.6 in steps of 0.05 (default 0.95; cubing.js's own default is 1.45). A stored value failing validation falls back
to the defaults.

#### Scenario: Changing a setting in one tool
- **WHEN** the user turns "Highlight pair" off in F2L settings
- **THEN** every cube on the page updates at once and the choice persists across reloads

#### Scenario: Invalid stored value
- **WHEN** the stored hint distance is 3
- **THEN** the defaults are used

### Requirement: Cube display settings section
The system SHALL provide a shared "Cube display · all tools" settings section that every tool showing 3D cubes
includes in its own settings (see tool-shell): Highlight pair (on/off), Hint stickers (Off/Pair/All F2L), a Hint
distance slider (Close–Far, disabled when hints are off) and a "Reset cube display" link restoring the defaults.

#### Scenario: Hints off
- **WHEN** Hint stickers is set to Off
- **THEN** the Hint distance slider is disabled

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
The system SHALL offer three playback speeds, Slow (tempo 0.75), Normal (1.5, default) and Fast (3), remembered per
browser in localStorage key `cubetrainer.tempo` and used by every player created afterwards. A stored value that is
not one of the three falls back to Normal; if storage is unavailable the speed simply isn't remembered.

#### Scenario: Remembered speed
- **WHEN** the user picks Fast and reloads
- **THEN** players start at Fast

### Requirement: Stealth recolouring hook
The system SHALL register every 3D player (including pll-compare's own cubes) with the shared stealth recolouring, which
renders stickers in greys (see stealth-mode) by recolouring cubing.js's shared sticker materials in place, so all cubes
switch at once, rescanning when masks swap in new materials.

#### Scenario: Toggling stealth
- **WHEN** stealth mode is switched on
- **THEN** every cube on the page switches to the stealth palette without being recreated
<!-- REVIEW: stealthCube.ts leans on cubing.js internals (experimental scene accessor, shared materials, hardcoded colour constants); recheck on every cubing.js upgrade (currently ^0.63.8). -->

### Requirement: Stealth palette switch
The system SHALL let a tool switch the page-wide stealth palette from `pair` (default) to `sides` while it is shown
(as pll-compare does); the returned cleanup restores `pair`. `pair` gives a slot's two sides different greys; `sides` gives each side its own grey, opposite faces different.

#### Scenario: Leaving a tool that set the sides palette
- **WHEN** the user leaves a tool that set the `sides` palette
- **THEN** cubes go back to the `pair` palette

### Requirement: Flat cube and reveal hook
The system SHALL, in stealth mode, lay a cube flat unless revealed: small cubes seen from straight above, the big
interactive cube from the nearest straight-on side or top/bottom, lifting cubing.js's 35° latitude limit to allow it.
Hovering the cube or its enclosing `[data-reveal]` area (overview card, slot cell, train stage) turns it back to its own
view; a drag that leaves the area is settled on pointer release.

#### Scenario: Hovering a flat cube's card
- **WHEN** stealth is on and the user hovers an overview card containing a cube
- **THEN** the cube turns back to its slot view

### Requirement: Flat 2D cube drawing
The system SHALL, while a small cube lies flat, replace its player with a 2D SVG of the same current state seen straight
on: the facing side's stickers at the same place and size as cubing.js draws them (so the player swaps back without a
jump), plus the nearest layer's row of each adjacent side as a thin strip around it. It applies the same masks as the 3D
cube, in the stealth greys. The big cube keeps its player.

#### Scenario: Small cube in stealth
- **WHEN** stealth is on and a small cube is not hovered
- **THEN** a flat drawing of its top face with side strips is shown in place of the player

#### Scenario: Big cube in stealth
- **WHEN** stealth is on and the big player is not hovered
- **THEN** the 3D player stays and lies flat; no 2D drawing is used

### Requirement: PLL case icon
The system SHALL draw a PLL case as a plain SVG icon (no cubing.js) from the catalog's `stickers` (a 5x5 grid: the U
face plus each side's top row folded out, `.` for empty corners) and `arrows` (between top-face stickers; `both` gives
a head at each end), held yellow up and green in front. The PLL tools use it at various sizes (default 96 px).
In stealth mode it renders in greys (see stealth-mode).

#### Scenario: Swap arrow
- **WHEN** an arrow has `both: true`
- **THEN** it is drawn with an arrowhead at each end

#### Scenario: Stealth
- **WHEN** stealth is on
- **THEN** the icon uses greys instead of cube colours

### Requirement: Slot icons
The system SHALL provide F2L slot icons drawn in `currentColor` (so they need no stealth variant): a 16 px icon of the
U face from above (back at the top) as an outlined square with the slot's corner filled, and a 26 px key at the centre
of the F2L family grid with the selected slot's corner filled, or empty when the selection is in another grid.

#### Scenario: Family grid key
- **WHEN** the selected slot-case is the BR cell of the shown family grid
- **THEN** the grid key fills the back-right corner

#### Scenario: Selection elsewhere
- **WHEN** the selection is not in this grid
- **THEN** the key shows the empty square
<!-- REVIEW: SlotIcon (the 16 px variant) is exported but not used anywhere; only SlotGridKey is. Keep or delete? -->
