// The shell: top bar (brand + tool menu, stealth toggle, the tool's crumb, its settings)
// around the current tool, picked from the hash (route.ts). The host passes the tools,
// in menu order; the first is the default.
import { useEffect, useState } from 'react'
import { MoveHintLayer } from '../notation/MoveHint.tsx'
import { BRAND, STEALTH_BRAND, useStealth } from '../stealth.ts'
import { parseHash } from './route.ts'
import { SettingsMenu } from './SettingsMenu.tsx'
import { StealthToggle } from './StealthToggle.tsx'
import { ToolSwitch } from './ToolSwitch.tsx'
import type { Tool } from '../tool.ts'

export function App({ tools }: { tools: readonly Tool[] }) {
  const [{ tool, path }, setRoute] = useState(() => parseHash(tools))

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(tools))
    addEventListener('hashchange', onHashChange)
    return () => removeEventListener('hashchange', onHashChange)
  }, [tools])

  useEffect(() => {
    scrollTo(0, 0)
  }, [tool])

  // The tab's title: brand and tool, the brand neutral in stealth.
  const stealth = useStealth()
  useEffect(() => {
    document.title = `${stealth ? STEALTH_BRAND : BRAND} · ${tool.name}`
  }, [tool, stealth])

  const { View, Crumb, Settings } = tool
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <ToolSwitch tools={tools} current={tool} />
          <StealthToggle />
          {Crumb && <Crumb path={path} />}
          {Settings && <SettingsMenu key={tool.id} ToolSettings={Settings} />}
        </div>
      </header>
      <div className="app">
        <View path={path} />
      </div>
      <MoveHintLayer />
    </>
  )
}
