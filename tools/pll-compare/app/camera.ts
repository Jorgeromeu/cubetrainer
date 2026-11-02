// The board's camera. Each cube is turned on its own by dragging it, and when it's let go
// (and its glide has stopped) it snaps to the nearest two-sided view: the angle you
// recognise from, looking mostly at one side and a little at the next (PLL is read from the
// sides, so never the top). ←/→ over a cube turn it between those views (rotate). The zoom
// and the view presets are shared: they set every cube at once.
import type { TwistyPlayer } from 'cubing/twisty'
import { CAMERA_DISTANCE } from '../../../packages/ui/cube/cubeModel.ts'

export interface View {
  latitude: number
  longitude: number
  distance: number
}

/** Where the camera looks from, in degrees (cubing.js orbit coordinates; longitude 0 = straight at the front). */
export const PRESETS: { label: string; title: string; view: Pick<View, 'latitude' | 'longitude'> }[] = [
  { label: 'F + R', title: 'Front and right sides, as you look at them to recognise', view: { latitude: 30, longitude: 40 } },
  { label: 'F + L', title: 'Front and left sides', view: { latitude: 30, longitude: -40 } },
]

const DISTANCE = { min: 4, max: 10 }

/** The two-sided views: this far round from a side, at the presets' height. */
const SNAP_OFF_SIDE = 40
const SNAP_LATITUDE = 30
/** No camera move for this long after letting go: the glide is over. */
const SETTLE_MS = 80
const SNAP_MS = 180

/** The nearest two-sided view to where the camera is (from below if it's below). */
export function snapView({ latitude, longitude }: Pick<View, 'latitude' | 'longitude'>) {
  const side = Math.round(longitude / 90) * 90
  return {
    latitude: latitude < 0 ? -SNAP_LATITUDE : SNAP_LATITUDE,
    longitude: side + (longitude >= side ? SNAP_OFF_SIDE : -SNAP_OFF_SIDE),
  }
}

/** The way from one longitude to another, the short way round. */
const turnTo = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180

type Angles = Pick<View, 'latitude' | 'longitude'>

export class BoardCamera {
  private view: View = { ...PRESETS[0].view, distance: CAMERA_DISTANCE }
  private players = new Set<TwistyPlayer>()
  /** Each cube's glide to a new view, by its id. */
  private glides = new Map<number, (to: (from: Angles) => Angles) => void>()

  /** Puts a player on the board, dragged within `container`. Returns the cleanup. */
  add(player: TwistyPlayer, container: HTMLElement, id: number): () => void {
    apply(player, this.view)
    const coordinates = player.experimentalModel.twistySceneModel.orbitCoordinates
    let dragging = false
    let settle: ReturnType<typeof setTimeout> | undefined
    /** Bumped to stop a glide in progress. */
    let glideId = 0
    /** Where a glide in progress is going. */
    let heading: Angles | null = null

    /** Glides to `to(where it's going)`: where it is, or where a glide in progress ends. */
    const glide = async (to: (from: Angles) => Angles) => {
      const id = ++glideId
      const from = await coordinates.get()
      if (id !== glideId) return
      const target = to(heading ?? from)
      heading = target
      const longitudeBy = turnTo(from.longitude, target.longitude)
      const start = performance.now()
      const step = (now: number) => {
        if (id !== glideId) return
        const t = Math.min(1, (now - start) / SNAP_MS)
        const eased = 1 - (1 - t) ** 3
        apply(player, {
          latitude: from.latitude + (target.latitude - from.latitude) * eased,
          longitude: from.longitude + longitudeBy * eased,
        })
        if (t < 1) requestAnimationFrame(step)
        else heading = null
      }
      requestAnimationFrame(step)
    }
    const stopGlide = () => {
      glideId++
      heading = null
    }

    const settleThenSnap = () => {
      clearTimeout(settle)
      settle = setTimeout(() => {
        settle = undefined
        void glide(snapView)
      }, SETTLE_MS)
    }
    // While gliding after the drag, each move puts the snap off again.
    const onMove = () => {
      if (!dragging && settle !== undefined) settleThenSnap()
    }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging = true
      stopGlide()
      clearTimeout(settle)
      settle = undefined
    }
    const onUp = () => {
      if (!dragging) return
      dragging = false
      settleThenSnap()
    }
    coordinates.addFreshListener(onMove)
    container.addEventListener('pointerdown', onDown)
    addEventListener('pointerup', onUp)
    addEventListener('pointercancel', onUp)
    this.players.add(player)
    this.glides.set(id, glide)
    return () => {
      stopGlide()
      clearTimeout(settle)
      coordinates.removeFreshListener(onMove)
      container.removeEventListener('pointerdown', onDown)
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onUp)
      this.players.delete(player)
      this.glides.delete(id)
    }
  }

  /** Turns a cube's view `by` quarter turns (positive as y: R comes to the front), keeping its two-sided lean. */
  rotate(id: number, by: number) {
    this.glides.get(id)?.((from) => {
      const { latitude, longitude } = snapView(from)
      return { latitude, longitude: longitude + by * 90 }
    })
  }

  set(view: Partial<View>) {
    this.view = { ...this.view, ...view }
    this.players.forEach((p) => apply(p, view))
  }

  /** Zooms by a factor: above 1 is further away. */
  zoom(factor: number) {
    const distance = Math.min(DISTANCE.max, Math.max(DISTANCE.min, this.view.distance * factor))
    if (distance !== this.view.distance) this.set({ distance })
  }

  resetZoom() {
    this.set({ distance: CAMERA_DISTANCE })
  }
}

function apply(player: TwistyPlayer, { latitude, longitude, distance }: Partial<View>) {
  if (latitude !== undefined) player.cameraLatitude = latitude
  if (longitude !== undefined) player.cameraLongitude = longitude
  if (distance !== undefined) player.cameraDistance = distance
}
