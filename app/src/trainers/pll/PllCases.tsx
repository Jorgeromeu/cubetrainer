// The case selector, which is also where the per-case stats live: every card shows its
// case's pace (ao5, or the mean until it has 5 solves) on a fast → slow colour scale
// across the timed cases, with the full stats on hover. Sorted by group, or slowest first.
import type { CSSProperties } from 'react'
import { Segmented } from '../../../../packages/ui/settings.tsx'
import { pllCases, pllGroups, type PllCase } from './catalog.ts'
import { PllIcon } from '../../../../packages/ui/icons/PllIcon.tsx'
import { setPllSelection, togglePllCases, usePllSelection } from './selection.ts'
import { updatePllSettings, usePllSettings, type CaseOrder } from './settings.ts'
import { formatTime, paceOf, statsTitle, type Stats } from './solves.ts'

const ORDER_OPTIONS: { value: CaseOrder; label: string }[] = [
  { value: 'group', label: 'By group' },
  { value: 'slowest', label: 'Slowest first' },
]

/**
 * `onSelect` gets the new selection after every change (the trainer deals a new scramble
 * if the current case was deselected). Open by default, collapsed in stealth.
 */
export function PllCases({ stats, open, onSelect }: {
  stats: ReadonlyMap<string, Stats>
  open: boolean
  onSelect: (selection: ReadonlySet<string>) => void
}) {
  const selection = usePllSelection()
  const { caseOrder } = usePllSettings()

  // The colour scale runs from the fastest to the slowest finished pace; DNF paces sit past the end.
  const paces = [...stats.values()].map(paceOf).filter(Number.isFinite)
  const [fastest, slowest] = [Math.min(...paces), Math.max(...paces)]
  const position = (s: Stats) => {
    const pace = paceOf(s)
    if (!Number.isFinite(pace)) return 1
    return slowest > fastest ? (pace - fastest) / (slowest - fastest) : 0
  }

  const card = (c: PllCase) => {
    const on = selection.has(c.id)
    const s = stats.get(c.id)
    return (
      <button
        key={c.id}
        className={'pll-card' + (on ? ' selected' : '')}
        aria-pressed={on}
        title={`${c.name}${s ? '\n' + statsTitle(s) : ' · not timed yet'}\n${c.algs[0]}`}
        onClick={() => onSelect(togglePllCases([c.id], !on))}
        data-reveal
      >
        <PllIcon pll={c} size={84} />
        <span className="pll-card-name">{c.name}</span>
        {s ? (
          <span
            className="pll-pace"
            style={{ '--pace': position(s) } as CSSProperties}
            title={`${s.ao5 === undefined ? `Mean of ${s.count}` : 'ao5'}; ${s.count} ${s.count === 1 ? 'solve' : 'solves'}`}
          >
            {formatTime(paceOf(s))}
            <small>{s.count}</small>
          </span>
        ) : (
          <span className="pll-pace untimed">–</span>
        )}
      </button>
    )
  }

  const bySlowest = [...pllCases].sort((a, b) => {
    const [sa, sb] = [stats.get(a.id), stats.get(b.id)]
    if (!sa || !sb) return sa ? -1 : sb ? 1 : 0 // untimed last, in catalog order
    return paceOf(sb) - paceOf(sa)
  })

  return (
    <details className="pll-cases" open={open}>
      <summary className="pll-cases-head">
        <svg className="pll-chevron" viewBox="0 0 10 6" width="10" height="7" aria-hidden>
          <path d="M1 1l4 4 4-4" />
        </svg>
        <h2>Cases</h2>
        <span className="pll-count">
          {selection.size} / {pllCases.length} selected
        </span>
      </summary>
      <div className="pll-cases-bar">
        <div className="pll-cases-actions">
          <button className="link-button" onClick={() => onSelect(setPllSelection(pllCases.map((c) => c.id)))}>
            All
          </button>
          <button className="link-button" onClick={() => onSelect(setPllSelection([]))}>
            None
          </button>
        </div>
        <Segmented options={ORDER_OPTIONS} value={caseOrder} onChange={(o) => updatePllSettings({ caseOrder: o })} />
      </div>

      {caseOrder === 'slowest' ? (
        <div className="pll-grid pll-group">{bySlowest.map(card)}</div>
      ) : (
        pllGroups.map(({ group, cases }) => {
          const ids = cases.map((c) => c.id)
          const allOn = ids.every((id) => selection.has(id))
          return (
            <div key={group} className="pll-group">
              <h3>
                {group}
                <button className="link-button" onClick={() => onSelect(togglePllCases(ids, !allOn))}>
                  {allOn ? 'Deselect all' : 'Select all'}
                </button>
              </h3>
              <div className="pll-grid">{cases.map(card)}</div>
            </div>
          )
        })
      )}
    </details>
  )
}
