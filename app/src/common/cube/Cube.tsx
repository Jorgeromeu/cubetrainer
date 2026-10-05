import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { TwistyPlayer } from 'cubing/twisty'
import type { AlgTrigger, Slot } from '../../../../shared/cube.ts'
import { moveKinds } from '../notation/notation.ts'
import { CAMERA_DISTANCE, HOLD_CROSS_ON_D, LL_PIECES, SLOT_PAIR } from './cubeModel.ts'
import { FlatCube, type Face, type FlatView } from './FlatCube.tsx'
import { useCubeSettings, type CubeSettings } from './settings.ts'
import { useStealth } from '../stealth.ts'
import { trackStealthColors } from './stealthCube.ts'

type AlgIndexer = Awaited<ReturnType<TwistyPlayer['experimentalModel']['indexer']['get']>>

type FaceletMask = 'regular' | 'dim' | 'ignored' | 'invisible'
interface StickeringMask {
  orbits: Record<string, { pieces: { facelets: { mask: FaceletMask; hintMask: FaceletMask }[] }[] }>
}

/**
 * Last layer grey. With `highlightPair`, only the slot's pair is in full colour and the
 * rest of F2L (centers included) is dimmed; otherwise F2L keeps its normal colours.
 * Hint stickers are shown for the pair, all of F2L, or nothing.
 */
