// Per-browser preferences: a settings object kept in localStorage and shared live.
import { useSyncExternalStore } from 'react'

/**
 * A per-browser preference kept in localStorage and shared live by every component that
 * reads it. Falls back to the defaults if storage is unavailable or holds something invalid.
 * `migrate` brings what an older version stored up to date before it's checked.
 */
export function persisted<T extends object>(
  key: string,
  defaults: T,
  valid: (value: T) => boolean,
  migrate: (stored: Record<string, unknown>) => Partial<T> = (stored) => stored as Partial<T>,
) {
  let current: T = defaults
  try {
    const merged = { ...defaults, ...migrate(JSON.parse(localStorage.getItem(key) ?? '{}')) }
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
