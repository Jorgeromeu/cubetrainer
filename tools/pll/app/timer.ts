// The solve timer, started one of two ways (Settings → PLL): a countdown, the time running
// from 0 (when you lift the cube from under the table, so you can't look at the case
// before the timer runs), or hold-to-start, as on csTimer (hold Space until it's ready,
// release to start). Any key stops it. Times are measured against performance.now(), not frames.
import { useEffect, useRef, useState } from 'react'

/** How long Space must be held before releasing it starts the timer. */
export const HOLD_MS = 300

export type TimerPhase =
  | { kind: 'idle' }
  /** Space held since `since`: ready once held HOLD_MS. */
  | { kind: 'holding'; since: number }
  /** Counting down while now < zeroAt, then running. */
  | { kind: 'timing'; zeroAt: number }

/** The countdown's sounds: a tick each second, a higher beep at 0. Stopped if cancelled. */
let audio: AudioContext | undefined
let scheduled: OscillatorNode[] = []

function playCountdown(seconds: number) {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    return // no Web Audio: silent
  }
  const t0 = audio.currentTime
  scheduled = Array.from({ length: seconds + 1 }, (_, i) => {
    const at = t0 + i
    const zero = i === seconds
    const osc = audio!.createOscillator()
    const gain = audio!.createGain()
    osc.frequency.value = zero ? 1320 : 660
    gain.gain.setValueAtTime(zero ? 0.25 : 0.12, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + (zero ? 0.25 : 0.08))
    osc.connect(gain).connect(audio!.destination)
    osc.start(at)
    osc.stop(at + 0.3)
    return osc
  })
}

function stopSounds() {
  for (const osc of scheduled) {
    try {
      osc.stop()
    } catch {
      // already stopped
    }
  }
  scheduled = []
}

/**
 * The timer's phase and the current time (updated every frame while not idle). `stop`
 * returns the solve's milliseconds, or undefined if it's still counting down.
 */
export function useSolveTimer() {
  const [phase, setPhaseState] = useState<TimerPhase>({ kind: 'idle' })
  const [now, setNow] = useState(() => performance.now())
  // The phase as of the last event, for stop() to read synchronously (the state lags a render).
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
    start(seconds: number, sound: boolean) {
      stopSounds()
      if (sound) playCountdown(seconds)
      const t = performance.now()
      setNow(t)
      setPhase({ kind: 'timing', zeroAt: t + seconds * 1000 })
    },
    /** Hold-to-start: Space (or the pointer) went down. */
    hold() {
      const t = performance.now()
      setNow(t)
      setPhase({ kind: 'holding', since: t })
    },
    /** Hold-to-start: released. Starts the timer if it was held long enough, else back to idle. */
    release() {
      const p = phaseRef.current
      if (p.kind !== 'holding') return
      const t = performance.now()
      setPhase(t - p.since >= HOLD_MS ? { kind: 'timing', zeroAt: t } : { kind: 'idle' })
    },
    stop(): number | undefined {
      const p = phaseRef.current
      const t = performance.now()
      if (p.kind !== 'timing' || t < p.zeroAt) return undefined
      setPhase({ kind: 'idle' })
      return t - p.zeroAt
    },
    cancel() {
      stopSounds()
      setPhase({ kind: 'idle' })
    },
  }
}
