// Timer maths shared by trainers that keep solves: penalties, WCA-style averages and how
// times are written.

/** What these need of a solve: its time as timed and its penalty. */
export interface TimedSolve {
  ms: number
  penalty: 'ok' | '+2' | 'dnf'
}

/** A solve's time with its penalty: +2 adds 2 seconds, a DNF is Infinity (worse than any time). */
export const effectiveMs = (s: TimedSolve) => (s.penalty === 'dnf' ? Infinity : s.penalty === '+2' ? s.ms + 2000 : s.ms)

/**
 * The WCA-style average of the last `n` solves (ao5, ao12): the best and worst are dropped
 * (5% each end, at least one) and the rest averaged. DNFs count as the worst, so one is
 * dropped; more than that and the average is a DNF (Infinity). Undefined with fewer than n.
 */
export function averageOf(solves: readonly TimedSolve[], n: number): number | undefined {
  if (solves.length < n) return undefined
  const trim = Math.max(1, Math.ceil(n * 0.05))
  const kept = solves.slice(-n).map(effectiveMs).sort((a, b) => a - b).slice(trim, n - trim)
  return kept.reduce((a, b) => a + b, 0) / kept.length
}

/** A solve as timers write it: "1.23", "3.23+" for a +2 (the 2s included), "DNF". */
export const formatSolve = (s: TimedSolve) =>
  s.penalty === 'dnf' ? 'DNF' : s.penalty === '+2' ? formatMs(s.ms + 2000) + '+' : formatMs(s.ms)

/** A time or average; Infinity is a DNF, undefined not enough solves yet. */
export const formatTime = (ms: number | undefined) => (ms === undefined ? '–' : ms === Infinity ? 'DNF' : formatMs(ms))

/** 1234 → "1.23" (seconds, hundredths); a minute or more → "1:02.34". */
export function formatMs(ms: number): string {
  const hundredths = Math.floor(ms / 10)
  const seconds = Math.floor(hundredths / 100)
  const frac = String(hundredths % 100).padStart(2, '0')
  if (seconds < 60) return `${seconds}.${frac}`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${frac}`
}
