// The cubes on the board, and the board as a URL path, so a comparison can be bookmarked:
// "Ga.1.3,Gb,T.0.2.0e7-c14~headlights_1m2" is a case name, then variant and turn when not
// 0, then any blocks: each a colour, its stickers and "~" its caption (escaped), "_"
// between them. Before blocks, the last field was plain stickers ("e7-c14"): colour 0.
import {
  BLOCK_COLORS,
  isSticker,
  MAX_CAPTION,
  MAX_SET_CUBES,
  type Block,
  type CompareCube,
} from '../../../../shared/pll-compare/sets.ts'
import { pllCasesById, pllCasesByName } from './catalog.ts'

export type { Block, CompareCube }
export const MAX_CUBES = MAX_SET_CUBES

/** A cube on the board; `key` keeps its player when others are added or removed. */
export interface BoardCube extends CompareCube {
  key: number
}

let nextKey = 1
export const onBoard = (cube: CompareCube): BoardCube => ({ ...cube, key: nextKey++ })

/** n quarter turns, any sign, as 0-3. */
export const quarters = (n: number) => ((n % 4) + 4) % 4

/** A U turn of n quarter turns (0-3). */
export const U_TURNS = ['', 'U', 'U2', "U'"]

/** The setup before the turn: the variant's U, then the case. */
export const baseSetup = ({ caseId, variant }: CompareCube) => `${U_TURNS[variant]} ${pllCasesById.get(caseId)!.setup}`

/** The cube as moves: "U · Ga · U2", leaving out turns of 0. */
export const cubeLabel = ({ caseId, variant, turn }: CompareCube) =>
  [U_TURNS[variant], pllCasesById.get(caseId)!.name, U_TURNS[turn]].filter(Boolean).join(' · ')

/** Text as it can sit in a path field: everything but letters and digits escaped. */
const escape = (text: string) =>
  encodeURIComponent(text).replace(/[-_.!~*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

const unescape = (text: string) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return ''
  }
}

function parseBlocks(field: string): Block[] {
  const blocks = field.split('_').flatMap((part): Block[] => {
    const match = /^(\d)?([^~]*)(?:~(.*))?$/.exec(part)
    if (!match) return []
    const color = Number(match[1] ?? 0)
    const stickers = match[2].split('-').filter(isSticker)
    return color < BLOCK_COLORS ? [{ color, caption: unescape(match[3] ?? '').slice(0, MAX_CAPTION), stickers }] : []
  })
  return withBlocks<CompareCube>({ caseId: '', variant: 0, turn: 0 }, blocks).blocks ?? []
}

export function parseBoard(path: string | undefined): BoardCube[] {
  if (!path) return []
  return path
    .split(',')
    .flatMap((part) => {
      const [name, variant = '0', turn = '0', blocks = ''] = part.split('.')
      const pll = pllCasesByName.get(unescape(name))
      if (!pll) return []
      const cube = { caseId: pll.id, variant: quarters(Number(variant) || 0), turn: quarters(Number(turn) || 0) }
      return [onBoard(withBlocks(cube, parseBlocks(blocks)))]
    })
    .slice(0, MAX_CUBES)
}

export const boardPath = (cubes: readonly CompareCube[]) =>
  cubes
    .map(({ caseId, variant, turn, blocks }) => {
      const name = pllCasesById.get(caseId)!.name
      if (blocks?.length) {
        const field = blocks
          .map((b) => `${b.color}${b.stickers.join('-')}${b.caption ? `~${escape(b.caption)}` : ''}`)
          .join('_')
        return `${name}.${variant}.${turn}.${field}`
      }
      return variant || turn ? `${name}.${variant}.${turn}` : name
    })
    .join(',')

/**
 * The cube with these blocks, as the shared type keeps them: one a colour (the first
 * wins), each sticker in one block (the first), blocks with no stickers left out, sorted;
 * undefined if none.
 */
export function withBlocks<C extends CompareCube>(cube: C, blocks: readonly Block[]): C {
  const colors = new Set<number>()
  const stickers = new Set<string>()
  const kept = blocks
    .flatMap((block) => {
      if (colors.has(block.color)) return []
      colors.add(block.color)
      const own = [...new Set(block.stickers)].filter((s) => !stickers.has(s)).sort()
      own.forEach((s) => stickers.add(s))
      return own.length ? [{ ...block, stickers: own }] : []
    })
    .sort((a, b) => a.color - b.color)
  return { ...cube, blocks: kept.length ? kept : undefined }
}

/** Paints a sticker `color`: into that colour's block (out of any other), or out of it if it was in it. */
export function paint<C extends CompareCube>(cube: C, sticker: string, color: number): C {
  const blocks = cube.blocks ?? []
  const had = blocks.find((b) => b.color === color)?.stickers.includes(sticker)
  const without = blocks.map((b) => ({ ...b, stickers: b.stickers.filter((s) => s !== sticker) }))
  if (had) return withBlocks(cube, without)
  const own = without.find((b) => b.color === color)
  return withBlocks(
    cube,
    own
      ? without.map((b) => (b === own ? { ...b, stickers: [...b.stickers, sticker] } : b))
      : [...without, { color, caption: '', stickers: [sticker] }],
  )
}

export const setCaption = <C extends CompareCube>(cube: C, color: number, caption: string) =>
  withBlocks(
    cube,
    (cube.blocks ?? []).map((b) => (b.color === color ? { ...b, caption: caption.slice(0, MAX_CAPTION) } : b)),
  )

export const removeBlock = <C extends CompareCube>(cube: C, color: number) =>
  withBlocks(cube, (cube.blocks ?? []).filter((b) => b.color !== color))

/** The same cubes in the same order, ignoring keys. */
export const sameCubes = (a: readonly CompareCube[], b: readonly CompareCube[]) =>
  a.length === b.length &&
  a.every(
    (c, i) =>
      c.caseId === b[i].caseId &&
      c.variant === b[i].variant &&
      c.turn === b[i].turn &&
      JSON.stringify(c.blocks ?? []) === JSON.stringify(b[i].blocks ?? []),
  )
