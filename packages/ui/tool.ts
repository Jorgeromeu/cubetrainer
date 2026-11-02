// What a tool gives the shell (the host's registry, app/src/tools.ts, lists them). A tool is standalone:
// it owns everything under #/<id>/, and only uses the shell through this interface.
import type { ComponentType } from 'react'

/** The route under a tool's #/<id>/, split on "/" (empty on its home page). */
export interface ToolProps {
  path: string[]
}

export interface Tool {
  id: string
  /** Shown in the top bar and the tool menu. */
  name: string
  /** One line in the tool menu. */
  description: string
  View: ComponentType<ToolProps>
  /** Its part of the top bar, after the brand and the stealth toggle. */
  Crumb?: ComponentType<ToolProps>
  /**
   * Its settings menu, the only thing in it (no gear without one). Build it with
   * settings.tsx; add shared sections only if they apply to it, e.g.
   * cube/CubeDisplaySettings.tsx if it shows 3D cubes.
   */
  Settings?: ComponentType
}

/** A link into a tool: #/<id>/<path...>. Empty path parts are dropped. */
export const toolHref = (id: string, ...path: (string | undefined)[]) =>
  '#/' + [id, ...path].filter(Boolean).join('/')
