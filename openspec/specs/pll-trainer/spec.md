# pll-trainer Specification

## Purpose
The PLL tool (`#/pll`) deals scrambles for the PLL cases the user selects and times each solve without inspection, keeping the times on the server with per-case stats that show the weak spots.

## Requirements

### Requirement: Tool registration
The system SHALL register the PLL tool with id `pll`, name "PLL" and description "Timed scrambles for the 21 cases you pick", reachable at `#/pll`, with its own top-bar crumb and a "PLL" section in the settings menu (see tool-shell). Its server module SHALL serve its API under `/api/pll` (see architecture).

#### Scenario: Opening the tool
- **WHEN** the user picks "PLL" in the tool switch menu
- **THEN** the URL becomes `#/pll` and the crumb shows "Scramble trainer" with a tag "N of 21 cases", N being the number of selected cases

### Requirement: Case data from the PLL catalog
The system SHALL take its cases from `catalog/pll.json` (see catalog-builder): 21 cases, each with an id such as `pll-Ua`, a name, a group, algs (best first), face-turn scrambles and a top-view icon description. Groups SHALL be shown in catalog order: "Edges only", "Adjacent corner swap", "Diagonal corner swap".

#### Scenario: Cases grouped
- **WHEN** the case selector is laid out by group
- **THEN** it shows three groups in catalog order, each with its cases in catalog order

### Requirement: Case selection kept per browser
The system SHALL let the user select which cases scrambles are drawn from, stored per browser in localStorage under `cubetrainer.pll.selection` as a list of case ids. All 21 cases SHALL be selected when nothing is stored or the stored value cannot be read. Unknown ids in the stored list SHALL be dropped. If storage is unavailable the selection SHALL still work for the session.

#### Scenario: First visit
- **WHEN** the browser has no stored PLL selection
- **THEN** all 21 cases are selected

#### Scenario: Selection remembered
- **WHEN** the user deselects Ua and reloads the page
- **THEN** Ua is still deselected

### Requirement: Case selector controls
The case selector SHALL show each case as a card (top-view PLL icon, see cube-rendering, plus its name) that toggles its selection on click, a count "N / 21 selected", "All" and "None" buttons, and, when laid out by group, a "Select all" / "Deselect all" button per group (Deselect all when every case of the group is selected).

#### Scenario: Deselect a group
- **WHEN** every case of "Edges only" is selected and the user clicks its "Deselect all"
- **THEN** H, Ua, Ub and Z are deselected and the other cases are unchanged

### Requirement: Case selector collapsible, collapsed in stealth
The case selector SHALL be a collapsible section, open by default and collapsed when stealth mode is on (see stealth-mode). Turning stealth on or off SHALL reset it to that default.

#### Scenario: Stealth collapses the selector
- **WHEN** stealth mode is turned on
- **THEN** the case selector collapses

