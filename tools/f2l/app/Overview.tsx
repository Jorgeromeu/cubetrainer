import { f2lHref } from './route.ts'
import {
  SLOTS,
  catalog,
  mainHasBetter,
  clustersByGroup,
  clusterTitle,
  getCase,
  getSlotCase,
  slotCaseIdFor,
  type Cluster,
} from './catalog.ts'
import { Cube } from '../../../packages/ui/cube/Cube.tsx'
import { useF2lFilter } from './filter.ts'
import { useF2lFocus } from './focus.ts'
import { ProgressBar, SlotStatusGrid } from './ProgressBits.tsx'
import { OverviewHead } from './OverviewHead.tsx'
import { tally, useProgress } from './progress.ts'

const allSlotCaseIds = (clusters: Cluster[]) =>
  clusters.flatMap((c) => c.caseIds.flatMap((caseId) => SLOTS.map((slot) => slotCaseIdFor(caseId, slot))))

export function Overview() {
  const { load, bySlotCase } = useProgress()
  const { active: filtering, matches, caseMatches } = useF2lFilter()
  /** The clusters' slot-cases that pass the filters. */
  const slotCaseIdsOf = (clusters: Cluster[]) => allSlotCaseIds(clusters).filter(matches)
  const overall = tally(bySlotCase, slotCaseIdsOf(catalog.clusters))
  const focus = useF2lFocus()
  return (
    <main className="overview">
      {load === 'ready' && <OverviewHead />}
      {filtering && !overall.total && <p className="lede">No slot-case matches the filter.</p>}
      {clustersByGroup.map(({ group, clusters: all }) => {
        // Filtering hides clusters with no matching slot-case; a case with none is faded.
        const clusters = all.filter((c) => c.caseIds.some(caseMatches))
        if (!clusters.length) return null
        const groupTally = tally(bySlotCase, slotCaseIdsOf(all))
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
                        <div
                          key={caseId}
                          className={
                            'cluster-case' +
                            (focus.isCaseDone(caseId) ? ' done' : '') +
                            (caseMatches(caseId) ? '' : ' filtered-out')
                          }
                        >
                          <Cube setup={getSlotCase(slotCaseIdFor(caseId, 'FR')).setup} size={110} />
                          {load === 'ready' && <SlotStatusGrid caseId={caseId} label={`F2L ${getCase(caseId).number}`} dimmed={(id) => !matches(id)} />}
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
                        title={`${t.learnt} learnt, ${t.learning} learning, ${t.wanted} want to learn, ${t.main} more with a main alg, of ${t.total} slot-cases`}
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
