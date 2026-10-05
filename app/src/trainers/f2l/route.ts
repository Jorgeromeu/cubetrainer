// F2L's routes, under #/f2l/ (common/trainer.ts):
//   (empty)                              overview
//   <clusterId>[/<slotCaseId>[/<algId>]] cluster detail
import { trainerHref } from '../../common/trainer.ts'

export interface F2lRoute {
  clusterId?: string
  slotCaseId?: string
  algId?: string
}

export const F2L_ID = 'f2l'

export const parseF2lPath = ([clusterId, slotCaseId, algId]: string[]): F2lRoute => ({ clusterId, slotCaseId, algId })

export const f2lHref = ({ clusterId, slotCaseId, algId }: F2lRoute) => trainerHref(F2L_ID, clusterId, slotCaseId, algId)
