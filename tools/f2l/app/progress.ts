// The user's progress, held by the server (../server) and mirrored here through serverData
// (packages/ui/serverData.ts): each slot-case's main alg, per alg a status independent of
// main, notes, video links and the algs you added yourself. Changes show at once and are
// sent in order; until the first load the progress UI is hidden ('offline' or 'loading').
import { type Load, request } from '../../../packages/core/api.ts'
import { serverData, type ServerState } from '../../../packages/ui/serverData.ts'
import { algsById, reachable, type CatalogAlg } from './catalog.ts'
import type {
  AlgRef,
  AlgState,
  AlgStatus,
  Note,
  NoteFollows,
  PatchAlgBody,
  ProgressResponse,
  PutNoteBody,
  PutProgressBody,
  PatchUserAlgBody,
  PutUserAlgBody,
  PutVideoBody,
  SlotCaseProgress,
  UserAlg,
  VideoLink,
} from '../contract.ts'

export type { AlgRef, AlgState, AlgStatus, Note, NoteFollows, SlotCaseProgress, UserAlg, VideoLink }

/** F2L's part of the server's API (server/src/tools/f2l/). */
const API = '/api/f2l'

/** One slot-case's progress: its main alg and its algs' states. Empty slot-cases have no entry. */
export interface SlotCaseState {
  mainAlg?: AlgRef
  algs: AlgState[]
}

/**
 * A slot-case's overall status, from its best alg: learnt (some alg learnt) · learning
 * (some alg being learnt) · wanted (some alg you want to learn) · main (a main alg,
 * nothing started) · none.
 */
export type Status = 'none' | 'main' | 'wanted' | 'learning' | 'learnt'

export const STATUS_LABEL: Record<Status, string> = {
  none: 'No main alg',
  main: 'Main alg chosen, not started',
  wanted: 'Want to learn',
  learning: 'Learning',
  learnt: 'Learnt',
}

export const ALG_STATUS_LABEL: Record<AlgStatus, string> = { wanted: 'Want to learn', learning: 'Learning', learnt: 'Learnt' }

/** The status toggle cycles: nothing → want to learn → learning → learnt → nothing. */
export const nextAlgStatus = (status: AlgStatus | null | undefined): AlgStatus | null =>
  !status ? 'wanted' : status === 'wanted' ? 'learning' : status === 'learning' ? 'learnt' : null

export interface ProgressState {
  /** loading: first fetch in flight · offline: no server, progress hidden · ready: loaded and editable. */
  load: Load
  bySlotCase: ReadonlyMap<string, SlotCaseState>
  /** All notes, by id. */
  notes: ReadonlyMap<string, Note>
  /** Video links, by algKey. */
  videos: ReadonlyMap<string, VideoLink>
  /** The algs you added, by id, oldest first. */
  userAlgs: ReadonlyMap<string, UserAlg>
  /** Why the server is offline, or the last failed save (cleared after a while). */
  error?: string
}

interface ProgressData {
  bySlotCase: ReadonlyMap<string, SlotCaseState>
  notes: ReadonlyMap<string, Note>
  videos: ReadonlyMap<string, VideoLink>
  userAlgs: ReadonlyMap<string, UserAlg>
}

const progress = serverData<ProgressData>({
  owner: 'f2l',
  fetch: () => fetchProgress(),
  empty: { bySlotCase: new Map(), notes: new Map(), videos: new Map(), userAlgs: new Map() },
})

let viewed: { from?: ServerState<ProgressData>; value?: ProgressState } = {}
/** The store's state as ProgressState, the same object for the same state. */
const view = (s: ServerState<ProgressData>): ProgressState =>
  viewed.from === s ? viewed.value! : (viewed = { from: s, value: { load: s.load, error: s.error, ...s.data } }).value!

export const useProgress = () => view(progress.use())

const data = () => progress.get().data

export const statusOf = (p: SlotCaseState | undefined): Status =>
  p?.algs.some((a) => a.status === 'learnt')
    ? 'learnt'
    : p?.algs.some((a) => a.status === 'learning')
      ? 'learning'
      : p?.algs.some((a) => a.status === 'wanted')
        ? 'wanted'
        : p?.mainAlg
          ? 'main'
          : 'none'

export const sameAlg = (a: AlgRef | undefined, b: AlgRef | undefined) => !!a && !!b && a.kind === b.kind && a.id === b.id

export const userRef = (alg: UserAlg): AlgRef => ({ kind: 'user', id: alg.id })

