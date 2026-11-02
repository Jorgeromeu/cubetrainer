// The charts, drawn as plain SVG: progress (every solve and its running averages), the
// spread of times, and solves per day, week or month. Hovering a period shades it on the
// timelines, and hovering a timeline lights up its period. Colours are the theme's tokens (index.css,
// "Stats"), so dark mode and stealth (ink instead of the accent) come for free. Each one
// has a hover readout; the solve table under them has every value without hovering.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { formatMs, formatTime } from '../../../../packages/core/solve.ts'
import { bucketName, bucketShortName, formatDuration, sessionsOf, spreadOf, type Bin, type Bucket, type Period, type Point } from './analysis.ts'
import { updateProgressSettings, useProgressSettings } from './settings.ts'
import type { Milestone } from './solves.ts'

const HEIGHT = 240
/** Room for the axes: left for the y labels, bottom for the x labels. */
const PAD = { top: 12, right: 12, bottom: 26, left: 40 }

/** A chart's width, following its container. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** About `count` round ticks (1, 2 or 5 × a power of ten) covering lo..hi. */
function niceTicks(lo: number, hi: number, count = 5): number[] {
  const raw = (hi - lo) / count || 1
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw)!
  const ticks = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(t)
  return ticks
}

const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)

/** A column, square on the baseline, its top corners barely rounded. */
function columnPath(x: number, y: number, w: number, base: number) {
  const r = Math.min(1, w / 2, base - y)
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`
}

const longDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** A chart's frame: title, optional legend, and the plot (drawn at the card's width). */
function ChartCard({ title, legend, children }: { title: string; legend?: ReactNode; children: (width: number) => ReactNode }) {
  const [ref, width] = useWidth()
  return (
    <section className="stats-section">
      <header className="stats-section-head">
        <h2>{title}</h2>
        {legend}
      </header>
      <div className="stats-plot" ref={ref}>
        {width > 0 && children(width)}
      </div>
    </section>
  )
}

/** The hover readout, beside the point it's about (on its left in the right half). */
function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  return (
    <div
      className="stats-tooltip"
      style={{ left: x, top: y, transform: `translate(${x > width / 2 ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}
    >
      {children}
    </div>
  )
}

/** The y axis: hairline gridlines with their labels. */
function YGrid({ ticks, y, width, format }: { ticks: number[]; y: (v: number) => number; width: number; format: (v: number) => string }) {
  return (
    <g className="stats-grid">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
          <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

/** The progress chart's height: taller than the others, it's the one to read closely. */
const PROGRESS_HEIGHT = 300

/**
 * A y range that fits `values` snugly, padded a little and widened to round ticks, so a
 * short range zooms in on the averages instead of keeping the scale of all time.
 */
function fitScale(values: number[]) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = Math.max(300, (hi - lo) * 0.12)
  const ticks = niceTicks((lo - pad) / 1000, (hi + pad) / 1000, 5)
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1
  const domainLo = Math.min(ticks[0], Math.floor((lo - pad) / 1000 / step) * step)
  const domainHi = Math.max(ticks.at(-1)!, Math.ceil((hi + pad) / 1000 / step) * step)
  return {
    lo: domainLo * 1000,
    hi: domainHi * 1000,
    ticks: niceTicks(domainLo, domainHi, 5).map((t) => t * 1000),
  }
}

/** 23.5 → "23.5s", 24 → "24s". */
const secondsLabel = (ms: number) => `${+(ms / 1000).toFixed(2)}s`

const isTime = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v)

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** A date-axis tick: where, what it says, and whether it's a milestone (a month or year start). */
interface Tick {
  value: number
  label: string
  major?: boolean
}

/** Days of the month that get a tick, densest first; the 1st is always one. */
const DAY_SETS = [
  Array.from({ length: 31 }, (_, i) => i + 1),
  [1, 5, 10, 15, 20, 25],
  [1, 10, 20],
  [1, 15],
  [1],
]

/** The local midnights from t0 to t1. */
function midnights(t0: number, t1: number): Date[] {
  const d = new Date(t0)
  d.setHours(0, 0, 0, 0)
  if (d.getTime() < t0) d.setDate(d.getDate() + 1)
  const out = []
  for (; d.getTime() <= t1; d.setDate(d.getDate() + 1)) out.push(new Date(d))
  return out
}

/** The densest days-of-the-month set giving at most `max` of these days. */
function daySetFor(days: readonly Date[], max: number) {
  return DAY_SETS.find((set) => days.filter((d) => set.includes(d.getDate())).length <= max) ?? DAY_SETS.at(-1)!
}

const monthLabel = (d: Date) =>
  d.getMonth() === 0 ? String(d.getFullYear()) : d.toLocaleDateString(undefined, { month: 'short' })

/**
 * A midnight's label: a month start is a milestone ("Aug", a year start "2027"); other
 * days are just their number, except the axis's first label, which carries the month.
 */
function dayTick(d: Date, first: boolean): Omit<Tick, 'value'> {
  if (d.getDate() === 1) return { label: monthLabel(d), major: true }
  return { label: first ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : String(d.getDate()) }
}

/**
 * Ticks between t0 and t1 on calendar milestones, at most about `max`: month starts (or
 * every quarter's), round days of the month in between (1/15, 1/10/20, …), or, over a
 * day or two, midnights and round hours. The densest that fits is used.
 */
