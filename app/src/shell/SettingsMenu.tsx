import { useEffect, useRef, useState, type ComponentType } from 'react'
import {
  DEFAULT_CUBE_SETTINGS,
  HINT_DISTANCE,
  updateCubeSettings,
  useCubeSettings,
  type HintMode,
} from '../common/cube/settings.ts'
import { OnOff, Segmented, Setting, SettingsSection } from '../common/ui/settings.tsx'

const HINT_OPTIONS: { value: HintMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'pair', label: 'Pair' },
  { value: 'all', label: 'All F2L' },
]

/**
 * Gear button at the right of the top bar opening the settings popover: the current
 * trainer's section, then cube display. Changes apply live.
 */
export function SettingsMenu({ TrainerSettings }: { TrainerSettings?: ComponentType }) {
  const settings = useCubeSettings()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    addEventListener('pointerdown', onPointer)
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('pointerdown', onPointer)
      removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="settings" ref={rootRef}>
      <button
        className="settings-button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
          <path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)" />
        </svg>
      </button>

      {open && (
        <div className="settings-panel" role="dialog" aria-label="Settings">
          <div className="settings-title">Settings</div>
          {TrainerSettings && <TrainerSettings />}

          <SettingsSection title="Cube display" />
          <Setting label="Highlight pair" hint="Only the slot's corner and edge in colour">
            <OnOff value={settings.highlightPair} onChange={(on) => updateCubeSettings({ highlightPair: on })} />
          </Setting>

          <Setting label="Hint stickers" hint="Floating copies of hidden faces (big cube)">
            <Segmented options={HINT_OPTIONS} value={settings.hints} onChange={(hints) => updateCubeSettings({ hints })} />
          </Setting>

          <Setting label="Hint distance" disabled={settings.hints === 'off'}>
            <div className="range-row">
              <span>Close</span>
              <input
                type="range"
                min={HINT_DISTANCE.min}
                max={HINT_DISTANCE.max}
                step={HINT_DISTANCE.step}
                value={settings.hintDistance}
                disabled={settings.hints === 'off'}
                onChange={(e) => updateCubeSettings({ hintDistance: Number(e.target.value) })}
              />
              <span>Far</span>
            </div>
          </Setting>

          <button className="link-button" onClick={() => updateCubeSettings(DEFAULT_CUBE_SETTINGS)}>
            Reset cube display
          </button>
        </div>
      )}
    </div>
  )
}
