// Timed PLL solves, held by the server (../server) and mirrored here, plus per-case stats
// to show the weak spots. A new solve shows right away; it's sent to the server and, if
// the server is unreachable, kept here (unsaved) and sent once it's back; penalties and
// removals too.
// Changes still waiting for the server are lost on reload.
import { useSyncExternalStore } from 'react'
import { Rejected, request } from '../../common/api.ts'
import type { PatchSolveBody, Penalty, PutSolveBody, Solve, SolvesResponse } from '../../../../shared/pll/solves.ts'
import { averageOf, effectiveMs, formatTime } from '../../common/solveTime.ts'

export type { Penalty, Solve }
export { averageOf, effectiveMs, formatMs, formatSolve, formatTime } from '../../common/solveTime.ts'

/** PLL's part of the server's API (server/src/trainers/pll/). */
const API = '/api/pll'

export interface SolvesState {
  /** loading: first fetch in flight · offline: no server, new solves wait · ready: loaded. */
  load: 'loading' | 'ready' | 'offline'
  /** Oldest first, saved and unsaved. */
  solves: readonly Solve[]
  /** Ids of solves not on the server yet. */
  unsaved: ReadonlySet<string>
  /** Why the server is offline, or the last refused save (cleared after a while). */
  error?: string
}

let state: SolvesState = { load: 'loading', solves: [], unsaved: new Set() }
const listeners = new Set<() => void>()

function setState(patch: Partial<SolvesState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSolves = () => useSyncExternalStore(subscribe, () => state)

const byTime = (a: Solve, b: Solve) => a.createdAt.localeCompare(b.createdAt)

/** Retry delays while offline: quick at first, then every 30s. Focus/online also retry. */
const RETRY_MS = [2000, 5000, 10000, 30000]
let retries = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined
let loading = false

/** Saved solves removed while offline, to remove on the server once it's back. */
const pendingDeletes = new Set<string>()
/** Saved solves whose penalty changed while offline (or before their upload finished). */
const pendingPenalties = new Set<string>()

/** Loads the server's solves and sends what's waiting: the unsaved solves and removals. */
async function load() {
  if (loading || state.load === 'ready') return
  loading = true
  clearTimeout(retryTimer)
  try {
    const body = await request<SolvesResponse>(`${API}/solves`)
    if (!Array.isArray(body?.solves)) throw new Error('unexpected response')
    retries = 0
    const unsaved = state.solves.filter((s) => state.unsaved.has(s.id))
    const local = new Map(state.solves.map((s) => [s.id, s]))
    const saved = body.solves
      .filter((s) => !pendingDeletes.has(s.id))
      .map((s) => (pendingPenalties.has(s.id) && local.has(s.id) ? { ...s, penalty: local.get(s.id)!.penalty } : s))
    setState({ load: 'ready', solves: [...saved, ...unsaved].sort(byTime), error: undefined })
    unsaved.forEach(upload)
    pendingDeletes.forEach(remove)
    pendingPenalties.forEach(sendPenalty)
  } catch (e) {
    goOffline(e as Error)
  } finally {
    loading = false
  }
}

function goOffline(e: Error) {
  setState({ load: 'offline', error: `Server ${e.message}` })
  clearTimeout(retryTimer)
  retryTimer = setTimeout(load, RETRY_MS[Math.min(retries++, RETRY_MS.length - 1)])
}

load()
addEventListener('focus', load)
addEventListener('online', load)

let errorTimer: ReturnType<typeof setTimeout> | undefined
function showSaveError(message: string) {
  setState({ error: message })
  clearTimeout(errorTimer)
  errorTimer = setTimeout(() => state.error === message && setState({ error: undefined }), 6000)
}

function withoutUnsaved(id: string) {
  const unsaved = new Set(state.unsaved)
  unsaved.delete(id)
  return unsaved
}

/** Sends a solve. Offline, it stays unsaved until load() resends it; refused, it's dropped. */
function upload(solve: Solve) {
  const { caseId, ms, scramble, penalty } = solve
  request(`${API}/solves/${solve.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, ms, scramble, penalty } satisfies PutSolveBody),
  }).then(
    () => {
      const now = state.solves.find((s) => s.id === solve.id)
      if (!now) return remove(solve.id) // deleted while it was being sent
      if (state.unsaved.has(solve.id)) setState({ unsaved: withoutUnsaved(solve.id) })
      if (now.penalty !== penalty) sendPenalty(solve.id) // changed while it was being sent
    },
    (e: Error) => {
      if (!state.unsaved.has(solve.id)) return // deleted, or saved by another attempt
      if (e instanceof Rejected) {
        setState({ solves: state.solves.filter((s) => s.id !== solve.id), unsaved: withoutUnsaved(solve.id) })
        showSaveError(`Couldn't save the time: ${e.message}`)
      } else if (state.load === 'ready') goOffline(e)
    },
  )
}