### Requirement: Scramble dealing
The system SHALL deal a scramble for a random case among the selected ones, never the same case twice in a row when more than one case is selected. The scramble SHALL be a random AUF (none, U, U2 or U'), one of the case's catalog scrambles chosen at random, and another random AUF, joined into one move sequence. With no case selected the tool SHALL show "Select at least one case to get scrambles." instead of a scramble.

#### Scenario: No repeat
- **WHEN** at least two cases are selected and a new scramble is dealt
- **THEN** its case differs from the previous scramble's case

#### Scenario: Single case
- **WHEN** only T is selected
- **THEN** every scramble is a T scramble

#### Scenario: Nothing selected
- **WHEN** the user clicks "None" in the case selector
- **THEN** no scramble is shown and the empty message appears

### Requirement: Selection change re-deals
The system SHALL deal a new scramble when the case of the current scramble is deselected, or when cases are selected while there was no scramble.

#### Scenario: Current case deselected
- **WHEN** the current scramble is a Gb and the user deselects Gb
- **THEN** a new scramble for another selected case is dealt

### Requirement: Scramble history in the session
The system SHALL keep the scrambles dealt this session (in memory only, up to 200) and let the user walk them: Previous (← or p) goes back, Next (button, →, Enter or n) goes forward and, at the newest scramble, deals a new one (see tool-shell drill utilities). Navigation SHALL be disabled while the timer is holding, counting down or running. Next SHALL also clear the last result shown under the timer.

#### Scenario: Going back
- **WHEN** the user has dealt three scrambles and presses ← twice
- **THEN** the first scramble of the session is shown again

#### Scenario: History limit
- **WHEN** more than 200 scrambles have been dealt
- **THEN** only the newest 200 can be reached with ←

### Requirement: Show case
The system SHALL let the user reveal or hide the case of an untimed scramble with "Show case" / "Hide case" (key R). A revealed case SHALL show its icon and name (first alg as tooltip) and, if the case has solves, its compact stats line. The button SHALL not be offered on a scramble that has a solve, since its case is already shown.

#### Scenario: Reveal
- **WHEN** the user presses R on an untimed scramble
- **THEN** the scramble's case icon and name appear under the timer

### Requirement: Countdown start
In countdown start mode (the default) the system SHALL start a countdown when the user presses Space (also when a button has focus) or presses the timer with the primary pointer button; the countdown length SHALL be the "Countdown" setting. The timer SHALL show the whole seconds left and the hint "Lift the cube at 0 · Esc cancels". At 0 the timer SHALL start running from 0 without any input. Keys other than Esc and taps on the timer SHALL do nothing during the countdown.

#### Scenario: Countdown to running
- **WHEN** the countdown setting is 3 s and the user presses Space
- **THEN** the timer shows 3, 2, 1 and then runs from 0.00

#### Scenario: Early key ignored
- **WHEN** the user presses a letter key during the countdown
- **THEN** the countdown continues

### Requirement: Countdown sound
The system SHALL, when "Countdown sound" is on and stealth mode is off, play a short tick at each whole second of the countdown and a higher, louder beep at 0, using Web Audio. Cancelling SHALL stop the sounds still scheduled. Without Web Audio the countdown SHALL run silently.

#### Scenario: Silent in stealth
- **WHEN** stealth mode is on and the countdown sound setting is on
- **THEN** the countdown plays no sound

### Requirement: Hold-to-start
In hold start mode the system SHALL, while Space or the primary pointer on the timer is held, show "Keep holding…" and, after 300 ms, mark the timer ready ("Release to start"). Releasing after at least 300 ms SHALL start the timer at once with no countdown; releasing earlier SHALL return to idle without starting. Esc while holding SHALL cancel. Other keys while holding SHALL be ignored.

#### Scenario: Released too early
- **WHEN** the user holds Space for 200 ms and releases
- **THEN** the timer does not start

#### Scenario: Held long enough
- **WHEN** the user holds Space for 400 ms and releases
- **THEN** the timer starts running from 0.00

### Requirement: Scramble hidden while timing
The system SHALL hide the scramble from the start of the countdown (or of the run, in hold mode) until the timer stops or is cancelled.

#### Scenario: No reading the case off the scramble
- **WHEN** the countdown starts
- **THEN** the scramble's moves are no longer visible

### Requirement: Stopping and saving a solve
While the timer runs the system SHALL show the running time and the hint "Any key stops · Esc throws it away", and stop on any key (key repeats ignored) or a pointer press on the timer. On stop it SHALL record a solve for the current scramble's case (time in whole milliseconds from 0 to the stop, penalty OK, the scramble's moves), attach it to that scramble, show it as the last result and deal the next scramble.

#### Scenario: Solve recorded
- **WHEN** the timer runs and the user presses any key other than Esc
- **THEN** a solve with the elapsed time is recorded for the scramble's case and the next scramble is shown

### Requirement: Cancelling a solve
The system SHALL discard the countdown or running solve and return to idle when Esc is pressed while timing. Keyboard shortcuts with Alt, Ctrl or Meta SHALL be ignored throughout the tool.

#### Scenario: Thrown away
- **WHEN** the timer runs and the user presses Esc
- **THEN** no solve is recorded and the timer returns to idle

### Requirement: Last result display
After a solve the system SHALL keep the result on screen, with the next scramble already up, until Next clears it: the time (formatted as in tool-shell solve time utilities, "DNF" for a DNF), the case revealed (icon and name), OK / +2 / DNF penalty buttons, a "Remove" button and the case's compact stats line. A removed solve SHALL no longer be shown.

#### Scenario: Result stays up
- **WHEN** the user stops the timer
- **THEN** the time and case stay under the timer while the next scramble is shown, until the user presses Next

