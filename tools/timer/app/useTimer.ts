// The solve timer, hold-to-start as on csTimer: hold Space (or press on the time) until
// it's ready, release to start; any key (or a press) stops it. Times are measured with
// performance.now(), not frames.
import { useEffect, useRef, useState } from 'react'

/** How long Space must be held before releasing it starts the timer. */
export const HOLD_MS = 300

export type TimerPhase =
  | { kind: 'idle' }
  /** Held since `since`: ready once held HOLD_MS. */
  | { kind: 'holding'; since: number }
  | { kind: 'running'; since: number }

/**
 * The timer's phase and the current time (updated every frame while holding or running).
 * `stop` returns the solve's milliseconds, or undefined if it wasn't running.
 */
export function useTimer() {
  const [phase, setPhaseState] = useState<TimerPhase>({ kind: 'idle' })
  const [now, setNow] = useState(() => performance.now())
  // The phase as of the last event, for the handlers to read synchronously (state lags a render).
  const phaseRef = useRef(phase)
  const setPhase = (p: TimerPhase) => {
    phaseRef.current = p
    setPhaseState(p)
  }

  useEffect(() => {
    if (phase.kind === 'idle') return
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [phase])

  return {
    phase,
    now,
    /** Space (or the pointer) went down while idle. */
    hold() {
      if (phaseRef.current.kind !== 'idle') return
      const t = performance.now()
      setNow(t)
      setPhase({ kind: 'holding', since: t })
    },
    /** Released: starts the timer if it was held long enough, else back to idle. */
    release() {
      const p = phaseRef.current
      if (p.kind !== 'holding') return
      const t = performance.now()
      setPhase(t - p.since >= HOLD_MS ? { kind: 'running', since: t } : { kind: 'idle' })
    },
    stop(): number | undefined {
      const p = phaseRef.current
      if (p.kind !== 'running') return undefined
      setPhase({ kind: 'idle' })
      return performance.now() - p.since
    },
    cancel() {
      setPhase({ kind: 'idle' })
    },
  }
}
