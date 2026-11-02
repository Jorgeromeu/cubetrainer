# stats Specification

## Purpose
The Stats tool (`#/stats`, "Solve history") shows the user's full-solve history, imported one-off from timer exports and kept by the server, as headline figures, charts and a solve table. It also covers the server module that stores solves and timeline milestones.

## Requirements

### Requirement: Separate tool
The system SHALL provide Stats as its own tool with id `stats`, name "Stats", the description "Your solve history, charted: progress, spread of times and practice per day, week or month", and a top-bar crumb reading "Solve history", registered in both the app and server tool registries (see architecture, tool-shell).

#### Scenario: Opening the tool
- **WHEN** the user picks Stats in the tool switch
- **THEN** the page at `#/stats` opens with "Solve history" in the top bar

### Requirement: Solve record
The system SHALL store each solve with: a server-made uuid `id`; `ms` as timed without penalty (integer, > 0); `penalty` (`ok`, `+2` or `dnf`); `penaltyKnown`; `scramble`; `scrambledBy` (`timer` or `hand`); `comment` (`""` if none); `solvedAt` (ISO timestamp from the timer, when the solve ended); `source`; `excluded`; and `excludedReason` (`""` if not said). Types live in `shared/stats/solves.ts`.

#### Scenario: Unreliable penalties
- **WHEN** a solve has `penaltyKnown: false`
- **THEN** its `penalty` may say `ok` for a solve that was really a +2 or DNF

#### Scenario: Hand-scrambled solve
- **WHEN** a solve was imported with `handScrambled: true`
- **THEN** it has `scrambledBy: "hand"` and its `scramble` is still the timer's text

### Requirement: Solve identity across imports
The system SHALL treat two solves as the same solve when they have the same `source`, `solved_at` and `ms` (a unique key in the DB).

#### Scenario: Same solve imported twice
- **WHEN** an export containing an already-stored solve is imported again
- **THEN** that solve is not added a second time

