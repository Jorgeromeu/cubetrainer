// F2L's settings (Settings → F2L) and the overview's view state. They only affect the F2L pages.
import { setting } from '../../../packages/ui/settings/setting.ts'
import { viewState } from '../../../packages/ui/settings/viewState.ts'
import type { HintMode } from '../../../packages/ui/cube/Cube.tsx'
import { LINK_KINDS, type LinkKind } from '../catalog/catalog.ts'
import type { Status } from './progress.ts'

/**
 * How a slot-case is set up: 'colours' keeps the centres where they are (green in front),
 * so other slots use B/L/F turns; 'rotation' does the FR setup, then turns the cube so the
 * pair lands in the slot (any colour in front).
 */
export type SetupMode = 'colours' | 'rotation'

/** The overview's edge filter (in its legend): slot-cases by their edge in their own slot (see SlotCase.edgeOriented). */
export type EdgeFilter = 'all' | 'good' | 'bad'

const STATUSES: Status[] = ['none', 'main', 'wanted', 'learning', 'learnt']

/** The overview legend's filter: what a saved filter keeps. */
export interface LegendFilter {
  edgeFilter: EdgeFilter
  /** Only slot-cases with one of these statuses; none for all. */
  statuses: Status[]
  caseFilter: string
}

/** A legend filter saved under a name, one click away in the legend. */
export interface SavedFilter extends LegendFilter {
  name: string
}

/** F2L's settings (Settings → F2L): kept with every setting (packages/ui/settings/setting.ts). */
export interface F2lSettings {
  /** Focus on what's missing: learnt slot-cases are greyed out (still clickable). */
  focusMissing: boolean
  setupMode: SetupMode
  /**
   * The link kinds that count as "the same" when grouping algs: the family map colours
   * cells whose main algs are linked by these, and the overview counts ideas by them.
   */
  linkKinds: LinkKind[]
  /** How F2L's cubes are drawn (F2lCube.tsx): the pair in full colour, the rest of F2L dimmed. */
  highlightPair: boolean
  /** Floating copies of hidden faces on the big cube: for the pair, all of F2L, or none. */
  hints: HintMode
  /** How far the hints float from the cube, in cubing.js units. */
  hintDistance: number
}

/** The hint distance slider's range. */
export const HINT_DISTANCE = { min: 0.8, max: 1.6, step: 0.05 }

export const DEFAULT_CUBE_DISPLAY = { highlightPair: true, hints: 'pair' as HintMode, hintDistance: 0.95 }

/** How the overview was left: its legend filter and saved filters, remembered per browser. */
export interface OverviewView extends LegendFilter {
  /** Legend filters saved under a name (in the legend). */
  // REVIEW: user data, not view state; moves into F2L's DB when the tool is reworked.
  savedFilters: SavedFilter[]
}

/** By default mirrors and rotations count as the same alg; transposes don't. */
const DEFAULT_LINK_KINDS: LinkKind[] = ['mirrorLR', 'mirrorFB', 'rotation']

const validStatuses = (statuses: Status[]) => Array.isArray(statuses) && statuses.every((s) => STATUSES.includes(s))

const validFilter = (f: SavedFilter) =>
  typeof f?.name === 'string' &&
  ['all', 'good', 'bad'].includes(f.edgeFilter) &&
  validStatuses(f.statuses) &&
  typeof f.caseFilter === 'string'

/** Filters used to have one status at most (statusFilter: a status or 'all'). */
function migrateFilter<F extends object>(f: F & { statusFilter?: unknown; statuses?: unknown }): F {
  if (f.statuses !== undefined || f.statusFilter === undefined) return f
  const { statusFilter, ...rest } = f
  return { ...rest, statuses: statusFilter === 'all' ? [] : [statusFilter] } as unknown as F
}

/** Both used to be one per-browser object under this key. */
const LEGACY_KEY = 'cubetrainer.f2lSettings'

const only = <K extends string>(stored: Record<string, unknown>, keys: readonly K[]) =>
  Object.fromEntries(keys.filter((k) => k in stored).map((k) => [k, stored[k]]))

const f2lSettings = setting<F2lSettings>(
  'f2l',
  { focusMissing: false, setupMode: 'colours', linkKinds: DEFAULT_LINK_KINDS, ...DEFAULT_CUBE_DISPLAY },
  (s) =>
    typeof s.focusMissing === 'boolean' &&
    ['colours', 'rotation'].includes(s.setupMode) &&
    Array.isArray(s.linkKinds) &&
    s.linkKinds.every((k) => LINK_KINDS.includes(k)) &&
    typeof s.highlightPair === 'boolean' &&
    ['off', 'pair', 'all'].includes(s.hints) &&
    s.hintDistance >= HINT_DISTANCE.min &&
    s.hintDistance <= HINT_DISTANCE.max,
  {
    legacyKey: LEGACY_KEY,
    migrate: (stored) => only(stored, ['focusMissing', 'setupMode', 'linkKinds', 'highlightPair', 'hints', 'hintDistance']),
  },
)

export const updateF2lSettings = f2lSettings.update
export const useF2lSettings = f2lSettings.use

const overview = viewState<OverviewView>(
  'f2l.overview',
  { edgeFilter: 'all', statuses: [], caseFilter: '', savedFilters: [] },
  (s) =>
    ['all', 'good', 'bad'].includes(s.edgeFilter) &&
    validStatuses(s.statuses) &&
    typeof s.caseFilter === 'string' &&
    Array.isArray(s.savedFilters) &&
    s.savedFilters.every(validFilter),
  {
    legacyKey: LEGACY_KEY,
    migrate: (stored) => {
      const s = migrateFilter(only(stored, ['edgeFilter', 'statuses', 'statusFilter', 'caseFilter', 'savedFilters']))
      return Array.isArray(s.savedFilters) ? { ...s, savedFilters: s.savedFilters.map(migrateFilter) } : s
    },
  },
)

export const updateOverview = overview.update
export const useOverview = overview.use

export const NO_FILTER: LegendFilter = { edgeFilter: 'all', statuses: [], caseFilter: '' }

const sameStatuses = (a: Status[], b: Status[]) => a.length === b.length && a.every((s) => b.includes(s))

/** True if the legend's current filter is the saved one (case filters compared as typed, give or take spaces). */
export const isFilter = (s: LegendFilter, f: LegendFilter) =>
  s.edgeFilter === f.edgeFilter &&
  sameStatuses(s.statuses, f.statuses) &&
  s.caseFilter.replace(/\s+/g, '') === f.caseFilter.replace(/\s+/g, '')

/** The legend's current filter, as one to save. */
export const legendFilter = ({ edgeFilter, statuses, caseFilter }: LegendFilter): LegendFilter => ({
  edgeFilter,
  statuses: STATUSES.filter((s) => statuses.includes(s)),
  caseFilter: caseFilter.trim(),
})

/**
 * The statuses after clicking one in the legend: on its own it shows just that one (or
 * all again, if it was the only one); with `add` (Shift/Ctrl/⌘) it joins or leaves the
 * others. All of them is the same as none.
 */
export function toggleStatus(statuses: Status[], status: Status, add: boolean): Status[] {
  const on = statuses.includes(status)
  const next = add ? (on ? statuses.filter((s) => s !== status) : [...statuses, status]) : on && statuses.length === 1 ? [] : [status]
  return next.length === STATUSES.length ? [] : STATUSES.filter((s) => next.includes(s))
}
