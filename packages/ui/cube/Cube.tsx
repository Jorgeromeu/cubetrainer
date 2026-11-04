import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Alg } from 'cubing/alg'
import { TwistyPlayer } from 'cubing/twisty'
import type { AlgTrigger, Slot } from '../../core/cube.ts'
import { moveKinds } from '../../core/notation/groups.ts'
import { isTextField } from '../keys.ts'
import { CAMERA_DISTANCE, HOLD_CROSS_ON_D, LL_PIECES, SLOT_PAIR } from './cubeModel.ts'
import { getCubeSettings, SPEEDS, updateCubeSettings, useCubeSettings } from './settings.ts'

type AlgIndexer = Awaited<ReturnType<TwistyPlayer['experimentalModel']['indexer']['get']>>

type FaceletMask = 'regular' | 'dim' | 'ignored' | 'invisible'
interface StickeringMask {
  orbits: Record<string, { pieces: { facelets: { mask: FaceletMask; hintMask: FaceletMask }[] }[] }>
}

export type HintMode = 'off' | 'pair' | 'all'

/** How a cube is drawn: the showing tool's choice (e.g. F2L's settings), not a shared setting. */
export interface CubeDisplay {
  /** Only the pair in full colour, the rest of F2L dimmed. Off = normal colours. */
  highlightPair: boolean
  /** Floating copies of hidden faces (big player only): for the pair, all of F2L, or none. */
  hints: HintMode
  /** Hint distance from the cube, in cubing.js units (stickers sit at ~0.5). */
  hintDistance: number
}

/** Plain: F2L in its normal colours, no hints. */
const PLAIN_DISPLAY: CubeDisplay = { highlightPair: false, hints: 'off', hintDistance: 0.95 }

/**
 * Last layer grey. With `highlightPair`, only the slot's pair is in full colour and the
 * rest of F2L (centers included) is dimmed; otherwise F2L keeps its normal colours.
 * Hint stickers are shown for the pair, all of F2L, or nothing.
 */
function cubeMask(pairSlot: Slot, { highlightPair, hints }: CubeDisplay): StickeringMask {
  const { corner, edge } = SLOT_PAIR[pairSlot]
  const orbit = (count: number, pairPiece: number | null) => ({
    pieces: Array.from({ length: count }, (_, i) => {
      const isPair = i === pairPiece
      const mask: FaceletMask = LL_PIECES.includes(i) ? 'ignored' : isPair || !highlightPair ? 'regular' : 'dim'
      const showHint = mask !== 'ignored' && (hints === 'all' || (hints === 'pair' && isPair))
      const hintMask: FaceletMask = showHint ? mask : 'invisible'
      return { facelets: Array.from({ length: 3 }, () => ({ mask, hintMask })) }
    }),
  })
  const centers = orbit(6, null)
  centers.pieces[5].facelets = [{ mask: 'ignored', hintMask: 'invisible' }] // last-layer center
  return { orbits: { EDGES: orbit(12, edge), CORNERS: orbit(8, corner), CENTERS: centers } }
}

// Camera longitude per slot. 0 = looking straight at the green front face; the camera
// never turns more than 30° from that, just enough to lean toward the slot's side.
// Back slots get the full 30° so a bit more of their side face is visible.
const SLOT_LONGITUDE: Record<Slot, number> = {
  FR: 20,
  FL: -20,
  BR: 30,
  BL: -30,
}
const CAMERA_TURN_MS = 450

/** A camera position in degrees, as cubing.js orbit coordinates. */
type View = { latitude: number; longitude: number }

/** Manual stepping always turns this fast (quicker than any playback speed); the speed setting is for playback. */
const STEP_SPEED = 5

const FORWARDS = 1
const BACKWARDS = -1

export interface CubeProps {
  setup: string
  alg?: string
  slot?: Slot
  /** The alg's marked triggers, for the move strip (CatalogAlg.triggers). */
  triggers?: readonly AlgTrigger[]
  /** Whose home corner + edge are the pair (see caseSetup); defaults to `slot`. */
  pairSlot?: Slot
  size: number
  /** Drag to turn the view; with `controls`, the player (play, step, move strip, keys) too. */
  interactive?: boolean
  /** Interactive only: show the player controls (default). Off, the cube can still be turned. */
  controls?: boolean
  /** The wheel (or a trackpad pinch) over the cube zooms it, instead of scrolling the page. */
  zoomable?: boolean
  /** Where the player rests when the alg changes: before it (default) or after it, e.g. to preview moves as they're typed. */
  at?: 'start' | 'end'
  /** How it's drawn (highlighting, hints): the showing tool's settings; plain by default. */
  display?: CubeDisplay
}

/** How far the wheel can zoom the camera in and out. */
const ZOOM_RANGE = [3.5, 12] as const

