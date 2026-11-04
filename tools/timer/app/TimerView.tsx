// The timer page: a random-state scramble, the time (hold Space, release to start, any key
// to stop), the last solve's penalty, the current averages and your latest solves. Every
// solve, timed here or imported, is one list (solves.ts), so the stats page has them all.
import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { randomScrambleForEvent } from 'cubing/scramble'
import { averageOf, formatMs, formatSolve, formatTime, type Penalty } from '../../../packages/core/solve.ts'
import { Notation } from '../../../packages/ui/notation/Notation.tsx'
import { isTextField } from '../../../packages/ui/keys.ts'
import { ServerNotice } from '../../../packages/ui/ServerNotice.tsx'
import { TIMER_SOURCE } from '../contract.ts'
import { addSolve, deleteSolve, setPenalty, useSolves, type Solve } from './solves.ts'
import { SOURCE_NAMES } from './sources.ts'
import { HOLD_MS, useTimer } from './useTimer.ts'

/** How many of the latest solves are listed. */
const RECENT = 12

/** A random-state 3x3 scramble, and the next one already being worked out. */
function useScramble() {
  const [scramble, setScramble] = useState<string>()
  const [next, setNext] = useState<Promise<string>>(() => newScramble())
  useEffect(() => {
    let live = true
    void next.then((s) => live && setScramble(s))
    return () => {
      live = false
    }
  }, [next])
  const advance = useCallback(() => {
    setScramble(undefined)
    setNext(newScramble())
  }, [])
  return { scramble, advance }
}

// Worked out in cubing.js's worker (app/vite.config.ts says what it needs from the build).
const newScramble = async () => (await randomScrambleForEvent('333')).toString()

export function TimerView() {
  const { load, solves, error, unsaved } = useSolves()
  const timer = useTimer()
  const { scramble, advance } = useScramble()
  /** The solve just timed, for its penalty buttons (until the next one starts). */
  const [lastId, setLastId] = useState<string>()
  const last = solves.find((s) => s.id === lastId)

  const finish = () => {
    const ms = timer.stop()
    if (ms === undefined) return
    setLastId(addSolve(ms, scramble ?? '').id)
    advance()
  }

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || isTextField(e.target)) return
    if (timer.phase.kind === 'running') {
      e.preventDefault()
      return finish()
    }
    if (e.key === ' ') {
      e.preventDefault()
      if (!e.repeat) timer.hold()
    } else if (e.key === 'Escape') timer.cancel()
  })
  const onKeyUp = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === ' ') timer.release()
  })
  useEffect(() => {
    addEventListener('keydown', onKeyDown)
    addEventListener('keyup', onKeyUp)
    return () => {
      removeEventListener('keydown', onKeyDown)
      removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const { phase, now } = timer
  const running = phase.kind === 'running'
  const ready = phase.kind === 'holding' && now - phase.since >= HOLD_MS
  const shown = running ? now - phase.since : last ? undefined : 0
  const recent = solves.slice(-RECENT).reverse()

  return (
    <div className={'timer' + (running ? ' running' : '')}>
      <div className="timer-scramble" aria-live="polite">
        {scramble ? <Notation moves={scramble} /> : <span className="muted">Scrambling…</span>}
        {!running && (
          <button className="timer-next" onClick={advance} title="Another scramble">
            Next
          </button>
        )}
      </div>

      <button
        className={'timer-time' + (ready ? ' ready' : phase.kind === 'holding' ? ' holding' : '')}
        onPointerDown={(e) => {
          e.preventDefault()
          if (running) finish()
          else timer.hold()
        }}
        onPointerUp={() => timer.release()}
        onPointerCancel={() => timer.cancel()}
        aria-label="Timer: hold Space (or press here), release to start; any key stops it"
      >
        {shown !== undefined ? formatMs(shown) : last ? formatSolve(last) : '0.00'}
      </button>

      {!running && (
        <>
          <p className="timer-hint muted">
            Hold <kbd>Space</kbd>, release to start · any key stops
          </p>
          {last && <LastSolve solve={last} unsaved={unsaved.has(last.id)} onDeleted={() => setLastId(undefined)} />}
          <Averages solves={solves} />
          {recent.length > 0 && <Recent solves={recent} />}
        </>
      )}
      <ServerNotice load={load} error={error} offline="No server · solves kept here until it's back" />
    </div>
  )
}

const PENALTY_LABELS: [Penalty, string][] = [
  ['ok', 'OK'],
  ['+2', '+2'],
  ['dnf', 'DNF'],
]

function LastSolve({ solve, unsaved, onDeleted }: { solve: Solve; unsaved: boolean; onDeleted: () => void }) {
  return (
    <div className="timer-last">
      <div className="speed" role="group" aria-label="Penalty">
        {PENALTY_LABELS.map(([p, label]) => (
          <button key={p} className={solve.penalty === p ? 'active' : undefined} aria-pressed={solve.penalty === p} onClick={() => setPenalty(solve.id, p)}>
            {label}
          </button>
        ))}
      </div>
      <button
        className="timer-delete"
        onClick={() => {
          void deleteSolve(solve.id)
          onDeleted()
        }}
      >
        Delete
      </button>
      {unsaved && <span className="muted">not saved yet</span>}
    </div>
  )
}

function Averages({ solves }: { solves: readonly Solve[] }) {
  return (
    <dl className="timer-averages">
      {[5, 12, 100].map((n) => (
        <div key={n}>
          <dt>ao{n}</dt>
          <dd>{formatTime(averageOf(solves, n))}</dd>
        </div>
      ))}
    </dl>
  )
}

function Recent({ solves }: { solves: readonly Solve[] }) {
  return (
    <section className="timer-recent">
      <h2>Latest</h2>
      <ol>
        {solves.map((s) => (
          <li key={s.id}>
            <span className="timer-recent-time">{formatSolve(s)}</span>
            <span className="muted">
              {new Date(s.solvedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            {s.source !== TIMER_SOURCE && <span className="timer-source">{SOURCE_NAMES[s.source] ?? s.source}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
