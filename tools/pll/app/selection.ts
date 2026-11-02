// Which PLL cases the trainer draws scrambles from. A per-browser preference, kept in
// localStorage; all cases by default.
import { useSyncExternalStore } from 'react'
import { pllCases, pllCasesById } from './catalog.ts'

const KEY = 'cubetrainer.pll.selection'

function load(): ReadonlySet<string> {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === null) return new Set(pllCases.map((c) => c.id))
    return new Set((JSON.parse(saved) as string[]).filter((id) => pllCasesById.has(id)))
  } catch {
    return new Set(pllCases.map((c) => c.id))
  }
}

let current = load()
const listeners = new Set<() => void>()

/** Returns the new selection. */
export function setPllSelection(ids: Iterable<string>): ReadonlySet<string> {
  current = new Set(ids)
  try {
    localStorage.setItem(KEY, JSON.stringify([...current]))
  } catch {
    // Storage unavailable (private mode etc.): the selection just isn't remembered.
  }
  listeners.forEach((l) => l())
  return current
}

/** Selects or deselects some cases, leaving the rest as they are. Returns the new selection. */
export function togglePllCases(ids: string[], on: boolean): ReadonlySet<string> {
  const next = new Set(current)
  for (const id of ids) {
    if (on) next.add(id)
    else next.delete(id)
  }
  return setPllSelection(next)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const usePllSelection = () => useSyncExternalStore(subscribe, () => current)
