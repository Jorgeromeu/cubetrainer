# f2l-catalog Specification

## Purpose
The F2L tool (`#/f2l`): an explorer over the 41 F2L cases in all four slots, grouped into mirror clusters, where the user picks a main alg per slot-case, tracks wanted/learning/learnt per alg, keeps notes and video links, adds their own algs, and drills a filtered selection. Its user data lives on the server; without the server it is a read-only explorer.

## Requirements

### Requirement: Registration and routes
The F2L tool SHALL register with id `f2l`, name "F2L", description "All 41 cases in every slot, with algs", a view, a top-bar crumb and a settings section (see tool-shell). Its routes under `#/f2l/` SHALL be: empty for the overview, `train` for the Train view, and `<clusterId>[/<slotCaseId>[/<algId>]]` for a cluster. `train` never collides with a cluster id because cluster ids start with `f2l-`.

#### Scenario: Cluster route with slot-case and alg
- **WHEN** the URL is `#/f2l/f2l-c-11-12/f2l-12-FR/<algId>`
- **THEN** the cluster view for cluster `f2l-c-11-12` opens on slot-case `f2l-12-FR` with that alg selected

#### Scenario: Unknown cluster id
- **WHEN** the path's first segment is neither `train` nor a known cluster id
- **THEN** the overview is shown

### Requirement: Scroll position across views
The system SHALL restore the overview's last scroll position (kept in memory for the page session) when returning to it, and SHALL scroll to the top when entering the Train view.

#### Scenario: Back from a cluster
- **WHEN** the user scrolls the overview, opens a cluster and goes back
- **THEN** the overview is at the scroll position it was left at

### Requirement: Catalog source
The tool SHALL read the catalog from the bundled `catalog/f2l.json` (contract in catalog-builder) and never modify it. Clusters, cases, slot-cases, mirror relations, family alg ids, shapes, triggers, inserts and recommendations SHALL be taken from the catalog as stored, not re-derived, except for alg links which are derived from `shapeId` / `mirrorShapeId` (see "Alg links").

#### Scenario: App built without server
- **WHEN** the app runs with no server
- **THEN** all clusters, slot-cases, setups and catalog algs are still browsable

### Requirement: Overview grouping and order
The overview SHALL show one card per mirror cluster (19 pairs + 3 self-mirror cases), grouped under the case group headings in the order Free Pairs, Connected Pairs, Disconnected Pairs, Corner In Slot, Edge In Slot, Pieces In Slot (unknown groups last), clusters within a group in catalog order. This order is the "overview order" used elsewhere.

#### Scenario: Group order
- **WHEN** the overview renders
- **THEN** the "Free Pairs" section comes first and "Pieces In Slot" last

### Requirement: Overview cluster card
Each cluster card SHALL link to its cluster and show, per case, a small cube of the case's front-right setup, the cluster title (case numbers joined by " · "), a "self-mirror" tag for 1-case clusters, and for pairs a sub-line "F2L N ↔ F2L M".

#### Scenario: Self-mirror card
- **WHEN** a self-mirror cluster is shown
- **THEN** its card has one cube, its case number as title and a "self-mirror" tag

### Requirement: Overview card progress
When progress is loaded, each cluster card SHALL also show per case a 2×2 slot status grid (back row on top: BL BR / FL FR, each cell coloured by slot-case status, faded if outside the filter), a stacked progress bar (learnt, learning, wanted, main), the learnt percentage of the cluster's filtered slot-cases, and "↑N" when N filtered slot-cases have a catalog main alg with a clearly more popular alternative.

#### Scenario: Pair card
- **WHEN** cluster `f2l-c-11-12` is shown with progress loaded
- **THEN** its card shows two cubes, title "11 · 12", "F2L 11 ↔ F2L 12", two slot status grids and a progress bar with a percentage

#### Scenario: Offline card
- **WHEN** progress is not loaded
- **THEN** cards show cubes and titles only, with no status grids, bars or counts

### Requirement: Slot-case status
A slot-case's status SHALL be derived from its best alg: `learnt` if any of its algs is learnt, else `learning` if any is learning, else `wanted` if any is wanted, else `main` if it has a main alg, else `none`. Labels: "Learnt", "Learning", "Want to learn", "Main alg chosen, not started", "No main alg".

#### Scenario: Learnt non-main alg
- **WHEN** a slot-case's main alg has no status but another of its algs is learnt
- **THEN** the slot-case's status is `learnt`

