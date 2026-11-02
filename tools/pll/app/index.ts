// The PLL tool: timed scrambles for the cases you pick, from catalog/pll.json, with
// times kept by ../server.
import type { Tool } from '../../../packages/ui/tool.ts'
import { PllCrumb, PllView } from './PllView.tsx'
import { PllSettings } from './PllSettings.tsx'
import './pll.css'

export const pllTool: Tool = {
  id: 'pll',
  name: 'PLL',
  description: 'Timed scrambles for the 21 cases you pick',
  View: PllView,
  Crumb: PllCrumb,
  Settings: PllSettings,
}