function timeTicks(t0: number, t1: number, max: number): Tick[] {
  const ticks: Tick[] = []
  const spanDays = (t1 - t0) / DAY
  const hours = [1, 3, 6, 12].find((h) => (spanDays * 24) / h <= max)
  if (hours) {
    const d = new Date(t0)
    d.setMinutes(0, 0, 0)
    d.setHours(Math.ceil(d.getHours() / hours) * hours)
    for (; d.getTime() <= t1; d.setHours(d.getHours() + hours)) {
      const value = d.getTime()
      if (d.getHours() === 0) ticks.push({ value, ...dayTick(d, !ticks.length) })
      else ticks.push({ value, label: `${String(d.getHours()).padStart(2, '0')}:00` })
    }
    return ticks
  }
  if (spanDays / 30.4 <= max) {
    const all = midnights(t0, t1)
    const set = daySetFor(all, max)
    for (const d of all) if (set.includes(d.getDate())) ticks.push({ value: d.getTime(), ...dayTick(d, !ticks.length) })
    return ticks
  }
  // Long spans: month starts, every quarter's if they're too many.
  const every = spanDays / 30.4 / 3 <= max ? 3 : 12
  const d = new Date(t0)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  if (d.getTime() < t0) d.setMonth(d.getMonth() + 1)
  for (; d.getTime() <= t1; d.setMonth(d.getMonth() + 1))
    if (d.getMonth() % every === 0) ticks.push({ value: d.getTime(), label: monthLabel(d), major: true })
  return ticks
}

/** On the date axis, a pause this long between solves breaks the lines (dashed across it). */
const BREAK_MS = 2 * DAY

const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/**
 * The x axis the progress and spread charts share: by date or by solve number
 * (settings.ts xAxis). By date, solves come in bursts, so lines go through one mark per
 * session (its last solve, when it ended) and hovering picks a session. By solve number
 * every solve is a mark. `from`: where the range starts, for the date axis.
 */
function xAxisOf(points: readonly Point[], byDate: boolean, from?: number, perSolve = false) {
  const times = points.map((p) => Date.parse(p.solve.solvedAt))
  /** Where solve i sits along the axis: its time, or its number. */
  const at = (i: number) => (byDate ? times[i] : points[i].n)
  const x0 = byDate ? Math.min(from ?? times[0], times[0]) : points[0].n
  const x1 = byDate ? Math.max(times.at(-1)!, x0 + HOUR) : points.at(-1)!.n
  const sessions = byDate && !perSolve ? sessionsOf(times) : points.map((_, i) => ({ start: i, end: i }))
  const marks = sessions.map((s) => s.end)
  return {
    times,
    at,
    x0,
    x1,
    sessions,
    marks,
    /** Whether the line breaks (dashed) between two marks: a long pause, by date. */
    breaksBetween: (a: number, b: number) => byDate && times[b] - times[a] > BREAK_MS,
    /** The mark nearest `target` along the axis (at() only ever increases). */
    nearest(target: number) {
      let lo = 0
      let hi = marks.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (at(marks[mid]) < target) lo = mid + 1
        else hi = mid
      }
      return marks[lo > 0 && target - at(marks[lo - 1]) < at(marks[lo]) - target ? lo - 1 : lo]
    },
    ticks(width: number): Tick[] {
      if (byDate) return timeTicks(x0, x1, Math.max(3, Math.floor(width / 80)))
      // By solve: the same calendar milestones, each at the first solve on or after it,
      // so they're unevenly spaced. Fewer of them, and none crowding another (a month
      // start wins over a day).
      const plotWidth = width - PAD.left - PAD.right
      const px = (n: number) => ((n - x0) / (x1 - x0 || 1)) * plotWidth
      const kept: (Tick & { date: number })[] = []
      for (const t of timeTicks(times[0], times.at(-1)!, Math.max(2, Math.floor(width / 110)))) {
        const i = times.findIndex((time) => time >= t.value)
        if (i < 0) continue
        const tick = { ...t, value: points[i].n, date: t.value }
        const last = kept.at(-1)
        if (!last) kept.push(tick)
        else if (last.value === tick.value || px(tick.value) - px(last.value) < 44) {
          // The later milestone of two landing together is the one that's true there.
          if (!last.major || tick.major) kept[kept.length - 1] = tick
        } else kept.push(tick)
      }
      // The first label carries its month if it's a bare day.
      const first = kept[0]
      if (first && !first.major && /^\d+$/.test(first.label))
        first.label = new Date(first.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      return kept
    },
  }
}

/** The x axis's labels, with a short tick each, under a plot `height` tall. */
function XTicks({ ticks, x, height }: { ticks: Tick[]; x: (v: number) => number; height: number }) {
  return (
    <g className="stats-axis">
      {ticks.map((t) => (
        <g key={t.value} className={t.major ? 'major' : undefined}>
          <line x1={x(t.value)} x2={x(t.value)} y1={height - PAD.bottom} y2={height - PAD.bottom + (t.major ? 6 : 4)} />
          <text x={x(t.value)} y={height - 8} textAnchor="middle">
            {t.label}
          </text>
        </g>
      ))}
    </g>
  )
}

/** The pointer's position along a hit rect, in axis units. */
const pointerAt = (e: React.PointerEvent<SVGRectElement>, x0: number, x1: number) => {
  const box = e.currentTarget.getBoundingClientRect()
  return x0 + ((e.clientX - box.left) / box.width) * (x1 - x0)
}

type Axis = ReturnType<typeof xAxisOf>

/**
 * A line through the marks where `value` is defined, and (by date) dashed links across
 * long pauses.
 */
