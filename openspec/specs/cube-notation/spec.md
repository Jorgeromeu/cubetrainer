# cube-notation Specification

## Purpose
Shared tooling for move notation used by every tool: splitting and joining move sequences, AUF helpers,
marked-up display of moves (rotations, named triggers) and the app-wide hover hint that shows what a move does.

## Requirements

### Requirement: Move vocabulary
The system SHALL treat a move sequence as whitespace-separated moves in standard 3x3 notation: face turns
(U R F D L B), wide turns (`Rw` or lowercase `r`), slices (M E S) and whole-cube rotations (x y z), each
plain, primed (`'`) or doubled (`2`). A rotation is exactly `x`, `y` or `z` optionally followed by `2` or `'`.

#### Scenario: Splitting moves
- **WHEN** a sequence such as `"R U  R' "` is split
- **THEN** the result is `["R", "U", "R'"]` (empty tokens dropped)

#### Scenario: Recognising a rotation
- **WHEN** a move is `y'`
- **THEN** it counts as a rotation
- **AND** `Rw`, `M` and `R` do not

### Requirement: Trigger kinds
The system SHALL define the named triggers in `shared/cube.ts` as the only move groups ever marked as triggers, with
kinds and display names `insert` "3-move insert", `sledgehammer` "Sledgehammer", `hedgeslammer` "Hedgeslammer" and
`sexy` "Sexy move". A trigger in an alg (`AlgTrigger`) is `{ kind, start, length }` with `start` a 0-based move index
and `length` 3 or 4.

#### Scenario: Trigger record
- **WHEN** an alg's moves 2–5 are a sexy move
- **THEN** its trigger is `{ kind: "sexy", start: 1, length: 4 }`

### Requirement: Trigger shapes
The system SHALL use these trigger shapes, in any slot or mirror: an insert is `X U* X'` with X a side face;
`R' F R F'` and `F R' F' R` are named by their first move (R/L sledgehammer, F/B hedgeslammer); a sexy move is
`X U X' U'` or `X' U' X U` with U turning the way the side does. Marking triggers in algs is catalog-builder's job.

#### Scenario: Hedgeslammer
- **WHEN** a catalog alg contains `F R' F' R` marked as a trigger
- **THEN** its kind is `hedgeslammer`

### Requirement: Triggers only from the catalog
The system SHALL mark as triggers only those listed in an alg's catalog entry (`CatalogAlg.triggers`); nothing is
detected from the moves at display time, and setups and scrambles never show triggers.

#### Scenario: Unmarked sexy move
- **WHEN** an alg contains `R U R' U'` but its catalog entry lists no trigger there
- **THEN** those moves are shown as plain moves

#### Scenario: Scramble
- **WHEN** a scramble is displayed
- **THEN** no triggers are marked

### Requirement: Grouping moves around triggers
The system SHALL split a move list into groups: each marked trigger becomes one group of its `length` moves starting
at its `start` index, and every other move is its own group. Each move then has one kind: `trigger` (inside a
marked trigger), `rotation`, or `turn`. The same grouping drives both the text notation and the 3D player's move strip.

#### Scenario: Alg with a closing insert
- **WHEN** an alg `U' R U R'` has a trigger `{ kind: insert, start: 1, length: 3 }`
- **THEN** the groups are `[U']` and `[R U R']` (trigger)
- **AND** the move kinds are `turn, trigger, trigger, trigger`

### Requirement: Notation display
The system SHALL render move text the same way everywhere (alg lists, setups, scrambles, solve history, F2L train,
PLL tool): moves separated by single spaces, rotations in the rotation colour (`--rotation`), and each marked trigger
in parentheses in the trigger colour (`--trigger`) with its name as tooltip. These colours stay in stealth mode
(see stealth-mode).

#### Scenario: Rotation in an alg
- **WHEN** an alg `y R U R'` is shown
- **THEN** `y` is coloured as a rotation and the other moves are plain

#### Scenario: Trigger shown
- **WHEN** an alg with a marked sexy-move trigger is shown
- **THEN** the trigger's moves appear as `(R U R' U')` in the trigger colour
- **AND** hovering them shows "Sexy move" as a tooltip

### Requirement: Notation hover contract
The system SHALL give every displayed move a `data-move="<move>"` attribute so the move hint applies. A plain move
carries an empty `title` so an enclosing element's tooltip does not show over it; moves inside a trigger carry no
title so the trigger's name shows. A caller may supply a trigger wrapper, in which case the trigger's markup is passed
through it and the plain name tooltip is omitted.

#### Scenario: Custom trigger wrapper
- **WHEN** the F2L alg list wraps triggers to give them a rich tooltip
- **THEN** the plain name tooltip is not shown

### Requirement: F2L trigger tooltip content
The system SHALL, on hovering a marked trigger of an F2L catalog alg, show a tooltip with the trigger's name and moves.
If the trigger is the alg's closing insert (same kind as `alg.insert` and ending on the alg's last move), it also shows
which case the insert solves on its own ("On its own it solves F2L <n> · <slot>", plus ", after <AUF>" when needed)
and the notes of that case's alg (see f2l-catalog).

#### Scenario: Hovering the closing insert
- **WHEN** the user hovers the closing `(R U R')` of an F2L alg whose insert solves another case after `U'`
- **THEN** the tooltip names "3-move insert", shows `R U R'`, and the case and AUF it solves
- **AND** lists that case's alg notes, if any