export function Cube({
  setup,
  alg = '',
  triggers,
  slot = 'FR',
  pairSlot = slot,
  size,
  interactive = false,
  controls = true,
  zoomable = false,
  at = 'start',
  display = PLAIN_DISPLAY,
}: CubeProps) {
  const [player, setPlayer] = useState<TwistyPlayer | null>(null)

  // Mount a TwistyPlayer into the container; recreated only if `interactive` changes.
  const containerRef = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container) return
      const p = new TwistyPlayer({
        puzzle: '3x3x3',
        background: 'none',
        controlPanel: 'none',
        hintFacelets: 'none',
        experimentalDragInput: interactive ? 'auto' : 'none',
        tempoScale: getCubeSettings().tempo,
        cameraDistance: CAMERA_DISTANCE,
      })
      p.style.width = '100%'
      p.style.height = '100%'
      container.appendChild(p)
      setPlayer(p)
      return () => {
        p.remove()
        setPlayer(null)
      }
    },
    [interactive],
  )

  useEffect(() => {
    if (player) showCase(player, setup, alg, at)
  }, [player, setup, alg, at])

  // Wheel zoom: moves the camera nearer or further (a new player starts at the default).
  useEffect(() => {
    if (!player || !zoomable) return
    let distance = CAMERA_DISTANCE
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      distance = Math.min(ZOOM_RANGE[1], Math.max(ZOOM_RANGE[0], distance * Math.exp(e.deltaY * 0.002)))
      player.cameraDistance = distance
    }
    player.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      player.removeEventListener('wheel', onWheel)
      player.cameraDistance = CAMERA_DISTANCE
    }
  }, [player, zoomable])

  const { tempo } = useCubeSettings()
  const { highlightPair, hints, hintDistance } = display
  useEffect(() => {
    if (!player) return
    setMask(player, cubeMask(pairSlot, { highlightPair, hints, hintDistance }))
    // Hints only on the big player; in the small cubes they'd be too tiny to read.
    setHints(player, interactive && hints !== 'off', hintDistance)
  }, [player, pairSlot, interactive, highlightPair, hints, hintDistance])
  useEffect(() => {
    if (player) player.tempoScale = tempo
  }, [player, tempo])

  // The camera leans toward the slot: placed at once on a new player, animated after.
  const cameraTurn = useRef(0)
  const placed = useRef<{ player: TwistyPlayer; slot: Slot } | null>(null)
  useEffect(() => {
    if (!player) return
    const isNew = placed.current?.player !== player
    if (!isNew && placed.current?.slot === slot) return
    placed.current = { player, slot }
    const turn = ++cameraTurn.current
    void moveCamera(player, { longitude: SLOT_LONGITUDE[slot] }, isNew ? 0 : CAMERA_TURN_MS, () => turn === cameraTurn.current)
  }, [player, slot])

  const cube = <div ref={containerRef} className="cube" style={{ width: size, maxWidth: '100%', aspectRatio: '1' }} />
  if (!interactive || !controls) return cube
  return (
    <div className="player">
      {cube}
      {player && <PlayerControls player={player} alg={alg} triggers={triggers} />}
    </div>
  )
}

function showCase(player: TwistyPlayer, setup: string, alg: string, at: 'start' | 'end') {
  player.experimentalSetupAlg = `${HOLD_CROSS_ON_D} ${setup}`
  player.alg = alg
  player.timestamp = at
}

function setMask(player: TwistyPlayer, mask: StickeringMask) {
  player.experimentalStickeringMaskOrbits = mask
}

function setHints(player: TwistyPlayer, show: boolean, distance: number) {
  player.hintFacelets = show ? 'floating' : 'none'
  player.experimentalHintFaceletsElevation = distance
}

function setView(player: TwistyPlayer, { latitude, longitude }: View) {
  player.cameraLatitude = latitude
  player.cameraLongitude = longitude
}

async function currentView(player: TwistyPlayer): Promise<View> {
  const { latitude, longitude } = await player.experimentalModel.twistySceneModel.orbitCoordinates.get()
  return { latitude, longitude }
}

/**
 * Moves the camera from wherever it is (the user may have dragged it) to `to`, over `ms`
 * (0 = at once). Resolves true once there, false if another move took over first.
 */