function traceLine(axis: Axis, value: (i: number) => number | undefined, x: (v: number) => number, y: (v: number) => number) {
  let line = ''
  let breaks = ''
  let prev: number | undefined
  for (const i of axis.marks) {
    const v = value(i)
    if (!isTime(v)) {
      prev = undefined
      continue
    }
    const xy = `${x(axis.at(i)).toFixed(1)},${y(v).toFixed(1)}`
    const gap = prev !== undefined && axis.breaksBetween(prev, i)
    if (gap) breaks += `M${x(axis.at(prev!)).toFixed(1)},${y(value(prev!)!).toFixed(1)}L${xy}`
    line += `${prev === undefined || gap ? 'M' : 'L'}${xy}`
    prev = i
  }
  return { line, breaks }
}

/** The area between two values over the marks, split where the line breaks. */
function traceBand(
  axis: Axis,
  low: (i: number) => number | undefined,
  high: (i: number) => number | undefined,
  x: (v: number) => number,
  y: (v: number) => number,
) {
  const runs: number[][] = []
  let prev: number | undefined
  for (const i of axis.marks) {
    if (!isTime(low(i)) || !isTime(high(i))) {
      prev = undefined
      continue
    }
    if (prev === undefined || axis.breaksBetween(prev, i)) runs.push([])
    runs.at(-1)!.push(i)
    prev = i
  }
  const xy = (i: number, v: number) => `${x(axis.at(i)).toFixed(1)},${y(v).toFixed(1)}`
  return runs
    .map((run) => `M${[...run.map((i) => xy(i, high(i)!)), ...[...run].reverse().map((i) => xy(i, low(i)!))].join('L')}Z`)
    .join('')
}

/** A crosshair-and-tooltip plot over the shared x axis: what Progress and Spread over time have in common. */
function useAxisHover(onHover?: (time: number | null) => void) {
  const [hover, setHover] = useState<number | null>(null)
  const handlers = (axis: Axis) => ({
    onPointerMove: (e: React.PointerEvent<SVGRectElement>) => {
      const i = axis.nearest(pointerAt(e, axis.x0, axis.x1))
      setHover(i)
      onHover?.(axis.times[i])
    },
    onPointerLeave: () => {
      setHover(null)
      onHover?.(null)
    },
  })
  return [hover, handlers] as const
}

/** What a hovered mark is: a session (by date) or a solve, for the tooltip's last line. */
function markLabel(axis: Axis, points: readonly Point[], i: number, byDate: boolean) {
  const session = byDate ? axis.sessions.find((s) => s.end === i) : undefined
  if (!session) return `Solve ${points[i].n} · ${longDate(points[i].solve.solvedAt)}`
  const n = session.end - session.start + 1
  return `At the end of ${n} ${n === 1 ? 'solve' : 'solves'} · ${longDate(points[session.start].solve.solvedAt)}–${clock(axis.times[session.end])}`
}

