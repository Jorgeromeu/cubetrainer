// What a trainer gives the shell (shell/trainers.ts lists them). A trainer is standalone:
// it owns everything under #/<id>/, and only uses the shell through this interface.
import type { ComponentType } from 'react'

/** The route under a trainer's #/<id>/, split on "/" (empty on its home page). */
export interface TrainerProps {
  path: string[]
}

export interface Trainer {
  id: string
  /** Shown in the top bar and the trainer menu. */
  name: string
  /** One line in the trainer menu. */
  description: string
  View: ComponentType<TrainerProps>
  /** Its part of the top bar, after the brand and the stealth toggle. */
  Crumb?: ComponentType<TrainerProps>
  /**
   * Its settings menu, the only thing in it (no gear without one). Build it with
   * common/ui/settings.tsx; add shared sections only if they apply to it, e.g.
   * common/cube/CubeDisplaySettings.tsx if it shows 3D cubes.
   */
  Settings?: ComponentType
}

/** A link into a trainer: #/<id>/<path...>. Empty path parts are dropped. */
export const trainerHref = (id: string, ...path: (string | undefined)[]) =>
  '#/' + [id, ...path].filter(Boolean).join('/')