async function moveCamera(player: TwistyPlayer, to: Partial<View>, ms: number, isCurrent: () => boolean) {
  const from = await currentView(player)
  if (!isCurrent()) return false
  const dLatitude = (to.latitude ?? from.latitude) - from.latitude
  const dLongitude = (((((to.longitude ?? from.longitude) - from.longitude) % 360) + 540) % 360) - 180 // shortest way round
  const at = (k: number) => ({ latitude: from.latitude + dLatitude * k, longitude: from.longitude + dLongitude * k })
  if (ms === 0 || (Math.abs(dLatitude) < 0.5 && Math.abs(dLongitude) < 0.5)) {
    setView(player, at(1))
    return true
  }
  const start = performance.now()
  return new Promise<boolean>((resolve) => {
    const frame = (now: number) => {
      if (!isCurrent()) return resolve(false)
      const t = Math.min(1, (now - start) / ms)
      setView(player, at(1 - (1 - t) ** 3))
      if (t < 1) requestAnimationFrame(frame)
      else resolve(true)
    }
    requestAnimationFrame(frame)
  })
}

/** Sets the player's position in ms (TimestampRequest is a tagged number type). */
function seek(player: TwistyPlayer, ms: number) {
  player.timestamp = ms as never
}


function PlayerControls({ player, alg, triggers }: { player: TwistyPlayer; alg: string; triggers?: readonly AlgTrigger[] }) {
  const model = player.experimentalModel
  const [playing, setPlaying] = useState(false)
  const [timeline, setTimeline] = useState({
    timestamp: 0,
    start: 0,
    end: 0,
    atStart: true,
    atEnd: true,
  })
  /** [start, end] timestamp of each animated move. */
  const [moveSpans, setMoveSpans] = useState<[number, number][]>([])
  const speed = useCubeSettings().tempo

  useEffect(() => {
    const onPlaying = (info: { playing: boolean }) => setPlaying(info.playing)
    const onTimeline = (info: {
      timestamp: number
      timeRange: { start: number; end: number }
      atStart: boolean
      atEnd: boolean
    }) =>
      setTimeline({
        timestamp: info.timestamp,
        start: info.timeRange.start,
        end: info.timeRange.end,
        atStart: info.atStart,
        atEnd: info.atEnd,
      })
    const onIndexer = (indexer: AlgIndexer) =>
      setMoveSpans(
        Array.from({ length: indexer.numAnimatedLeaves() }, (_, i) => {
          const start = indexer.indexToMoveStartTimestamp(i as never)
          return [start, start + indexer.moveDuration(i as never)]
        }),
      )
    model.playingInfo.addFreshListener(onPlaying)
    model.detailedTimelineInfo.addFreshListener(onTimeline)
    model.indexer.addFreshListener(onIndexer)
    return () => {
      model.playingInfo.removeFreshListener(onPlaying)
      model.detailedTimelineInfo.removeFreshListener(onTimeline)
      model.indexer.removeFreshListener(onIndexer)
    }
  }, [model])

  // The cube only rests between moves: the start, then the end of each move.
  const stops = [timeline.start, ...moveSpans.map(([, end]) => end)]
  const nearestStop = (ms: number) => stops.reduce((best, s) => (Math.abs(s - ms) < Math.abs(best - ms) ? s : best))

  // Stepping and settling glide the timestamp towards a target stop ourselves rather than
  // using cubing.js's play(), which ignores input until the move finishes. Each step moves
  // the target one more stop, and the glide speeds up while several moves are queued.
  const glide = useRef({ pos: 0, target: null as number | null, last: 0, frame: 0 })
  const moveMs = moveSpans.length ? (timeline.end - timeline.start) / moveSpans.length : 1000
  const glideTo = (target: number) => {
    const g = glide.current
    animation.pause()
    if (g.target === null) {
      g.pos = timeline.timestamp
      g.last = performance.now()
      g.frame = requestAnimationFrame(glideFrame)
    }
    g.target = target
  }
  const glideFrame = (now: number) => {
    const g = glide.current
    if (g.target === null) return
    const remaining = g.target - g.pos
    const rate = STEP_SPEED * Math.max(1, Math.abs(remaining) / moveMs)
    const distance = Math.min(Math.abs(remaining), rate * (now - g.last))
    g.pos += Math.sign(remaining) * distance
    g.last = now
    seek(player, g.pos)
    if (g.pos === g.target) g.target = null
    else g.frame = requestAnimationFrame(glideFrame)
  }
  const stopGlide = () => {
    cancelAnimationFrame(glide.current.frame)
    glide.current.target = null
  }
  useEffect(() => stopGlide, [])

  const animation = player.controller.animationController
  const togglePlay = () => {
    stopGlide()
    if (playing) animation.pause()
    else animation.play({ autoSkipToOtherEndIfStartingAtBoundary: true })
  }
  const step = (direction: typeof FORWARDS | typeof BACKWARDS) => {
    const from = glide.current.target ?? timeline.timestamp
    // At either end there's no further stop, so it stays put rather than wrapping round.
    const next = direction === FORWARDS ? stops.find((s) => s > from) : [...stops].reverse().find((s) => s < from)
    if (next !== undefined) glideTo(next)
  }
  const jumpToStart = () => {
    stopGlide()
    player.controller.jumpToStart({ flash: false })
  }
  const jumpToEnd = () => {
    stopGlide()
    player.controller.jumpToEnd({ flash: false })
  }
  const jumpAfterMove = (i: number) => {
    stopGlide()
    animation.pause()
    if (moveSpans[i]) seek(player, moveSpans[i][1])
  }
  const changeSpeed = (tempo: number) => updateCubeSettings({ tempo })

  // Keyboard: space = play/pause, ←/→ = step, Home/End = jump. Works even when a player
  // button or the scrubber has focus (after a click); only text fields keep their keys.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    // Shift+arrows are left to the page (e.g. F2L's previous/next cluster).
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (isTextField(e.target)) return
    const handlers: Record<string, () => void> = {
      ' ': togglePlay,
      ArrowRight: () => step(FORWARDS),
      ArrowLeft: () => step(BACKWARDS),
      Home: jumpToStart,
      End: jumpToEnd,
    }
    const handler = handlers[e.key]
    if (handler) {
      e.preventDefault()
      // A focused button would also "click" on space's keyup.
      if (e.target instanceof HTMLButtonElement) e.target.blur()
      handler()
    }
  })
  useEffect(() => {
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const moves = alg ? [...new Alg(alg).childAlgNodes()].map(String) : []
  const kinds = moveKinds(moves, triggers)

  // Dragging the scrubber is free, but on release the cube glides on to the nearest stop.
  const settle = () => {
    const target = nearestStop(timeline.timestamp)
    if (target !== timeline.timestamp) glideTo(target)
  }
  const fraction = (ms: number) =>
    timeline.end > timeline.start ? (ms - timeline.start) / (timeline.end - timeline.start) : 0

  return (
    <div className="controls">
      {moves.length > 0 && (
        <div className="move-strip" aria-label="Moves">
          {moves.map((m, i) => {
            const [start, end] = moveSpans[i] ?? [Infinity, Infinity]
            const state = timeline.timestamp >= end ? ' done' : timeline.timestamp > start ? ' current' : ''
            return (
              <button
                key={i}
                className={'move' + state + (kinds[i] === 'turn' ? '' : ` ${kinds[i]}-move`)}
                onClick={() => jumpAfterMove(i)}
                title="Jump to after this move"
                data-move={m}
              >
                {m}
              </button>
            )
          })}
        </div>
      )}

      <div className="scrubber-track" style={{ ['--progress' as string]: `${fraction(timeline.timestamp) * 100}%` }}>
        <input
          className="scrubber"
          type="range"
          min={timeline.start}
          max={timeline.end}
          value={timeline.timestamp}
          disabled={timeline.end === timeline.start}
          onChange={(e) => {
            stopGlide()
            animation.pause()
            seek(player, Number(e.target.value))
          }}
          onPointerUp={settle}
          onPointerCancel={settle}
          aria-label="Timeline"
        />
        {timeline.end > timeline.start &&
          stops.map((ms, i) =>
            ms === timeline.timestamp ? null : (
              <span
                key={i}
                className={'scrubber-stop' + (ms <= timeline.timestamp ? ' passed' : '')}
                style={{ ['--at' as string]: fraction(ms) }}
              />
            ),
          )}
      </div>

      <div className="control-row">
        <div className="transport">
          <IconButton label="Restart (Home)" onClick={jumpToStart} disabled={timeline.atStart}>
            <path d="M6 5h2v14H6zM20 5v14L9.5 12z" />
          </IconButton>
          <IconButton label="Step back (←)" onClick={() => step(BACKWARDS)} disabled={timeline.atStart}>
            <path d="M18 5v14L8 12z" />
          </IconButton>
          <IconButton
            label={playing ? 'Pause (space)' : 'Play (space)'}
            onClick={togglePlay}
            primary
            disabled={!moves.length}
          >
            {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
          </IconButton>
          <IconButton label="Step forward (→)" onClick={() => step(FORWARDS)} disabled={timeline.atEnd}>
            <path d="M6 5v14l10-7z" />
          </IconButton>
          <IconButton label="End (End)" onClick={jumpToEnd} disabled={timeline.atEnd}>
            <path d="M16 5h2v14h-2zM4 5v14l10.5-7z" />
          </IconButton>
        </div>
        <div className="speed" role="group" aria-label="Speed">
          {SPEEDS.map(({ label, tempo }) => (
            <button key={tempo} className={tempo === speed ? 'active' : undefined} onClick={() => changeSpeed(tempo)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface IconButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  children: React.ReactNode
}

function IconButton({ label, onClick, disabled, primary, children }: IconButtonProps) {
  return (
    <button
      className={'icon-button' + (primary ? ' primary' : '')}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" width={primary ? 22 : 18} height={primary ? 22 : 18} fill="currentColor">
        {children}
      </svg>
    </button>
  )
}
