// A tool's data held by its server, mirrored in the app: the one way tools load and change
// server data (openspec/specs/foundation/architecture, "App works without the server").
//
//   - load: the snapshot is fetched at start, then again on window focus and when back online
//     (never while changes are unsent, so a refresh can't undo them). Until the first load
//     succeeds, `load` is 'offline' and it's retried: quickly at first, then every 30 s.
//   - change: shown at once (`apply`), and its request joins the tool's outbox, which is sent
//     strictly in order, one at a time, so a request never overtakes the one it depends on
//     (save an alg, then make it main; save a solve, then fix its penalty). The outbox is kept
//     in this browser, so a reload loses nothing; requests must be idempotent (PUT, PATCH,
//     DELETE with client-made ids) since one may be sent again.
//   - no server mid-session: the data stays, the outbox waits and is retried.
//   - refused (a 4xx/5xx with an error): that request is dropped, the error shows for a while,
//     and the snapshot is fetched again once nothing else is unsent, so what's shown is what
//     the server has.
import { useSyncExternalStore } from 'react'
import { type Load, Rejected, request } from '../core/api.ts'
import { readLocal, writeLocal } from './settings/viewState.ts'

export interface Outgoing {
  method: 'PUT' | 'PATCH' | 'DELETE' | 'POST'
  url: string
  body?: unknown
}

export interface ServerState<T> {
  /** loading: first fetch in flight · offline: never loaded, no server · ready: loaded. */
  load: Load
  data: T
  /** Why the server can't be reached, or the last refused change (shown for a while). */
  error?: string
  /** Requests not yet accepted by the server, oldest first. */
  unsent: readonly Outgoing[]
}

export interface ServerData<T> {
  use(): ServerState<T>
  get(): ServerState<T>
  /** Shows `apply`'s result at once and queues `send`; ignored before the first load unless `changesBeforeLoad`. */
  change(apply: (data: T) => T, send: Outgoing): void
  /** Fetches the snapshot now (when nothing is unsent). */
  reload(): Promise<void>
}

export interface ServerDataOptions<T> {
  /** The owning tool's id: names its outbox in this browser. */
  owner: string
  /** Fetches the whole snapshot; throw for an unexpected answer. */
  fetch: () => Promise<T>
  /** The data before the first load. */
  empty: T
  /** Accept changes before the first load (e.g. timing solves with no server yet). */
  changesBeforeLoad?: boolean
}

/** Retry delays while the server is away: quick at first, then every 30 s. */
const RETRY_MS = [2000, 5000, 10000, 30000]
/** How long a refused change's message shows. */
const ERROR_MS = 6000

export function serverData<T>({ owner, fetch, empty, changesBeforeLoad = false }: ServerDataOptions<T>): ServerData<T> {
  const outboxKey = `cubetrainer.outbox.${owner}`
  const stored = readLocal(outboxKey)
  let state: ServerState<T> = { load: 'loading', data: empty, unsent: Array.isArray(stored) ? (stored as Outgoing[]) : [] }
  const listeners = new Set<() => void>()
  const set = (patch: Partial<ServerState<T>>) => {
    state = { ...state, ...patch }
    if ('unsent' in patch) writeLocal(outboxKey, state.unsent)
    listeners.forEach((l) => l())
  }

  let retries = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  const retryLater = (run: () => void) => {
    clearTimeout(retryTimer)
    retryTimer = setTimeout(run, RETRY_MS[Math.min(retries++, RETRY_MS.length - 1)])
  }

  let errorTimer: ReturnType<typeof setTimeout> | undefined
  const showError = (message: string) => {
    set({ error: message })
    clearTimeout(errorTimer)
    errorTimer = setTimeout(() => state.error === message && set({ error: undefined }), ERROR_MS)
  }

  let fetching = false
  async function reload() {
    if (fetching || state.unsent.length) return
    fetching = true
    try {
      const data = await fetch()
      retries = 0
      if (!state.unsent.length) set({ load: 'ready', data, error: undefined })
    } catch (e) {
      // A refused fetch is a broken server, not a missing one: either way, try again later.
      set({ load: state.load === 'ready' ? 'ready' : 'offline', error: `Server ${(e as Error).message}` })
      retryLater(sync)
    } finally {
      fetching = false
    }
  }

  let sending = false
  /** Sends the outbox in order; stops at the first request the server can't be reached for. */
  async function flush() {
    if (sending) return
    sending = true
    let refused = false
    try {
      while (state.unsent.length) {
        const next = state.unsent[0]
        try {
          await request(next.url, {
            method: next.method,
            ...(next.body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next.body) }),
          })
        } catch (e) {
          if (!(e instanceof Rejected)) {
            set({ load: state.load === 'loading' ? 'offline' : state.load, error: `Not saved yet: server ${(e as Error).message} · retrying` })
            retryLater(sync)
            return
          }
          refused = true
          showError(`Couldn't save: ${e.message}`)
        }
        set({ unsent: state.unsent.slice(1) })
      }
      retries = 0
      if (state.error?.startsWith('Not saved yet')) set({ error: undefined })
    } finally {
      sending = false
    }
    if (refused || state.load !== 'ready') await reload()
  }

  /** Sends what's unsent, then (if nothing is left) fetches the snapshot. */
  async function sync() {
    await flush()
    if (!state.unsent.length && state.load !== 'ready') await reload()
  }

  void sync()
  addEventListener('focus', () => void (state.unsent.length ? flush() : reload()))
  addEventListener('online', () => void sync())

  return {
    use: () =>
      useSyncExternalStore(
        (l) => {
          listeners.add(l)
          return () => listeners.delete(l)
        },
        () => state,
      ),
    get: () => state,
    reload,
    change(apply, send) {
      if (state.load !== 'ready' && !changesBeforeLoad) return
      set({ data: apply(state.data), unsent: [...state.unsent, send] })
      void flush()
    },
  }
}
