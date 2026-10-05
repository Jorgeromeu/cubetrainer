// The PLL catalog (catalog/pll.json, built by catalog-builder/src/build-pll.ts).
import catalogJson from '../../../../catalog/pll.json'
import type { PllCase, PllCatalog } from '../../../../shared/pll/catalog.ts'

export type { PllCase } from '../../../../shared/pll/catalog.ts'

export const pllCases = (catalogJson as unknown as PllCatalog).cases

export const pllCasesById = new Map(pllCases.map((c) => [c.id, c]))

export const pllGroups: { group: string; cases: PllCase[] }[] = (() => {
  const groups = new Map<string, PllCase[]>()
  for (const c of pllCases) groups.set(c.group, [...(groups.get(c.group) ?? []), c])
  return [...groups].map(([group, cases]) => ({ group, cases }))
})()
