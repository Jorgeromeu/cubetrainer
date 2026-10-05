// The user's progress, held by the server (../server) and mirrored here: each slot-case's
// main alg, per alg a status (learning/learnt) independent of main, and notes. Loaded
// at startup; changes show immediately and, if a save fails, the state is reloaded from
// the server, so nothing is shown as saved that isn't.
//
// The app works without the server: while it's unreachable, `load` is 'offline', the
// progress UI is hidden, and loading is retried in the background until it answers.
import { useSyncExternalStore } from 'react'
import { algsById, getSlotCase, ideaOf, slotRelation, type CatalogAlg } from './catalog.ts'
import type {
  AlgRef,
  AlgState,
  AlgStatus,
  Note,
  NoteSymmetry,
  PatchAlgBody,
  ProgressResponse,
  PutNoteBody,
  PutProgressBody,
  SlotCaseProgress,
} from '../../../../shared/f2l/progress.ts'

export type { AlgRef, AlgState, AlgStatus, Note, NoteSymmetry, SlotCaseProgress }

/** F2L's part of the server's API (server/src/trainers/f2l/). */
const API = '/api/f2l'

/** One slot-case's progress: its main alg and its algs' states. Empty slot-cases have no entry. */
export interface SlotCaseState {
  mainAlg?: AlgRef
  algs: AlgState[]
}

/**
 * A slot-case's overall status, from its best alg: learnt (some alg learnt) · learning
 * (some alg being learnt) · main (a main alg, nothing started) · none.
 */
export type Status = 'none' | 'main' | 'learning' | 'learnt'

export const STATUS_LABEL: Record<Status, string> = {
  none: 'No main alg',
  main: 'Main alg chosen, not started',
  learning: 'Learning',
  learnt: 'Learnt',
}

export const ALG_STATUS_LABEL: Record<AlgStatus, string> = { learning: 'Learning', learnt: 'Learnt' }

/** The learnt toggle cycles: nothing → learning → learnt → nothing. */
export const nextAlgStatus = (status: AlgStatus | null | undefined): AlgStatus | null =>
  !status ? 'learning' : status === 'learning' ? 'learnt' : null

export interface ProgressState {
  /** loading: first fetch in flight · offline: no server, progress hidden · ready: loaded and editable. */
  load: 'loading' | 'ready' | 'offline'
  bySlotCase: ReadonlyMap<string, SlotCaseState>
  /** All notes, by id. */
  notes: ReadonlyMap<string, Note>
  /** Why the server is offline, or the last failed save (cleared after a while). */
  error?: string
}

let state: ProgressState = { load: 'loading', bySlotCase: new Map(), notes: new Map() }
const listeners = new Set<() => void>()

