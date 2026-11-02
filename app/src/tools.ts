// Every trainer, in menu order; the first is where #/ goes. Adding one: a folder under
// trainers/ whose index.ts exports a Trainer (packages/ui/tool.ts), listed here.
import type { Trainer } from '../../packages/ui/tool.ts'
import { f2lTrainer } from './trainers/f2l/index.ts'
import { pllTrainer } from './trainers/pll/index.ts'
import { pllCompareTrainer } from './trainers/pll-compare/index.ts'
import { statsTrainer } from './trainers/stats/index.ts'

export const TRAINERS: Trainer[] = [f2lTrainer, pllTrainer, pllCompareTrainer, statsTrainer]

