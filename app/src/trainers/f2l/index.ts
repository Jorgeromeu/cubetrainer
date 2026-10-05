// The F2L trainer: the alg explorer over catalog/f2l.json, with progress kept by ../server.
import type { Trainer } from '../../common/trainer.ts'
import { F2lCrumb, F2lTrainer } from './F2lTrainer.tsx'
import { F2lSettings } from './F2lSettings.tsx'
import { F2L_ID } from './route.ts'

export const f2lTrainer: Trainer = {
  id: F2L_ID,
  name: 'F2L',
  description: 'All 41 cases in every slot, with algs',
  View: F2lTrainer,
  Crumb: F2lCrumb,
  Settings: F2lSettings,
}
