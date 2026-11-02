// F2L's routes, under #/f2l/ (packages/ui/tool.ts):
//   (empty)                              overview
//   train                                train the overview's selection (Train.tsx)
//   <clusterId>[/<slotCaseId>[/<algId>]] cluster detail
import { toolHref } from '../../../packages/ui/tool.ts'

export interface F2lRoute {
  clusterId?: string
  slotCaseId?: string
  algId?: string
}

export const F2L_ID = 'f2l'

/** The train page's path; never a cluster id (those start with "f2l-"). */
const TRAIN_PATH = 'train'

export const isTrainPath = (path: string[]) => path[0] === TRAIN_PATH

export const trainHref = () => toolHref(F2L_ID, TRAIN_PATH)

export const parseF2lPath = ([clusterId, slotCaseId, algId]: string[]): F2lRoute => ({ clusterId, slotCaseId, algId })

export const f2lHref = ({ clusterId, slotCaseId, algId }: F2lRoute) => toolHref(F2L_ID, clusterId, slotCaseId, algId)
