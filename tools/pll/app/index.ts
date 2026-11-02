// The PLL trainer: timed scrambles for the cases you pick, from catalog/pll.json, with
// times kept by ../server.
import type { Trainer } from '../../../packages/ui/tool.ts'
import { PllCrumb, PllTrainer } from './PllTrainer.tsx'
import { PllSettings } from './PllSettings.tsx'
import './pll.css'

export const pllTrainer: Trainer = {
  id: 'pll',
  name: 'PLL',
  description: 'Timed scrambles for the 21 cases you pick',
  View: PllTrainer,
  Crumb: PllCrumb,
  Settings: PllSettings,
}
