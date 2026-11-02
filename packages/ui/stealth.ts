// Stealth mode: an app-wide switch that keeps the page from looking like a cubing app at
// a glance. Visual only: a greyscale theme that keeps colour only where it means something
// (status, chart data), and cubes in grey, drawn flat and dimmed until hovered. The one
// text change is the brand (top bar and tab title); trainer names and content stay. A per-browser preference, kept
// in localStorage (index.html applies it before first paint) and mirrored as
// `data-stealth` on <html>, so CSS can react anywhere. Every visual feature needs a
// stealth variant.
import { useSyncExternalStore } from 'react'

export const STEALTH_KEY = 'cubetrainer.stealth'
/** The app's name, and the one shown in stealth (index.html uses it too, before first paint). */
export const BRAND = 'Cubetrainer'
export const STEALTH_BRAND = 'Workbench'
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