### Requirement: Overview progress head
When progress is loaded, the overview SHALL show an overall stacked progress bar with the learnt percentage over the slot-cases passing the edge and case parts of the filter, followed by the legend filter rows and a Train bar. Each group heading SHALL show learnt/total over that group's filtered slot-cases.

#### Scenario: Overall percentage
- **WHEN** 41 of 164 slot-cases are learnt and no filter is on
- **THEN** the overall bar shows 25%

### Requirement: Legend status filter
The status legend SHALL list learnt, learning, want to learn, main alg, not chosen, each with the count of slot-cases with that status passing the other filter parts. Clicking one SHALL show only that status (clicking it again when it is the only one clears the status filter); Shift/Ctrl/⌘-click SHALL add or remove it from a multi-selection. Selecting all five SHALL be the same as selecting none.

#### Scenario: Shift-click adds
- **WHEN** "learning" is active and the user shift-clicks "want to learn"
- **THEN** slot-cases with status learning or wanted are shown

#### Scenario: All selected collapses
- **WHEN** a click would leave all five statuses selected
- **THEN** the status filter becomes empty (no filtering)

### Requirement: Legend edge filter
The edge legend SHALL offer "good edge" and "bad edge" toggles with counts, filtering by each slot-case's own `edgeOriented` (good: inserts with R/L/U/D, no rotation; bad: needs F/B or a rotation). Clicking the active one SHALL turn the edge filter off.

#### Scenario: Toggle bad edge
- **WHEN** the user clicks "bad edge" twice
- **THEN** the edge filter is on after the first click and `all` after the second

### Requirement: Legend case-number filter
The case filter SHALL accept case numbers and ranges as text (e.g. `27-30, 33`; separators whitespace, comma or semicolon; ranges either way round). Unparseable parts SHALL be ignored; text with no parseable part SHALL mean no case filter. Escape or the × button SHALL clear it.

#### Scenario: Reversed range
- **WHEN** the case filter is `30-27`
- **THEN** cases 27, 28, 29 and 30 pass

### Requirement: Filter semantics
A slot-case SHALL be in the selection when it passes all active parts (status, edge, cases). The filter SHALL only take effect once progress is loaded; while loading or offline everything is in the selection. Overview clusters with no case in the selection SHALL be hidden; a case of a shown cluster with no slot in the selection SHALL be faded. When a filter is on and nothing matches, the overview SHALL say "No slot-case matches the filter."

#### Scenario: Filter while offline
- **WHEN** a status filter is saved in settings but the server is unreachable
- **THEN** all clusters are shown and Train deals from all 164 slot-cases

### Requirement: Saved filters
The user SHALL be able to save the current legend filter under a name ("+ Save this filter", shown when a filter is on and not already saved); saving under an existing name replaces it. Saved filters SHALL show as toggles with their current size; clicking applies it (or, if it is the current one, clears the filter); × deletes it after confirmation. Saved filters are kept per browser with the F2L settings.

#### Scenario: Apply and unapply
- **WHEN** the user clicks a saved filter twice
- **THEN** it is applied after the first click and the filter is cleared after the second

### Requirement: Saved filter equality
Two legend filters SHALL be equal when their edge filter, status set (ignoring order) and case text (ignoring whitespace) match; the matching saved filter is highlighted and named in the Train bar and Train crumb.

#### Scenario: Whitespace ignored
- **WHEN** the case text is `27-30,33` and a saved filter has `27-30, 33` with the same edge and statuses
- **THEN** that saved filter is shown as active

#### Scenario: Replace by name
- **WHEN** the user saves the current filter under a name that already exists
- **THEN** the button reads "Replace" and the old filter of that name is replaced

### Requirement: Train bar
The overview SHALL show a Train bar: with a filter, "<n> of 164 slot-cases · <saved name or filter description>" and a "Show all" button clearing the filter; without, "All 164 slot-cases". A "Train <n|all> →" link SHALL open the Train view, disabled as "Nothing to train" when the selection is empty. The `t` key (no modifiers, not in a text field) SHALL open Train when the selection is non-empty.

#### Scenario: T key
- **WHEN** the overview is shown with a non-empty selection and the user presses `t`
- **THEN** the Train view opens

