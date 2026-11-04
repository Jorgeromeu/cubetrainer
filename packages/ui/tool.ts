// What a tool gives the shell (the host's registry, app/src/tools.ts, lists them). A tool is standalone:
// it owns everything under #/<id>/, and only uses the shell through this interface.
import type { ComponentType } from 'react'

/** The app's name, in the top bar and the tab title. */
export const BRAND = 'Cubetrainer'

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
  /** Its part of the top bar, after the brand. */
  Crumb?: ComponentType<ToolProps>
  /**
   * Its own settings section in the settings window, under its name. Build it
   * from settings/blocks.tsx, over a setting(<its id>, ...) store (settings/setting.ts).
   */
  Settings?: ComponentType
  /** Shared library sections that apply to it (settings a library owns, the same in every tool): app-wide in the settings window. */
  sharedSettings?: readonly SharedSettings[]
}

/**
 * A settings section a shared library offers (its values are the same in every tool), for
 * tools to list in `sharedSettings`.
 */
export interface SharedSettings {
  title: string
  View: ComponentType
}

/** A link into a tool: #/<id>/<path...>. Empty path parts are dropped. */
export const toolHref = (id: string, ...path: (string | undefined)[]) =>
  '#/' + [id, ...path].filter(Boolean).join('/')
