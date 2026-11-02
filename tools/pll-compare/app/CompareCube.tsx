// One cube on the board: a cubing.js player under the board's camera (camera.ts), showing
// its setup and its blocks' stickers framed (marks.ts). A change of turn animates (the top
// layer turning); anything else jumps. Shift+click picks the sticker under the pointer.
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { TwistyPlayer } from 'cubing/twisty'
import { CAMERA_DISTANCE, HOLD_CROSS_ON_D } from '../../../packages/ui/cube/cubeModel.ts'
import { trackStealthColors } from '../../../packages/ui/cube/stealthCube.ts'
import { quarters, U_TURNS, type Block } from './board.ts'
import type { BoardCamera } from './camera.ts'
import { markAt, showMarks } from './marks.ts'

/** A quick turn: cubing.js's 1 is about a second per quarter turn. */
const TEMPO = 3

interface Props {
  /** The cube's key on the board, for the camera's keys. */
  id: number
  base: string
  turn: number
  blocks: readonly Block[] | undefined
  camera: BoardCamera
  onPick: (sticker: string) => void
}

export function CompareCube({ id, base, turn, blocks, camera, onPick }: Props) {
  const [player, setPlayer] = useState<TwistyPlayer | null>(null)
  const pick = useEffectEvent(onPick)

  const containerRef = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container) return
      const p = new TwistyPlayer({
        puzzle: '3x3x3',
        background: 'none',
        controlPanel: 'none',
        hintFacelets: 'none',
        experimentalDragInput: 'auto',
        tempoScale: TEMPO,
        cameraDistance: CAMERA_DISTANCE,
      })
      p.style.width = '100%'
      p.style.height = '100%'
      container.appendChild(p)
      setPlayer(p)
      const untrackStealth = trackStealthColors(p)
      const unshare = camera.add(p, container, id)
      return () => {
        unshare()
        untrackStealth()
        p.remove()
        setPlayer(null)
      }
    },
    [camera, id],
  )

  // What the player shows now, to tell a turn (animated) from any other change.
  const shown = useRef<{ player: TwistyPlayer; base: string; turn: number } | null>(null)
  useEffect(() => {
    if (!player) return
    const before = shown.current
    shown.current = { player, base, turn }
    const turned = before?.player === player && before.base === base && before.turn !== turn
    if (turned) show(player, `${base} ${U_TURNS[before.turn]}`, U_TURNS[quarters(turn - before.turn)])
    else show(player, `${base} ${U_TURNS[turn]}`, '')
  }, [player, base, turn])

  // Shift+click, caught on the way down, before cubing.js starts a drag.
  useEffect(() => {
    const container = player?.parentElement
    if (!player || !container) return
    const onShiftPress = (e: PointerEvent) => {
      if (!e.shiftKey || e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      void markAt(player, e.clientX, e.clientY).then((sticker) => sticker && pick(sticker))
    }
    container.addEventListener('pointerdown', onShiftPress, { capture: true })
    return () => container.removeEventListener('pointerdown', onShiftPress, { capture: true })
  }, [player])

  useEffect(() => {
    if (!player) return
    void showMarks(player, new Map((blocks ?? []).flatMap((b) => b.stickers.map((s) => [s, b.color] as const))))
  }, [player, blocks])

  return <div ref={containerRef} className="cube compare-cube" />
}

/** Shows `setup`, then plays `alg` from there (if any). */
function show(player: TwistyPlayer, setup: string, alg: string) {
  player.experimentalSetupAlg = `${HOLD_CROSS_ON_D} ${setup}`
  player.alg = alg
  player.timestamp = 'start'
  if (alg) player.play()
}
