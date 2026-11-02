// The stats tool: your solve history, imported from a timer's export (CubeTime for
// now) and kept by ../server, as charts and a table.
import type { Tool } from '../../../packages/ui/tool.ts'
import { StatsCrumb, StatsView } from './StatsView.tsx'
import './stats.css'

export const statsTool: Tool = {
  id: 'stats',
  name: 'Stats',
  description: 'Your solve history, charted: progress, spread of times and practice per day, week or month',
  View: StatsView,
  Crumb: StatsCrumb,
}
