// Every trainer, in menu order; the first is where #/ goes. Adding one: a folder under
// trainers/ whose index.ts exports a Trainer (packages/ui/tool.ts), listed here.
import type { Trainer } from '../../packages/ui/tool.ts'
import { f2lTrainer } from '../../tools/f2l/app/index.ts'
import { pllTrainer } from '../../tools/pll/app/index.ts'
import { pllCompareTrainer } from '../../tools/pll-compare/app/index.ts'
import { statsTrainer } from '../../tools/stats/app/index.ts'

export const TRAINERS: Trainer[] = [f2lTrainer, pllTrainer, pllCompareTrainer, statsTrainer]

