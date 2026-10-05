import { useEffect } from 'react'
import type { TrainerProps } from '../../common/trainer.ts'
import { clustersById } from './catalog.ts'
import { ClusterCrumb, ClusterView } from './ClusterView.tsx'
import { Overview } from './Overview.tsx'
import { parseF2lPath } from './route.ts'
import { ServerNotice } from './ServerNotice.tsx'

const clusterAt = (path: string[]) => {
  const { clusterId } = parseF2lPath(path)
  return clusterId ? clustersById.get(clusterId) : undefined
}

/** The overview, or a cluster (see route.ts). */
export function F2lTrainer({ path }: TrainerProps) {
  const { slotCaseId, algId } = parseF2lPath(path)
  const cluster = clusterAt(path)

  useEffect(() => {
    if (!cluster) scrollTo(0, 0)
  }, [cluster])

  return (
    <>
      {cluster ? <ClusterView cluster={cluster} slotCaseId={slotCaseId} algId={algId} /> : <Overview />}
      <ServerNotice />
    </>
  )
}

export function F2lCrumb({ path }: TrainerProps) {
  const cluster = clusterAt(path)
  return cluster ? <ClusterCrumb cluster={cluster} /> : null
}
