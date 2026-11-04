// View state: how a page was left (filters, chart toggles, a picked range), remembered per
// browser in localStorage and shared live. Not settings (setting.ts: picked once, kept on
// the server, shown on the settings window) and not user data (a tool's DB).
import { useSyncExternalStore } from 'react'

export interface Store<T> {
  use(): T
  get(): T
  update(patch: Partial<T>): void
}

export interface StoreOptions<T> {
  /** Brings what an older version stored up to date before it's validated. */
  migrate?: (stored: Record<string, unknown>) => Partial<T>
  /** A key it used to be stored under, read once when there's nothing under the new one. */
  legacyKey?: string
}

/** Reads `raw` over the defaults; undefined if unreadable or invalid. */
export function readOver<T extends object>(raw: unknown, defaults: T, valid: (value: T) => boolean, migrate = (s: Record<string, unknown>) => s as Partial<T>): T | undefined {
  if (raw === undefined || raw === null) return undefined
  try {
    const merged = { ...defaults, ...migrate(raw as Record<string, unknown>) }
    return valid(merged) ? merged : undefined
  } catch {
    return undefined
  }
}

export function readLocal(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode etc.): it just isn't remembered.
  }
}

/** A value shared live by every component that reads it, set through `update`. */
export function liveValue<T>(initial: T, onChange: (value: T) => void) {
  let current = initial
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return {
    get: () => current,
    set(value: T, notify = true) {
      current = value
      if (notify) onChange(value)
      listeners.forEach((l) => l())
    },
    use: () => useSyncExternalStore(subscribe, () => current),
  }
}

/**
 * View state under `cubetrainer.view.<key>` (key: `<tool id>.<what>`), falling back to the
 * defaults if storage is unavailable or holds something invalid.
 */
export function viewState<T extends object>(key: string, defaults: T, valid: (value: T) => boolean, options: StoreOptions<T> = {}): Store<T> {
  const storageKey = `cubetrainer.view.${key}`
  const read = (raw: unknown) => readOver(raw, defaults, valid, options.migrate)
  const initial = read(readLocal(storageKey)) ?? (options.legacyKey ? read(readLocal(options.legacyKey)) : undefined) ?? defaults
  const value = liveValue(initial, (v) => writeLocal(storageKey, v))
  return { use: value.use, get: value.get, update: (patch) => value.set({ ...value.get(), ...patch }) }
}
