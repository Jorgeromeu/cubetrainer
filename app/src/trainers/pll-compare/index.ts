// The PLL compare trainer: PLL cases side by side under one camera, each with its own U
// turns, to see how cases relate and find recognition tricks. Named sets of cubes are
// kept by ../server.
import type { Trainer } from '../../common/trainer.ts'
import { CompareCrumb, CompareTrainer } from './CompareTrainer.tsx'

export const pllCompareTrainer: Trainer = {
  id: 'pll-compare',
  name: 'PLL Compare',
  description: 'PLL cases side by side under one camera, to spot recognition tricks',
  View: CompareTrainer,
  Crumb: CompareCrumb,
}
