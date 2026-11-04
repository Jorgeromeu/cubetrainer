// The timer tool: times solves and keeps every one (timed here or imported from another
// timer's export) in ../server, with the stats page over all of them.
import type { Tool } from '../../../packages/ui/tool.ts'
import { TIMER_ID } from './route.ts'
import { TimerCrumb, TimerPages } from './TimerPages.tsx'
import './timer.css'

export const timerTool: Tool = {
  id: TIMER_ID,
  name: 'Timer',
  description: 'Time solves, and every solve (timed here or imported) charted',
  View: TimerPages,
  Crumb: TimerCrumb,
}