/** The legend's choice of window, and of x axis: plain-text pickers. */
function Pick<T extends string | number>({ options, value, onChange, label }: {
  options: readonly (readonly [T, string, string])[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <li className="stats-axis-pick" role="group" aria-label={label}>
      {options.map(([v, text, title]) => (
        <button key={String(v)} className={value === v ? 'active' : undefined} aria-pressed={value === v} title={title} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </li>
  )
}

/** A stretch of time, from `start` up to (not including) `end` (ms), maybe with a label. */
export interface Span {
  start: number
  end: number
  label?: string
  /** Hovered rather than pinned: drawn stronger. */
  hovered?: boolean
  /** A pin's colour slot (0-based): its hue everywhere it shows, and its number. */
  slot?: number
}

/** A pin's colour, for its band, column and header chip (index.css --stats-pin-*). */
const pinStyle = (slot: number | undefined) =>
  (slot === undefined ? undefined : { '--pin': `var(--stats-pin-${slot + 1})` }) as React.CSSProperties | undefined

/** A pin's number in its colour: what ties a column, its band and its chip together. */
function PinBadge({ slot }: { slot: number }) {
  return (
    <span className="stats-pin-badge" style={pinStyle(slot)}>
      {slot + 1}
    </span>
  )
}

/**
 * Where a span of time sits on a timeline chart, as left and right px within the plot;
 * undefined when it's off it. By solve number, it covers the solves done in it; with
 * none, it's zero wide where they would be.
 */
function spanX(axis: Axis, byDate: boolean, x: (v: number) => number, { start, end }: Span, width: number) {
  const left = PAD.left
  const right = width - PAD.right
  let from: number
  let to: number
  if (byDate) {
    from = x(start)
    to = x(end)
  } else {
    const step = (x(axis.x0 + 1) - x(axis.x0)) / 2
    const first = axis.times.findIndex((t) => t >= start)
    const after = axis.times.findIndex((t) => t >= end)
    const last = (after < 0 ? axis.times.length : after) - 1
    if (first < 0 && last < 0) return undefined
    from = first < 0 ? right : x(axis.at(first)) - step
    to = first < 0 || last < first ? from : x(axis.at(last)) + step
  }
  if (to < left || from > right) return undefined
  return { from: Math.max(from, left), to: Math.min(to, right) }
}

/** Rows of labels above the shaded periods, before the rest are left to the header's list. */
const FOCUS_LANES = 4

/** Roughly how wide a focus label is at 11px semibold, in px, with its pin's badge. */
const labelWidth = (text: string, badge: boolean) => text.length * 6.4 + 14 + (badge ? 16 : 0)

/**
 * The periods hovered or pinned on the solves-per chart, each shaded with an edge either
 * side and labelled at the top, in the pin's colour with its number. Labels that would
 * overlap go a row down, so every band says which days it is; the hovered one stands out.
 */
function FocusMarks({ focus, axis, byDate, x, height, width }: {
  focus: readonly Span[]
  axis: Axis
  byDate: boolean
  x: (v: number) => number
  height: number
  width: number
}) {
  const marks = focus
    .flatMap((f) => {
      const at = spanX(axis, byDate, x, f, width)
      return at ? [{ ...f, from: at.from, w: Math.max(2, at.to - at.from) }] : []
    })
    .sort((a, b) => a.from - b.from)
  // Each label's row: the first whose last label it clears.
  const laneEnds: number[] = []
  const labels = marks.map((m) => {
    if (!m.label) return undefined
    const lw = labelWidth(m.label, m.slot !== undefined)
    const left = m.from + lw > width - PAD.right ? m.from + m.w - lw : m.from
    const lane = laneEnds.findIndex((end) => end <= left)
    const row = lane < 0 ? laneEnds.length : lane
    if (row >= FOCUS_LANES) return undefined
    laneEnds[row] = left + lw
    return { left, y: PAD.top + 24 + row * 15 }
  })
  return (
    <g className="stats-focus">
      {marks.map((m) => (
        <g key={m.start} className={m.hovered ? 'hovered' : undefined} style={pinStyle(m.slot)}>
          <rect x={m.from} y={PAD.top} width={m.w} height={height - PAD.top - PAD.bottom} />
          <line x1={m.from} x2={m.from} y1={PAD.top} y2={height - PAD.bottom} />
          <line x1={m.from + m.w} x2={m.from + m.w} y1={PAD.top} y2={height - PAD.bottom} />
        </g>
      ))}
      {marks.map((m, i) => {
        const l = labels[i]
        if (!l) return null
        const badge = m.slot !== undefined
        return (
          <g key={m.start} style={pinStyle(m.slot)}>
            {badge && (
              <>
                <circle className="stats-focus-badge" cx={l.left + 10} cy={l.y - 4} r={6} />
                <text className="stats-focus-badge-text" x={l.left + 10} y={l.y - 4} dy="0.35em" textAnchor="middle">
                  {m.slot! + 1}
                </text>
              </>
            )}
            <text className={'stats-focus-label' + (m.hovered ? ' hovered' : '')} x={l.left + (badge ? 20 : 4)} y={l.y}>
              {m.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/**
 * Milestones on a timeline chart: each a shaded band over its days (a single day too),
 * labelled at the top. By solve number, it covers the solves done on those days; with
 * none, it's a line where they would be.
 */
function MilestoneMarks({
  milestones,
  axis,
  byDate,
  x,
  height,
  width,
}: {
  milestones: readonly Milestone[]
  axis: Axis
  byDate: boolean
  x: (v: number) => number
  height: number
  width: number
}) {
  return (
    <g className="stats-milestones">
      {milestones.map((m) => {
        const end = new Date((m.endDay ?? m.startDay) + 'T00:00')
        end.setDate(end.getDate() + 1)
        const at = spanX(axis, byDate, x, { start: new Date(m.startDay + 'T00:00').getTime(), end: end.getTime() }, width)
        if (!at) return null
        const { from, to } = at
        const days = m.endDay ? `${m.startDay} to ${m.endDay}` : m.startDay
        return (
          <g key={m.id}>
            <title>{`${m.label}: ${days}`}</title>
            <rect className="stats-milestone" x={from} y={PAD.top} width={Math.max(2, to - from)} height={height - PAD.top - PAD.bottom} />
            <line className="stats-milestone-edge" x1={from} x2={from} y1={PAD.top} y2={height - PAD.bottom} />
            <text className="stats-milestone-label" x={from + 4} y={PAD.top + 11}>
              {m.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** The fan's nested bands, outermost (p10–p90) first: every pair of its percentiles but the median. */
const FAN_LAYERS = Array.from({ length: 8 }, (_, k) => k)

/**
 * Your average over the window (12 or 100) as a line, with how those same solves spread
 * around it as a soft fan (densest in the middle, fading out to the middle 80%), every
 * single as a faint dot behind; along the shared x axis. Each can be hidden. Without
 * singles, the chart starts where the curve or fan do. The y axis fits what's shown: the fan, else the curve,
 * else the singles. `from`: where the range starts. `focus`: periods to shade (pinned or
 * hovered on the solves-per chart); `onHover`: the hovered mark's time, or null.
 */
export function ProgressChart({
  points: all,
  from,
  milestones,
  focus,
  onHover,
}: {
  points: readonly Point[]
  from?: number
  milestones: readonly Milestone[]
  focus?: readonly Span[]
  onHover?: (time: number | null) => void
}) {
  const [hover, handlers] = useAxisHover(onHover)
  const settings = useProgressSettings()
  const n = settings.window
  const avgKey = n === 12 ? 'ao12' : 'ao100'
  const byDate = settings.xAxis === 'date'
  const hasCurve = (p: Point) => (settings.curve && isTime(p[avgKey])) || (settings.distribution && !!p.dist[n])
  // Without singles, nothing to show before the window first fills.
  const shownFrom = settings.singles ? 0 : all.findIndex(hasCurve)
  const points = shownFrom < 0 ? [] : all.slice(shownFrom)
  // Singles alone: hover picks a solve, not a session.
  const singlesOnly = !settings.curve && !settings.distribution
  const singles = points.map((p) => p.ms).filter(isTime)
  if (!all.length) return null
  const axis = points.length ? xAxisOf(points, byDate, shownFrom ? undefined : from, singlesOnly) : undefined
  const marks = axis?.marks ?? []
  const fitted = [
    ...(settings.distribution ? marks.flatMap((i) => [points[i].dist[n]?.p10, points[i].dist[n]?.p90]) : []),
    ...(settings.curve ? marks.map((i) => points[i][avgKey]) : []),
  ].filter(isTime)
  const p = hover === null ? undefined : points[hover]
  const pd = p?.dist[n]

  const legend = (
    <ul className="stats-legend">
      <Pick
        label="Window"
        options={[
          [12, 'ao12', 'Your last 12 solves at each point'],
          [100, 'ao100', 'Your last 100 solves at each point'],
        ]}
        value={n}
        onChange={(window) => updateProgressSettings({ window })}
      />
      <li>
        <button
          className={'stats-legend-toggle' + (settings.curve ? '' : ' off')}
          aria-pressed={settings.curve}
          onClick={() => updateProgressSettings({ curve: !settings.curve })}
          title={`${settings.curve ? 'Hide' : 'Show'} the ao${n} line`}
        >
          <svg width="16" height="10" aria-hidden>
            <line x1="1" x2="15" y1="5" y2="5" className="stats-line stats-avg" />
          </svg>
          curve
        </button>
      </li>
      <li>
        <button
          className={'stats-legend-toggle' + (settings.distribution ? '' : ' off')}
          aria-pressed={settings.distribution}
          onClick={() => updateProgressSettings({ distribution: !settings.distribution })}
          title={`${settings.distribution ? 'Hide' : 'Show'} how the same ${n} solves spread: denser where more of them fall, fading out to the middle 80%, and the spread over time`}
        >
          <svg width="14" height="10" aria-hidden>
            {[1, 2, 3, 4].map((k) => (
              <rect key={k} x="1" y={k} width="12" height={10 - 2 * k} className="stats-range-fan stats-range-key" />
            ))}
          </svg>
          distribution
        </button>
      </li>
      <li>
        <button
          className={'stats-legend-toggle' + (settings.singles ? '' : ' off')}
          aria-pressed={settings.singles}
          onClick={() => updateProgressSettings({ singles: !settings.singles })}
          title={settings.singles ? 'Hide the single times' : 'Show the single times'}
        >
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r="3" className="stats-dot" />
          </svg>
          singles
        </button>
      </li>
      <li>
        <button
          className={'stats-legend-toggle' + (settings.windows ? '' : ' off')}
          aria-pressed={settings.windows}
          onClick={() => updateProgressSettings({ windows: !settings.windows })}
          title={(settings.windows ? 'Hide' : 'Show') + ' the solves the window covers, on hover'}
        >
          <svg width="14" height="10" aria-hidden>
            <rect x="1" y="1" width="12" height="8" className="stats-window-key" />
          </svg>
          window
        </button>
      </li>
      {milestones.length > 0 && (
        <li>
          <button
            className={'stats-legend-toggle' + (settings.milestones ? '' : ' off')}
            aria-pressed={settings.milestones}
            onClick={() => updateProgressSettings({ milestones: !settings.milestones })}
            title={`${settings.milestones ? 'Hide' : 'Show'} milestones on the timeline (${milestones.map((m) => m.label).join(', ')})`}
          >
            <svg width="14" height="10" aria-hidden>
              <rect x="1" y="1" width="12" height="8" className="stats-milestone" />
              <line x1="1.5" x2="1.5" y1="1" y2="9" className="stats-milestone-edge" />
            </svg>
            milestones
          </button>
        </li>
      )}
      <li className="stats-legend-sep" aria-hidden>
        ·
      </li>
      <Pick
        label="x axis"
        options={[
          ['date', 'by date', 'Solves where they fall in time'],
          ['solves', 'by solve', 'Solves evenly spaced, in order: sessions get room, breaks vanish'],
        ]}
        value={settings.xAxis}
        onChange={(xAxis) => updateProgressSettings({ xAxis })}
      />
    </ul>
  )

  return (
    <ChartCard title="Progress" legend={legend}>
      {(width) => {
        if (!axis || (!fitted.length && !(settings.singles && singles.length)))
          return <p className="stats-empty stats-plot-empty">{settings.singles ? 'Nothing to show' : `Not enough solves for ao${n} yet`}</p>
        const { at, x0, x1 } = axis
        const { lo, hi, ticks } = fitScale(fitted.length ? fitted : singles)
        const H = PROGRESS_HEIGHT
        const x = linear(x0, x1, PAD.left + 4, width - PAD.right - 4)
        const y = linear(lo, hi, H - PAD.bottom, PAD.top)
        const avg = traceLine(axis, (i) => (settings.curve ? points[i][avgKey] : undefined), x, y)
        const px = p && x(at(hover!))
        // The solves the window at the hovered point covers: a wash and a bracket. One
        // reaching back before the range runs off the left edge.
        const half = byDate ? 1.5 : (x(x0 + 1) - x(x0)) / 2 || 4
        const start = hover === null ? 0 : hover - n + 1
        const covered = p && settings.windows && !singlesOnly && isTime(p[avgKey]) && { left: start >= 0 ? x(at(start)) - half : 0, right: px! + half }
        return (
          <>
            <svg width={width} height={H} role="img" aria-label={`ao${n} with the spread of the same ${n} solves, by ${byDate ? 'date' : 'solve number'}`}>
              <defs>
                <clipPath id="stats-progress-clip">
                  <rect x={PAD.left} y={PAD.top - 4} width={width - PAD.left - PAD.right + 4} height={H - PAD.top - PAD.bottom + 8} />
                </clipPath>
              </defs>
              <YGrid ticks={ticks} y={y} width={width} format={secondsLabel} />
              <XTicks ticks={axis.ticks(width)} x={x} height={H} />
              {settings.milestones && <MilestoneMarks milestones={milestones} axis={axis} byDate={byDate} x={x} height={H} width={width} />}
              {focus && <FocusMarks focus={focus} axis={axis} byDate={byDate} x={x} height={H} width={width} />}
              <g clipPath="url(#stats-progress-clip)">
                {covered && <rect className="stats-window" x={covered.left} y={PAD.top} width={covered.right - covered.left} height={H - PAD.top - PAD.bottom} />}
                {settings.distribution && (
                  <>
                    {/* Nested faint bands, p10–p90 in to p45–p55: they pile up where times are dense, so the spread fades out to its edges. */}
                    {FAN_LAYERS.map((k) => (
                      <path
                        key={k}
                        d={traceBand(axis, (i) => points[i].dist[n]?.fan[k], (i) => points[i].dist[n]?.fan.at(-1 - k), x, y)}
                        className="stats-range-fan"
                      />
                    ))}
                  </>
                )}
                {settings.singles &&
                  points.map((pt, i) => isTime(pt.ms) && <circle key={pt.solve.id} cx={x(at(i))} cy={y(pt.ms)} r={2} className="stats-dot" />)}
                <path d={avg.breaks} className="stats-line stats-break stats-avg" />
                <path d={avg.line} className="stats-line stats-avg" />
              </g>
              {p && (
                <g className="stats-crosshair">
                  <line x1={px} x2={px} y1={PAD.top} y2={H - PAD.bottom} />
                  {covered && (
                    <path className="stats-bracket" d={`M${covered.left},${H - PAD.bottom - 9}V${H - PAD.bottom - 5}H${covered.right}V${H - PAD.bottom - 9}`} />
                  )}
                  {settings.curve && isTime(p[avgKey]) && <circle cx={px} cy={y(p[avgKey]!)} r={4} className="stats-end stats-avg-dot" />}
                  {singlesOnly && isTime(p.ms) && <circle cx={px} cy={y(p.ms)} r={4} className="stats-end stats-avg-dot" />}
                </g>
              )}
              <rect className="stats-hit" x={PAD.left} y={0} width={width - PAD.left - PAD.right} height={H} {...handlers(axis)} />
            </svg>
            {p && (
              <Tooltip x={px!} y={PAD.top + 34} width={width}>
                {settings.curve && (
                  <strong>
                    {formatTime(p[avgKey])} ao{n}
                  </strong>
                )}
                {singlesOnly && <strong>{formatTime(p.ms)}</strong>}
                {pd && settings.distribution && (
                  <span className={settings.curve ? 'stats-tooltip-sub' : undefined}>
                    middle 80% {formatTime(pd.p10)}–{formatTime(pd.p90)} ({formatTime(pd.p90 - pd.p10)} wide) · middle half{' '}
                    {formatTime(pd.p25)}–{formatTime(pd.p75)}
                  </span>
                )}
                <span className="stats-tooltip-sub">
                  {!singlesOnly && `Solves ${Math.max(1, p.n - n + 1)}–${p.n} · `}
                  {markLabel(axis, points, hover!, byDate && !singlesOnly)}
                </span>
              </Tooltip>
            )}
          </>
        )
      }}
    </ChartCard>
  )
}

/**
 * How wide the middle 80% of the window (12 or 100, as on Progress) is at each point:
 * one line, going down as you get more consistent.
 */
export function SpreadOverTimeChart({
  points: all,
  from,
  milestones,
  focus,
  onHover,
}: {
  points: readonly Point[]
  from?: number
  milestones: readonly Milestone[]
  focus?: readonly Span[]
  onHover?: (time: number | null) => void
}) {
  const [hover, handlers] = useAxisHover(onHover)
  const { window: n, xAxis, distribution, milestones: showMilestones } = useProgressSettings()
  const byDate = xAxis === 'date'
  // Starts where the line does: nothing to draw before the window first fills.
  const shownFrom = all.findIndex((p) => !!p.dist[n])
  const points = shownFrom < 0 ? [] : all.slice(shownFrom)
  if (!distribution || !points.length) return null
  const axis = xAxisOf(points, byDate, shownFrom ? undefined : from)
  const { at, x0, x1, marks } = axis
  const spreads = marks.map((i) => spreadOf(points[i], n)).filter(isTime)
  if (!spreads.length) return null
  const ticks = niceTicks(0, Math.max(...spreads) / 1000, 4).map((t) => t * 1000)
  const hi = Math.max(ticks.at(-1)!, ...spreads)
  const p = hover === null ? undefined : points[hover]
  const ps = p && spreadOf(p, n)

  return (
    <ChartCard title={`Spread over time (${n})`}>
      {(width) => {
        const x = linear(x0, x1, PAD.left + 4, width - PAD.right - 4)
        const y = linear(0, hi, HEIGHT - PAD.bottom, PAD.top)
        const line = traceLine(axis, (i) => spreadOf(points[i], n), x, y)
        const px = p && x(at(hover!))
        return (
          <>
            <svg width={width} height={HEIGHT} role="img" aria-label={`How wide the middle 80% of your last ${n} times is, over time`}>
              <YGrid ticks={ticks} y={y} width={width} format={secondsLabel} />
              <XTicks ticks={axis.ticks(width)} x={x} height={HEIGHT} />
              {showMilestones && <MilestoneMarks milestones={milestones} axis={axis} byDate={byDate} x={x} height={HEIGHT} width={width} />}
              {focus && <FocusMarks focus={focus} axis={axis} byDate={byDate} x={x} height={HEIGHT} width={width} />}
              <path d={line.breaks} className="stats-line stats-break stats-avg" />
              <path d={line.line} className="stats-line stats-avg" />
              {p && (
                <g className="stats-crosshair">
                  <line x1={px} x2={px} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
                  {isTime(ps) && <circle cx={px} cy={y(ps)} r={4} className="stats-end stats-avg-dot" />}
                </g>
              )}
              <rect className="stats-hit" x={PAD.left} y={0} width={width - PAD.left - PAD.right} height={HEIGHT} {...handlers(axis)} />
            </svg>
            {p && (
              <Tooltip x={px!} y={PAD.top + 34} width={width}>
                <strong>{formatTime(ps)} wide</strong>
                <span className="stats-tooltip-sub">middle 80% of your last {n}</span>
                <span className="stats-tooltip-sub">{markLabel(axis, points, hover!, byDate)}</span>
              </Tooltip>
            )}
          </>
        )
      }}
    </ChartCard>
  )
}

/** How many columns of a bar chart there are, and where they go. */
function columns(count: number, width: number) {
  const band = (width - PAD.left - PAD.right) / count
  const bar = Math.min(24, Math.max(1, band - 2))
  return { band, bar, left: (i: number) => PAD.left + i * band + (band - bar) / 2 }
}

/**
 * A column chart: one column per item, each with its own hover readout. `highlight`: a
 * column to light up as if hovered (from another chart); `onHover`: the hovered index.
 * With `onPick`, a column can be clicked; `picked` colours the ones that were, by index (their pin slots).
 */
function ColumnChart<T>({
  title,
  legend,
  items,
  value,
  label,
  tick,
  readout,
  ariaLabel,
  highlight,
  onHover,
  picked,
  onPick,
}: {
  title: string
  legend?: ReactNode
  items: readonly T[]
  value: (item: T) => number
  /** The x label under a column (a milestone stands out), or undefined to leave it bare. */
  label: (item: T, i: number, every: number) => string | Omit<Tick, 'value'> | undefined
  /** Room one x label needs, in px. */
  tick: number
  readout: (item: T) => ReactNode
  ariaLabel: string
  highlight?: number
  onHover?: (i: number | null) => void
  picked?: ReadonlyMap<number, number>
  onPick?: (i: number) => void
}) {
  const [hover, setOwnHover] = useState<number | null>(null)
  const setHover = (i: number | null) => {
    setOwnHover(i)
    onHover?.(i)
  }
  if (!items.length) return null
  const max = Math.max(1, ...items.map(value))
  const ticks = niceTicks(0, max, 4).filter((t) => Number.isInteger(t))
  const lit = hover ?? highlight

  return (
    <ChartCard title={title} legend={legend}>
      {(width) => {
        const { band, bar, left } = columns(items.length, width)
        const y = linear(0, Math.max(max, ticks.at(-1)!), HEIGHT - PAD.bottom, PAD.top)
        const every = Math.max(1, Math.ceil(tick / band))
        const base = HEIGHT - PAD.bottom
        const h = hover === null ? undefined : items[hover]
        return (
          <>
            <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
              <YGrid ticks={ticks} y={y} width={width} format={String} />
              <g className="stats-axis">
                {items.map((item, i) => {
                  const l = label(item, i, every)
                  if (l === undefined) return null
                  const { label: text, major } = typeof l === 'string' ? { label: l, major: false } : l
                  return (
                    <g key={i} className={major ? 'major' : undefined}>
                      <text x={left(i) + bar / 2} y={HEIGHT - 8} textAnchor="middle">
                        {text}
                      </text>
                    </g>
                  )
                })}
              </g>
              {items.map((item, i) => (
                <g key={i}>
                  {value(item) > 0 && (
                    <path
                      d={columnPath(left(i), y(value(item)), bar, base)}
                      className={'stats-bar' + (picked?.has(i) ? ' picked' : lit === i ? ' hovered' : '')}
                      style={pinStyle(picked?.get(i))}
                    />
                  )}
                  {picked?.has(i) && (
                    // Its pin's number over it, matching its band and chip beyond colour alone.
                    <g style={pinStyle(picked.get(i))}>
                      <circle className="stats-focus-badge" cx={left(i) + bar / 2} cy={y(value(item)) - 10} r={6} />
                      <text className="stats-focus-badge-text" x={left(i) + bar / 2} y={y(value(item)) - 10} dy="0.35em" textAnchor="middle">
                        {picked.get(i)! + 1}
                      </text>
                    </g>
                  )}
                  <rect
                    className="stats-hit"
                    x={PAD.left + i * band}
                    y={PAD.top}
                    width={band}
                    height={base - PAD.top}
                    style={onPick && { cursor: 'pointer' }}
                    onPointerEnter={() => setHover(i)}
                    onClick={onPick && (() => onPick(i))}
                  />
                </g>
              ))}
            </svg>
            {h !== undefined && (
              <Tooltip x={left(hover!) + bar / 2} y={Math.max(PAD.top + 30, y(value(h)))} width={width}>
                {readout(h)}
              </Tooltip>
            )}
          </>
        )
      }}
    </ChartCard>
  )
}

const solvesLabel = (n: number) => `${n} ${n === 1 ? 'solve' : 'solves'}`

/** How many finished solves took each second of time. */
export function DistributionChart({ bins, total }: { bins: readonly Bin[]; total: number }) {
  return (
    <ColumnChart
      title="Distribution of times"
      items={bins}
      value={(b) => b.count}
      label={(b, i, every) => (i % every === 0 ? `${b.from}s` : undefined)}
      tick={32}
      ariaLabel="How many solves took each second of time"
      readout={(b) => (
        <>
          <strong>{solvesLabel(b.count)}</strong>
          <span className="stats-tooltip-sub">
            {formatMs(b.from * 1000)}–{formatMs(b.from * 1000 + 990)}s · {total ? Math.round((b.count / total) * 100) : 0}%
          </span>
        </>
      )}
    />
  )
}

const PERIOD_NAMES: Record<Period, string> = { day: 'day', week: 'week', month: 'month' }

/** A column's x label: calendar milestones, as on the date axis. */
function bucketLabel(buckets: readonly Bucket[], period: Period, i: number, every: number): string | Omit<Tick, 'value'> | undefined {
  const date = new Date(buckets[i].start)
  if (period === 'month') return i % every === 0 ? { label: monthLabel(date), major: true } : undefined
  if (period === 'week') {
    // The week a month starts in carries the month; the others their Monday, room allowing.
    const last = new Date(buckets[i].end - DAY / 2)
    if (date.getDate() === 1 || last.getMonth() !== date.getMonth()) {
      const first = new Date(last.getFullYear(), last.getMonth(), 1)
      return { label: monthLabel(first), major: true }
    }
    return i % every === 0 ? String(date.getDate()) : undefined
  }
  // Days: month starts, round days between.
  const dates = buckets.map((b) => new Date(b.start))
  const set = daySetFor(dates, Math.ceil(buckets.length / every))
  if (!set.includes(date.getDate())) return undefined
  return dayTick(date, dates.findIndex((e) => set.includes(e.getDate())) === i)
}

/**
 * Solves per day, week or month, quiet ones included. `periods`: the ones to pick from
 * (just days over a short range). Hovering a column reports it (onHover), so the
 * timelines can shade it; `highlight` lights one up from there. Clicking one pins it
 * (onPin, again to unpin): the timelines keep it shaded in its own colour, the column and
 * its chip in the header in the same one, each numbered.
 */
export function SolvesChart({
  buckets,
  period,
  periods,
  onPeriod,
  highlight,
  onHover,
  pinned,
  onPin,
}: {
  buckets: readonly Bucket[]
  period: Period
  periods: readonly Period[]
  onPeriod: (period: Period) => void
  highlight?: number
  onHover?: (i: number | null) => void
  /** The pinned columns (index) and their colour slots, in slot order. */
  pinned: readonly { i: number; slot: number }[]
  /** A column to pin or unpin; null unpins them all. */
  onPin: (i: number | null) => void
}) {
  // Each pin removable on its own, and all at once when there are a few.
  const legend = (
    <ul className="stats-legend">
      {pinned.map(({ i, slot }) => (
        <li key={i}>
          <button className="stats-legend-toggle" onClick={() => onPin(i)} title={`Unpin ${bucketName(buckets[i], period)}`}>
            <PinBadge slot={slot} />
            {bucketShortName(buckets[i], period)} ×
          </button>
        </li>
      ))}
      {pinned.length > 1 && (
        <li>
          <button className="stats-legend-toggle" onClick={() => onPin(null)} title="Unpin them all">
            clear
          </button>
        </li>
      )}
      {pinned.length > 0 && periods.length > 1 && (
        <li className="stats-legend-sep" aria-hidden>
          ·
        </li>
      )}
      {periods.length > 1 && <Pick
        label="Per"
        options={periods.map((p) => [p, PERIOD_NAMES[p], `Solves per ${PERIOD_NAMES[p]}`] as const)}
        value={period}
        onChange={onPeriod}
      />}
    </ul>
  )
  return (
    <ColumnChart
      title={`Solves per ${PERIOD_NAMES[period]}`}
      legend={legend}
      items={buckets}
      value={(b) => b.count}
      label={(_, i, every) => bucketLabel(buckets, period, i, every)}
      tick={period === 'day' ? 44 : 36}
      ariaLabel={`How many solves each ${PERIOD_NAMES[period]}`}
      highlight={highlight}
      onHover={onHover}
      picked={new Map(pinned.map(({ i, slot }) => [i, slot]))}
      onPick={onPin}
      readout={(b) => (
        <>
          <strong>{solvesLabel(b.count)}</strong>
          <span className="stats-tooltip-sub">{bucketName(b, period)}</span>
          {b.count > 0 && (
            <span className="stats-tooltip-sub">
              mean {formatTime(b.mean)} · best {formatTime(b.best)}
            </span>
          )}
          {b.count > 0 && (
            <span className="stats-tooltip-sub">
              ≈ {formatDuration(b.trained.ms)} trained · {b.trained.sessions} {b.trained.sessions === 1 ? 'session' : 'sessions'}
            </span>
          )}
        </>
      )}
    />
  )
}
