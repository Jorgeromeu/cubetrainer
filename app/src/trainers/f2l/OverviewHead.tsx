// The top of the F2L overview: the progress bar with its legend, which is also the filter
// (status, edge, case numbers, saved filters; filter.ts), and the Train bar for what the
// filter lets through. Each legend count is what that choice would show given the rest of
// the filter, and the bar is the status counts drawn to scale.
import { useEffect, useState, type FormEvent } from 'react'
import { isTextField } from '../../common/drill/keys.ts'
import { getSlotCase } from './catalog.ts'
import { allSlotCaseIds, filterMatcher, isFiltering, type FilterPart } from './filter.ts'
import { useF2lFocus } from './focus.ts'
import { ProgressBar } from './ProgressBits.tsx'
import { STATUS_LABEL, tally, useProgress, type Status } from './progress.ts'
import { trainHref } from './route.ts'
import {
  NO_FILTER,
  isFilter,
  legendFilter,
  updateF2lSettings,
  useF2lSettings,
  toggleStatus,
  type EdgeFilter,
  type LegendFilter,
  type SavedFilter,
} from './settings.ts'

const STATUS_LEGEND: { status: Status; label: string }[] = [
  { status: 'learnt', label: 'learnt' },
  { status: 'learning', label: 'learning' },
  { status: 'wanted', label: 'want to learn' },
  { status: 'main', label: 'main alg' },
  { status: 'none', label: 'not chosen' },
]

const EDGE_HINT: Record<Exclude<EdgeFilter, 'all'>, string> = {
  good: 'Good edge: inserts with R/L/U/D moves, no rotation needed.',
  bad: 'Bad edge: needs an F/B move, or a rotation first.',
}

const FILTER_HINT =
  " Click to show only these, again to show all. Edge goes by each slot-case's own slot (a family shares it: a good 23 at front-right means a good 24 at front-left)."

/** A filter in words, e.g. "cases 27-30 · bad edge · learning". */
const describe = (f: LegendFilter) =>
  [
    f.caseFilter.trim() && `cases ${f.caseFilter.trim()}`,
    f.edgeFilter !== 'all' && `${f.edgeFilter} edge`,
    f.statuses.map((s) => STATUS_LABEL[s].toLowerCase()).join(' or '),
  ]
    .filter(Boolean)
    .join(' · ') || 'everything'

