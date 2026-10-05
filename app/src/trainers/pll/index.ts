// The PLL trainer: scrambles for the cases you pick, from catalog/pll.json.
import type { Trainer } from '../../common/trainer.ts'
import { PllCrumb, PllTrainer } from './PllTrainer.tsx'

export const pllTrainer: Trainer = {
  id: 'pll',
  name: 'PLL',
  description: 'Scrambles for the 21 cases you pick',
  View: PllTrainer,
  Crumb: PllCrumb,
}
