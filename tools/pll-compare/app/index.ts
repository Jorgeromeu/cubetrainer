// The PLL compare tool: PLL cases side by side under one camera, each with its own U
// turns, to see how cases relate and find recognition tricks. Named sets of cubes are
// kept by ../server.
import type { Tool } from '../../../packages/ui/tool.ts'
import { CompareCrumb, CompareView } from './CompareView.tsx'
import './pll-compare.css'

export const pllCompareTool: Tool = {
  id: 'pll-compare',
  name: 'PLL Compare',
  description: 'PLL cases side by side under one camera, to spot recognition tricks',
  View: CompareView,
  Crumb: CompareCrumb,
}