/** Records a timed solve. Returns it. */
export function addSolve(caseId: string, ms: number, scramble: string): Solve {
  const solve: Solve = {
    id: crypto.randomUUID(),
    caseId,
    ms: Math.round(ms),
    penalty: 'ok',
    scramble,
    createdAt: new Date().toISOString(),
  }
  setState({ solves: [...state.solves, solve], unsaved: new Set(state.unsaved).add(solve.id) })
  if (state.load === 'ready') upload(solve)
  return solve
}

/** Removes a saved solve on the server. Offline, it waits in pendingDeletes for load(). */
function remove(id: string) {
  pendingDeletes.add(id)
  if (state.load !== 'ready') return
  request(`${API}/solves/${id}`, { method: 'DELETE' }).then(
    () => pendingDeletes.delete(id),
    (e: Error) => {
      if (!(e instanceof Rejected)) return state.load === 'ready' && goOffline(e)
      // Refused: show what the server has.
      pendingDeletes.delete(id)
      showSaveError(`Couldn't remove the time: ${e.message}`)
      setState({ load: 'loading' })
      load()
    },
  )
}

/** Sends a saved solve's current penalty. Offline, it waits in pendingPenalties for load(). */
function sendPenalty(id: string) {
  const solve = state.solves.find((s) => s.id === id)
  if (!solve) return pendingPenalties.delete(id)
  pendingPenalties.add(id)
  if (state.load !== 'ready') return
  const { penalty } = solve
  request(`${API}/solves/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ penalty } satisfies PatchSolveBody),
  }).then(
    () => state.solves.find((s) => s.id === id)?.penalty === penalty && pendingPenalties.delete(id),
    (e: Error) => {
      if (!(e instanceof Rejected)) return state.load === 'ready' && goOffline(e)
      pendingPenalties.delete(id)
      showSaveError(`Couldn't save the penalty: ${e.message}`)
      setState({ load: 'loading' })
      load()
    },
  )
}

/** Sets a solve's penalty: OK, +2 or DNF. */
export function setPenalty(id: string, penalty: Penalty) {
  const solve = state.solves.find((s) => s.id === id)
  if (!solve || solve.penalty === penalty) return
  setState({ solves: state.solves.map((s) => (s.id === id ? { ...s, penalty } : s)) })
  // An unsaved one goes up with its penalty (upload() catches a change while it's in flight).
  if (!state.unsaved.has(id)) sendPenalty(id)
}

/** Removes a solve (a botched one). */
export function deleteSolve(id: string) {
  const wasUnsaved = state.unsaved.has(id)
  setState({ solves: state.solves.filter((s) => s.id !== id), unsaved: withoutUnsaved(id) })
  if (!wasUnsaved) remove(id)
}

/** The usual timer stats over some solves (oldest first): all of them, or one case's. */
export interface Stats {
  count: number
  dnfs: number
  /** Best single (with +2s); undefined if none finished. */
  best?: number
  ao5?: number
  ao12?: number
  /** Mostly for all solves: a single case takes a long time to get to 100. */
  ao100?: number
  /** Mean of the finished solves. */
  mean?: number
}

export function statsOf(solves: readonly Solve[]): Stats {
  const finished = solves.map(effectiveMs).filter(Number.isFinite)
  return {
    count: solves.length,
    dnfs: solves.length - finished.length,
    best: finished.length ? Math.min(...finished) : undefined,
    ao5: averageOf(solves, 5),
    ao12: averageOf(solves, 12),
    ao100: averageOf(solves, 100),
    mean: finished.length ? finished.reduce((a, b) => a + b, 0) / finished.length : undefined,
  }
}

/** Stats per case id, for the cases with solves. */
export function statsByCase(solves: readonly Solve[]): Map<string, Stats> {
  const byCase = new Map<string, Solve[]>()
  for (const s of solves) byCase.set(s.caseId, [...(byCase.get(s.caseId) ?? []), s])
  return new Map([...byCase].map(([caseId, solves]) => [caseId, statsOf(solves)]))
}

/**
 * Where a case stands now, for ranking and colouring the weak spots: its ao5, or the mean
 * of its finished solves until it has 5. Infinity (slowest) if that's a DNF or none finished.
 */
export const paceOf = (s: Stats) => s.ao5 ?? s.mean ?? Infinity

/** A case's stats as a tooltip. */
export const statsTitle = (s: Stats) =>
  [
    `ao5 ${formatTime(s.ao5)} · ao12 ${formatTime(s.ao12)}${s.ao100 === undefined ? '' : ` · ao100 ${formatTime(s.ao100)}`}`,
    `best ${formatTime(s.best)} · mean ${formatTime(s.mean)}`,
    `${s.count} ${s.count === 1 ? 'solve' : 'solves'}${s.dnfs ? ` · ${s.dnfs} DNF` : ''}`,
  ].join('\n')
