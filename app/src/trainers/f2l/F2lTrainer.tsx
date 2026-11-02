import { useEffect } from 'react'
import type { TrainerProps } from '../../../../packages/ui/tool.ts'
import { clustersById } from './catalog.ts'
import { ClusterCrumb, ClusterView } from './ClusterView.tsx'
import { Overview } from './Overview.tsx'
import { useProgress } from './progress.ts'
import { isTrainPath, parseF2lPath } from './route.ts'
import { Train, TrainCrumb } from './Train.tsx'
import { ServerNotice } from '../../../../packages/ui/ServerNotice.tsx'

const clusterAt = (path: string[]) => {
  const { clusterId } = parseF2lPath(path)
  return clusterId ? clustersById.get(clusterId) : undefined
}

/** Where the overview was last scrolled to, restored on coming back to it. */
let overviewScrollY = 0

/** The overview, a cluster or training (see route.ts). */
export function F2lTrainer({ path }: TrainerProps) {
  const { slotCaseId, algId } = parseF2lPath(path)
  const cluster = clusterAt(path)
  const training = isTrainPath(path)
  const progress = useProgress()

  // The overview comes back where it was left; training starts at the top.
  const overview = !cluster && !training
  useEffect(() => {
    if (training) scrollTo(0, 0)
    if (!overview) return
    scrollTo(0, overviewScrollY)
    const onScroll = () => (overviewScrollY = scrollY)
    addEventListener('scroll', onScroll)
    return () => removeEventListener('scroll', onScroll)
  }, [overview, training])

  return (
    <>
      {cluster ? (
        <ClusterView cluster={cluster} slotCaseId={slotCaseId} algId={algId} />
      ) : training ? (
        <Train />
      ) : (
        <Overview />
      )}
      <ServerNotice load={progress.load} error={progress.error} offline="No server · progress not loaded" />
    </>
  )
}

export function F2lCrumb({ path }: TrainerProps) {
  const cluster = clusterAt(path)
  return cluster ? <ClusterCrumb cluster={cluster} /> : isTrainPath(path) ? <TrainCrumb /> : null
}
