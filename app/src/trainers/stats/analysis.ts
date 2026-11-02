// What the charts show, worked out from the solves (oldest first): each solve with its
// running averages and spread, sessions, the spread of times, and solves per day, week or month.
import { averageOf, effectiveMs } from '../../common/solveTime.ts'
import type { Solve } from './solves.ts'

/** A solve with where it stood: its number and the averages ending on it. */
export interface Point {
  /** 1-based, over all solves. */
  n: number
  solve: Solve
  /** Effective time (Infinity for a DNF). */
  ms: number
  ao5?: number
  ao12?: number
  ao100?: number
  /** How the last 12 and last 100 times (this one included) spread; undefined before there are that many. */
  dist: Record<Window, Dist | undefined>
  /** Local calendar day, "2026-10-19". */
  day: string
}

/** The windows the averages and spreads are over. */
export const WINDOWS = [12, 100] as const
export type Window = (typeof WINDOWS)[number]

/**
 * How a window's times spread, as percentiles. Between p10 and p90 is the middle 80%,
 * between p25 and p75 the middle half; the narrower, the more consistent.
 */
export interface Dist {
  p10: number
  p25: number
  p75: number
  p90: number
  /** Every FAN_STEP-th percentile from p10 to p90, for drawing the spread as a gradient. */
  fan: number[]
}

/** The gap between the fan's percentiles: p10, p15, … p90. */
const FAN_STEP = 0.05

/** Solves less than this apart are one session. */
export const SESSION_GAP_MS = 45 * 60_000

/** Runs of solves with no pause of SESSION_GAP_MS, as first and last index. */
export function sessionsOf(times: readonly number[]): { start: number; end: number }[] {
  const sessions: { start: number; end: number }[] = []
  times.forEach((t, i) => {
    const last = sessions.at(-1)
    if (last && t - times[i - 1] < SESSION_GAP_MS) last.end = i
    else sessions.push({ start: i, end: i })
  })
  return sessions
}

/** The most of a pause between solves (in a session) that counts as practice: scrambling, inspecting; the rest was something else. */
export const PAUSE_CAP_MS = 2 * 60_000

/** How long some solves (oldest first) kept you practising. */
export interface Training {
  /** The solving, plus each pause between solves in a session up to PAUSE_CAP_MS (ms). */
  ms: number
  sessions: number
  /** Of that, the time on the clock (ms). */
  solving: number
}

/**
 * The time practised over some solves: every solve's time, plus the pause before it (from
 * the last solve's end, as solvedAt is when a solve ended) up to PAUSE_CAP_MS, unless that
 * pause starts a new session (SESSION_GAP_MS).
 */
export function trainingOf(points: readonly Point[]): Training {
  const ends = points.map((p) => new Date(p.solve.solvedAt).getTime())
  const solving = points.reduce((sum, p) => sum + p.solve.ms, 0)
  const pauses = points.reduce((sum, p, i) => {
    if (!i || ends[i] - ends[i - 1] >= SESSION_GAP_MS) return sum
    return sum + Math.min(PAUSE_CAP_MS, Math.max(0, ends[i] - p.solve.ms - ends[i - 1]))
  }, 0)
  return { ms: solving + pauses, sessions: sessionsOf(ends).length, solving }
}

/** A stretch of practice, to the minute: "24h 10m", "35m". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  const h = Math.floor(minutes / 60)
  return h ? `${h}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

/** The p-th percentile (0–1) of sorted values, interpolated. */
function percentile(sorted: readonly number[], p: number): number {
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (i - lo)
}

/** The averages tracked per solve. */
export const AVERAGES = [5, 12, 100] as const

/** "2026-10-19" in local time. */
export const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA')

/**
 * Every solve with its running averages and spread (over all solves before it, not just
 * a range). DNFs count as the slowest in the spread.
 */
export function pointsOf(solves: readonly Solve[]): Point[] {
  return solves.map((solve, i) => {
    const upTo = solves.slice(Math.max(0, i + 1 - 100), i + 1)
    const distOf = (n: Window): Dist | undefined => {
      if (upTo.length < n) return undefined
      const sorted = upTo.slice(-n).map(effectiveMs).sort((a, b) => a - b)
      const fan = Array.from({ length: Math.round(0.8 / FAN_STEP) + 1 }, (_, k) => percentile(sorted, 0.1 + k * FAN_STEP))
      return { p10: percentile(sorted, 0.1), p25: percentile(sorted, 0.25), p75: percentile(sorted, 0.75), p90: percentile(sorted, 0.9), fan }
    }
    return {
      n: i + 1,
      solve,
      ms: effectiveMs(solve),
      ao5: averageOf(upTo, 5),
      ao12: averageOf(upTo, 12),
      ao100: averageOf(upTo, 100),
      dist: { 12: distOf(12), 100: distOf(100) },
      day: dayOf(solve.solvedAt),
    }
  })
}

/** How wide the middle 80% of a window's times is, in ms; undefined before it's full. */
export const spreadOf = (p: Point, n: Window = 100) => {
  const d = p.dist[n]
  return d && d.p90 - d.p10
}

const finite = (xs: (number | undefined)[]) => xs.filter((x): x is number => x !== undefined && Number.isFinite(x))
const minOf = (xs: (number | undefined)[]) => (finite(xs).length ? Math.min(...finite(xs)) : undefined)

export interface Summary {
  count: number
  dnfs: number
  days: number
  best?: number
  mean?: number
  median?: number
  /** The latest averages, and the best ones within the points. */
  current: Record<(typeof AVERAGES)[number], number | undefined>
  bestAvg: Record<(typeof AVERAGES)[number], number | undefined>
  latest?: Point
  /** Middle 80% of the last 100, now and at its narrowest in the points (ms). */
  spread?: number
  narrowestSpread?: number
  trained: Training
}

