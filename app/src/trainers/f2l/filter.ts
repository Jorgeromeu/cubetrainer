// The overview legend's filter (by status, by edge and by case number, see F2lSettings):
// which slot-cases are "in the selection". The overview shows only those; a cluster greys
// the rest out; Train deals them. It only takes effect once progress has loaded, as the
// legend is hidden till then.
import { SLOTS, catalog, getCase, getSlotCase, slotCaseIdFor } from './catalog.ts'
import { statusOf, useProgress, type SlotCaseState } from './progress.ts'
import { useF2lSettings, type LegendFilter } from './settings.ts'

/** The case numbers in a case filter like "27-30, 33" (a range either way round); none if nothing parses. */
export function parseCaseNumbers(text: string): Set<number> | undefined {
  const numbers = new Set<number>()
  for (const part of text.split(/[\s,;]+/)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part)
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[2] ?? m[1])
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) numbers.add(n)
  }
  return numbers.size ? numbers : undefined
}

/** One part of the filter, left out to count what the others let through (the legend's counts). */
export type FilterPart = 'status' | 'edge' | 'case'

/** Whether a slot-case passes a filter, optionally ignoring one of its parts. */
export function filterMatcher(
  { edgeFilter, statuses, caseFilter }: LegendFilter,
  bySlotCase: ReadonlyMap<string, SlotCaseState>,
  ignore?: FilterPart,
) {
  const caseNumbers = ignore === 'case' ? undefined : parseCaseNumbers(caseFilter)
  const edge = ignore === 'edge' ? 'all' : edgeFilter
  const wanted = ignore === 'status' ? [] : statuses
  return (slotCaseId: string) => {
    const slotCase = getSlotCase(slotCaseId)
    return (
      (edge === 'all' || slotCase.edgeOriented === (edge === 'good')) &&
      (!wanted.length || wanted.includes(statusOf(bySlotCase.get(slotCaseId)))) &&
      (!caseNumbers || caseNumbers.has(getCase(slotCase.caseId).number))
    )
  }
}

/** True if the filter narrows anything down. */
export const isFiltering = (f: LegendFilter) =>
  f.edgeFilter !== 'all' || f.statuses.length > 0 || !!parseCaseNumbers(f.caseFilter)

/** Every slot-case id, in catalog order. */
export const allSlotCaseIds = () => catalog.slotCases.map((sc) => sc.id)

export function useF2lFilter() {
  const settings = useF2lSettings()
  const { load, bySlotCase } = useProgress()
  const active = load === 'ready' && isFiltering(settings)
  const passes = filterMatcher(settings, bySlotCase)

  /** True if the slot-case is in the selection (always, when no filter is on). */
  const matches = (slotCaseId: string) => !active || passes(slotCaseId)
  /** True if any slot of the case is in the selection. */
  const caseMatches = (caseId: string) => SLOTS.some((slot) => matches(slotCaseIdFor(caseId, slot)))

  return { active, matches, caseMatches }
}