### Requirement: Timed scrambles in the history
Going back to a timed scramble SHALL show that scramble's case and time the same way as the last result.

#### Scenario: Back to a timed scramble
- **WHEN** the user goes back to a scramble they timed
- **THEN** its case and its time with penalty buttons are shown

### Requirement: Idle timer
Before any result the idle timer SHALL read 0.00 with the hint for the start mode: "Space: Ns countdown, then the timer" or "Hold Space to start". A key legend SHALL list Space, ← →, R, 2, D and ⌫.

#### Scenario: Idle hint
- **WHEN** the start mode is countdown with 3 s and nothing has been timed
- **THEN** the timer reads 0.00 with "Space: 3s countdown, then the timer"

### Requirement: Retiming a scramble
The system SHALL allow starting the timer on any scramble shown, including one already timed; the new solve then replaces the scramble's link to its earlier solve, which stays in the solves list.
<!-- REVIEW: timing an already-timed scramble (after going back) records a second solve on the same scramble and the first is only reachable through the Solves list; decide if this should be blocked. -->

#### Scenario: Timing an old scramble again
- **WHEN** the user goes back to a timed scramble and times it again
- **THEN** a new solve is recorded and shown for that scramble, and both solves are in the list

### Requirement: Penalties
The system SHALL support a penalty per solve: OK, +2 (two seconds added) or DNF (did not finish), set with the buttons on the shown solve or on any row of the solves list. Keys 2 and D SHALL toggle +2 and DNF on the shown solve (pressing again returns it to OK). Backspace SHALL remove the shown solve.

#### Scenario: Toggle DNF
- **WHEN** the shown solve is OK and the user presses D twice
- **THEN** it becomes DNF and then OK again

### Requirement: Solve stats
The system SHALL compute, for all solves and for each case's solves: count, DNFs, best single (with +2 included), ao5, ao12, ao100 and the mean of the finished solves, using the WCA-style averages from tool-shell (best and worst dropped, 5% each end for ao100, DNFs counting as worst so one more DNF than is dropped makes the average DNF; undefined until there are enough solves). ao100 SHALL only be shown once it is defined.

#### Scenario: ao5 with two DNFs
- **WHEN** a case's last five solves contain two DNFs
- **THEN** its ao5 shows DNF

### Requirement: Overall stats by the controls
The system SHALL show the overall ao5 and ao12 (and ao100 once defined) next to the scramble navigation whenever there is at least one solve.

#### Scenario: No solves
- **WHEN** there are no solves
- **THEN** no overall stats are shown next to the controls

### Requirement: Solves list
The system SHALL show a collapsible "Solves" section (open by default, hidden when there are no solves) with the solve count, the overall stats line on top and the solves newest first, each numbered from 1 for the oldest, with its time (penalty applied; the raw time as tooltip when penalised), case name, penalty buttons and a remove (×) button. It SHALL show the newest 25 and a "Show all N" / "Show fewer" toggle beyond that.

#### Scenario: Long list
- **WHEN** there are 40 solves
- **THEN** the list shows solves 40 down to 16 and a "Show all 40" button

### Requirement: Per-case pace on the case cards
Each case card SHALL show the case's pace with its solve count, or "–" when untimed. The pace SHALL be its ao5 or, until it has 5 solves, the mean of its finished solves; DNF when neither is finite. Hovering a card SHALL show its name, all its stats (or "not timed yet") and its first alg.

#### Scenario: Fewer than five solves
- **WHEN** a case has 3 solves
- **THEN** its card shows the mean of the finished ones and the count 3

### Requirement: Pace colour scale
The pace SHALL be tinted on a fast-to-slow scale (green to red) relative to the fastest and slowest finite paces among the timed cases; DNF paces SHALL sit at the slow end, and when all paces are equal they SHALL be at the fast end. There SHALL be no legend. The tint SHALL be kept in stealth since it carries meaning (see stealth-mode).
<!-- REVIEW: docs/requirements.md says the pace scale is "muted in stealth"; the CSS keeps the green-red tint in stealth. -->

#### Scenario: Slowest case tinted red
- **WHEN** three cases are timed and Na has the slowest pace
- **THEN** Na's pace is tinted at the red end and the fastest case's at the green end

