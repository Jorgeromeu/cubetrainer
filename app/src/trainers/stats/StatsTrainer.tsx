// The stats page, flat like the F2L overview: a range picker scoping everything below
// it, the headline numbers, the charts (Charts.tsx) and every solve as a table. Solves
// are imported one-off through the server's API (solves.ts).
import { useMemo, useState } from 'react'
import { Notation } from '../../../../packages/ui/notation/Notation.tsx'
import { formatSolve, formatTime } from '../../../../packages/core/solve.ts'
import {
  AVERAGES,
  bucketName,
  bucketShortName,
  bucketsOf,
  formatDuration,
  histogramOf,
  inRange,
  pointsOf,
  RANGES,
  rangeStart,
  summaryOf,
  type Period,
  type Point,
} from './analysis.ts'
import { DistributionChart, ProgressChart, SolvesChart, type Span, SpreadOverTimeChart } from './Charts.tsx'
import { updateSolvesPer, useSolvesPer } from './settings.ts'
import { useSolves, type Solve } from './solves.ts'

/** Top bar content. */
export function StatsCrumb() {
  return (
    <nav className="crumb">
      <h1>Solve history</h1>
    </nav>
  )
}

/** A headline number, with a quieter one under it. */
function Figure({ label, value, sub, title }: { label: string; value: string; sub?: string; title?: string }) {
  return (
    <div className="stats-figure" title={title}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {sub && <dd className="stats-figure-sub">{sub}</dd>}
    </div>
  )
}

/** How the timers solves come from are written; others as stored. */
const SOURCE_NAMES: Record<string, string> = { cubetime: 'CubeTime', thecubeapp: 'The Cube App' }

/** Pins at once: one per colour (index.css --stats-pin-*). */
const MAX_PINS = 6

/** How many rows the table shows before "Show all". */
const TABLE_SIZE = 25

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** The scramble cell: the scramble, or "by hand" when the timer's wasn't used. */
function ScrambleCell({ solve }: { solve: Solve }) {
  return solve.scrambledBy === 'hand' ? (
    <td className="stats-scramble muted" title={`Scrambled by hand. The timer showed: ${solve.scramble}`}>
      by hand
    </td>
  ) : (
    <td className="stats-scramble">
      <Notation moves={solve.scramble} />
    </td>
  )
}

