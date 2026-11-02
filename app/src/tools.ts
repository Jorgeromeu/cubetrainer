// Every tool, in menu order; the first is where #/ goes. Adding one: tools/<id>/ whose
// app/index.ts exports a Tool (packages/ui/tool.ts), listed here.
import type { Tool } from '../../packages/ui/tool.ts'
import { f2lTool } from '../../tools/f2l/app/index.ts'
import { pllTool } from '../../tools/pll/app/index.ts'
import { pllCompareTool } from '../../tools/pll-compare/app/index.ts'
import { statsTool } from '../../tools/stats/app/index.ts'

export const TOOLS: Tool[] = [f2lTool, pllTool, pllCompareTool, statsTool]

