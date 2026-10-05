// Every trainer, in menu order. Adding one: a folder under trainers/ whose index.ts exports
// a Trainer (common/trainer.ts), listed here.
import type { Trainer } from '../common/trainer.ts'
import { f2lTrainer } from '../trainers/f2l/index.ts'
import { pllTrainer } from '../trainers/pll/index.ts'

export const TRAINERS: Trainer[] = [f2lTrainer, pllTrainer]

/** Where #/ goes. */
export const DEFAULT_TRAINER = f2lTrainer
