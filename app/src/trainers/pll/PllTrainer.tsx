// The PLL trainer (v0): a scramble for a random case out of the ones selected, and Next
// for another. No timing.
import { useCallback, useEffect, useState } from 'react'
import { useStealth } from '../../common/stealth.ts'
import { pllCases, pllGroups } from './catalog.ts'
import { PllIcon } from './PllIcon.tsx'
import { Notation } from '../../common/notation/Notation.tsx'
import { nextScramble } from './scramble.ts'
import { setPllSelection, togglePllCases, usePllSelection } from './selection.ts'

/** Keys that get the next scramble (Space and Enter only when not on a control). */
const NEXT_KEYS = [' ', 'Enter', 'ArrowRight', 'n']

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

export function PllTrainer() {
  const selection = usePllSelection()
  const selected = pllCases.filter((c) => selection.has(c.id))
  const [current, setCurrent] = useState(() => nextScramble(selected))
  const stealth = useStealth()

  const next = useCallback(() => {
    setCurrent(nextScramble(pllCases.filter((c) => selection.has(c.id)), current))
  }, [current, selection])

  // Deselecting the current case (or selecting some after having none) deals a new one.
  const reconcile = (selection: ReadonlySet<string>) => {
    if (current ? !selection.has(current.caseId) : selection.size) {
      setCurrent(nextScramble(pllCases.filter((c) => selection.has(c.id))))
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!NEXT_KEYS.includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof HTMLElement && e.target.closest('button, a, input, textarea, select, [contenteditable]'))
        return
      e.preventDefault()
      next()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [next])

  return (
    <main className="pll">
      <section className="pll-drill">
        {current ? (
          <>
            <div className="pll-scramble" aria-live="polite">
              <Notation moves={current.moves} />
            </div>
            <div className="pll-actions">
              <button className="pll-next" onClick={next} autoFocus>
                Next
              </button>
              <span className="pll-keys">Space / → for the next one</span>
            </div>
          </>
        ) : (
          <p className="pll-empty">Select at least one case to get scrambles.</p>
        )}
      </section>

      {/* Collapsible case selector: open by default, collapsed in stealth (keyed on stealth
          so switching modes resets it). */}
      <details key={String(stealth)} className="pll-cases" open={!stealth}>
        <summary className="pll-cases-head">
          <svg className="pll-chevron" viewBox="0 0 10 6" width="10" height="7" aria-hidden>
            <path d="M1 1l4 4 4-4" />
          </svg>
          <h2>Cases</h2>
          <span className="pll-count">
            {selection.size} / {pllCases.length}
          </span>
        </summary>
        <div className="pll-cases-actions">
          <button className="link-button" onClick={() => reconcile(setPllSelection(pllCases.map((c) => c.id)))}>
            All
          </button>
          <button className="link-button" onClick={() => reconcile(setPllSelection([]))}>
            None
          </button>
        </div>
        {pllGroups.map(({ group, cases }) => {
          const ids = cases.map((c) => c.id)
          const allOn = ids.every((id) => selection.has(id))
          return (
            <div key={group} className="pll-group">
              <h3>
                {group}
                <button className="link-button" onClick={() => reconcile(togglePllCases(ids, !allOn))}>
                  {allOn ? 'Deselect all' : 'Select all'}
                </button>
              </h3>
              <div className="pll-grid">
                {cases.map((c) => {
                  const on = selection.has(c.id)
                  return (
                    <button
                      key={c.id}
                      className={'pll-card' + (on ? ' selected' : '')}
                      aria-pressed={on}
                      title={c.algs[0]}
                      onClick={() => reconcile(togglePllCases([c.id], !on))}
                      data-reveal
                    >
                      <PllIcon pll={c} size={84} />
                      <span className="pll-card-name">{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </details>
    </main>
  )
}
