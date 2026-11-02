// Painted stickers (blocks, board.ts) on a cube: the black plastic around the sticker
// turns the block's colour (a frame that leaves the sticker itself as it is), and
// Shift+click finds the sticker under the pointer. cubing.js has no API for either, so this
// leans on its internals like stealthCube.ts does: the puzzle object (an experimental accessor) is its
// Cube3D, whose kpuzzleFaceletInfo holds each sticker's mesh by orbit, piece and facelet.
// A frame is a child of its sticker's mesh, so it moves (and animates) with it. Recheck
// all this when upgrading cubing.js.
import type { TwistyPlayer } from 'cubing/twisty'
import { Color, FrontSide, LinearSRGBColorSpace, Mesh, MeshBasicMaterial, Path, Raycaster, Shape, ShapeGeometry, Vector2, type Object3D } from 'three'
import { BLOCK_COLORS, STICKER_ORBITS } from '../../../../shared/pll-compare/sets.ts'

/**
 * The blocks' colours, by index: `frame` on the cube, `ink` for captions on white (the
 * same hue, darkened to 4.5:1). A frame doesn't touch its sticker (black shows between
 * them), and the frames are the colours furthest from the six sticker colours and from
 * each other (OKLab, hue and chroma counting more than lightness) among those bright on
 * the black plastic. The sticker colours fill most of the wheel, which leaves room for
 * about four. Kept in stealth, like any mark.
 */
export const PALETTE = [
  { frame: '#f000f8', ink: '#cc00d6' },
  { frame: '#10b888', ink: '#008659' },
  { frame: '#98a8f0', ink: '#6371b4' },
  { frame: '#f08088', ink: '#bc525c' },
] as const satisfies { length: typeof BLOCK_COLORS }

/**
 * In the sticker's own plane: a unit square at z = 0 facing +z, scaled down (cubing.js's
 * faceletScale, 0.85) on its piece's face, so the face's edge is at 0.5 / scale. The frame
 * lies on the plastic from just off the sticker to a little past that edge, onto the next
 * piece's plastic (still short of its sticker), to be thick enough to see.
 */
const HALF = 0.5
const GAP = 0.025
const OVERHANG = 0.03
const FRAME_LIFT = 0.002

const square = <T extends Path>(path: T, half: number) =>
  path.moveTo(-half, -half).lineTo(half, -half).lineTo(half, half).lineTo(-half, half).closePath() as T

const frameGeometries = new Map<number, ShapeGeometry>()
function frameGeometry(scale: number) {
  let geometry = frameGeometries.get(scale)
  if (!geometry) {
    const frame = square(new Shape(), HALF / scale + OVERHANG)
    frame.holes.push(square(new Path(), HALF + GAP))
    geometry = new ShapeGeometry(frame)
    frameGeometries.set(scale, geometry)
  }
  return geometry
}
// Taken as linear, as cubing.js's own colours are, so they show as written.
const frameMaterials = PALETTE.map(
  ({ frame }) => new MeshBasicMaterial({ color: new Color().setStyle(frame, LinearSRGBColorSpace), side: FrontSide }),
)

interface Cube3D extends Object3D {
  kpuzzleFaceletInfo: Record<string, { facelet: Mesh }[][]>
}

/** Every sticker's mesh, by its name (shared/pll-compare/sets.ts). */
function stickers(puzzle: Cube3D): Map<string, Mesh> {
  const byName = new Map<string, Mesh>()
  for (const [letter, { orbit, stickers }] of Object.entries(STICKER_ORBITS))
    puzzle.kpuzzleFaceletInfo[orbit]?.forEach((piece, p) =>
      piece.forEach(({ facelet }, f) => byName.set(`${letter}${p * stickers + f}`, facelet)),
    )
  return byName
}

async function render(player: TwistyPlayer) {
  for (const vantage of await player.experimentalCurrentVantages()) vantage.scheduleRender()
}

/** Frames exactly the painted stickers on the player's cube, each in its colour (by index). */
export async function showMarks(player: TwistyPlayer, colors: ReadonlyMap<string, number>) {
  const puzzle = (await player.experimentalCurrentThreeJSPuzzleObject()) as Cube3D
  for (const [name, sticker] of stickers(puzzle)) {
    const frame = sticker.children.find((c): c is Mesh => c.userData.mark)
    const color = colors.get(name)
    if (color === undefined) {
      if (frame) sticker.remove(frame)
    } else if (frame) frame.material = frameMaterials[color]
    else {
      const added = new Mesh(frameGeometry(sticker.scale.x), frameMaterials[color])
      added.userData.mark = true
      added.position.z = FRAME_LIFT
      sticker.add(added)
    }
  }
  await render(player)
}

/** The sticker at a point on the screen, by name; null if none is there. */
export async function markAt(player: TwistyPlayer, x: number, y: number): Promise<string | null> {
  const [vantage] = await player.experimentalCurrentVantages()
  if (!vantage) return null
  const [puzzle, camera, { canvas }] = await Promise.all([
    player.experimentalCurrentThreeJSPuzzleObject() as Promise<Cube3D>,
    vantage.camera(),
    vantage.canvasInfo(),
  ])
  const rect = canvas.getBoundingClientRect()
  const raycaster = new Raycaster()
  raycaster.setFromCamera(
    new Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1),
    camera,
  )
  const byMesh = new Map([...stickers(puzzle)].map(([mark, mesh]) => [mesh as Object3D, mark]))
  const [hit] = raycaster.intersectObjects([...byMesh.keys()], false)
  return hit ? byMesh.get(hit.object)! : null
}
