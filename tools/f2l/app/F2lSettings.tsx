import { CubeDisplaySettings } from '../../../packages/ui/cube/CubeDisplaySettings.tsx'
import { OnOff, Setting, SettingsSection } from '../../../packages/ui/settings.tsx'
import { DistinctAlgs } from './DistinctAlgs.tsx'
import { LinkKindsPicker } from './LinkKindsPicker.tsx'
import { updateF2lSettings, useF2lSettings } from './settings.ts'

/** F2L's settings menu: its own section, then cube display. */
export function F2lSettings() {
  const { focusMissing, linkKinds } = useF2lSettings()
  return (
    <>
      <SettingsSection title="F2L" />
      <Setting label="Focus on what's missing" hint="Grey out learnt cases">
        <OnOff value={focusMissing} onChange={(on) => updateF2lSettings({ focusMissing: on })} />
      </Setting>
      <Setting label="Count as linked" hint="Which links make two algs the same: tints in a cluster's map, and ideas below">
        <LinkKindsPicker value={linkKinds} onChange={(kinds) => updateF2lSettings({ linkKinds: kinds })} />
      </Setting>
      <Setting label="What there is to learn" hint="Your algs counted as algs, shapes and ideas">
        <DistinctAlgs linkKinds={linkKinds} />
      </Setting>
      <CubeDisplaySettings />
    </>
  )
}
