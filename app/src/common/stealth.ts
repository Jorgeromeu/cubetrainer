// Stealth mode: an app-wide switch that keeps the page from looking like a cubing app at
// a glance. Cubes turn grey and only show while hovered. A per-browser preference, kept
// in localStorage (index.html applies it before first paint) and mirrored as
// `data-stealth` on <html>, so CSS can react anywhere. Every visual feature needs a
// stealth variant.
import { useSyncExternalStore } from 'react'

export const STEALTH_KEY = 'cubetrainer.stealth'
/** Toggles stealth mode from anywhere on the page (except while typing). */
export const STEALTH_HOTKEY = '`'

function load(): boolean {
  try {
    return localStorage.getItem(STEALTH_KEY) === 'on'
  } catch {
    return false
  }
}

let current = load()
const listeners = new Set<() => void>()

export function setStealth(on: boolean) {
  if (on === current) return
  current = on
  try {
    localStorage.setItem(STEALTH_KEY, on ? 'on' : 'off')
  } catch {
    // Storage unavailable (private mode etc.): the setting just isn't remembered.
  }
  document.documentElement.toggleAttribute('data-stealth', on)
  listeners.forEach((l) => l())
}

export const isStealth = () => current

export function subscribeStealth(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useStealth = () => useSyncExternalStore(subscribeStealth, isStealth)
