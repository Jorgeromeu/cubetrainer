// "Focus on what's missing" (an F2L setting): learnt slot-cases are greyed out (still
// clickable), so the F2L pages point at what's left. Learning counts as missing. It only
// takes effect once progress has loaded: without it nothing is known to be learnt.
import { SLOTS, slotCaseIdFor, type Cluster } from './catalog.ts'
import { statusOf, useProgress } from './progress.ts'
import { useF2lSettings } from './settings.ts'

export function useF2lFocus() {
  const { focusMissing } = useF2lSettings()
  const { load, bySlotCase } = useProgress()
  const active = focusMissing && load === 'ready'

  /** True when focus is on and the slot-case is learnt (so it's greyed out). */
  const isDone = (slotCaseId: string) => active && statusOf(bySlotCase.get(slotCaseId)) === 'learnt'
  /** True when focus is on and every slot of the case is learnt. */
  const isCaseDone = (caseId: string) => active && SLOTS.every((slot) => isDone(slotCaseIdFor(caseId, slot)))
  /** True when focus is on and every slot-case of the cluster is learnt. */
  const isClusterDone = (cluster: Cluster) => active && cluster.caseIds.every(isCaseDone)

  return { active, isDone, isCaseDone, isClusterDone }
}
