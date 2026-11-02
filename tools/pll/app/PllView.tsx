// The PLL tool: a scramble for a random case out of the ones selected, timed without
// inspection. You scramble under the table, press Space, and a countdown runs; at 0 the
// timer starts and you lift the cube, recognise, solve, and press any key. Or, as an
// option, hold Space and release to start (timer.ts). The time is
// saved for that case (solves.ts), the case is revealed and the next scramble comes up.
// ← goes back through the scrambles dealt this session; R reveals a scramble's case.
import { useCallback, useEffect, useState } from 'react'
import { useDealt, type Draw } from '../../../packages/ui/drill/dealt.ts'
import { DrillNav } from '../../../packages/ui/drill/DrillNav.tsx'
import { ServerNotice } from '../../../packages/ui/ServerNotice.tsx'
import { isControl, isTextField, NEXT_KEYS, PREV_KEYS } from '../../../packages/ui/drill/keys.ts'
import { useStealth } from '../../../packages/ui/stealth.ts'
import { pllCases, pllCasesById, type PllCase } from './catalog.ts'
import { PllIcon } from '../../../packages/ui/icons/PllIcon.tsx'
import { Notation } from '../../../packages/ui/notation/Notation.tsx'
import { nextScramble, type PllScramble } from './scramble.ts'
import { usePllSelection } from './selection.ts'
import { usePllSettings } from './settings.ts'
import { PllCases } from './PllCases.tsx'
import { PenaltyButtons, SolveList, StatsLine } from './PllSolves.tsx'
import { addSolve, deleteSolve, formatMs, formatSolve, formatTime, setPenalty, statsByCase, statsOf, useSolves, type Solve } from './solves.ts'
import { HOLD_MS, useSolveTimer } from './timer.ts'

/** A case named, with its icon: what a scramble was. */
function CaseReveal({ pll }: { pll: PllCase }) {
  return (
    <div className="pll-reveal" data-reveal title={pll.algs[0]}>
      <PllIcon pll={pll} size={44} />
      <span>{pll.name}</span>
    </div>
  )
}

/** Top bar content: what this is and how many cases are in play. */
export function PllCrumb() {
  const selection = usePllSelection()
  return (
    <nav className="crumb">
      <h1>Scramble trainer</h1>
      <span className="tag">
        {selection.size} of {pllCases.length} cases
      </span>
    </nav>
  )
}

/** A scramble dealt this session: whether its case was revealed, and its solve if timed. */
interface Dealt {
  scramble: PllScramble
  revealed?: boolean
  solveId?: string
}

/** Draws a scramble for one of the selected cases (a different one from the last, if possible). */
const drawFrom =
  (cases: ReadonlySet<string>): Draw<Dealt> =>
  (previous) => {
    const scramble = nextScramble(pllCases.filter((c) => cases.has(c.id)), previous?.scramble)
    return scramble && { scramble }
  }