function setState(patch: Partial<ProgressState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useProgress = () => useSyncExternalStore(subscribe, () => state)

export const statusOf = (p: SlotCaseState | undefined): Status =>
  p?.algs.some((a) => a.status === 'learnt')
    ? 'learnt'
    : p?.algs.some((a) => a.status === 'learning')
      ? 'learning'
      : p?.mainAlg
        ? 'main'
        : 'none'

export const sameAlg = (a: AlgRef | undefined, b: AlgRef | undefined) => !!a && !!b && a.kind === b.kind && a.id === b.id

export const algStateOf = (p: SlotCaseState | undefined, alg: AlgRef) => p?.algs.find((a) => sameAlg(a.alg, alg))

const TIMEOUT_MS = 5000

/** The server answered and refused the request (a 4xx/5xx with its JSON error). */
class Rejected extends Error {}

/**
 * Throws Rejected when the server refused the request, and a plain Error when there's no
 * server to talk to: network failure, timeout, a proxy error, or something that isn't our
 * API answering (e.g. a static host returning index.html).
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    throw new Error((e as Error).name === 'TimeoutError' ? 'timed out' : 'not reachable')
  }
  const body: unknown = await res.json().catch(() => undefined)
  const error = (body as { error?: unknown } | undefined)?.error
  if (!res.ok) {
    if (typeof error === 'string') throw new Rejected(error)
    throw new Error(`not reachable (${res.status})`)
  }
  if (body === undefined) throw new Error('not answering as an API')
  return body as T
}

function toMap(progress: SlotCaseProgress[], algs: AlgState[]) {
  const map = new Map<string, SlotCaseState>()
  const entry = (id: string) => map.get(id) ?? map.set(id, { algs: [] }).get(id)!
  for (const p of progress) entry(p.slotCaseId).mainAlg = p.mainAlg
  for (const a of algs) entry(a.slotCaseId).algs.push(a)
  return map
}

async function fetchProgress(): Promise<Pick<ProgressState, 'bySlotCase' | 'notes'>> {
  const body = await request<ProgressResponse>(`${API}/progress`)
  if (!Array.isArray(body?.progress) || !Array.isArray(body?.algs) || !Array.isArray(body?.notes))
    throw new Error('unexpected response')
  return { bySlotCase: toMap(body.progress, body.algs), notes: new Map(body.notes.map((n) => [n.id, n])) }
}

/** Retry delays while offline: quick at first, then every 30s. Focus/online also retry. */
const RETRY_MS = [2000, 5000, 10000, 30000]
let retries = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined
let loading = false

async function load() {
  if (loading || state.load === 'ready') return
  loading = true
  clearTimeout(retryTimer)
  try {
    const loaded = await fetchProgress()
    retries = 0
    setState({ load: 'ready', ...loaded, error: undefined })
  } catch (e) {
    goOffline(e as Error)
  } finally {
    loading = false
  }
}

function goOffline(e: Error) {
  setState({ load: 'offline', bySlotCase: new Map(), notes: new Map(), error: `Server ${e.message}` })
  clearTimeout(retryTimer)
  retryTimer = setTimeout(load, RETRY_MS[Math.min(retries++, RETRY_MS.length - 1)])
}

load()
addEventListener('focus', load)
addEventListener('online', load)

/** Save errors fade after a while; the offline notice stays until the server is back. */
let errorTimer: ReturnType<typeof setTimeout> | undefined
function showSaveError(message: string) {
  setState({ error: message })
  clearTimeout(errorTimer)
  errorTimer = setTimeout(() => state.error === message && setState({ error: undefined }), 6000)
}

/** Saves per key (slot-case, note) run one after another, so they reach the server in order. */
const queues = new Map<string, Promise<unknown>>()

/** Applies `next` to the slot-case locally right away, then sends the request to the server. */
function save(slotCaseId: string, next: SlotCaseState, method: 'PUT' | 'PATCH', url: string, body: PutProgressBody | PatchAlgBody) {
  if (state.load !== 'ready') return
  const map = new Map(state.bySlotCase)
  if (next.mainAlg || next.algs.length) map.set(slotCaseId, next)
  else map.delete(slotCaseId)
  setState({ bySlotCase: map })
  send(slotCaseId, method, url, body)
}

/**
 * Sends a change already shown locally. If the server refuses it, reloads what the server
 * has; if the server is gone, goes offline (hiding progress) and reconnects.
 */
function send(queueKey: string, method: 'PUT' | 'PATCH', url: string, body: unknown) {
  const sendNow = () =>
    request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  const queued = (queues.get(queueKey) ?? Promise.resolve()).then(sendNow).then(
    () => {},
    (e: Error) => {
      if (!(e instanceof Rejected)) {
        // The server went away: hide progress (nothing unsaved stays on screen) and reconnect.
        if (state.load === 'ready') goOffline(e)
        return
      }
      // Drop the optimistic state: show whatever the server actually has.
      showSaveError(`Couldn't save: ${e.message}`)
      fetchProgress().then(setState, goOffline)
    },
  )
  queues.set(queueKey, queued)
}

const current = (slotCaseId: string): SlotCaseState => state.bySlotCase.get(slotCaseId) ?? { algs: [] }

/** Makes `alg` the slot-case's main alg, or clears it when null. Learnt algs are untouched. */
export function setMainAlg(slotCaseId: string, alg: AlgRef | null) {
  const p = current(slotCaseId)
  if (alg ? sameAlg(p.mainAlg, alg) : !p.mainAlg) return
  save(slotCaseId, { ...p, mainAlg: alg ?? undefined }, 'PUT', `${API}/progress/${encodeURIComponent(slotCaseId)}`, {
    mainAlg: alg,
  })
}

/** Sets an alg's status; null clears it. */
export function setAlgStatus(slotCaseId: string, alg: AlgRef, status: AlgStatus | null) {
  const p = current(slotCaseId)
  if ((algStateOf(p, alg)?.status ?? null) === status) return
  const others = p.algs.filter((a) => !sameAlg(a.alg, alg))
  const algs = status ? [...others, { alg, slotCaseId, status, updatedAt: new Date().toISOString() }] : others
  save(slotCaseId, { ...p, algs }, 'PATCH', `${API}/algs/${alg.kind}/${encodeURIComponent(alg.id)}`, {
    status,
  } satisfies PatchAlgBody)
}

/**
 * Creates or updates a note (the id is the caller's uuid); empty text deletes it. Shows
 * locally right away.
 */
export function saveNote(id: string, note: PutNoteBody & { slotCaseId: string }) {
  if (state.load !== 'ready') return
  const before = state.notes.get(id)
  if (before && before.text === note.text && before.symmetry === note.symmetry) return
  if (!before && !note.text.trim()) return
  const notes = new Map(state.notes)
  const now = new Date().toISOString()
  if (note.text.trim()) notes.set(id, { id, ...note, createdAt: before?.createdAt ?? now, updatedAt: now })
  else notes.delete(id)
  setState({ notes })
  const { alg, symmetry, text } = note
  send(`note:${id}`, 'PUT', `${API}/notes/${id}`, { alg, symmetry, text } satisfies PutNoteBody)
}

/**
 * The notes shown on a catalog alg, oldest first: its own, those written on its
 * mirrored/turned versions whose symmetry reaches it (lr / fb: that mirror; both: all
 * four slots), and 'linked' notes written anywhere in its idea (see ideaOf).
 */
export function notesFor(notes: ReadonlyMap<string, Note>, alg: CatalogAlg): Note[] {
  const slot = getSlotCase(alg.slotCaseId).slot
  return [...notes.values()]
    .filter((n) => {
      if (n.alg.kind !== 'catalog') return false
      if (n.alg.id === alg.id) return true
      const owner = algsById.get(n.alg.id)
      if (!owner) return false
      if (n.symmetry === 'linked') return ideaOf.get(owner.id) === ideaOf.get(alg.id)
      if (owner.familyId !== alg.familyId) return false
      const relation = slotRelation(getSlotCase(owner.slotCaseId).slot, slot)
      return n.symmetry === 'both' || n.symmetry === relation
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Counts of slot-cases by status, over a set of slot-cases. */
export function tally(bySlotCase: ReadonlyMap<string, SlotCaseState>, slotCaseIds: string[]) {
  const counts: Record<Status, number> = { none: 0, main: 0, learning: 0, learnt: 0 }
  for (const id of slotCaseIds) counts[statusOf(bySlotCase.get(id))]++
  return { total: slotCaseIds.length, ...counts }
}