export function summaryOf(points: readonly Point[]): Summary {
  const times = finite(points.map((p) => p.ms)).sort((a, b) => a - b)
  const latest = points.at(-1)
  return {
    count: points.length,
    dnfs: points.length - times.length,
    days: new Set(points.map((p) => p.day)).size,
    best: times[0],
    mean: times.length ? times.reduce((a, b) => a + b, 0) / times.length : undefined,
    median: times.length ? times[Math.floor((times.length - 1) / 2)] : undefined,
    current: { 5: latest?.ao5, 12: latest?.ao12, 100: latest?.ao100 },
    bestAvg: { 5: minOf(points.map((p) => p.ao5)), 12: minOf(points.map((p) => p.ao12)), 100: minOf(points.map((p) => p.ao100)) },
    latest,
    spread: latest && spreadOf(latest),
    narrowestSpread: minOf(points.map((p) => spreadOf(p))),
    trained: trainingOf(points),
  }
}

/** A one-second bucket of the spread: times from `from` up to (not including) `from` + 1s. */
export interface Bin {
  /** Whole seconds. */
  from: number
  count: number
}

/** Finished solves per second of time, every second from the fastest to the slowest. */
export function histogramOf(points: readonly Point[]): Bin[] {
  const secs = finite(points.map((p) => p.ms)).map((ms) => Math.floor(ms / 1000))
  if (!secs.length) return []
  const lo = Math.min(...secs)
  const bins: Bin[] = Array.from({ length: Math.max(...secs) - lo + 1 }, (_, i) => ({ from: lo + i, count: 0 }))
  for (const s of secs) bins[s - lo].count++
  return bins
}

/** What the solves-per chart counts by. */
export type Period = 'day' | 'week' | 'month'

/** A day, week (Monday on) or calendar month, and the solves in it. */
export interface Bucket {
  /** Local midnight it starts at, and the next one's (ms). */
  start: number
  end: number
  count: number
  best?: number
  mean?: number
  /** A session running past midnight counts in each period it reaches, up to its last solve there. */
  trained: Training
}

/** The local midnight starting the period that `day` ("2026-10-19") is in. */
function periodStart(day: string, period: Period): Date {
  const d = new Date(day + 'T00:00')
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  if (period === 'month') d.setDate(1)
  return d
}

/** The local midnight starting the period after the one starting at `d`. */
function nextStart(d: Date, period: Period): Date {
  const next = new Date(d)
  if (period === 'month') next.setMonth(next.getMonth() + 1)
  else next.setDate(next.getDate() + (period === 'week' ? 7 : 1))
  return next
}

/**
 * Every period from `from` (or the first solve) to today (or, for all time, the last
 * solve), with or without solves.
 */
export function bucketsOf(points: readonly Point[], period: Period, from?: number): Bucket[] {
  if (!points.length) return []
  const byStart = new Map<number, Point[]>()
  for (const p of points) {
    const start = periodStart(p.day, period).getTime()
    byStart.set(start, [...(byStart.get(start) ?? []), p])
  }
  const first = from === undefined ? points[0].day : new Date(from).toLocaleDateString('en-CA')
  const last = from === undefined ? points.at(-1)!.day : dayOf(new Date().toISOString())
  const end = nextStart(periodStart(last, period), period).getTime()
  const buckets: Bucket[] = []
  for (let d = periodStart(first, period); d.getTime() < end; d = nextStart(d, period)) {
    const inIt = byStart.get(d.getTime()) ?? []
    const times = inIt.map((p) => p.ms)
    const done = finite(times)
    buckets.push({
      start: d.getTime(),
      end: nextStart(d, period).getTime(),
      count: times.length,
      best: minOf(done),
      mean: done.length ? done.reduce((a, b) => a + b, 0) / done.length : undefined,
      trained: trainingOf(inIt),
    })
  }
  return buckets
}

const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** What a column is, for its readout and the timelines' label: "Tue, Oct 14", "Oct 13 – Oct 19", "October 2026". */
export function bucketName({ start, end }: Bucket, period: Period) {
  const date = new Date(start)
  if (period === 'day') return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  if (period === 'month') return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return `${shortDate(date)} – ${shortDate(new Date(end - 12 * 3_600_000))}`
}

/** A column's short name, for labelling its band on the timelines: "Oct 14", "Sep 7–13", "Sep". */
export function bucketShortName({ start, end }: Bucket, period: Period) {
  const date = new Date(start)
  if (period === 'month') return date.toLocaleDateString(undefined, { month: 'short' })
  if (period === 'day') return shortDate(date)
  const last = new Date(end - 12 * 3_600_000)
  return last.getMonth() === date.getMonth() ? `${shortDate(date)}–${last.getDate()}` : `${shortDate(date)} – ${shortDate(last)}`
}

/** The ranges the page can be narrowed to, in days (undefined: all). */
export const RANGES = [
  { label: 'All time', days: undefined },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 7 days', days: 7 },
] as const

/** Local midnight starting the last `days` days (today included); undefined for all time. */
export function rangeStart(days: number | undefined): number | undefined {
  if (days === undefined) return undefined
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - days + 1)
  return from.getTime()
}

/** The points within the last `days` days, counted back from today. */
export function inRange(points: readonly Point[], days: number | undefined): Point[] {
  const from = rangeStart(days)
  if (from === undefined) return [...points]
  const since = new Date(from).toLocaleDateString('en-CA')
  return points.filter((p) => p.day >= since)
}