### Requirement: Case order setting
The case selector SHALL offer "By group" (default) or "Slowest first". Slowest first SHALL list all cases in one grid by pace, slowest first, with untimed cases last in catalog order. The choice SHALL be kept per browser as part of the PLL settings.

#### Scenario: Slowest first
- **WHEN** the user picks "Slowest first"
- **THEN** the timed cases come first from slowest to fastest pace, then the untimed ones

### Requirement: PLL settings
The system SHALL keep PLL settings per browser under `cubetrainer.pllSettings` (persisted helper, see tool-shell) with defaults start = countdown, caseOrder = group, countdown = 3, sound = on; a stored value failing validation SHALL fall back to the defaults. The settings menu's PLL section SHALL offer Start (Countdown / Hold), Countdown (1, 2, 3, 4 or 5 s) and Countdown sound (on/off); the last two SHALL be disabled when Start is Hold.

#### Scenario: Invalid stored settings
- **WHEN** the stored countdown is 7
- **THEN** the defaults are used

### Requirement: Solves kept on the server
The system SHALL store every solve on the server (see user-data), keyed by a client-made uuid, and load all solves when the tool's code first loads. A new solve, a penalty change or a removal SHALL show at once, before the server answers.

#### Scenario: Solve appears immediately
- **WHEN** the user stops the timer
- **THEN** the solve is in the list and stats at once, while it is sent to the server

### Requirement: Working without the server
When the server cannot be reached the system SHALL keep timing, hold new solves, penalty changes and removals locally, and send them once the server is back; it SHALL retry after 2, 5, 10 and then every 30 seconds, and also on window focus and when the browser goes online. While offline it SHALL show a notice "No server · times not saved yet" with the reason as tooltip. Changes still waiting SHALL be lost on reload.

#### Scenario: Offline solve sent later
- **WHEN** a solve is timed while the server is down and the server comes back
- **THEN** the solve is uploaded and merged with the server's solves in time order

### Requirement: Refused changes
When the server refuses a new solve the system SHALL drop it locally and show "Couldn't save the time: <reason>" for 6 seconds. When it refuses a penalty change or removal it SHALL show "Couldn't save the penalty: <reason>" or "Couldn't remove the time: <reason>" and reload the solves from the server.

#### Scenario: Refused solve
- **WHEN** the server rejects a new solve as invalid
- **THEN** the solve disappears from the list and the error is shown

### Requirement: Solves API
The server SHALL expose: `GET /api/pll/solves` returning `{ solves }` oldest first; `PUT /api/pll/solves/:id` with `{ caseId, ms, scramble, penalty? }` creating the solve (penalty "ok" if left out, `createdAt` set by the server) and returning it, where saving an existing id again SHALL return the stored solve unchanged; `PATCH /api/pll/solves/:id` with `{ penalty }` returning the updated solve; `DELETE /api/pll/solves/:id` returning null (also for an unknown id).

#### Scenario: Retried PUT
- **WHEN** the client sends the same PUT twice
- **THEN** one solve is stored and both responses return it

### Requirement: Solve validation
The server SHALL reject as an invalid request (400): an id that is not a uuid; unknown body fields; a `caseId` that is not a case of `catalog/pll.json`; `ms` that is not a whole number from 1 to 600000 (10 minutes); a `scramble` that is not a string or is over 500 characters; a penalty other than `ok`, `+2` or `dnf`; and a PATCH for an unknown solve.

#### Scenario: Forgotten timer
- **WHEN** a solve of 700000 ms is sent
- **THEN** the server rejects it

### Requirement: Solve storage
The server SHALL keep solves in the PLL tool's own SQLite database, table `solves` (id, case_id, ms > 0, penalty in ok/+2/dnf defaulting to ok, scramble, created_at), created and changed only through numbered migrations and never wiped (see user-data). Case ids SHALL be catalog ids, not foreign keys.

#### Scenario: Older database upgraded
- **WHEN** the server starts on a database created before penalties existed
- **THEN** migration 002 adds the penalty column with every existing solve as "ok"

### Requirement: Stealth look
In stealth mode (see stealth-mode) the PLL icons SHALL be grey and dimmed until hovered, the timer SHALL be a plain smaller number with the countdown digits muted, and the countdown sound SHALL be off.

#### Scenario: Timer in stealth
- **WHEN** stealth mode is on and a countdown runs
- **THEN** the digits are shown in the muted text colour at the smaller size
