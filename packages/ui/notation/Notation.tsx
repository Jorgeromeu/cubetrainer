import { Fragment, type ReactNode } from 'react'
import { TRIGGER_NAMES, type AlgTrigger } from '../../core/cube.ts'
import { isRotation } from '../../core/notation/moves.ts'
import { groupMoves, splitMoves } from '../../core/notation/groups.ts'

interface Props {
  moves: string
  /** The alg's marked triggers (CatalogAlg.triggers); none for setups and scrambles. */
  triggers?: readonly AlgTrigger[]
  /** Wraps a trigger's markup, e.g. to give it a richer tooltip than its name. */
  wrapTrigger?: (trigger: AlgTrigger, content: ReactNode) => ReactNode
}

/**
 * Moves as text, marked up the same way everywhere (see notation.ts): rotations in their
 * colour, marked triggers in theirs and in parentheses, named on hover. Each move shows
 * the app-wide move hint on hover (MoveHint.tsx); outside triggers, an empty title keeps
 * an enclosing element's own tooltip from showing over it.
 */
export function Notation({ moves, triggers, wrapTrigger }: Props) {
  return groupMoves(splitMoves(moves), triggers).map(({ moves, trigger }, i) => {
    const space = i > 0 && ' '
    if (!trigger) {
      const [move] = moves
      return (
        <Fragment key={i}>
          {space}
          <span className={isRotation(move) ? 'rotation-move' : undefined} data-move={move} title="">
            {move}
          </span>
        </Fragment>
      )
    }
    // Its moves keep no title of their own, so the trigger's name still shows over them.
    const content = (
      <span className="trigger-moves" title={wrapTrigger ? undefined : TRIGGER_NAMES[trigger.kind]}>
        (
        {moves.map((move, k) => (
          <Fragment key={k}>
            {k > 0 && ' '}
            <span data-move={move}>
              {move}
            </span>
          </Fragment>
        ))}
        )
      </span>
    )
    return (
      <Fragment key={i}>
        {space}
        {wrapTrigger ? wrapTrigger(trigger, content) : content}
      </Fragment>
    )
  })
}
