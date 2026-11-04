// Where the server runs (packages/core/devInfo.ts), fetched once and again on window focus,
// for the branch badge and the tab title. Undefined without a server: then no badge.
import { useSyncExternalStore } from 'react'
import { request } from '../../core/api.ts'
import { DEV_INFO_PATH, type DevInfo } from '../../core/devInfo.ts'

let info: DevInfo | undefined
const listeners = new Set<() => void>()

async function load() {
  try {
    info = await request<DevInfo>(DEV_INFO_PATH)
  } catch {
    info = undefined
  }
  listeners.forEach((l) => l())
}

load()
addEventListener('focus', load)

export const useDevInfo = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => info,
  )

/** A stable colour per branch name. */
export function branchColour(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 65% 45%)`
}