function SolveTable({ points }: { points: readonly Point[] }) {
  const [all, setAll] = useState(false)
  // Hand-scrambled solves' scrambles weren't used: no column while that's all of them.
  const scrambles = points.some((p) => p.solve.scrambledBy !== 'hand')
  const newestFirst = [...points].reverse()
  const rows = all ? newestFirst : newestFirst.slice(0, TABLE_SIZE)
  return (
    <section className="stats-section">
      <header className="stats-section-head">
        <h2>
          Solves <span className="stats-count">{points.length}</span>
        </h2>
      </header>
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>ao5</th>
              <th>ao12</th>
              <th>ao100</th>
              <th>When</th>
              <th>Source</th>
              {scrambles && <th className="stats-scramble">Scramble</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.solve.id} title={p.solve.comment || undefined}>
                <td className="num muted">{p.n}</td>
                <td className="num">{formatSolve(p.solve)}</td>
                <td className="num">{formatTime(p.ao5)}</td>
                <td className="num">{formatTime(p.ao12)}</td>
                <td className="num">{formatTime(p.ao100)}</td>
                <td className="muted">{when(p.solve.solvedAt)}</td>
                <td className="muted">{SOURCE_NAMES[p.solve.source] ?? p.solve.source}</td>
                {scrambles && <ScrambleCell solve={p.solve} />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {newestFirst.length > TABLE_SIZE && (
        <button className="link-button" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${newestFirst.length}`}
        </button>
      )}
    </section>
  )
}

export function StatsTrainer() {
  const { load, solves, milestones, error } = useSolves()
  const [range, setRange] = useState(0)
  const allPoints = useMemo(() => pointsOf(solves), [solves])
  const points = useMemo(() => inRange(allPoints, RANGES[range].days), [allPoints, range])
  const summary = useMemo(() => summaryOf(points), [points])
  const bins = useMemo(() => histogramOf(points), [points])
  // Over a short range, days are all there is to count by.
  const allTime = RANGES[range].days === undefined
  const periods: Period[] = allTime ? ['day', 'week', 'month'] : ['day']
  const { period: chosen } = useSolvesPer()
  const period = allTime ? chosen : 'day'
  const from = rangeStart(RANGES[range].days)
  const buckets = useMemo(() => bucketsOf(points, period, from), [points, period, from])
  // Linked hovering: a hovered column shades its period on the timelines, and a hovered
  // timeline lights up the column its mark falls in. Clicked columns stay shaded (pinned),
  // each in its own colour slot, kept while it's pinned (a pin never changes colour); past
  // MAX_PINS the oldest gives its slot up. Pins are kept as their period and start, so they
  // survive a range change; changing the period clears them.
  const [focus, setFocus] = useState<number | null>(null)
  const [pins, setPins] = useState<{ period: Period; start: number; slot: number }[]>([])
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const pinned = buckets
    .flatMap((b, i) => pins.filter((p) => p.period === period && p.start === b.start).map((p) => ({ i, slot: p.slot })))
    .sort((a, b) => a.slot - b.slot)
  const togglePin = (i: number | null) => {
    if (i === null) return setPins([])
    const start = buckets[i].start
    setPins((ps) => {
      if (ps.some((p) => p.period === period && p.start === start)) return ps.filter((p) => !(p.period === period && p.start === start))
      const free = Array.from({ length: MAX_PINS }, (_, s) => s).find((s) => !ps.some((p) => p.slot === s))
      if (free === undefined) return [...ps.slice(1), { period, start, slot: ps[0].slot }]
      return [...ps, { period, start, slot: free }]
    })
  }
  const focusSpans: Span[] = pinned.map(({ i, slot }) => ({ ...buckets[i], label: bucketShortName(buckets[i], period), slot }))
  if (focus !== null && buckets[focus]) {
    const b = buckets[focus]
    const label = `${bucketName(b, period)} · ${b.count} ${b.count === 1 ? 'solve' : 'solves'}`
    const at = focusSpans.findIndex((s) => s.start === b.start)
    if (at < 0) focusSpans.push({ ...b, label, hovered: true })
    else focusSpans[at] = { ...focusSpans[at], label, hovered: true }
  }
  const lit = hoverTime === null ? -1 : buckets.findIndex((b) => hoverTime >= b.start && hoverTime < b.end)

  if (load === 'loading') return <p className="stats-empty">Loading…</p>
  if (load === 'offline')
    return <p className="stats-empty">The solves live on the server, and it isn't answering ({error}). Start it and this page fills in.</p>

  return (
    <div className="stats">
      <div className="speed stats-range" role="group" aria-label="Range">
        {RANGES.map((r, i) => (
          <button key={r.label} className={i === range ? 'active' : undefined} aria-pressed={i === range} onClick={() => setRange(i)}>
            {r.label}
          </button>
        ))}
      </div>

      {!solves.length ? (
        <p className="stats-empty">No solves yet. Import a timer's export through the server's API (server/README.md, "Stats API").</p>
      ) : !points.length ? (
        <p className="stats-empty">No solves in this range.</p>
      ) : (
        <>
          <dl className="stats-figures">
            <Figure
              label="Solves"
              value={String(summary.count)}
              sub={`over ${summary.days} ${summary.days === 1 ? 'day' : 'days'}${summary.dnfs ? ` · ${summary.dnfs} DNF` : ''}`}
            />
            <Figure label="Best single" value={formatTime(summary.best)} sub={summary.latest && `latest ${formatSolve(summary.latest.solve)}`} />
            {AVERAGES.map((n) => (
              <Figure
                key={n}
                label={`ao${n}`}
                value={formatTime(summary.current[n])}
                sub={`best ${formatTime(summary.bestAvg[n])}`}
                title={`Your latest average of ${n}, and the best one in this range`}
              />
            ))}
            <Figure label="Mean" value={formatTime(summary.mean)} sub={`median ${formatTime(summary.median)}`} title="Of the finished solves" />
            <Figure
              label="Spread of 100"
              value={formatTime(summary.spread)}
              sub={`narrowest ${formatTime(summary.narrowestSpread)}`}
              title="How wide the middle 80% of your last 100 times is: the narrower, the more consistent. The spread chart shows it over time."
            />
            <Figure
              label="Time trained"
              value={`≈ ${formatDuration(summary.trained.ms)}`}
              sub={`${summary.trained.sessions} ${summary.trained.sessions === 1 ? 'session' : 'sessions'} · ${formatDuration(summary.trained.solving)} solving`}
              title="Estimated: the time on the clock, plus up to 2 minutes of each pause between solves (scrambling, inspecting; longer, you were doing something else). Solves 45 minutes or more apart are separate sessions."
            />
          </dl>
          <ProgressChart points={points} from={from} milestones={milestones} focus={focusSpans} onHover={setHoverTime} />
          <SolvesChart
            buckets={buckets}
            period={period}
            periods={periods}
            onPeriod={(period) => {
              updateSolvesPer({ period })
              setPins([])
            }}
            highlight={lit < 0 ? undefined : lit}
            onHover={setFocus}
            pinned={pinned}
            onPin={togglePin}
          />
          <SpreadOverTimeChart points={points} from={from} milestones={milestones} focus={focusSpans} onHover={setHoverTime} />
          <DistributionChart bins={bins} total={points.length - summary.dnfs} />
          <SolveTable points={points} />
        </>
      )}
    </div>
  )
}