/** The algs you added for a slot-case, oldest first. */
export const userAlgsOf = (userAlgs: ReadonlyMap<string, UserAlg>, slotCaseId: string) =>
  [...userAlgs.values()].filter((a) => a.slotCaseId === slotCaseId)

/** An alg's key in `videos`. */
export const algKey = (alg: AlgRef) => `${alg.kind}:${alg.id}`

export const algStateOf = (p: SlotCaseState | undefined, alg: AlgRef) => p?.algs.find((a) => sameAlg(a.alg, alg))

function toMap(progress: SlotCaseProgress[], algs: AlgState[]) {
  const map = new Map<string, SlotCaseState>()
  const entry = (id: string) => map.get(id) ?? map.set(id, { algs: [] }).get(id)!
  for (const p of progress) entry(p.slotCaseId).mainAlg = p.mainAlg
  for (const a of algs) entry(a.slotCaseId).algs.push(a)
  return map
}

async function fetchProgress(): Promise<ProgressData> {
  const body = await request<ProgressResponse>(`${API}/progress`)
  if (
    !Array.isArray(body?.progress) ||
    !Array.isArray(body?.algs) ||
    !Array.isArray(body?.notes) ||
    !Array.isArray(body?.videos) ||
    !Array.isArray(body?.userAlgs)
  )
    throw new Error('unexpected response')
  return {
    bySlotCase: toMap(body.progress, body.algs),
    notes: new Map(body.notes.map((n) => [n.id, n])),
    videos: new Map(body.videos.map((v) => [algKey(v.alg), v])),
    userAlgs: new Map(body.userAlgs.map((a) => [a.id, a])),
  }
}

const json = (method: 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown) => ({ method, url, body })

/** Shows `next` as the slot-case's progress at once and sends the change. */
function save(slotCaseId: string, next: SlotCaseState, method: 'PUT' | 'PATCH', url: string, body: PutProgressBody | PatchAlgBody) {
  progress.change((d) => {
    const map = new Map(d.bySlotCase)
    if (next.mainAlg || next.algs.length) map.set(slotCaseId, next)
    else map.delete(slotCaseId)
    return { ...d, bySlotCase: map }
  }, json(method, url, body))
}

const current = (slotCaseId: string): SlotCaseState => data().bySlotCase.get(slotCaseId) ?? { algs: [] }

/** Makes `alg` the slot-case's main alg, or clears it when null. Learnt algs are untouched. */
export function setMainAlg(slotCaseId: string, alg: AlgRef | null) {
  const p = current(slotCaseId)
  if (alg ? sameAlg(p.mainAlg, alg) : !p.mainAlg) return
  save(
    slotCaseId,
    { ...p, mainAlg: alg ?? undefined },
    'PUT',
    `${API}/progress/${encodeURIComponent(slotCaseId)}`,
    { mainAlg: alg } satisfies PutProgressBody,
  )
}

/** Sets an alg's status; null clears it. */
export function setAlgStatus(slotCaseId: string, alg: AlgRef, status: AlgStatus | null) {
  const p = current(slotCaseId)
  if ((algStateOf(p, alg)?.status ?? null) === status) return
  const others = p.algs.filter((a) => !sameAlg(a.alg, alg))
  const algs = status ? [...others, { alg, slotCaseId, status, updatedAt: new Date().toISOString() }] : others
  save(
    slotCaseId,
    { ...p, algs },
    'PATCH',
    `${API}/algs/${alg.kind}/${encodeURIComponent(alg.id)}`,
    { status } satisfies PatchAlgBody,
  )
}

/**
 * Creates or updates a note (the id is the caller's uuid); empty text deletes it. Shows
 * locally right away.
 */
export function saveNote(id: string, note: PutNoteBody & { slotCaseId: string }) {
  const before = data().notes.get(id)
  if (before && before.text === note.text && before.follows.join() === note.follows.join()) return
  if (!before && !note.text.trim()) return
  const now = new Date().toISOString()
  const { alg, follows, text } = note
  progress.change((d) => {
    const notes = new Map(d.notes)
    if (note.text.trim()) notes.set(id, { id, ...note, createdAt: before?.createdAt ?? now, updatedAt: now })
    else notes.delete(id)
    return { ...d, notes }
  }, json('PUT', `${API}/notes/${id}`, { alg, follows, text } satisfies PutNoteBody))
}

