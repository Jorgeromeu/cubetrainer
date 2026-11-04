// What the stats page's progress and solves-per charts show, picked in their legends: view
// state, remembered per browser.
import { viewState } from '../../../packages/ui/settings/viewState.ts'
import type { Period } from './analysis.ts'

export interface ProgressSettings {
  /** The window the curve averages and the band spreads over. */
  window: 12 | 100
  /** The average over the window, as a line. */
  curve: boolean
  /** The spread of the window's solves as bands around the curve, and the spread-over-time chart. */
  distribution: boolean
  singles: boolean
  /** Milestones (learning PLL, …) on the timeline charts. */
  milestones: boolean
  /** On hover, shade the solves each shown average is over. */
  windows: boolean
  /** Solves placed by when they were done, or evenly by solve number. */
  xAxis: 'date' | 'solves'
}

const progressSettings = viewState<ProgressSettings>(
  'timer.progress',
  { window: 100, curve: true, distribution: true, singles: true, milestones: true, windows: true, xAxis: 'date' },
  (s) =>
    [12, 100].includes(s.window) &&
    ['date', 'solves'].includes(s.xAxis) &&
    typeof s.curve === 'boolean' &&
    typeof s.distribution === 'boolean' &&
    typeof s.singles === 'boolean' &&
    typeof s.windows === 'boolean' &&
    typeof s.milestones === 'boolean',
  { legacyKey: 'cubetrainer.statsProgress' },
)

export const updateProgressSettings = progressSettings.update
export const useProgressSettings = progressSettings.use

/** What the solves-per chart counts by over all time (shorter ranges are always by day). */
const solvesPer = viewState<{ period: Period }>('timer.solvesPer', { period: 'week' }, (s) => ['day', 'week', 'month'].includes(s.period), {
  legacyKey: 'cubetrainer.statsSolvesPer',
})

export const updateSolvesPer = solvesPer.update
export const useSolvesPer = solvesPer.use
