import type { ReactNode } from 'react'
import { TRIGGER_NAMES, type AlgTrigger } from '../../../../shared/cube.ts'
import { isRotation } from './moves.ts'
import { groupMoves, splitMoves } from './notation.ts'

interface Props {
  moves: string
  /** The alg's marked triggers (CatalogAlg.triggers); none for setups and scrambles. */
  triggers?: readonly AlgTrigger[]
  /** Wraps a trigger's markup, e.g. to give it a richer tooltip than its name. */
  wrapTrigger?: (trigger: AlgTrigger, content: ReactNode) => ReactNode
}

/**
 * Moves as text, marked up the same way everywhere (see notation.ts): rotations in their
 * colour, marked triggers in theirs and in parentheses, named on hover.
 */
export function Notation({ moves, triggers, wrapTrigger }: Props) {
  return groupMoves(splitMoves(moves), triggers).map(({ moves, trigger }, i) => {
    const space = i > 0 && ' '
    if (!trigger) {
      const [move] = moves
      return (
        <span key={i} className={isRotation(move) ? 'rotation-move' : undefined}>
          {space}
          {move}
        </span>
      )
    }
    const content = (
      <span className="trigger-moves" title={wrapTrigger ? undefined : TRIGGER_NAMES[trigger.kind]}>
        ({moves.join(' ')})
      </span>
    )
    return (
      <span key={i}>
        {space}
        {wrapTrigger ? wrapTrigger(trigger, content) : content}
      </span>
    )
  })
}
