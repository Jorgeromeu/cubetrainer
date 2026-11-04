// Every tool with server-side data. Adding one: tools/<id>/server/index.ts exports a
// ServerTool (tool.ts), listed here. Tools that store nothing don't need an entry.
import type { ServerTool } from "./tool.ts";
import { f2lTool } from "../../tools/f2l/server/index.ts";
import { timerTool } from "../../tools/timer/server/index.ts";

export const TOOLS: ServerTool[] = [timerTool, f2lTool];
