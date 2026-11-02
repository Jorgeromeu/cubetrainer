// Imported solves and timeline milestones, held by the server (../server) and mirrored
// here, read-only: both are added one-off through the server's API (server/README.md,
// "Stats API"), so they're fetched again on window focus. Without a server there's
// nothing to show, and it keeps retrying. Excluded solves (a DB-side mark, so a re-import can't
// bring them back) are dropped here: the page never shows them.
import { useSyncExternalStore } from 'react'
import { type Load, request } from '../../../packages/core/api.ts'
import type { Milestone, MilestonesResponse, Solve, SolvesResponse } from '../contract.ts'

export type { Milestone, Solve }

/** The stats trainer's part of the server's API (server/src/trainers/stats/). */
const API = '/api/stats'

export interface SolvesState {
  /** loading: first fetch in flight · offline: no server · ready: loaded. */
  load: Load
  /** Oldest first. */
  solves: readonly Solve[]
  /** By start day. */
  milestones: readonly Milestone[]
  error?: string
}

let state: SolvesState = { load: 'loading', solves: [], milestones: [] }
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

const RETRY_MS = 30000
let retryTimer: ReturnType<typeof setTimeout> | undefined
let loading = false

async function load() {
  if (loading) return
  loading = true
  clearTimeout(retryTimer)
  try {
    const [body, marks] = await Promise.all([
      request<SolvesResponse>(`${API}/solves`),
      request<MilestonesResponse>(`${API}/milestones`),
    ])
    if (!Array.isArray(body?.solves) || !Array.isArray(marks?.milestones)) throw new Error('unexpected response')
    setState({ load: 'ready', solves: body.solves.filter((s) => !s.excluded), milestones: marks.milestones, error: undefined })
  } catch (e) {
    setState({ load: 'offline', error: `Server ${(e as Error).message}` })
    retryTimer = setTimeout(load, RETRY_MS)
  } finally {
    loading = false
  }
}

load()
addEventListener('focus', load)
addEventListener('online', load)