### Requirement: Focus on what's missing
With the "Focus on what's missing" setting on and progress loaded, learnt slot-cases SHALL be greyed out but stay clickable: fully learnt cases and clusters on the overview, learnt cells on the family map (not while picking an equivalent), and the viewer of a learnt slot-case. The overview legend SHALL show a "Focus on missing" chip whose × turns the setting off. Learning counts as missing.

#### Scenario: Fully learnt cluster
- **WHEN** focus is on and every slot-case of a cluster is learnt
- **THEN** its overview card is greyed with tooltip "All learnt" and still links to the cluster

### Requirement: Cluster crumb and navigation
On a cluster the top bar SHALL show "← All cases", the cluster name ("Cases N · M" or "Case N") between ‹ › links to the previous/next cluster in overview order (wrapping around), the case group tag and a "self-mirror" tag when applicable. Shift+← / Shift+→ (outside text fields) SHALL go to the previous/next cluster.

#### Scenario: Wrap around
- **WHEN** the last cluster in overview order is shown and the user presses Shift+→
- **THEN** the first cluster in overview order opens

### Requirement: Default slot-case and alg
When the URL names no slot-case of the cluster (or one not in it), the cluster view SHALL open on the first slot-case in case order then slot order FR, FL, BR, BL — in focus mode, the first one not learnt. When the URL names no alg, the selected alg SHALL be the slot-case's main alg (catalog or user), else the first catalog alg.

#### Scenario: No alg in URL with user main
- **WHEN** a slot-case's main alg is one of the user's algs and the URL has no alg id
- **THEN** that user alg is selected

### Requirement: Slot-case viewer
The viewer SHALL show "F2L N · <slot name>" with a good/bad edge tag, a 380px interactive cube playing the selected alg from the case's setup (with the catalog alg's marked triggers), and the setup line. "Show on cube" SHALL instead play the setup from a solved cube, until "Back to alg" or the slot-case/alg selection changes. Cube rendering is specified in cube-rendering, notation display in cube-notation.

#### Scenario: Setup mode resets
- **WHEN** "Show on cube" is on and the user selects another alg
- **THEN** the cube plays the newly selected alg

### Requirement: Setup styles
The setup line SHALL offer two styles, remembered per browser: "Colours" (default; the slot-case's own setup with green in front, other slots using B/L/F turns) and "FR + y" (the case's FR setup followed by `y`, `y'` or `y2` to bring the pair to FL, BR or BL; FR unchanged). The family map cubes SHALL follow the same style.

#### Scenario: Back-left in FR + y
- **WHEN** style is "FR + y" and the slot-case is at BL
- **THEN** the setup shown is the case's FR setup followed by `y2`

### Requirement: Family map
The cluster view SHALL show the cluster as top-down 2×2 grids (back row on top), one per case: that case at FR and BL, its mirror at FL and BR, so side-by-side cells are left-right mirrors, front/back cells front-back mirrors and diagonals the 180° turn. A self-mirror cluster SHALL show one grid.

#### Scenario: Pair cluster map
- **WHEN** cluster `f2l-c-11-12` is open
- **THEN** two grids show; the first has case 11 at FR and BL and case 12 at FL and BR

### Requirement: Family map cells
Each family map cell SHALL link to its slot-case and show a small cube, "F2L N", its status mark and "↑" when its catalog main alg has a clearly more popular alternative. The selected slot-case's cell SHALL be highlighted and the grid centre SHALL show a slot key with the selected slot filled. Cells outside the overview filter SHALL be faded.

#### Scenario: Selected cell
- **WHEN** slot-case `f2l-12-FL` is selected
- **THEN** its cell is highlighted and the first grid's centre key has the FL corner filled

### Requirement: Family map tooltips and main marks
A cell's tooltip SHALL include its status, any more popular alg with its votes, how the selected alg's exact family version in that cell relates to the selected alg, whether that version is the main alg there or a different main was chosen, and every direct link from that cell's main alg to the other cells' main algs, marking kinds not counted as "(not counted)". A cell whose main alg is the selected alg's family version SHALL show a small star badge.

#### Scenario: Family version is main
- **WHEN** the selected alg's front-left family version is the main alg at FL
- **THEN** the FL cell shows the star badge and its tooltip says "your main alg there"