### Requirement: Import a CubeTime export
The system SHALL accept `POST /api/stats/import` with body `{ format: "cubetime", text, handScrambled?, penaltiesUnreliable? }` (`text` the export file's contents, at most 20,000,000 characters), add all new solves in one transaction (all or nothing), skip ones already stored, and return `{ added, skipped }`. Unknown fields, an unknown format, or non-boolean flags SHALL be refused. There is no import UI in the app; imports are done against the API (e.g. curl, see server/README.md).

#### Scenario: Re-importing a newer export of a session
- **WHEN** an export with 120 solves is imported and 100 of them were imported before
- **THEN** the response is `{ added: 20, skipped: 100 }`

#### Scenario: Bad line rolls back the whole import
- **WHEN** one row's time can't be parsed
- **THEN** the request is refused naming the line, and no solve from that file is added

### Requirement: Import trust flags
The system SHALL apply the import flags (both default false) to every solve added by that import: `handScrambled` stores `scrambledBy: "hand"`, `penaltiesUnreliable` stores `penaltyKnown: false`.

#### Scenario: Unreliable penalties import
- **WHEN** an export is imported with `penaltiesUnreliable: true`
- **THEN** every solve it adds has `penaltyKnown: false`

### Requirement: CubeTime CSV parsing
The system SHALL parse a CubeTime session export as RFC 4180 CSV (quoted cells may hold commas, newlines and `""`), ignoring blank rows, with a header row whose columns are matched by name without case: `Time` and `Date` required, `Comment`, `Scramble` and `Penalty` optional. Rows may be in any order. Time is in seconds, stored rounded to whole ms (at least 1).

#### Scenario: Quoted comment
- **WHEN** a Comment cell is quoted and holds a comma and a newline
- **THEN** the whole cell is kept as the solve's comment

#### Scenario: Missing required columns
- **WHEN** the file has no `Date` column
- **THEN** the import is refused with "Not a CubeTime export: it needs Time and Date columns"

#### Scenario: Empty file
- **WHEN** the text has no non-blank rows
- **THEN** the import is refused with "The file is empty"

### Requirement: CubeTime penalties
The system SHALL read a CubeTime row as a DNF when its time contains "DNF" or its Penalty is `dnf`, as a +2 when its time ends with `+` or its Penalty is `+2` or `plustwo`, and otherwise as ok.

#### Scenario: Plus-two written in the time
- **WHEN** a row's Time is "12.34+"
- **THEN** the solve is stored with `ms` 12340 and penalty `+2`

### Requirement: CubeTime dates
The system SHALL read a CubeTime Date as `YYYY-MM-DD hh:mm:ss`, 12-hour with AM/PM or 24-hour, with an optional `±hh:mm` or `±hhmm` offset, and store it as a UTC ISO timestamp. An unreadable date refuses the import, naming the line.

#### Scenario: 12-hour date with offset
- **WHEN** a row's Date is "2026-09-19 12:09:02 PM +0000"
- **THEN** the solve's `solvedAt` is `2026-09-19T12:09:02.000Z`

### Requirement: Other timers' solves
The system SHALL keep solves from timers without an import format (The Cube App, `source: "thecubeapp"`) when they are added straight into the DB, and show them like any other solve.
<!-- REVIEW: no `thecubeapp` import format; its 151 solves were inserted by hand. Add a parser for its backup JSON? -->

#### Scenario: The Cube App backup shape
- **WHEN** a The Cube App backup is read
- **THEN** it is a JSON array of `{ timeMs, penalty: { <kind>: {} }, timestamp (epoch ms), scramble: { rawScramble, type } }`

#### Scenario: Hand-added source shown by name
- **WHEN** a solve's source is `thecubeapp`
- **THEN** the table shows its source as "The Cube App"

### Requirement: List solves
The system SHALL serve `GET /api/stats/solves` as `{ solves: Solve[] }`, oldest first by `solvedAt`, excluded solves included.

#### Scenario: Listing
- **WHEN** the app requests the solves
- **THEN** every stored solve is returned ordered by `solvedAt` ascending

### Requirement: Exclude a solve instead of deleting it
The system SHALL accept `PATCH /api/stats/solves/:id` with body `{ excluded, reason? }` (`excluded` a boolean, `reason` a string of at most 200 characters, trimmed), set the solve's exclusion, keep the reason only while excluded (cleared to `""` when included again), and return the updated `Solve`. An unknown id or unknown fields SHALL be refused. There is no delete endpoint for solves: an excluded solve stays in the DB so a re-import skips it, while a deleted one would come back.

#### Scenario: Excluding a misfire
- **WHEN** a solve is patched with `{ excluded: true, reason: "misfire" }`
- **THEN** it is returned with `excluded: true` and `excludedReason: "misfire"`
- **AND** a later import of the same file does not bring it back as a new solve

#### Scenario: Including it again
- **WHEN** an excluded solve is patched with `{ excluded: false }`
- **THEN** it is returned with `excluded: false` and `excludedReason: ""`

### Requirement: Excluded solves never shown
The app SHALL drop excluded solves on load, so they appear in no figure, chart or table row. There is no app UI to exclude or include a solve; it is done through the API.

#### Scenario: Excluded solve hidden
- **WHEN** a solve is excluded on the server and the page reloads its data
- **THEN** it is missing from the count, averages, charts and table, and solve numbers close the gap

### Requirement: Milestones
The system SHALL store milestones: a client-made uuid `id`, a `label` (1–80 characters, trimmed), a `startDay` and an optional `endDay` (local calendar days like `"2026-09-05"`, both included; `endDay` null for a single day). An `endDay` equal to `startDay` SHALL be stored as null. Non-uuid ids, unknown fields, malformed days and an `endDay` before `startDay` SHALL be refused. There is no app UI to edit milestones.

#### Scenario: Range milestone
- **WHEN** `PUT /api/stats/milestones/<uuid>` is sent `{ label: "learning PLL", startDay: "2026-09-05", endDay: "2026-09-12" }`
- **THEN** the milestone is saved and returned with those days

#### Scenario: Same start and end day
- **WHEN** a milestone is put with `startDay` and `endDay` both "2026-09-05"
- **THEN** it is stored as a single day with `endDay: null`

### Requirement: Milestones API
The system SHALL serve `GET /api/stats/milestones` as `{ milestones }` ordered by start day then end day, accept `PUT /api/stats/milestones/:id` with `{ label, startDay, endDay? }` (creates or replaces, returns the `Milestone`), and `DELETE /api/stats/milestones/:id` (returns `null`).

#### Scenario: Deleting
- **WHEN** a milestone is deleted
- **THEN** the response is `null` and it no longer shows on the charts after the next fetch

### Requirement: Milestones on the timelines
The system SHALL draw each milestone on the Progress and Spread over time charts as a shaded band over its days (a single day too) with an edge line and its label at the top, and its label and days as a hover title. By solve number, the band covers the solves done on those days, or is a line where they would be.

#### Scenario: Milestone by solve
- **WHEN** the x axis is by solve and a milestone covers days with 40 solves
- **THEN** its band spans those 40 solves

### Requirement: Server storage
The system SHALL keep stats data in `data/stats.sqlite`, built by migrations 001 (solves), 002 (`scrambled_by`, `penalty_known`; it marked every solve up to then as `hand` and penalties unknown), 003 (`excluded`, `excluded_reason`) and 004 (milestones), and never wipe it (see user-data).

#### Scenario: Server restart
- **WHEN** the server restarts
- **THEN** all imported solves, exclusions and milestones are still there

### Requirement: Loading and offline state
The app SHALL fetch solves and milestones together from the server, show "Loading…" during the first fetch, and when the server does not answer show that the solves live on the server and it isn't answering (with the error), retrying every 30 s. It SHALL fetch again when the window regains focus or the browser comes back online. Data is read-only in the app.

#### Scenario: Server down
- **WHEN** the server is not running
- **THEN** the page says the server isn't answering and fills in by itself once it is started

#### Scenario: No solves yet
- **WHEN** the server answers with no solves
- **THEN** the page says there are no solves yet and points to the server's import API

### Requirement: Range picker
The system SHALL offer a range picker above everything else with "All time" (default), "Last 30 days" and "Last 7 days", scoping the figures, charts and table. A range counts back whole local days from today, today included. The chosen range is not remembered. Running averages and spreads of solves in a range are still computed over all solves before them, not just those in the range.

#### Scenario: Short range
- **WHEN** the user picks "Last 7 days"
- **THEN** only solves from the last 7 local calendar days are shown, and the date axes start at that range's first midnight
- **AND** if there are none, "No solves in this range." is shown

### Requirement: Averages and penalties
The system SHALL compute ao5, ao12 and ao100 per solve WCA-style over the last n solves up to and including it (drop 5% at each end, at least one; DNFs count as worst, so a window with more DNFs than are dropped averages DNF); a +2 adds 2 s; undefined before there are n solves. Solves are numbered from 1 over all (non-excluded) solves. Times show as seconds with hundredths ("12.34", "1:02.34" from a minute), a +2 as "14.34+", a DNF as "DNF", a missing value as "–" (see tool-shell).

#### Scenario: Not enough solves
- **WHEN** there are 80 solves
- **THEN** every ao100 shows "–"

### Requirement: Headline figures
The system SHALL show, for the range: Solves (count, with "over N days" and the DNF count when any); Best single (with the latest solve); ao5, ao12, ao100 (latest, with the best in the range); Mean of finished solves (with the median); Spread of 100 (the width of the middle 80%, p10 to p90, of the last 100 times, with the narrowest in the range); and Time trained (estimated, with the session count and the time on the clock).

#### Scenario: Spread figure
- **WHEN** the latest solve has 100 solves behind it
- **THEN** "Spread of 100" shows p90 − p10 of those 100 times, DNFs counted as slowest

### Requirement: Sessions and time trained
The system SHALL treat solves less than 45 minutes apart as one session. Time trained SHALL be the sum of solve times plus, for each solve within a session, the pause since the previous solve ended (its `solvedAt` minus its time, minus the previous `solvedAt`), capped at 2 minutes per pause; written to the minute as "24h 10m" or "35m".

#### Scenario: Long pause inside a session
- **WHEN** two solves in one session are 10 minutes apart
- **THEN** only 2 minutes of that pause count as training

### Requirement: Spread percentiles
The system SHALL compute, for each solve, the distribution of the last 12 and the last 100 effective times (undefined until there are that many): interpolated p10, p25, p75, p90, and every 5th percentile from p10 to p90 (the fan). DNFs count as the slowest.

#### Scenario: Window not yet full
- **WHEN** a solve is the 50th
- **THEN** it has a 12-solve spread but no 100-solve spread

### Requirement: Progress chart
The system SHALL draw a Progress chart (300 px tall) with: the running average over the chosen window (ao12 or ao100) as a line ("curve"); the spread of the same window's solves as nested faint bands from p10–p90 in to p45–p55 ("distribution"); every finished single as a faint dot ("singles"); milestones; and on hover a wash and bracket over the solves the hovered average covers ("window"). Each is toggled in the legend (milestones listed only when any exist).

#### Scenario: Hiding singles
- **WHEN** the user turns singles off
- **THEN** the chart starts where the curve or fan first exist, or says "Not enough solves for aoN yet" if they never do

#### Scenario: Switching window
- **WHEN** the user picks ao12 in the legend
- **THEN** the curve, fan and Spread over time chart all use the last 12 solves

#### Scenario: Hovering a point
- **WHEN** the user hovers the chart
- **THEN** a crosshair and readout show the average, the middle 80% and middle half ranges with the width, the solve numbers covered, and the date

### Requirement: Progress y axis fits what is shown
The system SHALL fit the Progress y axis to what is shown (the fan, else the curve, else the singles), padded by at least 0.3 s and widened to round ticks, so a short range zooms in on the averages.

#### Scenario: Short range zooms in
- **WHEN** the range is "Last 7 days"
- **THEN** the y axis spans only the shown fan or curve, not all-time times

### Requirement: Shared x axis by date or by solve
The system SHALL let the Progress legend switch the timeline charts' x axis between "by date" (default) and "by solve". By date, lines go through one mark per session (its last solve), hover picks a session ("At the end of N solves · date–time"), and a pause over 2 days dashes the line across it. By solve, every solve is evenly spaced and hover picks a solve. With only singles shown, hover picks single solves even by date.

#### Scenario: Long break by date
- **WHEN** there are 5 days without solves
- **THEN** the curve is dashed across that gap

### Requirement: Calendar ticks
The system SHALL put timeline x ticks on calendar milestones, the densest set that fits: month starts as major ticks (the year for January, every quarter's on long spans), round days of the month in between (1/5/10…, 1/10/20, 1/15), or round hours over a day or two; the first label carries its month. By solve, each tick sits at the first solve on or after it, thinned so labels don't crowd (a month start wins).

#### Scenario: Month start
- **WHEN** the axis crosses 1 August
- **THEN** a major tick labelled "Aug" is drawn there

### Requirement: Spread over time chart
The system SHALL show, while distribution is on, a "Spread over time (N)" chart: one line of the middle-80% width of the chosen window at each mark, from 0 up, starting where the window first fills, on the same x axis, milestones and focus bands as Progress, with a hover readout.

#### Scenario: Distribution hidden
- **WHEN** the user turns distribution off
- **THEN** the Spread over time chart is not shown

### Requirement: Solves per period chart
The system SHALL show a "Solves per day/week/month" column chart with every local calendar period (weeks from Monday) from the range start (or the first solve, for all time) to today (or the last solve, for all time), quiet ones included. Over "All time" the user picks day, week (default) or month; shorter ranges always count by day. Hovering a column shows its count, name, mean and best, and time trained with sessions.

#### Scenario: Short range forces days
- **WHEN** the range is "Last 30 days"
- **THEN** the chart counts per day and offers no period picker

### Requirement: Linked hover and pinned periods
The system SHALL link the Solves per chart with the timeline charts: hovering a column shades and labels its period on Progress and Spread over time, and hovering a timeline lights up the column its mark falls in.

#### Scenario: Hovering a column
- **WHEN** the user hovers the column for one day
- **THEN** that day is shaded and labelled with its name and solve count on both timelines

### Requirement: Pinned periods
The system SHALL pin a column on click (again to unpin): up to 6 pins, each keeping its own colour slot and number while pinned; a seventh takes the oldest pin's slot. Pins show as numbered coloured bands on the timelines (labels in up to 4 rows), coloured numbered columns, and header chips that unpin one ("clear" unpins all when more than one). Pins survive a range change and are cleared when the period changes.

#### Scenario: Pinning two weeks
- **WHEN** the user clicks two week columns
- **THEN** both weeks stay shaded on the timelines in two different colours numbered 1 and 2, matching their columns and header chips

### Requirement: Distribution of times chart
The system SHALL show a "Distribution of times" column chart with one column per whole second from the fastest to the slowest finished solve in the range, each hover showing its count and share of finished solves.

#### Scenario: Hovering a bin
- **WHEN** the user hovers the 18 s column
- **THEN** it shows how many solves took 18.00–18.99 s and their percentage

### Requirement: Warm-up effect
The system SHALL NOT currently show a warm-up effect chart.
<!-- REVIEW: the root README promises "how much warming up matters", but no such chart or calculation exists in the code. Decide what it should be (e.g. mean time by solve position within a session) or drop it from the README. -->

#### Scenario: No warm-up chart
- **WHEN** the stats page is shown
- **THEN** its charts are Progress, Solves per, Spread over time and Distribution of times only

### Requirement: Solve table
The system SHALL list the range's solves newest first with columns #, Time, ao5, ao12, ao100, When (day, month, hour:minute), Source, and Scramble (as notation; "by hand" for hand-scrambled solves, with the timer's scramble in its tooltip). The Scramble column is left out while every shown solve is hand-scrambled. A row's tooltip is the solve's comment. The table shows 25 rows, with "Show all N" / "Show fewer".

#### Scenario: Only hand-scrambled solves
- **WHEN** every solve in the range has `scrambledBy: "hand"`
- **THEN** the table has no Scramble column

### Requirement: Remembered chart settings
The system SHALL remember per browser, under `cubetrainer.statsProgress`, the window (12 or 100, default 100), curve, distribution, singles, milestones and windows toggles (all default on) and the x axis (`date` default, or `solves`), and under `cubetrainer.statsSolvesPer` the all-time period (`day`, `week` default, `month`). Invalid stored values fall back to the defaults (see tool-shell).

#### Scenario: Settings kept
- **WHEN** the user hides singles and reloads
- **THEN** singles stay hidden

### Requirement: Stealth
The system SHALL follow stealth-mode for the stats page; chart marks (lines, bars, fan) keep the accent colour and the six pin colours stay in stealth, as they carry meaning and aren't cube colours.
<!-- REVIEW: the Charts.tsx header comment says stealth uses ink instead of the accent, but index.css keeps the accent in stealth; confirm which is intended. -->

#### Scenario: Stealth on
- **WHEN** stealth mode is on
- **THEN** the pinned periods keep their distinct colours
