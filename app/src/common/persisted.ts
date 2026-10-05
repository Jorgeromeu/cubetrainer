// Per-browser preferences: a settings object kept in localStorage and shared live.
import { useSyncExternalStore } from 'react'

/**
 * A per-browser preference kept in localStorage and shared live by every component that
 * reads it. Falls back to the defaults if storage is unavailable or holds something invalid.
 */
export function persisted<T extends object>(key: string, defaults: T, valid: (value: T) => boolean) {
  let current: T = defaults
  try {
    const merged = { ...defaults, ...(JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<T>) }
    if (valid(merged)) current = merged
  } catch {
    // Unreadable: keep the defaults.
  }
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return {
    update(patch: Partial<T>) {
      current = { ...current, ...patch }
      try {
        localStorage.setItem(key, JSON.stringify(current))
      } catch {
        // Storage unavailable (private mode etc.): the setting just isn't remembered.
      }
      listeners.forEach((l) => l())
    },
    use: () => useSyncExternalStore(subscribe, () => current),
  }
}
