// Loads the static catalog and builds lookup indexes over it.
import catalogJson from '../../../../catalog/f2l.json'
import { FRONT_BACK_SLOT, MIRROR_SLOT, type Slot } from '../../../../shared/cube.ts'
import type { Case, Catalog, CatalogAlg, Cluster, SlotCase } from '../../../../shared/f2l/catalog.ts'
import { isRotation } from '../../common/notation/moves.ts'
import type { SetupMode } from './settings.ts'

export { SLOTS, type Slot } from '../../../../shared/cube.ts'
export type { Case, CatalogAlg, Cluster, SlotCase }

export const catalog = catalogJson as unknown as Catalog

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((x) => [x.id, x]))

export const clustersById = byId(catalog.clusters)
export const casesById = byId(catalog.cases)
export const slotCasesById = byId(catalog.slotCases)
export const algsById = byId(catalog.algs)

export const getCase = (id: string) => casesById.get(id)!
export const getSlotCase = (id: string) => slotCasesById.get(id)!
export const getAlg = (id: string) => algsById.get(id)!

export const slotCaseIdFor = (caseId: string, slot: Slot) => `${caseId}-${slot}`

/** After the FR setup, the y rotation (not turned back) that brings the FR pair to the slot. */
const SETUP_ROTATION: Record<Slot, string> = { FR: '', FL: 'y', BR: "y'", BL: 'y2' }

/**
 * The setup shown for a slot-case (see SetupMode), and the slot whose home pieces make up
 * the pair: after a rotation setup that's always FR's corner and edge.
 */
export function caseSetup(slotCase: SlotCase, mode: SetupMode): { setup: string; pairSlot: Slot } {
  if (mode === 'colours' || slotCase.slot === 'FR') return { setup: slotCase.setup, pairSlot: slotCase.slot }
  const frSetup = getSlotCase(slotCaseIdFor(slotCase.caseId, 'FR')).setup
  return { setup: `${frSetup} ${SETUP_ROTATION[slotCase.slot]}`, pairSlot: 'FR' }
}

/** Whole-cube rotations in an alg (wherever they are). */
export const rotationCount = (alg: CatalogAlg) => alg.moves.split(' ').filter(isRotation).length

/** The alg's left-right mirror (same motion, other hand), if the catalog has it. */
export const leftRightMirror = (alg: CatalogAlg) => {
  const id = alg.familyAlgIds?.[MIRROR_SLOT[getSlotCase(alg.slotCaseId).slot]]
  return id ? getAlg(id) : undefined
}

/**
 * SpeedCubeDB votes for the alg plus its left-right mirror. Votes outside front-right are
 * sparse, and the mirror is the same motion with the other hand, so pooling them is fair.
 * (Not the front-back mirror: B moves at the back feel nothing like F moves at the front.)
 */
export const popularity = (alg: CatalogAlg) => (alg.votes ?? 0) + (leftRightMirror(alg)?.votes ?? 0)

/** A more popular alg only counts as better past this gap: noise otherwise. */
const isClearlyMoreVoted = (votes: number, than: number) => votes - than >= Math.max(5, votes * 0.25)

/**
 * A clearly more popular alg for the same slot-case with no more rotations than `alg`, if
 * there is one (the most popular of those). Votes are the main signal for "better"; the
 * rotation limit keeps a deliberately rotationless choice from being flagged.
 */
export function betterAlg(alg: CatalogAlg): CatalogAlg | undefined {
  const best = getSlotCase(alg.slotCaseId)
    .algIds.map(getAlg)
    .filter((a) => a.id !== alg.id && rotationCount(a) <= rotationCount(alg))
    .sort((a, b) => popularity(b) - popularity(a))[0]
  return best && isClearlyMoreVoted(popularity(best), popularity(alg)) ? best : undefined
}

/** The slot-case's main alg has a clearly more popular alternative (see betterAlg). */
export const mainHasBetter = (mainAlgId: string | undefined) => {
  const main = mainAlgId ? algsById.get(mainAlgId) : undefined
  return main ? betterAlg(main) : undefined
}

/** execution id -> the algs with those hand motions (same case, any slot, any leading y). */
const algsByExecution = new Map<string, CatalogAlg[]>()
for (const a of catalog.algs) algsByExecution.set(a.executionId, [...(algsByExecution.get(a.executionId) ?? []), a])

/** Other algs that are the same execution as `alg` (a leading y rotation apart). */
export const executionPeers = (alg: CatalogAlg) => algsByExecution.get(alg.executionId)!.filter((a) => a.id !== alg.id)

/**
 * alg id -> its idea: every alg reachable from it through family links (mirrors, 180°
 * turn: shared familyId) and execution links (shared executionId), in any number of steps.
 * Not stored anywhere, so it doesn't need to be stable across catalog rebuilds.
 */
export const ideaOf: ReadonlyMap<string, string> = (() => {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const root = find(p)
    parent.set(x, root)
    return root
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))
  for (const a of catalog.algs) {
    union(a.id, `family:${a.familyId}`)
    union(a.id, `execution:${a.executionId}`)
  }
  return new Map(catalog.algs.map((a) => [a.id, find(a.id)]))
})()

export const SLOT_NAMES: Record<Slot, string> = {
  FR: 'Front right',
  FL: 'Front left',
  BR: 'Back right',
  BL: 'Back left',
}

/** How a slot relates to another for the same alg family: the alg itself, a mirror, or turned. */
export function slotRelation(from: Slot, to: Slot): 'same' | 'lr' | 'fb' | 'turned' {
  if (from === to) return 'same'
  if (MIRROR_SLOT[from] === to) return 'lr'
  if (FRONT_BACK_SLOT[from] === to) return 'fb'
  return 'turned'
}

/** How an alg in `from` relates to its family member in `to` (see CatalogAlg.familyAlgIds). */
export function familyRelation(from: Slot, to: Slot): string {
  if (MIRROR_SLOT[from] === to) return 'Left-right mirror'
  if (FRONT_BACK_SLOT[from] === to) return 'Front-back mirror'
  return 'Same alg, cube turned 180°'
}

/** Groups in the order cases are usually learnt, with their clusters. */
export const clustersByGroup: { group: string; clusters: Cluster[] }[] = (() => {
  const order = [
    'Free Pairs',
    'Connected Pairs',
    'Disconnected Pairs',
    'Corner In Slot',
    'Edge In Slot',
    'Pieces In Slot',
  ]
  const groups = new Map<string, Cluster[]>()
  for (const cluster of catalog.clusters) {
    const group = getCase(cluster.caseIds[0]).group
    groups.set(group, [...(groups.get(group) ?? []), cluster])
  }
  return [...groups]
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map(([group, clusters]) => ({ group, clusters }))
})()

export const clusterTitle = (cluster: Cluster) =>
  cluster.caseIds.map((id) => getCase(id).number).join(' · ')
