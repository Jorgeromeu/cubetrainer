// How cubes are displayed (Settings → Cube display), for every trainer. A per-browser
// preference, kept in localStorage and shared live.
import { persisted } from '../persisted.ts'

export type HintMode = 'off' | 'pair' | 'all'

export interface CubeSettings {
  /** Pair in full colour, the rest of F2L dimmed. Off = normal colours. */
  highlightPair: boolean
  /** Floating stickers showing hidden faces (big player only). */
  hints: HintMode
  /** Hint distance from the cube, in cubing.js units (stickers sit at ~0.5). */
  hintDistance: number
}

export const HINT_DISTANCE = { min: 0.8, max: 1.6, step: 0.05 }

export const DEFAULT_CUBE_SETTINGS: CubeSettings = {
  highlightPair: true,
  hints: 'pair',
  // cubing.js's default is 1.45, which floats the hints quite far from the cube.
  hintDistance: 0.95,
}

const cubeSettings = persisted<CubeSettings>(
  'cubetrainer.cubeSettings',
  DEFAULT_CUBE_SETTINGS,
  (s) =>
    typeof s.highlightPair === 'boolean' &&
    ['off', 'pair', 'all'].includes(s.hints) &&
    s.hintDistance >= HINT_DISTANCE.min &&
    s.hintDistance <= HINT_DISTANCE.max,
)

export const updateCubeSettings = cubeSettings.update
export const useCubeSettings = cubeSettings.use