function cubeMask(pairSlot: Slot, { highlightPair, hints }: CubeSettings): StickeringMask {
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

/** cubing.js's cap on looking down at the cube; stealth lifts it to allow a top-down view. */
const DEFAULT_LATITUDE_LIMIT = 35
const TOP_DOWN = 90

const roundToQuarter = (degrees: number) => Math.round(degrees / 90) * 90

/**
 * Where a cube lies flat in stealth mode: small cubes seen from straight above, the big
 * one from the straight-on side (or top/bottom) nearest to where it's looking.
 */
function flatView(view: View, interactive: boolean): View {
  const latitude = !interactive ? TOP_DOWN : Math.abs(view.latitude) > 45 ? Math.sign(view.latitude) * TOP_DOWN : 0
  return { latitude, longitude: roundToQuarter(view.longitude) }
}

const SIDE_AT_LONGITUDE: Record<number, Face> = { 0: 'F', 90: 'R', 180: 'B', [-90]: 'L' }
const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' }

/** A flat (straight-on) camera position as faces: which one it looks at, which is up. */
function facesOf({ latitude, longitude }: View): FlatView {
  const side = SIDE_AT_LONGITUDE[((((roundToQuarter(longitude) % 360) + 540) % 360) - 180) as 0 | 90 | -90] ?? 'B'
  if (latitude === TOP_DOWN) return { toward: 'U', up: OPPOSITE[side] }
  if (latitude === -TOP_DOWN) return { toward: 'D', up: side }
  return { toward: side, up: 'U' }
}

// tempoScale per speed; 1 is cubing.js's default (~1s per quarter turn).
const SPEEDS = [
  { label: 'Slow', tempo: 1.5 },
  { label: 'Normal', tempo: 3 },
  { label: 'Fast', tempo: 5 },
]
const DEFAULT_SPEED = 3
/** Manual stepping always turns at the fastest speed; the speed setting is for playback. */
const STEP_SPEED = SPEEDS[SPEEDS.length - 1].tempo
const SPEED_KEY = 'cubetrainer.tempo'

const FORWARDS = 1
const BACKWARDS = -1

interface Props {
  setup: string
  alg?: string
  slot?: Slot
  /** The alg's marked triggers, for the move strip (CatalogAlg.triggers). */
  triggers?: readonly AlgTrigger[]
  /** Whose home corner + edge are the pair (see caseSetup); defaults to `slot`. */
  pairSlot?: Slot
  size: number
  interactive?: boolean
}

export function Cube({ setup, alg = '', triggers, slot = 'FR', pairSlot = slot, size, interactive = false }: Props) {
  const [player, setPlayer] = useState<TwistyPlayer | null>(null)
  const [hovered, setHovered] = useState(false)
  const stealth = useStealth()
  /** Stealth mode, not hovered: the cube lies flat (see the camera effect below). */
  const flat = stealth && !hovered

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
        tempoScale: loadSpeed(),
        cameraDistance: CAMERA_DISTANCE,
      })
      p.style.width = '100%'
      p.style.height = '100%'
      container.appendChild(p)
      setPlayer(p)
      const untrackStealth = trackStealthColors(p)

      // Hovering the cube's card or slot cell (or just the cube) counts as looking at it.
      // Leaving mid-drag (big cube) is settled when the button is released.
      const scope = container.closest('[data-reveal]') ?? container
      const onEnter = () => setHovered(true)
      const onLeave = (e: Event) => {
        if (!(e as PointerEvent).buttons) setHovered(false)
        else addEventListener('pointerup', () => setHovered(scope.matches(':hover')), { once: true })
      }
      scope.addEventListener('pointerenter', onEnter)
      scope.addEventListener('pointerleave', onLeave)
      return () => {
        scope.removeEventListener('pointerenter', onEnter)
        scope.removeEventListener('pointerleave', onLeave)
        untrackStealth()
        p.remove()
        setPlayer(null)
        setHovered(false)
      }
    },
    [interactive],
  )

  useEffect(() => {
    if (player) showCase(player, setup, alg)
  }, [player, setup, alg])

  const settings = useCubeSettings()
  useEffect(() => {
    if (!player) return
    setMask(player, cubeMask(pairSlot, settings))
    // Hints only on the big player; in the small cubes they'd be too tiny to read. Not
    // while it lies flat either: they'd poke out around the face as slivers.
    setHints(player, interactive && !flat && settings.hints !== 'off', settings.hintDistance)
  }, [player, pairSlot, interactive, settings, flat])

  // The camera leans toward the slot. In stealth mode, a cube that isn't hovered lies flat
  // (see flatView) and hovering turns it back to its own view, kept in `ownView` while it's
  // flat or on its way back. The first placement is instant, later moves animate.
  const cameraTurn = useRef(0)
  /** The flat view the camera rests in (or is heading to), for the flat drawing. */
  const [flatAt, setFlatAt] = useState<View | null>(null)
  const placed = useRef<{ player: TwistyPlayer; slot: Slot } | null>(null)
  const ownView = useRef<View | null>(null)
  useEffect(() => {
    if (!player) return
    const isNew = placed.current?.player !== player
    const slotChanged = isNew || placed.current?.slot !== slot
    placed.current = { player, slot }
    if (isNew) ownView.current = null
    const turn = ++cameraTurn.current
    const isCurrent = () => turn === cameraTurn.current
    const move = (to: Partial<View>) => moveCamera(player, to, isNew ? 0 : CAMERA_TURN_MS, isCurrent)
    const longitude = SLOT_LONGITUDE[slot]
    const aimed = (view: View) => (slotChanged ? { ...view, longitude } : view)
    if (stealth) setLatitudeLimit(player, TOP_DOWN)

    void (async () => {
      if (flat) {
        const own = ownView.current ?? (await currentView(player))
        if (!isCurrent()) return
        ownView.current = aimed(own)
        const target = flatView(ownView.current, interactive)
        setFlatAt(target)
        await move(target)
      } else if (ownView.current) {
        ownView.current = aimed(ownView.current)
        if (!(await move(ownView.current))) return
        ownView.current = null
        if (!stealth) setLatitudeLimit(player, DEFAULT_LATITUDE_LIMIT)
      } else if (slotChanged) {
        await move({ longitude })
      }
    })()
  }, [player, slot, interactive, stealth, flat])

  // While flat, a small cube's player gives way to a 2D drawing (FlatCube): the same
  // picture plus the side stickers around it. Hovering swaps the player back in, then it
  // turns. The big cube keeps its player throughout.
  const [pattern, setPattern] = useState<KPattern | null>(null)
  useEffect(() => {
    if (!player || !stealth || interactive) return
    const currentPattern = player.experimentalModel.currentPattern
    const onPattern = (p: KPattern) => setPattern(p)
    currentPattern.addFreshListener(onPattern)
    return () => currentPattern.removeFreshListener(onPattern)
  }, [player, stealth, interactive])

  const cube = (
    <div ref={containerRef} className="cube" style={{ width: size, maxWidth: '100%', aspectRatio: '1' }}>
      {flat && !interactive && flatAt && pattern && (
        <FlatCube pattern={pattern} pairSlot={pairSlot} highlightPair={settings.highlightPair} view={facesOf(flatAt)} />
      )}
    </div>
  )
  if (!interactive) return cube
  return (
    <div className="player">
      {cube}
      {player && <PlayerControls player={player} alg={alg} triggers={triggers} />}
    </div>
  )
}

function showCase(player: TwistyPlayer, setup: string, alg: string) {
  player.experimentalSetupAlg = `${HOLD_CROSS_ON_D} ${setup}`
  player.alg = alg
  player.timestamp = 'start'
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

function setLatitudeLimit(player: TwistyPlayer, degrees: number) {
  player.cameraLatitudeLimit = degrees
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

function setTempo(player: TwistyPlayer, speed: number) {
  player.tempoScale = speed
}

function loadSpeed(): number {
  try {
    const saved = Number(localStorage.getItem(SPEED_KEY))
    return SPEEDS.some((s) => s.tempo === saved) ? saved : DEFAULT_SPEED
  } catch {
    return DEFAULT_SPEED
  }
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
  const [speed, setSpeed] = useState(loadSpeed)

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
  const changeSpeed = (s: number) => {
    setSpeed(s)
    setTempo(player, s)
    try {
      localStorage.setItem(SPEED_KEY, String(s))
    } catch {
      // Private mode etc.: the speed just isn't remembered.
    }
  }

  // Keyboard: space = play/pause, ←/→ = step, Home/End = jump. Works even when a player
  // button or the scrubber has focus (after a click); only text fields keep their keys.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('input:not([type=range]), textarea, select, [contenteditable]')
    )
      return
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
