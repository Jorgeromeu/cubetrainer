import { f2lHref } from './route.ts'
import {
  SLOTS,
  algsById,
  catalog,
  ideaOf,
  mainHasBetter,
  clustersByGroup,
  clusterTitle,
  getCase,
  getSlotCase,
  slotCaseIdFor,
  type CatalogAlg,
  type Cluster,
} from './catalog.ts'
import { Cube } from '../../common/cube/Cube.tsx'
import { useF2lFocus } from './focus.ts'
import { ProgressBar, SlotStatusGrid } from './ProgressBits.tsx'
import { tally, useProgress, type SlotCaseState } from './progress.ts'
import { updateF2lSettings } from './settings.ts'
import { SlotIcon } from './SlotIcon.tsx'

/**
 * How many distinct things a set of algs really is: as algs, as executions (a leading
 * rotation apart counts once) and as ideas (mirrors and rotation versions count once).
 */
function distinct(algs: CatalogAlg[]) {
  return {
    algs: algs.length,
    executions: new Set(algs.map((a) => a.executionId)).size,
    ideas: new Set(algs.map((a) => ideaOf.get(a.id))).size,
  }
}

/** Main algs (one per slot-case that has one) and learnt algs, as catalog algs. */
function chosenAlgs(bySlotCase: ReadonlyMap<string, SlotCaseState>) {
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
  return { main: distinct(main), learnt: distinct(learnt) }
}

const DISTINCT_HINT =
  'Algs: one per slot. Executions: the same moves a leading rotation apart count once. ' +
  'Ideas: mirrors and rotation versions count once too: roughly what you actually memorise.'

const slotCaseIdsOf = (clusters: Cluster[]) =>
  clusters.flatMap((c) => c.caseIds.flatMap((caseId) => SLOTS.map((slot) => slotCaseIdFor(caseId, slot))))

export function Overview() {
  const { load, bySlotCase } = useProgress()
  const pairs = catalog.clusters.filter((c) => c.caseIds.length === 2).length
  const overall = tally(bySlotCase, slotCaseIdsOf(catalog.clusters))
  const focus = useF2lFocus()
  const chosen = chosenAlgs(bySlotCase)
  return (
    <main className="overview">
      <p className="lede">
        {catalog.cases.length} cases in {catalog.clusters.length} mirror clusters ({pairs} mirror pairs,{' '}
        {catalog.clusters.length - pairs} self-mirror). Shown in the front-right slot{' '}
        <span className="inline-icon">
          <SlotIcon slot="FR" size={14} />
        </span>
        .
      </p>
      {load === 'ready' && (
        <div className="overall-progress">
          <ProgressBar {...overall} />
          <span>
            <strong>{overall.learnt}</strong> / {overall.total} slot-cases learnt ·{' '}
            <strong>{overall.learning}</strong> learning · <strong>{overall.main}</strong> more with a main alg
          </span>
          {focus.active && (
            <span className="focus-chip" title="Learnt cases are greyed out (Settings → F2L)">
              Focus: {overall.total - overall.learnt} missing
              <button onClick={() => updateF2lSettings({ focusMissing: false })} aria-label="Turn off focus mode">
                ×
              </button>
            </span>
          )}
          <span className="distinct-stat" title={DISTINCT_HINT}>
            Main algs <strong>{chosen.main.algs}</strong> → {chosen.main.executions} executions →{' '}
            <strong>{chosen.main.ideas}</strong> ideas
            <span className="sep">·</span>
            Learnt <strong>{chosen.learnt.algs}</strong> → {chosen.learnt.executions} →{' '}
            <strong>{chosen.learnt.ideas}</strong> ideas
          </span>
          <span className="legend">
            <span className="swatch learnt" /> learnt <span className="swatch learning" /> learning{' '}
            <span className="swatch main" /> main alg <span className="swatch none" /> not chosen
          </span>
        </div>
      )}
      {clustersByGroup.map(({ group, clusters }) => {
        const groupTally = tally(bySlotCase, slotCaseIdsOf(clusters))
        return (
          <section key={group}>
            <h2>
              {group}
              {load === 'ready' && (
                <span className="group-count">
                  {groupTally.learnt}/{groupTally.total}
                </span>
              )}
            </h2>
            <div className="cluster-grid">
              {clusters.map((cluster) => {
                const t = tally(bySlotCase, slotCaseIdsOf([cluster]))
                // Slots whose main alg has a clearly more popular alternative.
                const upgrades = slotCaseIdsOf([cluster]).filter((id) => {
                  const main = bySlotCase.get(id)?.mainAlg
                  return main?.kind === 'catalog' && mainHasBetter(main.id)
                }).length
                const content = (
                  <>
                    <div className="cluster-cubes">
                      {cluster.caseIds.map((caseId) => (
                        <div key={caseId} className={'cluster-case' + (focus.isCaseDone(caseId) ? ' done' : '')}>
                          <Cube setup={getSlotCase(slotCaseIdFor(caseId, 'FR')).setup} size={110} />
                          {load === 'ready' && <SlotStatusGrid caseId={caseId} label={`F2L ${getCase(caseId).number}`} />}
                        </div>
                      ))}
                    </div>
                    <div className="cluster-label">
                      <strong>{clusterTitle(cluster)}</strong>
                      {cluster.caseIds.length === 1 && <span className="tag">self-mirror</span>}
                    </div>
                    {cluster.caseIds.length === 2 && (
                      <div className="cluster-sub">
                        {cluster.caseIds.map((id) => `F2L ${getCase(id).number}`).join(' ↔ ')}
                      </div>
                    )}
                    {load === 'ready' && (
                      <div
                        className="cluster-progress"
                        title={`${t.learnt} learnt, ${t.learning} learning, ${t.main} more with a main alg, of ${t.total} slot-cases`}
                      >
                        <ProgressBar {...t} />
                        {upgrades > 0 && (
                          <span className="better-count" title={`${upgrades} slot${upgrades > 1 ? 's' : ''} where a more popular alg than your main exists`}>
                            ↑{upgrades}
                          </span>
                        )}
                        <span className={t.learnt === t.total ? 'complete' : undefined}>
                          {Math.round((t.learnt / t.total) * 100)}%
                        </span>
                      </div>
                    )}
                  </>
                )
                // Focus mode: a fully learnt cluster is greyed out (still clickable).
                const done = focus.isClusterDone(cluster)
                return (
                  <a
                    key={cluster.id}
                    href={f2lHref({ clusterId: cluster.id })}
                    className={'cluster-card' + (done ? ' done' : '')}
                    title={done ? 'All learnt' : undefined}
                    data-reveal
                  >
                    {content}
                  </a>
                )
              })}
            </div>
          </section>
        )
      })}
    </main>
  )
}
