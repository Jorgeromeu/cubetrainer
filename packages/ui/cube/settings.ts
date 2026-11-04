// The one setting about every 3D cube, owned by this library (`ui.cube`): the player's
// playback speed, set from its own buttons and the same in every tool. How a tool's cubes are
// drawn (which pieces are highlighted, hint stickers) is that tool's, passed as Cube's
// `display` prop.
import { setting } from '../settings/setting.ts'

export interface CubeSettings {
  /** Playback speed: cubing.js tempoScale, one of SPEEDS. */
  tempo: number
}

/** The player's speeds (tempoScale; 1 is cubing.js's ~1 s per quarter turn). */
export const SPEEDS = [
  { label: 'Slow', tempo: 0.75 },
  { label: 'Normal', tempo: 1.5 },
  { label: 'Fast', tempo: 3 },
]

const cubeSettings = setting<CubeSettings>('ui.cube', { tempo: 1.5 }, (s) => SPEEDS.some((speed) => speed.tempo === s.tempo), {
  // The speed used to be kept per browser, on its own.
  migrate: (stored) => {
    if ('tempo' in stored) return { tempo: stored.tempo } as Partial<CubeSettings>
    const tempo = Number(localStorage.getItem('cubetrainer.tempo'))
    return SPEEDS.some((s) => s.tempo === tempo) ? { tempo } : {}
  },
  legacyKey: 'cubetrainer.tempo',
})

export const updateCubeSettings = cubeSettings.update
export const useCubeSettings = cubeSettings.use
export const getCubeSettings = cubeSettings.get