### Requirement: Family map tints
Cells whose catalog main algs are linked (directly or transitively, through links between the cluster's mains only) by the "Count as linked" kinds SHALL share a tint, one tint per group of 2+ cells across both grids, biggest group first, cycling through 5 tints. Mains linked to no other SHALL stay plain; user-alg mains are ignored. A "Count as linked" popover next to the map SHALL edit the same setting as Settings → F2L.

#### Scenario: Transpose not counted
- **WHEN** two cells' mains are linked only by a transpose and transpose is not counted
- **THEN** those cells do not share a tint

### Requirement: Alg links
The system SHALL derive links between catalog algs: same `shapeId` is a `rotation` link (same alg in another grip or slot); an alg whose `shapeId` equals another's `mirrorShapeId` is `mirrorLR` if in the left-right neighbouring slot, `mirrorFB` if in the front-back neighbouring slot, otherwise `transpose`. User algs have no links.

#### Scenario: Mirror shape, same slot
- **WHEN** an alg at FR has the mirror shape of an alg of the mirror case at FR
- **THEN** they are linked by `transpose`

### Requirement: Link wording
Links SHALL be described from the alg they are listed on: "left-right mirror", "front-back mirror", "transpose (R-U version)" / "(F-U version)" from the linked alg's side, and for rotation links "same alg, another grip (rotation / d move)" (same slot), "same alg, cube turned 180°" (opposite slot) or "same alg in another slot".

#### Scenario: Same shape, opposite slot
- **WHEN** two algs share a shape and sit at FR and BL
- **THEN** they are linked by `rotation`, described as "same alg, cube turned 180°"

### Requirement: Go to equivalent
For a selected catalog alg, the user SHALL be able to start "Go to equivalent" (row button or `g`): the family map's cells then link to the alg most like it in that slot-case — the user's main there if reachable through any links, else fewest link steps, then its exact family version, then most popular — or are disabled when nothing there is linked. A hint above the map names the alg; Esc, a click outside the map, or landing on another alg ends it. It SHALL be unavailable for user algs.

#### Scenario: Pick a cell
- **WHEN** picking is on and the user clicks a cell with a linked alg
- **THEN** that slot-case opens with the equivalent alg selected and picking ends

### Requirement: Alg list layout
The alg list SHALL show "Algorithms (<count>)" and, with progress loaded, sections in this order: "Main alg" (the main alg row, or "Star an alg to make it your main"), "Your algs" (the user's other algs oldest first, with "+ Add alg"), then "Other algs" (or "All algs" when there is no main) in catalog order. Offline, only the catalog list is shown.

#### Scenario: No main yet
- **WHEN** a slot-case has no main alg
- **THEN** the main section says "Star an alg to make it your main" and the catalog section is labelled "All algs"

### Requirement: Catalog alg row
Each catalog alg row SHALL show, with progress loaded, a main star, status toggle, note toggle and video toggle; then the moves (with marked triggers) linking to select the alg, recommendation picks, own SpeedCubeDB votes, left-right mirror votes (empty column when the catalog has no exact mirror), STM, and a go-to-equivalent button.

#### Scenario: Offline list
- **WHEN** the server is unreachable
- **THEN** the list shows the catalog algs without stars, status, notes, video toggles or "Your algs"

### Requirement: Alg list folding and search
The other-algs list SHALL show the first 4 algs (more if the selected or just-moved alg sits further down) and a "… N more" button to show all. When there are more than 4 other algs, a search box SHALL narrow them to those starting with the typed moves, with a "· m of n" count and "No algs start with …" when empty. `/` focuses it; Escape clears it, then leaves it. The search SHALL reset when the slot-case changes.

#### Scenario: Selected alg beyond the fold
- **WHEN** the selected alg is the 7th other alg
- **THEN** at least 7 other algs are shown without expanding

### Requirement: Main alg
Each slot-case SHALL have at most one main alg, a catalog alg or one of the user's algs of that slot-case. The star (or `f` on the selected alg) SHALL make an alg main, or unset it if it already is; setting it never changes any alg's status. A row moving between sections SHALL slide to its new place and glow (no slide with reduced motion). When the selection followed the main alg implicitly, toggling SHALL first pin the selected alg in the URL so the selection does not jump.

#### Scenario: Unset main keeps selection
- **WHEN** the selected alg is the main alg only implicitly and the user presses `f`
- **THEN** the alg stops being main and stays selected

### Requirement: Use in all slots
Under a catalog main alg, a "Use in all slots (n)" button SHALL appear while some slot with a family version of it (`familyAlgIds`) does not have that version as main. It SHALL make each such version main in its slot-case, asking for confirmation first when it would replace n different main algs.

#### Scenario: Replacing other mains
- **WHEN** two of the target slot-cases have a different main alg
- **THEN** the user is asked "This replaces the main alg you chose in 2 other slots. Continue?" before anything changes

### Requirement: More popular alg hint
The system SHALL treat an alg's popularity as its SpeedCubeDB votes plus its left-right mirror's votes. Another alg of the same slot-case with no more rotations SHALL count as clearly better when its popularity exceeds by at least max(5, 25% of its own popularity). Under a catalog main alg with a better one, the list SHALL show "↑ More popular:" with the most popular such alg (linked) and both vote texts.

#### Scenario: Small gap ignored
- **WHEN** another alg has popularity 12 and the main has 9
- **THEN** no "more popular" hint is shown

### Requirement: Recommendation picks
Each catalog alg row SHALL show a "JP" (J Perm) and/or "CS" (CubeSkills) pick: solid when the alg is in the catalog's `recommendedBy`, outlined when a same-shape alg of the same slot-case is (same alg written with another grip). Picks SHALL never carry over from another slot.

#### Scenario: Other grip
- **WHEN** J Perm's sheet lists `y' U R' …` and the row is `d R' …` in the same slot-case with the same shape
- **THEN** the row shows an outlined "JP" naming the sheet's spelling

### Requirement: Alg status
Each alg (catalog or user) SHALL have at most one status: `wanted`, `learning` or `learnt`, independent of being main. The status toggle (or `k` on the selected alg) SHALL cycle none → wanted → learning → learnt → none.

#### Scenario: Cycle from learnt
- **WHEN** an alg is learnt and the user presses `k` on it
- **THEN** its status is cleared
<!-- REVIEW: the shortcut hint in the list header reads "K learning/learnt" although K also sets "want to learn". -->

### Requirement: Alg list keyboard shortcuts
Outside text fields and without Alt/Ctrl/⌘, the cluster view SHALL handle: `f` main, `k` status, `n` open/focus the selected alg's note, `v` toggle its video popover, `g` go to equivalent, `/` focus the search, `a` start adding an alg. `f k n v a` SHALL need progress loaded. The list header SHALL show these as a hint.

#### Scenario: N on open note
- **WHEN** the selected alg's notes are open and the user presses `n`
- **THEN** focus moves to its last note's text box

### Requirement: Notes
An alg SHALL be able to carry several notes (max 5000 characters each). A note is written on one alg and SHALL keep that alg. A note on a catalog alg SHALL also show on every catalog alg reachable from it through links of its `follows` kinds, any number of steps (default: none, just its own alg). Notes on user algs SHALL show only on that alg. Notes are listed oldest first.

#### Scenario: Note following left-right mirror
- **WHEN** a note on an FR alg follows `mirrorLR`
- **THEN** it also shows on that alg's left-right mirror at FL, and on that alg's mirror in turn

### Requirement: Notes strip editing
The note toggle (filled when the alg has notes; hovering shows them) SHALL open the alg's notes under its row, one at a time per list. Selecting an alg that has notes SHALL open them without taking focus; closing keeps them closed until the selection changes. With no notes, an empty note is shown at once; otherwise "+" on the last note adds one. Esc closes the strip.

#### Scenario: Auto-open on select
- **WHEN** the user selects an alg that has notes
- **THEN** its notes open under its row and keyboard focus stays where it was

### Requirement: Note saving
A note SHALL save 700 ms after typing stops, and on blur or when its row closes; empty text SHALL delete it on blur/close but never mid-edit. Saves coming back SHALL never disturb the text being typed.

#### Scenario: Clearing a note
- **WHEN** the user deletes all text of a note and leaves the field
- **THEN** the note is deleted

### Requirement: Note follows picker
For notes on catalog algs, a link-set icon SHALL show the note's `follows` kinds and open a picker of the four kinds with a preview on the cluster's family grids: filled cells where the note shows on some alg, the viewed slot-case outlined, and "Shows on n algs in m slot-cases" or "just this alg". Changing it SHALL save immediately (unless the text is empty).

#### Scenario: Preview count
- **WHEN** the user ticks rotation and left-right mirror on a note
- **THEN** the preview fills every slot-case where a reachable alg exists and states the alg and slot-case counts

### Requirement: Video links
Each alg (catalog or user) SHALL have at most one video link, an http(s) URL of at most 2000 characters, stored normalised. The video toggle (or `v`) SHALL open a popover with "Open video ↗" (new tab) when set, a URL field ("Not an http(s) link" when invalid), Save (disabled when invalid or unchanged) and Remove. Saving an empty field SHALL remove the link.

#### Scenario: Invalid link
- **WHEN** the user types `ftp://x`
- **THEN** "Not an http(s) link" shows and Save is disabled

### Requirement: Adding user algs with live check
"+ Add alg" (or `a`) SHALL open an editor whose moves field is read loosely (spaces optional, brackets and commas ignored, curly quotes and `R2'` accepted) and previewed live on the big cube, tagged "Preview". Enter adds, Esc cancels; the new alg is selected after adding.

#### Scenario: Loose typing
- **WHEN** the user types `(RUR')`
- **THEN** it is read as `R U R'` and the cube previews those moves

### Requirement: Live alg check
The add editor SHALL check the typed moves on a cubing.js cube from the slot-case's setup and say whether the text is unreadable ("Not a move: …"), how many F2L pieces are still off, that it solves only after a U turn (offering "Start with <AUF>"), that it is already in the list (linking to it), or "✓ Solves the case". F2L SHALL count as solved after any whole-cube rotation.

#### Scenario: Unsolved
- **WHEN** the typed moves leave 3 F2L pieces out of place
- **THEN** the editor says "Not solved yet: 3 F2L pieces out of place"

### Requirement: Accepting a user alg
Only an alg that solves the case, is not already listed for the slot-case (compared after merging redundant same-layer turns, which is also how it is saved) and is at most 200 characters SHALL be addable.

#### Scenario: Needs AUF
- **WHEN** the typed moves solve the case only after a `U'`
- **THEN** the editor says it solves after a `U'` first and offers to prepend it, and Add stays disabled

#### Scenario: Redundant turns
- **WHEN** the user types `R R U' R'` and `R2 U' R'` is already listed
- **THEN** it is reported as already in the list

### Requirement: Placeholder user algs
When adding, the user SHALL be able to leave the moves empty and write a first note: this adds a placeholder alg (no moves) with that note. Placeholders show "No moves yet" with the first note and an "Add moves" button opening the same editor in fill mode, where only solving moves are accepted. A placeholder SHALL be usable as main alg and keep its status, notes and video when filled. A user alg with moves SHALL never be edited, only deleted.

#### Scenario: Fill a placeholder
- **WHEN** the user fills in solving moves for a placeholder that is the main alg
- **THEN** it keeps being the main alg with its notes and status

### Requirement: User alg rows and deletion
User alg rows SHALL look like catalog rows but show a "YOU" pick, no votes, STM as moves excluding rotations ("–" for a placeholder), no go-to-equivalent, and a delete button. Deleting SHALL ask for confirmation and remove the alg with its main-alg spot, status, notes and video link. A first note given when adding SHALL follow no links.

#### Scenario: Delete main user alg
- **WHEN** the user deletes their alg that is the slot-case's main
- **THEN** the slot-case has no main alg and the alg's notes and video are gone

### Requirement: Trigger tooltips
Hovering a marked trigger in a catalog alg's moves SHALL show its name and moves; for the alg's closing insert also "On its own it solves F2L N · <slot>[, after <AUF>]" and the notes shown on that slot-case's matching catalog alg. Trigger highlighting itself is specified in cube-notation.

#### Scenario: Closing insert
- **WHEN** the user hovers the closing `R U' R'` of an alg whose insert solves F2L 4 at FR after `U`
- **THEN** the tooltip says it solves F2L 4 · Front right, after U

### Requirement: Train view
`#/f2l/train` SHALL deal the slot-cases in the current overview selection in rounds: each once in random order before any repeats, a new round never starting with the one just dealt. A "<k> / <n> this round" counter SHALL show progress. If the shown case leaves the selection, another SHALL be dealt; an empty selection SHALL show a message linking to the overview.

#### Scenario: Round coverage
- **WHEN** the selection has 8 slot-cases and the user presses Next 7 times
- **THEN** all 8 have been dealt exactly once

### Requirement: Train setup
Each deal SHALL get a random AUF and show the setup always in "FR + y" style regardless of the setup setting (the case's FR setup, the AUF, then the y to the slot), with an unrevealed 300px cube (drag to turn, scroll to zoom, no player controls). The crumb SHALL show "← All cases", "Train", the saved filter's name if the selection is one, and "<n> slot-cases".

#### Scenario: Back-right deal
- **WHEN** a BR slot-case is dealt with AUF `U2`
- **THEN** the setup reads as the case's FR setup, then `U2`, then `y'`

### Requirement: Train answer
"Show alg" (or `r`) SHALL reveal the case name (linking to it in its cluster) and play, from the dealt angle, the user's main alg (catalog or own), else a learnt catalog alg, else the catalog's first alg; the dealt AUF is undone first and merged into the alg's first U turn, triggers shifted along. A main placeholder SHALL show "Your main alg here has no moves yet." with its notes.

#### Scenario: Placeholder main
- **WHEN** the dealt slot-case's main alg is a placeholder and the user presses `r`
- **THEN** the placeholder's notes are shown as the answer

### Requirement: Train keys and history
In the Train view, Next (Enter, →, `n`, Space) and back (←, `p`) SHALL step through the deals of this session (up to 200, see tool-shell drill utilities); `r` toggles the answer. While the answer is shown, Space, ← and → SHALL go to the cube player instead.

#### Scenario: Back to a revealed deal
- **WHEN** the user reveals a deal, presses Next, then `p`
- **THEN** the earlier deal comes back still revealed

### Requirement: Train rating placeholder
The Train view SHALL show disabled "Knew it", "Slow", "Didn't know" buttons labelled "not recorded yet"; nothing is recorded.

#### Scenario: Rating disabled
- **WHEN** the user tries to rate a case
- **THEN** nothing happens
<!-- REVIEW: half-done feature: decide whether to implement recording (TrainerAttempt in requirements §5.2) or remove the buttons. -->

### Requirement: F2L settings
The F2L settings SHALL be kept per browser under `cubetrainer.f2lSettings` with defaults: focusMissing false, setupMode `colours`, linkKinds `mirrorLR, mirrorFB, rotation` (transpose not counted), edgeFilter `all`, statuses empty, caseFilter empty, savedFilters empty. A stored value failing validation SHALL fall back to all defaults; an old single `statusFilter` SHALL migrate to `statuses`.

#### Scenario: Corrupt settings
- **WHEN** the stored settings have an unknown setupMode
- **THEN** all F2L settings load as defaults

#### Scenario: Legacy status filter
- **WHEN** stored settings have `statusFilter: "learning"` and no `statuses`
- **THEN** they load as `statuses: ["learning"]`

### Requirement: F2L settings section
Settings → F2L SHALL show "Focus on what's missing" (on/off), "Count as linked" (the link-kinds picker, each kind with its mark, name and hint) and "What there is to learn", then the shared cube display settings (see cube-rendering).

#### Scenario: Count as linked shared
- **WHEN** the user changes "Count as linked" in settings
- **THEN** the family map popover shows the same kinds and the tints update

### Requirement: What there is to learn
With progress loaded, Settings → F2L SHALL show, for main algs and for learnt algs (catalog algs only), the count as algs, as distinct shapes, and as ideas (groups linked by the "Count as linked" kinds).

#### Scenario: Mirrored mains
- **WHEN** the mains are 4 algs that are one alg's left-right, front-back and 180° versions and all those kinds are counted
- **THEN** it shows 4 algs → 2 shapes → 1 idea

### Requirement: Progress loading and offline mode
The app SHALL load all F2L user data with one `GET /api/f2l/progress` at startup. If it fails, progress SHALL be `offline`: progress UI hidden, a bottom-right notice "No server · progress not loaded", and loading retried after 2, 5, 10, then every 30 s, and on window focus or coming online.

#### Scenario: Server comes back
- **WHEN** the server becomes reachable while offline
- **THEN** progress loads on the next retry and the progress UI appears

### Requirement: Optimistic saves
Changes SHALL show locally at once and be sent to the server, in order per key (slot-case, note, video, user alg); a change about a user alg SHALL wait for that alg's own save. If the server refuses a change, the app SHALL show "Couldn't save: <reason>" for 6 s and reload all progress from the server; if the server is unreachable, it SHALL go offline. Nothing SHALL be editable while not loaded.

#### Scenario: Refused save
- **WHEN** the server rejects a status change
- **THEN** an error notice shows briefly and the status reverts to the server's

### Requirement: F2L server API
The server module SHALL serve under `/api/f2l/`: `GET /progress` → `{progress, algs, notes, videos, userAlgs}`; `PUT /progress/:slotCaseId` `{mainAlg: AlgRef|null}`; `PATCH /algs/:kind/:id` `{status|null}`; `PUT /notes/:id` `{alg, follows, text}`; `PUT /videos/:kind/:id` `{url|null}`; `PUT /user-algs/:id` `{slotCaseId, moves}`; `PATCH /user-algs/:id` `{moves}`; `DELETE /user-algs/:id`. Null/empty values SHALL delete the row and return null. Error conventions are in user-data.

#### Scenario: Clear main
- **WHEN** `PUT /api/f2l/progress/f2l-12-FR` is sent with `{"mainAlg": null}`
- **THEN** the slot-case's main row is removed and the response is null

### Requirement: Server validation
The server SHALL validate against `catalog/f2l.json`: slot-case ids must exist; a main alg must exist and belong to that slot-case; an alg ref's kind must be `catalog` or `user` and the alg must exist; status must be one of the three.

#### Scenario: Main alg from another slot-case
- **WHEN** a main alg from `f2l-11-FL` is put on `f2l-12-FR`
- **THEN** the request is rejected as invalid
<!-- REVIEW: PUT /progress and PUT /notes accept unknown body fields, while the other endpoints reject them. -->

### Requirement: Server note and video validation
The server SHALL require note ids to be uuids, `follows` to be distinct link kinds (stored in canonical LINK_KINDS order), note text at most 5000 characters, and SHALL refuse moving an existing note to another alg. Video URLs SHALL be trimmed, at most 2000 characters, parse as http or https, and be stored normalised.

#### Scenario: Duplicate follows
- **WHEN** a note is put with `follows: ["rotation", "rotation"]`
- **THEN** the request is rejected as invalid

### Requirement: Server move notation check
The server SHALL require user alg ids to be uuids and moves at most 200 characters, each a face, wide, slice or rotation move with optional 2 and/or prime, re-joined with single spaces. The server SHALL NOT check that a user alg solves its case (it has no cube model).

#### Scenario: Bad token
- **WHEN** a user alg is put with moves `R U X`
- **THEN** the request is rejected with "Not a move: X"

### Requirement: Server user alg rules
`PUT /user-algs/:id` SHALL create the alg (empty moves make a placeholder), refuse moves the slot-case already has in the catalog or among the user's algs, and return the existing alg unchanged when the same id is sent with the same slot-case and moves (safe retries), refusing different content under an existing id. `PATCH` SHALL only fill in a placeholder's moves (same moves again is a no-op). `DELETE` SHALL, in one transaction, remove the alg and its main-alg row, status, notes and video link.

#### Scenario: Retry
- **WHEN** the same `PUT /user-algs/:id` is sent twice
- **THEN** both return the same alg and only one row exists

### Requirement: F2L persistence
F2L user data SHALL live in `data/f2l.sqlite` in tables `user_algs`, `slot_case_progress` (one row per slot-case with a main), `alg_state` (one row per alg with a status, keyed by kind+id), `notes` (uuid id, alg, slot-case, comma-separated `follows`), and `video_links` (one per alg), Catalog algs are referenced by their content-derived ids, not foreign keys (see user-data).

#### Scenario: Status row lifecycle
- **WHEN** an alg's status is cleared
- **THEN** its `alg_state` row is removed

### Requirement: F2L migrations
The F2L schema SHALL be created and changed only by the numbered migrations 001–009, which carry existing data forward: learnt slot-case flags became learnt alg statuses, per-alg notes and family notes became `notes` rows, note symmetries became `follows`, and `wanted` was added as a status.

#### Scenario: Old symmetry note
- **WHEN** migration 007 runs on a note with symmetry `both`
- **THEN** its `follows` becomes `mirrorLR,mirrorFB,rotation`

### Requirement: Stealth variant
All F2L visuals SHALL follow stealth-mode: cubes on the overview cards, family map cells and viewer are marked to be revealed on hover, and status/progress colours stay meaningful. The rules are specified in stealth-mode.

#### Scenario: Stealth overview
- **WHEN** stealth mode is on
- **THEN** overview card cubes follow stealth-mode's dimmed/flat rules until hovered
