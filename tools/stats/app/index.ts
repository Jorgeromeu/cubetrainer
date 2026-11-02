// The stats trainer: your solve history, imported from a timer's export (CubeTime for
// now) and kept by ../server, as charts and a table.
import type { Trainer } from '../../../packages/ui/tool.ts'
import { StatsCrumb, StatsTrainer } from './StatsTrainer.tsx'
import './stats.css'

export const statsTrainer: Trainer = {
  id: 'stats',
  name: 'Stats',
  description: 'Your solve history, charted: progress, spread of times and practice per day, week or month',
  View: StatsTrainer,
  Crumb: StatsCrumb,
}