export function OverviewHead() {
  const settings = useF2lSettings()
  const { edgeFilter, statuses, caseFilter, savedFilters } = settings
  const { bySlotCase } = useProgress()
  const focus = useF2lFocus()

  const ids = allSlotCaseIds()
  const passing = (part?: FilterPart) => ids.filter(filterMatcher(settings, bySlotCase, part))
  const byStatus = tally(bySlotCase, passing('status'))
  const byEdge = passing('edge')
  const edgeCount = (edge: 'good' | 'bad') => byEdge.filter((id) => getSlotCase(id).edgeOriented === (edge === 'good')).length
  const filtering = isFiltering(settings)
  const selected = passing().length
  const saved = savedFilters.find((f) => isFilter(settings, f))
  const learntPct = byStatus.total ? Math.round((byStatus.learnt / byStatus.total) * 100) : 0

  // T trains the selection from anywhere on the overview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 't' || e.altKey || e.ctrlKey || e.metaKey || isTextField(e.target) || !selected) return
      location.href = trainHref()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [selected])

  return (
    <div className="overview-head">
      <div className="overall-bar" title={`${byStatus.learnt} of ${byStatus.total} slot-cases learnt`}>
        <ProgressBar {...byStatus} />
        <span className={'overall-pct' + (learntPct === 100 ? ' complete' : '')}>{learntPct}%</span>
      </div>

      <div className="filter-rows">
        <span className="filter-label">Status</span>
        <span className="legend" role="group" aria-label="Filter by status">
          {STATUS_LEGEND.map(({ status, label }) => (
            <button
              key={status}
              className={(statuses.includes(status) ? 'active' : '') + (byStatus[status] ? '' : ' empty')}
              aria-pressed={statuses.includes(status)}
              title={STATUS_LABEL[status] + '.' + FILTER_HINT + ' Shift-click to pick several.'}
              onClick={(e) =>
                updateF2lSettings({ statuses: toggleStatus(statuses, status, e.shiftKey || e.ctrlKey || e.metaKey) })
              }
            >
              <span className={`swatch ${status}`} /> {label} <span className="count">{byStatus[status]}</span>
            </button>
          ))}
          {focus.active && (
            <span className="focus-chip" title="Learnt cases are greyed out (Settings → F2L)">
              Focus on missing
              <button onClick={() => updateF2lSettings({ focusMissing: false })} aria-label="Turn off focus mode">
                ×
              </button>
            </span>
          )}
        </span>

        <span className="filter-label">Edge</span>
        <span className="legend" role="group" aria-label="Filter by edge">
          {(['good', 'bad'] as const).map((edge) => (
            <button
              key={edge}
              className={edgeFilter === edge ? 'active' : undefined}
              aria-pressed={edgeFilter === edge}
              title={EDGE_HINT[edge] + FILTER_HINT}
              onClick={() => updateF2lSettings({ edgeFilter: edgeFilter === edge ? 'all' : edge })}
            >
              <span className={`swatch edge-${edge}`} /> {edge} edge <span className="count">{edgeCount(edge)}</span>
            </button>
          ))}
        </span>

        <label className="filter-label" htmlFor="f2l-case-filter">
          Cases
        </label>
        <span className="case-filter-row">
          <input
            id="f2l-case-filter"
            className="case-filter"
            type="text"
            inputMode="numeric"
            placeholder="all · e.g. 27-30, 33"
            title={'Only these case numbers: single ones and ranges, like "27-30, 33". Empty for all.'}
            value={caseFilter}
            onChange={(e) => updateF2lSettings({ caseFilter: e.target.value })}
            onKeyDown={(e) => e.key === 'Escape' && updateF2lSettings({ caseFilter: '' })}
          />
          {caseFilter && (
            <button className="case-filter-clear" aria-label="Clear the case numbers" onClick={() => updateF2lSettings({ caseFilter: '' })}>
              ×
            </button>
          )}
        </span>

        {(savedFilters.length > 0 || filtering) && (
          <>
            <span className="filter-label">Saved</span>
            <SavedFilters current={settings} filtering={filtering} saved={savedFilters} />
          </>
        )}
      </div>

      <div className="train-bar">
        <span className="train-what">
          {filtering ? (
            <>
              <strong>{selected}</strong> of {ids.length} slot-cases ·{' '}
              {saved ? <strong>{saved.name}</strong> : describe(settings)}
              <button className="link-button" onClick={() => updateF2lSettings(NO_FILTER)}>
                Show all
              </button>
            </>
          ) : (
            <>
              All <strong>{ids.length}</strong> slot-cases · filter above to train a few
            </>
          )}
        </span>
        {selected > 0 ? (
          <a href={trainHref()} className="train-button" title="Each one once, in random order, at a random angle (T)">
            Train {filtering ? selected : 'all'} →
          </a>
        ) : (
          <span className="train-button disabled">Nothing to train</span>
        )}
      </div>
    </div>
  )
}

/** The saved filters as toggles, each with its size; saving the current one is inline. */
function SavedFilters({ current, filtering, saved }: { current: LegendFilter; filtering: boolean; saved: SavedFilter[] }) {
  const { bySlotCase } = useProgress()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const ids = allSlotCaseIds()
  const unsaved = filtering && !saved.some((f) => isFilter(current, f))
  const replacing = saved.some((f) => f.name === name.trim())

  const save = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    updateF2lSettings({ savedFilters: [...saved.filter((f) => f.name !== n), { name: n, ...legendFilter(current) }] })
    setNaming(false)
    setName('')
  }
  const remove = (f: SavedFilter) => {
    if (confirm(`Delete the saved filter "${f.name}"? (${describe(f)})`))
      updateF2lSettings({ savedFilters: saved.filter((s) => s.name !== f.name) })
  }

  return (
    <span className="legend saved-filters" role="group" aria-label="Saved filters">
      {saved.map((f) => {
        const on = isFilter(current, f)
        const size = ids.filter(filterMatcher(f, bySlotCase)).length
        return (
          <span key={f.name} className={'saved-filter' + (on ? ' active' : '')}>
            <button
              aria-pressed={on}
              title={`${describe(f)}. ${on ? 'Click to show all.' : 'Click to apply.'}`}
              onClick={() => updateF2lSettings(on ? NO_FILTER : { ...NO_FILTER, ...legendFilter(f) })}
            >
              {f.name} <span className="count">{size}</span>
            </button>
            <button className="saved-filter-delete" aria-label={`Delete "${f.name}"`} title="Delete" onClick={() => remove(f)}>
              ×
            </button>
          </span>
        )
      })}
      {naming ? (
        <form className="save-filter-form" onSubmit={save}>
          <input
            autoFocus
            aria-label="Name for this filter"
            placeholder={`Name for ${describe(current)}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
          />
          <button type="submit" disabled={!name.trim()}>
            {replacing ? 'Replace' : 'Save'}
          </button>
          <button type="button" className="link-button" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </form>
      ) : (
        unsaved && (
          <button className="save-filter" onClick={() => setNaming(true)} title={`Save ${describe(current)} under a name`}>
            + Save this filter
          </button>
        )
      )}
    </span>
  )
}