export function PllView() {
  const selection = usePllSelection()
  const history = useDealt(drawFrom(selection))
  const { entry, pos, atEnd, deal, prev } = history
  const current = entry?.scramble
  const stealth = useStealth()
  const { start: startMode, countdown, sound } = usePllSettings()
  const timer = useSolveTimer()
  const { solves, load, error } = useSolves()
  const stats = statsByCase(solves)
  const overall = statsOf(solves)
  const solveById = (id: string | undefined) => (id ? solves.find((s) => s.id === id) : undefined)
  // The solve shown under the timer, case revealed: this scramble's if it was timed, else
  // (on the newest scramble) the last one timed. Gone if removed.
  const [lastId, setLastId] = useState<string>()
  const shown: Solve | undefined = solveById(entry?.solveId) ?? (atEnd ? solveById(lastId) : undefined)
  const timing = timer.phase.kind === 'timing'
  const holding = timer.phase.kind === 'holding'

  /** Forward through the history, or a new scramble at its end. Clears the last result. */
  const historyNext = history.next
  const next = useCallback(() => {
    setLastId(undefined)
    historyNext(drawFrom(selection))
  }, [historyNext, selection])

  const historyUpdate = history.update
  const reveal = useCallback(() => historyUpdate((e) => ({ ...e, revealed: !e.revealed })), [historyUpdate])

  const start = useCallback(() => {
    if (!current) return
    if (startMode === 'hold') timer.hold()
    else timer.start(countdown, sound && !stealth)
  }, [current, timer, startMode, countdown, sound, stealth])

  /** Stops the timer, saves the time on this scramble and deals a new one. */
  const stop = useCallback(() => {
    const ms = timer.stop()
    if (ms === undefined || !current) return
    const { id } = addSolve(current.caseId, ms, current.moves)
    setLastId(id)
    deal(drawFrom(selection), (dealt) => dealt.with(pos, { ...dealt[pos], solveId: id }))
  }, [timer, current, deal, selection, pos])

  // Deselecting the current case (or selecting some after having none) deals a new one.
  const reconcile = (selection: ReadonlySet<string>) => {
    if (current ? !selection.has(current.caseId) : selection.size) deal(drawFrom(selection))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (timing) {
        // Any key stops the timer (Esc throws the solve away); nothing else reacts meanwhile.
        e.preventDefault()
        if (e.repeat) return
        if (e.key === 'Escape') timer.cancel()
        else stop()
        return
      }
      if (holding) {
        e.preventDefault()
        if (e.key === 'Escape') timer.cancel()
        return
      }
      if (isTextField(e.target)) return
      if (e.key === ' ') {
        // Space starts the countdown even with a button focused (Enter still clicks it).
        e.preventDefault()
        if (!e.repeat) start()
      } else if (e.key === 'Backspace' && shown) {
        e.preventDefault()
        deleteSolve(shown.id)
      } else if (isControl(e.target)) {
        return
      } else if (NEXT_KEYS.includes(e.key)) {
        e.preventDefault()
        next()
      } else if (PREV_KEYS.includes(e.key)) {
        e.preventDefault()
        prev()
      } else if ((e.key === '2' || e.key === 'd') && shown) {
        // Toggle a penalty on the solve shown, as timers do.
        e.preventDefault()
        const penalty = e.key === '2' ? '+2' : 'dnf'
        setPenalty(shown.id, shown.penalty === penalty ? 'ok' : penalty)
      } else if (e.key === 'r') {
        e.preventDefault()
        reveal()
      }
    }
    // Hold-to-start: releasing Space (or the pointer) starts the timer if it was held long enough.
    const onKeyUp = (e: KeyboardEvent) => e.key === ' ' && timer.release()
    const onPointerUp = () => timer.release()
    addEventListener('keydown', onKey)
    addEventListener('keyup', onKeyUp)
    addEventListener('pointerup', onPointerUp)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('keyup', onKeyUp)
      removeEventListener('pointerup', onPointerUp)
    }
  }, [timing, holding, timer, start, stop, next, prev, reveal, shown])

  const remaining = timing ? (timer.phase as { zeroAt: number }).zeroAt - timer.now : 0
  const counting = timing && remaining > 0
  const ready = holding && timer.now - (timer.phase as { since: number }).since >= HOLD_MS
  const shownCase = shown && pllCasesById.get(shown.caseId)
  const shownStats = shown && stats.get(shown.caseId)
  // This scramble's case, when asked for (a timed one shows it with its time instead).
  const revealedCase = current && entry.revealed && !solveById(entry.solveId) ? pllCasesById.get(current.caseId) : undefined
  const idle = !timing && !holding

  return (
    <main className="pll">
      <section className={'drill' + (timing ? ' timing' : '')}>
        {current ? (
          <>
            <div className="drill-moves" aria-live="polite">
              <Notation moves={current.moves} />
            </div>

            <div className="pll-stage">
              <button
                className={
                  'pll-timer' +
                  (counting ? ' counting' : '') +
                  (holding ? (ready ? ' ready' : ' holding') : '') +
                  (idle && shown?.penalty === 'dnf' ? ' dnf' : '') +
                  (idle && !shown ? ' blank' : '')
                }
                // Pointer down, not click: stopping must not wait for the release.
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  if (timing) stop()
                  else start()
                }}
                aria-label={timing ? 'Stop the timer' : startMode === 'hold' ? 'Hold, then release to start' : 'Start the countdown'}
              >
                {counting
                  ? Math.ceil(remaining / 1000)
                  : timing
                    ? formatMs(-remaining)
                    : shown && !holding
                      ? formatSolve(shown)
                      : '0.00'}
              </button>

              <p className="pll-status">
                {counting
                  ? 'Lift the cube at 0 · Esc cancels'
                  : holding
                    ? ready
                      ? 'Release to start'
                      : 'Keep holding…'
                    : timing
                      ? 'Any key stops · Esc throws it away'
                      : shown
                        ? null
                        : startMode === 'hold'
                          ? 'Hold Space to start'
                          : `Space: ${countdown}s countdown, then the timer`}
              </p>

              {idle && shown && (
                <div className="pll-result">
                  <div className="pll-result-main">
                    {shownCase && <CaseReveal pll={shownCase} />}
                    <PenaltyButtons solve={shown} />
                    <button className="link-button" onClick={() => deleteSolve(shown.id)} title="Backspace">
                      Remove
                    </button>
                  </div>
                  {shownStats && <StatsLine stats={shownStats} compact />}
                </div>
              )}
              {idle && revealedCase && (
                <div className="pll-result">
                  <div className="pll-result-main">
                    <CaseReveal pll={revealedCase} />
                  </div>
                  {stats.get(revealedCase.id) && <StatsLine stats={stats.get(revealedCase.id)!} compact />}
                </div>
              )}
            </div>

            <div className="drill-controls">
              <DrillNav noun="scramble" onPrev={prev} onNext={next} canPrev={pos > 0} disabled={!idle}>
                {!solveById(entry.solveId) && (
                  <button className="link-button" onClick={reveal} disabled={!idle} title="R">
                    {entry.revealed ? 'Hide case' : 'Show case'}
                  </button>
                )}
              </DrillNav>
              {solves.length > 0 && (
                <div className="pll-overall" title="All solves">
                  <span>ao5</span> <b>{formatTime(overall.ao5)}</b>
                  <span>ao12</span> <b>{formatTime(overall.ao12)}</b>
                  {overall.ao100 !== undefined && (
                    <>
                      <span>ao100</span> <b>{formatTime(overall.ao100)}</b>
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="drill-keys">
              <kbd>Space</kbd> {startMode === 'hold' ? 'hold to start' : 'start'} <kbd>←</kbd>
              <kbd>→</kbd> scrambles <kbd>R</kbd> show case <kbd>2</kbd> +2 <kbd>D</kbd> DNF <kbd>⌫</kbd> remove
            </p>
          </>
        ) : (
          <p className="drill-empty">Select at least one case to get scrambles.</p>
        )}
      </section>

      <PllCases key={String(stealth)} stats={stats} open={!stealth} onSelect={reconcile} />

      <SolveList solves={solves} />

      <ServerNotice load={load} error={error} offline="No server · times not saved yet" />
    </main>
  )
}
