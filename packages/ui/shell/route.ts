// Hash-based routes, so the app works as plain static files: #/<toolId>/<path...>,
// where the path is the tool's own (../tool.ts). #/ and any hash that doesn't
// start with a tool id (older links, from before tools had a prefix) go to the
// default tool (the first one listed), with the whole hash as its path.
import type { Tool } from '../tool.ts'

export interface Route {
  tool: Tool
  path: string[]
}

export function parseHash(tools: readonly Tool[]): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const tool = tools.find((t) => t.id === parts[0])
  return tool ? { tool, path: parts.slice(1) } : { tool: tools[0], path: parts }
}
