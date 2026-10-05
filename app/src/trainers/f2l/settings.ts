// F2L trainer preferences (Settings → F2L). They only affect the F2L pages.
import { persisted } from '../../common/persisted.ts'

/**
 * How a slot-case is set up: 'colours' keeps the centres where they are (green in front),
 * so other slots use B/L/F turns; 'rotation' does the FR setup, then turns the cube so the
 * pair lands in the slot (any colour in front).
 */
export type SetupMode = 'colours' | 'rotation'

/** F2L trainer preferences. They only affect the F2L pages. */
export interface F2lSettings {
  /** Focus on what's missing: learnt slot-cases are greyed out (still clickable). */
  focusMissing: boolean
  setupMode: SetupMode
}

const f2lSettings = persisted<F2lSettings>(
  'cubetrainer.f2lSettings',
  { focusMissing: false, setupMode: 'colours' },
  (s) => typeof s.focusMissing === 'boolean' && ['colours', 'rotation'].includes(s.setupMode),
)

export const updateF2lSettings = f2lSettings.update
export const useF2lSettings = f2lSettings.use
