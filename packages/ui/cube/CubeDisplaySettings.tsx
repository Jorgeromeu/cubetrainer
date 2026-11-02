// The Cube display section of the settings menu, for trainers that show 3D cubes (Cube.tsx).
// A trainer that does includes it in its own Settings; the values are shared by all of them.
import { OnOff, Segmented, Setting, SettingsSection } from '../settings.tsx'
import { DEFAULT_CUBE_SETTINGS, HINT_DISTANCE, updateCubeSettings, useCubeSettings, type HintMode } from './settings.ts'

const HINT_OPTIONS: { value: HintMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'pair', label: 'Pair' },
  { value: 'all', label: 'All F2L' },
]

export function CubeDisplaySettings() {
  const settings = useCubeSettings()
  return (
    <>
      <SettingsSection title="Cube display · all trainers" />
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
    </>
  )
}
