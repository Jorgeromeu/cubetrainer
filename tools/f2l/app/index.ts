// The F2L tool: the alg explorer over catalog/f2l.json, with progress kept by ../server.
import type { Tool } from '../../../packages/ui/tool.ts'
import { F2lCrumb, F2lView } from './F2lView.tsx'
import { F2lSettings } from './F2lSettings.tsx'
import { F2L_ID } from './route.ts'
import './f2l.css'

export const f2lTool: Tool = {
  id: F2L_ID,
  name: 'F2L',
  description: 'All 41 cases in every slot, with algs',
  View: F2lView,
  Crumb: F2lCrumb,
  Settings: F2lSettings,
}
