// Named sets of cubes ("Ra Rb T", "Y V E"), held by the server (../server) and mirrored
// here. Without a server there are no sets, and it keeps retrying (and on window focus).
import { useSyncExternalStore } from 'react'
import { type Load, request } from '../../../../packages/core/api.ts'
import type { CompareCube, CompareSet, PutSetBody, SetsResponse } from '../../../../shared/pll-compare/sets.ts'

export type { CompareSet }

/** PLL compare's part of the server's API (server/src/trainers/pll-compare/). */
const API = '/api/pll-compare'

export interface SetsState {
  /** loading: first fetch in flight · offline: no server · ready: loaded. */
  load: Load
  /** By name. */
  sets: readonly CompareSet[]
}

let state: SetsState = { load: 'loading', sets: [] }
const listeners = new Set<() => void>()

function setState(patch: Partial<SetsState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSets = () => useSyncExternalStore(subscribe, () => state)

const byName = (a: CompareSet, b: CompareSet) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

const RETRY_MS = 30000
let retryTimer: ReturnType<typeof setTimeout> | undefined
let loading = false

async function load() {
  if (loading || state.load === 'ready') return
  loading = true
  clearTimeout(retryTimer)
  try {
    const body = await request<SetsResponse>(`${API}/sets`)
    if (!Array.isArray(body?.sets)) throw new Error('unexpected response')
    setState({ load: 'ready', sets: body.sets })
  } catch {
    setState({ load: 'offline' })
    retryTimer = setTimeout(load, RETRY_MS)
  } finally {
    loading = false
  }
}

load()
addEventListener('focus', load)
addEventListener('online', load)

/** Saves a set (new or existing id). Throws with the server's reason if it isn't saved. */
export async function saveSet(id: string, name: string, cubes: readonly CompareCube[]): Promise<CompareSet> {
  const saved = await request<CompareSet>(`${API}/sets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      cubes: cubes.map(({ caseId, variant, turn, blocks }) => ({ caseId, variant, turn, ...(blocks?.length ? { blocks } : {}) })),
    } satisfies PutSetBody),
  })
  setState({ sets: [...state.sets.filter((s) => s.id !== id), saved].sort(byName) })
  return saved
}

export async function deleteSet(id: string) {
  await request(`${API}/sets/${id}`, { method: 'DELETE' })
  setState({ sets: state.sets.filter((s) => s.id !== id) })
}
