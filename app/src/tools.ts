// Every tool, in menu order; the first is where #/ goes. Adding one: tools/<id>/ whose
// app/index.ts exports a Tool (packages/ui/tool.ts), listed here.
import type { Tool } from '../../packages/ui/tool.ts'
import { f2lTool } from '../../tools/f2l/app/index.ts'
import { timerTool } from '../../tools/timer/app/index.ts'

export const TOOLS: Tool[] = [timerTool, f2lTool]
