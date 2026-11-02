// The standard timer bits: penalties (OK / +2 / DNF) on a solve, the stats line (best,
// ao5, ao12, mean) used both for all solves and for one case, and the list of every
// solve, newest first, where any of them can be fixed or removed.
import { useState } from 'react'
import { pllCasesById } from './catalog.ts'
import { deleteSolve, formatSolve, formatTime, setPenalty, statsOf, type Penalty, type Solve, type Stats } from './solves.ts'

const PENALTY_OPTIONS: { value: Penalty; label: string; title: string }[] = [
  { value: 'ok', label: 'OK', title: 'No penalty' },
  { value: '+2', label: '+2', title: '+2 seconds (key 2)' },
  { value: 'dnf', label: 'DNF', title: 'Did not finish (key D)' },
]

/** OK / +2 / DNF for one solve. */
export function PenaltyButtons({ solve }: { solve: Solve }) {
  return (
    <div className="pll-penalty" role="group" aria-label="Penalty">
      {PENALTY_OPTIONS.map((o) => (
        <button
          key={o.value}
          className={solve.penalty === o.value ? 'active' : undefined}
          data-penalty={o.value}
          aria-pressed={solve.penalty === o.value}
          title={o.title}
          onClick={() => setPenalty(solve.id, o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Best, ao5, ao12, ao100 and mean, in a row (ao100 only once there are 100 solves).
 * `compact`: one line of small text.
 */
export function StatsLine({ stats, compact }: { stats: Stats; compact?: boolean }) {
  const items: [string, number | undefined, string?][] = [
    ['best', stats.best],
    ['ao5', stats.ao5],
    ['ao12', stats.ao12],
    ...(stats.ao100 === undefined ? [] : [['ao100', stats.ao100] as [string, number]]),
    ['mean', stats.mean, 'Of the finished solves'],
  ]
  return (
    <dl className={'pll-stats' + (compact ? ' compact' : '')}>
      {items.map(([label, value, title]) => (
        <div key={label} title={title}>
          <dt>{label}</dt>
          <dd>{formatTime(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** How many solves the list shows before "Show all". */
const LIST_SIZE = 25

/** Every solve, newest first, with its penalty and a remove button; overall stats on top. */
export function SolveList({ solves }: { solves: readonly Solve[] }) {
  const [all, setAll] = useState(false)
  if (!solves.length) return null
  const newestFirst = solves.map((s, i) => ({ s, n: i + 1 })).reverse()
  const rows = all ? newestFirst : newestFirst.slice(0, LIST_SIZE)

  return (
    <details className="pll-solves" open>
      <summary className="pll-cases-head">
        <svg className="pll-chevron" viewBox="0 0 10 6" width="10" height="7" aria-hidden>
          <path d="M1 1l4 4 4-4" />
        </svg>
        <h2>Solves</h2>
        <span className="pll-count">{solves.length}</span>
      </summary>
      <StatsLine stats={statsOf(solves)} />
      <ol className="pll-solve-list">
        {rows.map(({ s, n }) => (
          <li key={s.id} className={s.penalty === 'dnf' ? 'dnf' : undefined}>
            <span className="pll-solve-n">{n}</span>
            <span className="pll-solve-time" title={s.penalty === 'ok' ? undefined : `Timed ${formatTime(s.ms)}`}>
              {formatSolve(s)}
            </span>
            <span className="pll-solve-case">{pllCasesById.get(s.caseId)?.name ?? s.caseId}</span>
            <PenaltyButtons solve={s} />
            <button className="pll-solve-remove" onClick={() => deleteSolve(s.id)} title="Remove this solve" aria-label="Remove">
              ×
            </button>
          </li>
        ))}
      </ol>
      {newestFirst.length > LIST_SIZE && (
        <button className="link-button" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${newestFirst.length}`}
        </button>
      )}
    </details>
  )
}
