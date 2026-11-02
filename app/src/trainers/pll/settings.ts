// PLL trainer preferences (Settings → PLL). They only affect the PLL page.
import { persisted } from '../../../../packages/ui/persisted.ts'

/**
 * How a solve starts: 'countdown' after Space (you scramble under the table and lift at
 * 0: no inspection), or 'hold' Space and release, as on csTimer (you can see the case first).
 */
export type StartMode = 'countdown' | 'hold'

/** How the case selector is laid out: by PLL group, or all cases slowest first. */
export type CaseOrder = 'group' | 'slowest'

export interface PllSettings {
  start: StartMode
  caseOrder: CaseOrder
  /** Seconds between pressing Space and the timer starting: time to get your hand back on the cube. */
  countdown: number
  /** Ticks during the countdown and a beep at 0, so you needn't watch the screen. Never in stealth. */
  sound: boolean
}

export const COUNTDOWNS = [1, 2, 3, 4, 5]

const pllSettings = persisted<PllSettings>(
  'cubetrainer.pllSettings',
  { start: 'countdown', caseOrder: 'group', countdown: 3, sound: true },
  (s) =>
    ['countdown', 'hold'].includes(s.start) &&
    ['group', 'slowest'].includes(s.caseOrder) &&
    COUNTDOWNS.includes(s.countdown) &&
    typeof s.sound === 'boolean',
)

export const updatePllSettings = pllSettings.update
export const usePllSettings = pllSettings.use
