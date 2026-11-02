// The board as a picture, for the clipboard: each cube as drawn (cropped to its pixels),
// its case name, and its captions in their blocks' colours, on white, in the board's
// columns. Nothing else of the page. The cubes are copied as they are on screen (in
// stealth, grey).
import type { TwistyPlayer } from 'cubing/twisty'
import type { BoardCube } from './board.ts'
import { pllCasesById } from './catalog.ts'
import { PALETTE } from './marks.ts'

/** In CSS pixels; scaled with the cubes' own resolution. */
const PAD = 20
const GAP_X = 16
const GAP_Y = 20
const NAME = { size: 16, line: 24 }
const CAPTION = { size: 13, line: 20 }
const INK = '#1a1a1a'

/** The part of a cube's canvas that isn't transparent. */
function crop(canvas: HTMLCanvasElement) {
  const { width, height } = canvas
  const alpha = canvas.getContext('2d')!.getImageData(0, 0, width, height).data
  let [left, top, right, bottom] = [width, height, -1, -1]
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (alpha[(y * width + x) * 4 + 3]) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
  return right < 0 ? { x: 0, y: 0, w: width, h: height } : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 }
}

/**
 * A cube's picture, copied into a canvas of our own. cubing.js draws with WebGL, whose
 * pixels can only be read straight after a draw, so it draws it again first.
 */
async function snapshot(player: TwistyPlayer) {
  const [vantage] = await player.experimentalCurrentVantages()
  const { canvas } = await vantage.canvasInfo()
  await vantage.render()
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  copy.getContext('2d')!.drawImage(canvas, 0, 0)
  return { copy, cssWidth: canvas.getBoundingClientRect().width }
}

/** The board's cubes (and their players, in the same order) as a PNG. */
export async function boardImage(cubes: readonly BoardCube[], players: readonly TwistyPlayer[], columns: number) {
  const snapshots = []
  for (const player of players) snapshots.push(await snapshot(player))
  const canvases = snapshots.map((s) => s.copy)
  /** Device pixels per CSS pixel, as the cubes were drawn. */
  const k = canvases[0].width / snapshots[0].cssWidth || devicePixelRatio
  const crops = canvases.map(crop)
  const captions = cubes.map((c) => (c.blocks ?? []).filter((b) => b.caption.trim()))
  const font = getComputedStyle(document.body).fontFamily
  const nameFont = `700 ${NAME.size * k}px ${font}`
  const captionFont = `600 ${CAPTION.size * k}px ${font}`
  // As wide as the widest cube or caption.
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = captionFont
  const cellWidth = Math.ceil(
    Math.max(...crops.map((c) => c.w), ...captions.flat().map((b) => measure.measureText(b.caption.trim()).width)),
  )
  const rows = Array.from({ length: Math.ceil(cubes.length / columns) }, (_, r) => {
    const ids = cubes.map((_, i) => i).slice(r * columns, (r + 1) * columns)
    return {
      ids,
      cube: Math.max(...ids.map((i) => crops[i].h)),
      below: (NAME.line + Math.max(...ids.map((i) => captions[i].length)) * CAPTION.line) * k,
    }
  })

  const out = document.createElement('canvas')
  out.width = Math.ceil(2 * PAD * k + columns * cellWidth + (columns - 1) * GAP_X * k)
  out.height = Math.ceil(
    2 * PAD * k + rows.reduce((sum, r) => sum + r.cube + r.below, 0) + (rows.length - 1) * GAP_Y * k,
  )
  const g = out.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, out.width, out.height)
  g.textAlign = 'center'
  g.textBaseline = 'middle'

  let top = PAD * k
  for (const row of rows) {
    row.ids.forEach((i, col) => {
      const left = PAD * k + col * (cellWidth + GAP_X * k)
      const centre = left + cellWidth / 2
      const { x, y, w, h } = crops[i]
      // Bottoms line up, so the names do.
      g.drawImage(canvases[i], x, y, w, h, centre - w / 2, top + row.cube - h, w, h)
      let line = top + row.cube + (NAME.line / 2) * k
      g.font = nameFont
      g.fillStyle = INK
      g.fillText(pllCasesById.get(cubes[i].caseId)!.name, centre, line)
      line += ((NAME.line + CAPTION.line) / 2) * k
      g.font = captionFont
      for (const block of captions[i]) {
        g.fillStyle = PALETTE[block.color].ink
        g.fillText(block.caption.trim(), centre, line)
        line += CAPTION.line * k
      }
    })
    top += row.cube + row.below + GAP_Y * k
  }
  return new Promise<Blob>((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't draw the image"))), 'image/png'),
  )
}

/** Puts the board's image on the clipboard. Called straight from a click, so the browser allows it. */
export const copyBoardImage = (...args: Parameters<typeof boardImage>) =>
  navigator.clipboard.write([new ClipboardItem({ 'image/png': boardImage(...args) })])
