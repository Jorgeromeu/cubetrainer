// Every solve (timed here or imported) and the timeline milestones, held by the server
// (../server) and mirrored here through serverData (packages/ui/serverData.ts). A solve timed
// here shows at once and is saved in order with what follows it (a penalty, a delete), also
// with no server yet: nothing is lost. Imports and milestones are added through the server's
// API (../README.md) and show on the next fetch (window focus). Excluded solves (a DB-side
// mark, so a re-import can't bring them back) are left out here: no page shows them.
import { request } from '../../../packages/core/api.ts'
import type { Load } from '../../../packages/core/api.ts'
import type { Penalty } from '../../../packages/core/solve.ts'
import { serverData, type ServerState } from '../../../packages/ui/serverData.ts'
import { type Milestone, type MilestonesResponse, type PatchSolveBody, type PutSolveBody, type Solve, type SolvesResponse, TIMER_SOURCE } from '../contract.ts'

export type { Milestone, Solve }

/** The timer tool's part of the server's API (tools/timer/server/). */
const API = '/api/timer'

interface SolvesData {
  /** Oldest first, excluded ones left out. */
  solves: readonly Solve[]
  /** By start day. */
  milestones: readonly Milestone[]
}

export interface SolvesState extends SolvesData {
  load: Load
  /** Ids of solves timed here that the server doesn't have yet. */
  unsaved: ReadonlySet<string>
  error?: string
}

async function fetchSolves(): Promise<SolvesData> {
  const [body, marks] = await Promise.all([request<SolvesResponse>(`${API}/solves`), request<MilestonesResponse>(`${API}/milestones`)])
  if (!Array.isArray(body?.solves) || !Array.isArray(marks?.milestones)) throw new Error('unexpected response')
  return { solves: body.solves.filter((s) => !s.excluded), milestones: marks.milestones }
}

const store = serverData<SolvesData>({ owner: 'timer', fetch: fetchSolves, empty: { solves: [], milestones: [] }, changesBeforeLoad: true })

const solveUrl = (id: string) => `${API}/solves/${id}`

let viewed: { from?: ServerState<SolvesData>; value?: SolvesState } = {}
const view = (s: ServerState<SolvesData>): SolvesState =>
  viewed.from === s
    ? viewed.value!
    : (viewed = {
        from: s,
        value: {
          load: s.load,
          error: s.error,
          ...s.data,
          unsaved: new Set(s.unsent.filter((o) => o.method === 'PUT').map((o) => o.url.slice(solveUrl('').length))),
        },
      }).value!

export const useSolves = () => view(store.use())

const withSolve = (d: SolvesData, solve: Solve): SolvesData => ({
  ...d,
  solves: [...d.solves.filter((s) => s.id !== solve.id), solve].sort((a, b) => a.solvedAt.localeCompare(b.solvedAt)),
})

/** A solve just timed here: shown at once, saved in the background. */
export function addSolve(ms: number, scramble: string): Solve {
  const solve: Solve = {
    id: crypto.randomUUID(),
    ms: Math.max(1, Math.round(ms)),
    penalty: 'ok',
    penaltyKnown: true,
    scramble,
    scrambledBy: 'timer',
    comment: '',
    solvedAt: new Date().toISOString(),
    source: TIMER_SOURCE,
    importId: null,
    excluded: false,
    excludedReason: '',
  }
  const body: PutSolveBody = { ms: solve.ms, penalty: solve.penalty, scramble, solvedAt: solve.solvedAt }
  store.change((d) => withSolve(d, solve), { method: 'PUT', url: solveUrl(solve.id), body })
  return solve
}

/** Sets a solve's penalty. */
export function setPenalty(id: string, penalty: Penalty) {
  const before = store.get().data.solves.find((s) => s.id === id)
  if (!before || before.penalty === penalty) return
  store.change((d) => withSolve(d, { ...before, penalty, penaltyKnown: true }), {
    method: 'PATCH',
    url: solveUrl(id),
    body: { penalty } satisfies PatchSolveBody,
  })
}

/** Deletes a solve timed here (imported ones are excluded instead, through the API). */
export function deleteSolve(id: string) {
  store.change((d) => ({ ...d, solves: d.solves.filter((s) => s.id !== id) }), { method: 'DELETE', url: solveUrl(id) })
}
