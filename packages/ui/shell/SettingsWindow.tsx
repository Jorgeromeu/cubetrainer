// The settings window (Ctrl+, or the gear): every settings section in one place, as a window
// over the page, like a desktop app's preferences. The left pane lists "App-wide" (the shared
// library sections, the same in every tool: cube display) and "Tools" (each tool's own
// section); the right shows the one picked. Escape, ×, a click outside or Ctrl+, again close
// it. See openspec/specs/foundation/settings.
import { useEffect, useRef, type ComponentType } from 'react'
import { Pane, PaneButton, PaneGroup, PaneRow } from '../panes.tsx'
import type { Tool } from '../tool.ts'

export interface SettingsSectionEntry {
  id: string
  title: string
  View: ComponentType
  /** A shared library section: the tools listing it. A tool's own: undefined. */
  sharedBy?: string[]
  /** A tool's own section: the shared sections it uses (by id). */
  uses?: string[]
}

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Every section, shared ones first (in the order tools list them), then each tool's own. */
export function settingsSections(tools: readonly Tool[]): SettingsSectionEntry[] {
  const shared = new Map<string, SettingsSectionEntry>()
  for (const t of tools)
    for (const s of t.sharedSettings ?? []) {
      const id = slug(s.title)
      const section = shared.get(id) ?? { id, title: s.title, View: s.View, sharedBy: [] }
      section.sharedBy!.push(t.name)
      shared.set(id, section)
    }
  const own = tools.flatMap((t) =>
    t.Settings ? [{ id: t.id, title: t.name, View: t.Settings, uses: (t.sharedSettings ?? []).map((s) => slug(s.title)) }] : [],
  )
  return [...shared.values(), ...own]
}

/** The section the window opens at from a tool: its own, else the first shared one it uses. */
export function sectionFor(tool: Tool) {
  return tool.Settings ? tool.id : tool.sharedSettings?.[0] ? slug(tool.sharedSettings[0].title) : undefined
}

export function SettingsWindow({
  sections,
  section,
  onSection,
  onClose,
}: {
  sections: SettingsSectionEntry[]
  section?: string
  onSection: (id: string) => void
  onClose: () => void
}) {
  const current = sections.find((s) => s.id === section) ?? sections[0]
  const titleOf = (id: string) => sections.find((s) => s.id === id)?.title ?? id
  const groups: [string, SettingsSectionEntry[]][] = [
    ['App-wide', sections.filter((s) => s.sharedBy)],
    ['Tools', sections.filter((s) => !s.sharedBy)],
  ]
  const windowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    windowRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onClose()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="window-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="window settings-window" role="dialog" aria-modal="true" aria-label="Settings" tabIndex={-1} ref={windowRef}>
        <Pane title="Settings" width={200}>
          {groups.map(
            ([group, list]) =>
              list.length > 0 && (
                <PaneGroup key={group} title={group}>
                  {list.map((s) => (
                    <PaneRow key={s.id} onClick={() => onSection(s.id)} current={s === current}>
                      {s.title}
                    </PaneRow>
                  ))}
                </PaneGroup>
              ),
          )}
        </Pane>
        <Pane
          title={current?.title ?? 'Nothing to set yet'}
          note={
            current?.sharedBy ? (
              `App-wide · ${current.sharedBy.join(', ')}`
            ) : current?.uses?.length ? (
              <>
                Also applies:{' '}
                {current.uses.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ', '}
                    <button className="link-button" onClick={() => onSection(id)}>
                      {titleOf(id)}
                    </button>
                  </span>
                ))}
              </>
            ) : undefined
          }
          actions={
            <PaneButton label="Close (Esc)" onClick={onClose}>
              ×
            </PaneButton>
          }
        >
          {current && (
            <div className="settings-body">
              <current.View />
            </div>
          )}
        </Pane>
      </div>
    </div>
  )
}
