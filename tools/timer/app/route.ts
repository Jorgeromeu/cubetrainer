// The timer's routes, under #/timer/ (packages/ui/tool.ts):
//   (empty)   the timer (TimerView.tsx)
//   stats     every solve, charted (Stats.tsx)
import { toolHref } from '../../../packages/ui/tool.ts'

export const TIMER_ID = 'timer'

export type TimerPage = 'timer' | 'stats'

export const pageOf = (path: string[]): TimerPage => (path[0] === 'stats' ? 'stats' : 'timer')

export const pageHref = (page: TimerPage) => toolHref(TIMER_ID, page === 'stats' ? 'stats' : undefined)
