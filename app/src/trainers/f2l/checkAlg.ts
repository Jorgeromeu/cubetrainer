// Checking an alg you type in against its slot-case, on a cubing.js cube: does it solve
// the case? Used to add your own algs (see AddAlg in ClusterView.tsx). Same rules as the
// catalog builder's check (catalog-builder/src/cube.ts), plus reading loosely typed moves.
import { useEffect, useState } from 'react'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { cube3x3x3 } from 'cubing/puzzles'
import { AUFS } from '../../../../packages/core/notation/moves.ts'

/**
 * Typed moves read so far: the moves in canonical spelling ("R2'" -> "R2", spaces
 * optional, brackets ignored), and where reading stopped, if it did.
 */
export interface TypedAlg {
  moves: string[]
  /** The text that isn't a move, if any; `moves` are those before it. */
  error?: string
}

/** One move: face (or wide face), slice or rotation, then an amount and/or prime. */
const MOVE = /([URFDLB]w|[URFDLBurfdlbMESxyz])(\d*)('?)/y
const SKIP = /[\s()[\],]+/y

/** Reads typed moves: "RUR'", "(R U R')", "R2'" and curly quotes all work. */
export function readMoves(text: string): TypedAlg {
  const input = text.replace(/[’‘`´]/g, "'")
  const moves: string[] = []
  let at = 0
  while (at < input.length) {
    SKIP.lastIndex = at
    if (SKIP.test(input)) {
      at = SKIP.lastIndex
      continue
    }
    MOVE.lastIndex = at
    const match = MOVE.exec(input)
    const turns = match && ((Number(match[2] || 1) * (match[3] ? 3 : 1)) % 4)
    if (!match || !turns) return { moves, error: input.slice(at).split(/\s/)[0] }
    moves.push(match[1] + ['', '', '2', "'"][turns])
    at = MOVE.lastIndex
  }
  return { moves }
}

const AMOUNT: Record<string, number> = { '': 1, '2': 2, "'": 3 }

/**
 * Moves with turns of the same layer merged where they meet ("R R" -> "R2", "U' U" -> ""),
 * as an alg is saved: so one typed with a redundant turn isn't a new alg.
 */
export function simplifyMoves(moves: string[]): string[] {
  const out: string[] = []
  for (const move of moves) {
    const [, family, amount] = /^(.+?)(2|'|)$/.exec(move)!
    const last = out.at(-1)
    const [, lastFamily, lastAmount] = last ? /^(.+?)(2|'|)$/.exec(last)! : []
    if (lastFamily !== family) {
      out.push(move)
      continue
    }
    out.pop()
    const turns = (AMOUNT[lastAmount] + AMOUNT[amount]) % 4
    if (turns) out.push(family + ['', '', '2', "'"][turns])
  }
  return out
}

let kpuzzle: KPuzzle | undefined
const loading = cube3x3x3.kpuzzle().then((k) => (kpuzzle = k))

/** The cube model to check algs on, once it's loaded (undefined until then). */
export function useKPuzzle(): KPuzzle | undefined {
  const [loaded, setLoaded] = useState(kpuzzle)
  useEffect(() => {
    if (!loaded) void loading.then(setLoaded)
  }, [loaded])
  return loaded
}

/** F2L pieces: every piece a U move leaves in place (cross, slots, centers). */
const f2lPiecesCache = new WeakMap<KPuzzle, Record<string, number[]>>()
function f2lPieces(kp: KPuzzle) {
  let pieces = f2lPiecesCache.get(kp)
  if (pieces) return pieces
  const solved = kp.defaultPattern()
  const afterU = solved.applyMove('U')
  pieces = Object.fromEntries(
    Object.entries(solved.patternData).map(([orbit, data]) => [
      orbit,
      data.pieces
        .map((_, i) => i)
        .filter((i) => afterU.patternData[orbit].pieces[i] === i && !afterU.patternData[orbit].orientation[i]),
    ]),
  )
  f2lPiecesCache.set(kp, pieces)
  return pieces
}

/** Whole-cube rotations an alg may leave behind: F2L only has to be solved after one of them. */
const ROTATIONS = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((a) => ['', 'y', 'y2', "y'"].map((b) => `${a} ${b}`.trim()))

/** F2L pieces out of place (or twisted), for the rotation that leaves fewest. */
function piecesOff(kp: KPuzzle, p: KPattern): number {
  const pieces = f2lPieces(kp)
  return Math.min(
    ...ROTATIONS.map((r) => {
      const q = r ? p.applyAlg(r) : p
      return Object.entries(pieces).reduce(
        (n, [orbit, idxs]) =>
          n + idxs.filter((i) => q.patternData[orbit].pieces[i] !== i || q.patternData[orbit].orientation[i]).length,
        0,
      )
    }),
  )
}

export type AlgCheck =
  | { result: 'empty' }
  | { result: 'unreadable'; text: string }
  /** F2L isn't solved after it: this many pieces are off. */
  | { result: 'unsolved'; off: number }
  /** It solves the case, but only after this U turn first. */
  | { result: 'needsAuf'; auf: string }
  | { result: 'solves' }

/** Whether `moves` solves the case set up by `setup` (face turns from a solved cube). */
export function checkAlg(kp: KPuzzle, setup: string, typed: TypedAlg): AlgCheck {
  if (typed.error) return { result: 'unreadable', text: typed.error }
  if (!typed.moves.length) return { result: 'empty' }
  const start = kp.defaultPattern().applyAlg(setup)
  const alg = typed.moves.join(' ')
  const off = piecesOff(kp, start.applyAlg(alg))
  if (off === 0) return { result: 'solves' }
  const auf = AUFS.find((u) => u && piecesOff(kp, start.applyAlg(u).applyAlg(alg)) === 0)
  return auf ? { result: 'needsAuf', auf } : { result: 'unsolved', off }
}
