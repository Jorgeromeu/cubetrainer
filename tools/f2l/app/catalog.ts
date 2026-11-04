// Loads the static catalog and builds lookup indexes over it.
import catalogJson from '../catalog/f2l.json'
import { FRONT_BACK_SLOT, MIRROR_SLOT, OPPOSITE_SLOT, type Slot } from '../../../packages/core/cube.ts'
import {
  LINK_KINDS,
  RECOMMENDERS,
  type Case,
  type Catalog,
  type CatalogAlg,
  type Cluster,
  type LinkKind,
  type Recommender,
  type SlotCase,
} from '../catalog/catalog.ts'
import { isRotation, joinMoves } from '../../../packages/core/notation/moves.ts'
import type { SetupMode } from './settings.ts'

export { SLOTS, type Slot } from '../../../packages/core/cube.ts'
export { LINK_KINDS, RECOMMENDERS }
export type { Case, CatalogAlg, Cluster, LinkKind, Recommender, SlotCase }

export const catalog = catalogJson as unknown as Catalog

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((x) => [x.id, x]))

export const clustersById = byId(catalog.clusters)
const casesById = byId(catalog.cases)
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
 * the pair: after a rotation setup that's always FR's corner and edge. An `auf` turns the
 * case to another angle (before the rotation, so the setup reads as FR moves, then a y).
 */
export function caseSetup(slotCase: SlotCase, mode: SetupMode, auf = ''): { setup: string; pairSlot: Slot } {
  if (mode === 'colours' || slotCase.slot === 'FR') return { setup: joinMoves(slotCase.setup, auf), pairSlot: slotCase.slot }
  const frSetup = getSlotCase(slotCaseIdFor(slotCase.caseId, 'FR')).setup
  return { setup: `${joinMoves(frSetup, auf)} ${SETUP_ROTATION[slotCase.slot]}`, pairSlot: 'FR' }
}

/** Whole-cube rotations in an alg (wherever they are). */
const rotationCount = (alg: CatalogAlg) => alg.moves.split(' ').filter(isRotation).length

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

/** A recommendation sheet an alg is on (see CatalogAlg.recommendedBy), as printed or in another grip. */
export interface Recommendation {
  by: Recommender
  /** The sheet's spelling, when this alg is the same alg (same shape) written with another grip, in the same slot-case. */
  via?: CatalogAlg
}

/**
 * The sheets that recommend this alg for its slot-case: with exactly its moves
 * (recommendedBy), or as the same alg (same shape) in another grip there. Never from
 * another slot: a sheet's pick in one slot isn't a pick in another (J Perm's sheet is
 * front-right only), so other slots only show what a sheet picked for them.
 */
export function recommendationsOf(alg: CatalogAlg): Recommendation[] {
  const direct = alg.recommendedBy ?? []
  const sameSlot = (algsByShape.get(alg.shapeId) ?? []).filter((b) => b !== alg && b.slotCaseId === alg.slotCaseId)
  return (Object.keys(RECOMMENDERS) as Recommender[]).flatMap((by) => {
    if (direct.includes(by)) return [{ by }]
    const via = sameSlot.find((b) => b.recommendedBy?.includes(by))
    return via ? [{ by, via }] : []
  })
}

/** shape id -> the algs with that shape (same case, any slot, any grip). */
const algsByShape = new Map<string, CatalogAlg[]>()
for (const a of catalog.algs) algsByShape.set(a.shapeId, [...(algsByShape.get(a.shapeId) ?? []), a])

/** One of an alg's links: how `alg` relates to the alg it's listed on (see LinkKind). */
export interface AlgLink {
  kind: LinkKind
  alg: CatalogAlg
}

const linksCache = new Map<string, AlgLink[]>()

/**
 * Every alg linked to `alg`, with how: the same shape is a rotation link, the mirror
 * shape a mirror (neighbouring slot) or transpose (same or opposite slot) link.
 */
function linksOf(alg: CatalogAlg): AlgLink[] {
  const cached = linksCache.get(alg.id)
  if (cached) return cached
  const slot = getSlotCase(alg.slotCaseId).slot
  const links: AlgLink[] = [
    ...(algsByShape.get(alg.shapeId) ?? []).filter((b) => b !== alg).map((b) => ({ kind: 'rotation' as const, alg: b })),
    ...(algsByShape.get(alg.mirrorShapeId) ?? [])
      .filter((b) => b !== alg)
      .map((b) => {
        const other = getSlotCase(b.slotCaseId).slot
        const kind: LinkKind = MIRROR_SLOT[slot] === other ? 'mirrorLR' : FRONT_BACK_SLOT[slot] === other ? 'mirrorFB' : 'transpose'
        return { kind, alg: b }
      }),
  ]
  linksCache.set(alg.id, links)
  return links
}

export const LINK_LABEL: Record<LinkKind, string> = {
  mirrorLR: 'Left-right mirror',
  mirrorFB: 'Front-back mirror',
  rotation: 'Rotation / d move',
  transpose: 'Transpose',
}