/** Sets an alg's video link (an http(s) URL); null removes it. Shows locally right away. */
export function setVideoLink(slotCaseId: string, alg: AlgRef, url: string | null) {
  const key = algKey(alg)
  if ((data().videos.get(key)?.url ?? null) === url) return
  progress.change((d) => {
    const videos = new Map(d.videos)
    if (url) videos.set(key, { alg, slotCaseId, url, updatedAt: new Date().toISOString() })
    else videos.delete(key)
    return { ...d, videos }
  }, json('PUT', `${API}/videos/${alg.kind}/${encodeURIComponent(alg.id)}`, { url } satisfies PutVideoBody))
}

/**
 * Adds an alg of your own for a slot-case (checked on the cube by the caller: see
 * checkAlg.ts), or a placeholder with no moves yet. Shows locally right away; returns its
 * id, or undefined while offline.
 */
export function addUserAlg(slotCaseId: string, moves: string): string | undefined {
  if (progress.get().load !== 'ready') return
  const id = crypto.randomUUID()
  progress.change((d) => {
    const userAlgs = new Map(d.userAlgs)
    userAlgs.set(id, { id, slotCaseId, moves, createdAt: new Date().toISOString() })
    return { ...d, userAlgs }
  }, json('PUT', `${API}/user-algs/${id}`, { slotCaseId, moves } satisfies PutUserAlgBody))
  return id
}

/** True for an alg of yours with no moves yet: kept as just its notes till they're filled in. */
export const isPlaceholder = (alg: UserAlg) => !alg.moves

/** Fills in a placeholder's moves (checked on the cube by the caller). Its notes etc. stay. */
export function fillUserAlg(alg: UserAlg, moves: string) {
  progress.change((d) => {
    const userAlgs = new Map(d.userAlgs)
    userAlgs.set(alg.id, { ...alg, moves })
    return { ...d, userAlgs }
  }, json('PATCH', `${API}/user-algs/${alg.id}`, { moves } satisfies PatchUserAlgBody))
}

/** Deletes an alg you added, and with it its main-alg spot, status, notes and video link. */
export function deleteUserAlg(alg: UserAlg) {
  const ref = userRef(alg)
  progress.change((d) => {
    const userAlgs = new Map(d.userAlgs)
    userAlgs.delete(alg.id)
    const bySlotCase = new Map(d.bySlotCase)
    const p = d.bySlotCase.get(alg.slotCaseId) ?? { algs: [] }
    const next = { mainAlg: sameAlg(p.mainAlg, ref) ? undefined : p.mainAlg, algs: p.algs.filter((a) => !sameAlg(a.alg, ref)) }
    if (next.mainAlg || next.algs.length) bySlotCase.set(alg.slotCaseId, next)
    else bySlotCase.delete(alg.slotCaseId)
    const notes = new Map([...d.notes].filter(([, n]) => !sameAlg(n.alg, ref)))
    const videos = new Map(d.videos)
    videos.delete(algKey(ref))
    return { userAlgs, bySlotCase, notes, videos }
  }, json('DELETE', `${API}/user-algs/${alg.id}`))
}

/** The catalog algs a note shows on: its own, and those its links reach (see NoteFollows). */
export function noteReach(alg: AlgRef, follows: NoteFollows): ReadonlySet<string> {
  const owner = alg.kind === 'catalog' ? algsById.get(alg.id) : undefined
  if (!owner) return new Set()
  const key = `${owner.id}|${follows.join()}`
  let reach = reachCache.get(key)
  if (!reach) reachCache.set(key, (reach = new Set(reachable(owner, follows).keys())))
  return reach
}

const reachCache = new Map<string, ReadonlySet<string>>()

/** The notes shown on a catalog alg, oldest first: its own, and those whose links reach it (noteReach). */
export function notesFor(notes: ReadonlyMap<string, Note>, alg: CatalogAlg): Note[] {
  return [...notes.values()]
    .filter((n) => n.alg.kind === 'catalog' && (n.alg.id === alg.id || noteReach(n.alg, n.follows).has(alg.id)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** The notes on an alg: for a catalog alg, those notesFor shows; for one of yours, its own. */
export function notesOn(notes: ReadonlyMap<string, Note>, alg: AlgRef): Note[] {
  if (alg.kind === 'catalog') return algsById.has(alg.id) ? notesFor(notes, algsById.get(alg.id)!) : []
  return [...notes.values()].filter((n) => sameAlg(n.alg, alg)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Counts of slot-cases by status, over a set of slot-cases. */
export function tally(bySlotCase: ReadonlyMap<string, SlotCaseState>, slotCaseIds: string[]) {
  const counts: Record<Status, number> = { none: 0, main: 0, wanted: 0, learning: 0, learnt: 0 }
  for (const id of slotCaseIds) counts[statusOf(bySlotCase.get(id))]++
  return { total: slotCaseIds.length, ...counts }
}