#### Scenario: Hovering another trigger
- **WHEN** the user hovers a trigger that is not the closing insert
- **THEN** the tooltip shows only its name and moves

### Requirement: F2L trigger tooltip placement
The system SHALL place the trigger tooltip fixed to the viewport (so the alg row's clipping does not cut it), above the
trigger, or below it when the trigger is within 160 px of the top, clamped horizontally inside the window. It never
takes hover.

#### Scenario: Trigger near the top
- **WHEN** the hovered trigger is 100 px from the top of the window
- **THEN** the tooltip opens below it

### Requirement: Move info
The system SHALL describe any single move it recognises with its axis (x, y, z), turning layers (-1, 0, 1 along the
axis), direction about the axis, whether it is a half turn, a name ("Right face", "Middle slice", "Whole cube",
"Right face + middle (two layers)"…) and a "how" text. Curly quotes, backticks and acute accents count as primes.
Anything else is not a move and gets no info.

#### Scenario: Wide turn
- **WHEN** the move is `r` or `Rw`
- **THEN** the info is the x axis, layers R side and middle, named "Right face + middle (two layers)"

#### Scenario: Unknown token
- **WHEN** the token is `R3` or `Mw`
- **THEN** no move info is returned

### Requirement: Move "how" text
The system SHALL phrase how a move turns as: face turns "clockwise, seen from the right" / "counter-clockwise, seen
from …" / "half turn (180°)"; slices and rotations relative to the face they turn like, e.g. `M'` "like L' (…)"
and `x2` "half turn, like R2". M turns like L, E like D, S like F; x like R, y like U, z like F.

#### Scenario: Slice
- **WHEN** the move is `M`
- **THEN** the text is "like L (clockwise, seen from the left)"

### Requirement: App-wide move hint
The system SHALL show, anywhere in the app, a small icon of what a move does when the pointer rests on an element whose
`data-move` holds a recognised move. One hint layer is mounted once by the shell; a feature only needs the attribute.
The hint appears after 180 ms and hides when the pointer leaves, on any scroll and on any pointer press.

#### Scenario: Hovering a move
- **WHEN** the pointer rests on `R'` in any alg for 180 ms
- **THEN** a hint shows a cube with the right layer marked and an arrow turning it counter-clockwise

#### Scenario: Sweeping across moves
- **WHEN** the pointer passes over several moves in under 180 ms each
- **THEN** no hint flashes for the moves passed over

#### Scenario: Unrecognised move
- **WHEN** an element's `data-move` is not a move (e.g. empty)
- **THEN** no hint is shown

### Requirement: Move hint placement
The system SHALL place the move hint fixed to the viewport, centred below the move (above if there is no room), kept
8 px inside the window, never taking hover. The icon is 88 px; its text (`<move>: <name>, <how>`) is only for screen
readers.

#### Scenario: Move at the bottom of the window
- **WHEN** the hovered move is near the bottom edge
- **THEN** the hint opens above it

### Requirement: Move icon drawing
The system SHALL draw the move icon as an isometric 3x3 cube seen from up-front-right in the UI's neutral greys,
never in cube colours, with the turning layers tinted in the select colour (rotations in the rotation colour) and
arrows for the direction: a round arrow on a visible face that itself turns, a straight arrow along each band crossing
a visible face. Half turns add "×2" and show the clockwise direction. Stealth tinting follows stealth-mode.

#### Scenario: Slice move
- **WHEN** the move is `M`
- **THEN** the middle column on U and F is tinted, with straight arrows pointing the way L turns

#### Scenario: Double turn
- **WHEN** the move is `U2`
- **THEN** the icon shows the U layer tinted, a clockwise round arrow on U, and "×2"

### Requirement: Typed move prefix matching
The system SHALL match typed text against an alg's moves as a prefix: spaces are optional (`RUR'` = `R U R'`),
curly quotes count as primes, every typed move must match exactly except the last, which may be half typed
(`R` matches `R'`, `R2`, `Rw`) unless a trailing space marks it complete.

#### Scenario: Half-typed last move
- **WHEN** the query is `R U R` and the alg is `R U R' U'`
- **THEN** it matches

#### Scenario: Completed last move
- **WHEN** the query is `R U R ` (trailing space) and the alg is `R U R' U'`
- **THEN** it does not match

### Requirement: AUF helpers
The system SHALL define the four AUFs as `""`, `U`, `U2`, `U'`, and the undo of an AUF as its inverse (`U` ↔ `U'`;
`U2` and `""` undo themselves).

#### Scenario: Undoing an AUF
- **WHEN** the AUF is `U`
- **THEN** its undo is `U'`

### Requirement: Joining move sequences
The system SHALL join move sequences into one, merging consecutive turns of the same face where they meet by summing
quarter turns mod 4 (a cancelled pair disappears). It is used to prepend AUFs to setups and scrambles.

#### Scenario: Cancelling
- **WHEN** `R U` is joined with `U' F`
- **THEN** the result is `R F`

#### Scenario: Merging
- **WHEN** `U` is joined with `U R`
- **THEN** the result is `U2 R`
<!-- REVIEW: merging compares only the first character, so `R` followed by `Rw` would be merged as if the same move. Only plain face turns are joined today (AUFs + setups/scrambles), but the rule is unsafe for wide moves. -->