export const LINK_HINT: Record<LinkKind, string> = {
  mirrorLR: 'The same alg with the other hand, in the slot beside it',
  mirrorFB: 'The same alg mirrored to the slot in front / behind',
  rotation: 'The same alg in another grip or slot: a rotation, a d move or a 180° turn apart',
  transpose: 'The mirror case in the same slot, done with F-U moves instead of R-U ones (or the other way)',
}

/** A short "what's on" for tooltips: "left-right mirror, rotation / d move", or `none`. */
export const linkSetSummary = (kinds: readonly LinkKind[], none: string) =>
  kinds.length ? kinds.map((k) => LINK_LABEL[k].toLowerCase()).join(', ') : none

/** What a link is, said from the alg it's listed on: "left-right mirror", "transpose (F-U version)"… */
export function linkPhrase(from: CatalogAlg, link: AlgLink): string {
  if (link.kind === 'transpose') return link.alg.side ? `transpose (${link.alg.side}-U version)` : 'transpose'
  if (link.kind !== 'rotation') return LINK_LABEL[link.kind].toLowerCase()
  const [a, b] = [from, link.alg].map((x) => getSlotCase(x.slotCaseId).slot)
  if (a === b) return 'same alg, another grip (rotation / d move)'
  if (OPPOSITE_SLOT[a] === b) return 'same alg, cube turned 180°'
  return 'same alg in another slot'
}

/** Breadth-first over links of the given kinds: alg id -> steps from `alg` (0 for itself). */
export function reachable(alg: CatalogAlg, kinds: readonly LinkKind[]): Map<string, number> {
  const steps = new Map([[alg.id, 0]])
  const queue = [alg]
  for (let i = 0; i < queue.length; i++) {
    for (const link of linksOf(queue[i])) {
      if (!kinds.includes(link.kind) || steps.has(link.alg.id)) continue
      steps.set(link.alg.id, steps.get(queue[i].id)! + 1)
      queue.push(link.alg)
    }
  }
  return steps
}

/** The links of the given kinds between two algs, if any. */
export const linksBetween = (a: CatalogAlg, b: CatalogAlg, kinds: readonly LinkKind[] = LINK_KINDS) =>
  linksOf(a).filter((l) => l.alg === b && kinds.includes(l.kind))

/**
 * Splits a set of algs into groups: algs linked directly (by a link of the given kinds)
 * share a group, and so does anything linked to those, within the set. Only links
 * between members count, so leaving a kind out really splits groups apart.
 */
export function groupAlgs(algs: CatalogAlg[], kinds: readonly LinkKind[]): CatalogAlg[][] {
  const parent = new Map(algs.map((a) => [a.id, a.id]))
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!))
  for (const a of algs)
    for (const l of linksOf(a)) if (parent.has(l.alg.id) && kinds.includes(l.kind)) parent.set(find(a.id), find(l.alg.id))
  const groups = new Map<string, CatalogAlg[]>()
  for (const a of algs) groups.set(find(a.id), [...(groups.get(find(a.id)) ?? []), a])
  return [...groups.values()]
}

/**
 * The alg in `slotCaseId` that's most like `alg`, through links of any kind: your main
 * there if it's linked at all, else the fewest links away (a direct link first, the exact
 * mirrored / turned version among those, then the most popular). Undefined when nothing
 * there is linked.
 */
export function equivalentIn(alg: CatalogAlg, slotCaseId: string, mainId?: string) {
  const steps = reachable(alg, LINK_KINDS)
  const candidates = getSlotCase(slotCaseId).algIds.filter((id) => steps.has(id) && id !== alg.id).map(getAlg)
  if (!candidates.length) return undefined
  const exact = new Set(Object.values(alg.familyAlgIds ?? {}))
  const rank = (a: CatalogAlg) => [a.id === mainId ? 0 : 1, steps.get(a.id)!, exact.has(a.id) ? 0 : 1, -popularity(a)]
  const byRank = (a: CatalogAlg, b: CatalogAlg) => {
    const [ra, rb] = [rank(a), rank(b)]
    const i = ra.findIndex((x, k) => x !== rb[k])
    return i === -1 ? 0 : ra[i] - rb[i]
  }
  const best = candidates.sort(byRank)[0]
  return { alg: best, steps: steps.get(best.id)!, links: linksBetween(alg, best) }
}

export const SLOT_NAMES: Record<Slot, string> = {
  FR: 'Front right',
  FL: 'Front left',
  BR: 'Back right',
  BL: 'Back left',
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

/** Clusters in overview order: by group, then as listed. */
const clusterOrder = clustersByGroup.flatMap((g) => g.clusters)

/** The clusters before and after this one in overview order, wrapping around at the ends. */
export function neighbourClusters(cluster: Cluster): { previous: Cluster; next: Cluster } {
  const i = clusterOrder.indexOf(cluster)
  const at = (k: number) => clusterOrder[(k + clusterOrder.length) % clusterOrder.length]
  return { previous: at(i - 1), next: at(i + 1) }
}

export const clusterTitle = (cluster: Cluster) =>
  cluster.caseIds.map((id) => getCase(id).number).join(' · ')
