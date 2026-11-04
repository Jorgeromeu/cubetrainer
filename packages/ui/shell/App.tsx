// The shell: top bar (brand + tool menu, branch badge, the tool's crumb, the settings gear)
// around the current tool, picked from the hash (route.ts), and the settings window over it
// (Ctrl+, or the gear). The host passes the tools, in menu order; the first is the default.
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { isPlainMain } from '../../core/devInfo.ts'
import { MoveHintLayer } from '../notation/MoveHint.tsx'
import { BRAND, type Tool } from '../tool.ts'
import { DevBadge } from './DevBadge.tsx'
import { useDevInfo } from './devInfo.ts'
import { parseHash } from './route.ts'
import { sectionFor, settingsSections, SettingsWindow } from './SettingsWindow.tsx'
import { ToolSwitch } from './ToolSwitch.tsx'

export function App({ tools }: { tools: readonly Tool[] }) {
  const [{ tool, path }, setRoute] = useState(() => parseHash(tools))
  const sections = useMemo(() => settingsSections(tools), [tools])
  /** The settings window's section while it's open; null while closed. */
  const [settings, setSettings] = useState<string | undefined | null>(null)
  const closeSettings = useCallback(() => setSettings(null), [])

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(tools))
    addEventListener('hashchange', onHashChange)
    return () => removeEventListener('hashchange', onHashChange)
  }, [tools])

  useEffect(() => {
    scrollTo(0, 0)
  }, [tool])

  // Ctrl+, (⌘, on a Mac) opens the settings at this tool's section, or closes them.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== ',' || !(e.ctrlKey || e.metaKey) || e.altKey || !sections.length) return
    e.preventDefault()
    setSettings((open) => (open === null ? sectionFor(tool) : null))
  })
  useEffect(() => {
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  // The tab title, prefixed with the branch whenever the badge shows.
  const dev = useDevInfo()
  const branch = dev && !isPlainMain(dev) ? `${dev.branch} · ` : ''
  useEffect(() => {
    document.title = `${branch}${BRAND} · ${tool.name}`
  }, [tool, branch])

  const { View, Crumb } = tool
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <ToolSwitch tools={tools} current={tool} />
          <DevBadge />
          {Crumb && <Crumb path={path} />}
          {sections.length > 0 && (
            <button className="settings-button" onClick={() => setSettings(sectionFor(tool))} title="Settings (Ctrl+,)" aria-label="Settings">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                <path
                  d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
                  transform="translate(-1 0)"
                />
              </svg>
            </button>
          )}
        </div>
      </header>
      <div className="app">
        <View path={path} />
      </div>
      {settings !== null && <SettingsWindow sections={sections} section={settings} onSection={setSettings} onClose={closeSettings} />}
      <MoveHintLayer />
    </>
  )
}
