import type { HintMode } from '../../../packages/ui/cube/Cube.tsx'
import { OnOff, Segmented, Setting, SettingsSection } from '../../../packages/ui/settings/blocks.tsx'
import { DistinctAlgs } from './DistinctAlgs.tsx'
import { LinkKindsPicker } from './LinkKindsPicker.tsx'
import { DEFAULT_CUBE_DISPLAY, HINT_DISTANCE, updateF2lSettings, useF2lSettings } from './settings.ts'

const HINT_OPTIONS: { value: HintMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'pair', label: 'Pair' },
  { value: 'all', label: 'All F2L' },
]

/** F2L's own section of the settings window (the shell adds its heading). */
export function F2lSettings() {
  const { focusMissing, linkKinds, highlightPair, hints, hintDistance } = useF2lSettings()
  return (
    <>
      <Setting label="Focus on what's missing" hint="Grey out learnt cases">
        <OnOff value={focusMissing} onChange={(on) => updateF2lSettings({ focusMissing: on })} />
      </Setting>
      <Setting label="Count as linked" hint="Which links make two algs the same: tints in a cluster's map, and ideas below">
        <LinkKindsPicker value={linkKinds} onChange={(kinds) => updateF2lSettings({ linkKinds: kinds })} />
      </Setting>
      <Setting label="What there is to learn" hint="Your algs counted as algs, shapes and ideas">
        <DistinctAlgs linkKinds={linkKinds} />
      </Setting>
      <SettingsSection title="Cubes" />
      <Setting label="Highlight pair" hint="Only the slot's corner and edge in colour">
        <OnOff value={highlightPair} onChange={(on) => updateF2lSettings({ highlightPair: on })} />
      </Setting>
      <Setting label="Hint stickers" hint="Floating copies of hidden faces (big cube)">
        <Segmented options={HINT_OPTIONS} value={hints} onChange={(hints) => updateF2lSettings({ hints })} />
      </Setting>
      <Setting label="Hint distance" disabled={hints === 'off'}>
        <div className="range-row">
          <span>Close</span>
          <input
            type="range"
            min={HINT_DISTANCE.min}
            max={HINT_DISTANCE.max}
            step={HINT_DISTANCE.step}
            value={hintDistance}
            disabled={hints === 'off'}
            onChange={(e) => updateF2lSettings({ hintDistance: Number(e.target.value) })}
          />
          <span>Far</span>
        </div>
      </Setting>
      <button className="link-button" onClick={() => updateF2lSettings(DEFAULT_CUBE_DISPLAY)}>
        Reset cubes
      </button>
    </>
  )
}
