// Grey stickers for stealth mode. cubing.js has no API for sticker colours: its 3D
// renderer (Cube3D.ts) hardcodes them as three.js materials, created once and shared by
// every player on the page. So we find those materials in each player's scene graph and
// recolour them in place, which recolours every cube at once. This leans on internals
// (an experimental accessor, shared materials, the colour constants below): recheck it
// when upgrading cubing.js.
import type { TwistyPlayer } from 'cubing/twisty'
import type { Color, Mesh, MeshBasicMaterial, Object3D } from 'three'
import { isStealth, subscribeStealth } from '../stealth.ts'

/**
 * Last layer black, white stays white, and the pair's two side colours as two greys. A
 * pair's sides are always adjacent faces, never opposite ones, so green and blue can
 * share one grey and red and orange the other: every pair still gets two distinct tones.
 * The rest of F2L (dimmed when only the pair is highlighted) goes near-black.
 */
export type Role = 'white' | 'greenBlue' | 'redOrange' | 'lastLayer' | 'dim'

/** Written like cubing.js's own constants, which it treats as linear colours (they show as written). */
const STEALTH_COLOR: Record<Role, number> = {
  white: 0xffffff,
  greenBlue: 0xa0a0a0,
  redOrange: 0x505050,
  lastLayer: 0x000000,
  dim: 0x141414,
}

/** A role's colour as it appears on screen, for the flat drawing (FlatCube.tsx). */
export const stealthScreenColor = (role: Role) => `#${STEALTH_COLOR[role].toString(16).padStart(6, '0')}`

/** cubing.js's sticker colours (regular, dim and hint variants) by role. */
const CUBING_COLORS: [number, Role][] = [
  [0xffffff, 'white'],
  [0x00ff00, 'greenBlue'],
  [0x2266ff, 'greenBlue'],
  [0xff9900, 'redOrange'],
  [0xff0000, 'redOrange'],
  // Yellow (the last layer's face, after z2) and the grey of "ignored" stickers + hints.
  [0xffff00, 'lastLayer'],
  [0x666666, 'lastLayer'],
  [0xcccccc, 'lastLayer'],
  ...[0xdddddd, 0x885500, 0x884400, 0x008800, 0x009900, 0x660000, 0x113388, 0x001866, 0x888800, 0xddde00].map(
    (hex): [number, Role] => [hex, 'dim'],
  ),
]

/** A colour as cubing.js stores it: the constant, converted as if it were linear. */
const asCubingColor = (like: Color, hex: number) => like.clone().setHex(hex).convertLinearToSRGB()

let roleByStoredHex: Map<number, Role> | undefined
const recoloured = new Map<MeshBasicMaterial, { original: Color; stealth: Color }>()
/** Materials seen that aren't sticker colours (the plastic, etc.). */
const ignored = new WeakSet<MeshBasicMaterial>()
const players = new Set<TwistyPlayer>()

function adopt(puzzle: Object3D) {
  puzzle.traverse((object) => {
    const material = (object as Mesh).material as MeshBasicMaterial | undefined
    if (!material?.isMeshBasicMaterial || recoloured.has(material) || ignored.has(material)) return
    roleByStoredHex ??= new Map(CUBING_COLORS.map(([hex, role]) => [asCubingColor(material.color, hex).getHex(), role]))
    const role = roleByStoredHex.get(material.color.getHex())
    if (!role) {
      ignored.add(material)
      return
    }
    const entry = { original: material.color.clone(), stealth: asCubingColor(material.color, STEALTH_COLOR[role]) }
    recoloured.set(material, entry)
    if (isStealth()) material.color.copy(entry.stealth)
  })
}

/**
 * Keeps a player's stickers in step with stealth mode. Its scene is rescanned whenever
 * it schedules a render, since masks swap in materials that may not have been seen yet.
 * Returns the cleanup.
 */
export function trackStealthColors(player: TwistyPlayer): () => void {
  let puzzle: Object3D | undefined
  let tracking = true
  players.add(player)
  void player
    .experimentalCurrentThreeJSPuzzleObject(() => {
      if (tracking && puzzle) adopt(puzzle)
    })
    .then((object) => {
      puzzle = object
      if (tracking) adopt(object)
    })
  return () => {
    tracking = false
    players.delete(player)
  }
}

subscribeStealth(() => {
  const stealth = isStealth()
  recoloured.forEach(({ original, stealth: grey }, material) => material.color.copy(stealth ? grey : original))
  players.forEach(async (player) => {
    for (const vantage of await player.experimentalCurrentVantages()) vantage.scheduleRender()
  })
})
