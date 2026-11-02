// The stats trainer: your solve history, imported from a timer's export (CubeTime for
// now) and kept by ../server, as charts and a table.
import type { Trainer } from '../../common/trainer.ts'
import { StatsCrumb, StatsTrainer } from './StatsTrainer.tsx'

export const statsTrainer: Trainer = {
  id: 'stats',
  name: 'Stats',
  description: 'Your solve history, charted: progress, spread of times and practice per day, week or month',
  View: StatsTrainer,
  Crumb: StatsCrumb,
}
