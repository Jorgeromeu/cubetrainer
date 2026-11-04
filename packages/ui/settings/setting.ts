// Settings (packages/core/settings.ts): picked once, the same in every checkout and browser.
// Kept by the server host, one object per owner; cached in localStorage so they apply at
// once on load and without a server. Changes show at once and are sent shortly after (a
// slider sends once it settles); unsent ones are retried on focus and when back online.
//
// Owners: a tool's own settings under its id (setting('f2l', ...)), a library's shared ones
// as `<library>.<name>` (setting('ui.cube', ...)). Declare each owner once, at module level.
import { Rejected, request } from '../../core/api.ts'
import { SETTINGS_OWNER, SETTINGS_PATH, type SettingsResponse } from '../../core/settings.ts'
import { liveValue, readLocal, readOver, writeLocal, type Store, type StoreOptions } from './viewState.ts'

interface Owner {
  /** The server's stored value arrived. */
  received(value: unknown): void
  /** The server has nothing for this owner yet. */
  missing(): void
}

const owners = new Map<string, Owner>()
/** Owner -> the value to send. */
const unsent = new Map<string, object>()
let loaded: SettingsResponse['settings'] | undefined
let sendTimer: ReturnType<typeof setTimeout> | undefined

const SEND_DELAY_MS = 400

function scheduleSend() {
  clearTimeout(sendTimer)
  sendTimer = setTimeout(send, SEND_DELAY_MS)
}

async function send() {
  for (const [owner, value] of [...unsent]) {
    try {
      await request(`${SETTINGS_PATH}/${owner}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
    } catch (e) {
      if (!(e instanceof Rejected)) return // no server: retried on focus / online
      console.error(`Settings for ${owner} refused:`, e.message)
    }
    if (unsent.get(owner) === value) unsent.delete(owner)
  }
}

function deliver(owner: string, entry: Owner) {
  if (!loaded || unsent.has(owner)) return // a change made here wins over what was stored
  if (owner in loaded) entry.received(loaded[owner])
  else entry.missing()
}

async function load() {
  try {
    loaded = (await request<SettingsResponse>(SETTINGS_PATH)).settings
  } catch {
    return // no server: the cached values stand
  }
  owners.forEach((entry, owner) => deliver(owner, entry))
  await send()
}

load()
addEventListener('focus', load)
addEventListener('online', load)

/** An owner's settings: `defaults` merged under what's stored, and only if `valid`. */
export function setting<T extends object>(owner: string, defaults: T, valid: (value: T) => boolean, options: StoreOptions<T> = {}): Store<T> {
  if (!SETTINGS_OWNER.test(owner)) throw new Error(`Settings owner must be a tool id or <library>.<name>: ${owner}`)
  if (owners.has(owner)) throw new Error(`Settings for ${owner} declared twice`)
  const cacheKey = `cubetrainer.settings.${owner}`
  const read = (raw: unknown) => readOver(raw, defaults, valid, options.migrate)
  const cached = read(readLocal(cacheKey))
  const legacy = cached ? undefined : options.legacyKey ? read(readLocal(options.legacyKey)) : undefined
  const value = liveValue(cached ?? legacy ?? defaults, (v) => {
    writeLocal(cacheKey, v)
    unsent.set(owner, v)
    scheduleSend()
  })
  const entry: Owner = {
    received(raw) {
      const stored = read(raw)
      if (!stored) return // invalid on the server (an older or newer version): keep ours
      writeLocal(cacheKey, stored)
      value.set(stored, false)
    },
    // Nothing on the server yet: what this browser had (cache or an older key) becomes the stored value.
    missing() {
      if (cached || legacy) value.set(value.get())
    },
  }
  owners.set(owner, entry)
  deliver(owner, entry)
  return { use: value.use, get: value.get, update: (patch) => value.set({ ...value.get(), ...patch }) }
}
