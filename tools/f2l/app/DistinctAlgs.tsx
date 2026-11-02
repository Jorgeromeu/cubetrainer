// How many distinct things your algs really are, shown in Settings → F2L under the link
// kinds that decide it.
import { algsById, groupAlgs, type CatalogAlg, type LinkKind } from './catalog.ts'
import { useProgress, type SlotCaseState } from './progress.ts'

/**
 * As algs, as shapes (the same alg in another grip or slot counts once) and as ideas (algs
 * linked by the kinds you count as the same, see F2lSettings.linkKinds, count once).
 */
function distinct(algs: CatalogAlg[], kinds: readonly LinkKind[]) {
  return {
    algs: algs.length,
    shapes: new Set(algs.map((a) => a.shapeId)).size,
    ideas: groupAlgs(algs, kinds).length,
  }
}

/** Main algs (one per slot-case that has one) and learnt algs, as catalog algs. */
function chosenAlgs(bySlotCase: ReadonlyMap<string, SlotCaseState>, kinds: readonly LinkKind[]) {
  const main: CatalogAlg[] = []
  const learnt: CatalogAlg[] = []
  for (const p of bySlotCase.values()) {
    const m = p.mainAlg?.kind === 'catalog' ? algsById.get(p.mainAlg.id) : undefined
    if (m) main.push(m)
    for (const a of p.algs) {
      const alg = a.status === 'learnt' && a.alg.kind === 'catalog' ? algsById.get(a.alg.id) : undefined
      if (alg) learnt.push(alg)
    }
  }
  return { main: distinct(main, kinds), learnt: distinct(learnt, kinds) }
}

const HINT =
  'Algs: one per slot. Shapes: the same alg in another grip or slot (a rotation or d move apart) counts once. ' +
  'Ideas: algs linked the ways you count as the same count once: roughly what you actually memorise.'

export function DistinctAlgs({ linkKinds }: { linkKinds: readonly LinkKind[] }) {
  const { load, bySlotCase } = useProgress()
  if (load !== 'ready') return null
  const { main, learnt } = chosenAlgs(bySlotCase, linkKinds)
  return (
    <p className="distinct-stat" title={HINT}>
      Main algs <strong>{main.algs}</strong> → {main.shapes} shapes → <strong>{main.ideas}</strong> ideas
      <br />
      Learnt <strong>{learnt.algs}</strong> → {learnt.shapes} shapes → <strong>{learnt.ideas}</strong> ideas
    </p>
  )
}
