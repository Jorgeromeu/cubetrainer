import { OnOff, Setting, SettingsSection } from '../../common/ui/settings.tsx'
import { updateF2lSettings, useF2lSettings } from './settings.ts'

/** F2L's section in the settings menu. */
export function F2lSettings() {
  const { focusMissing } = useF2lSettings()
  return (
    <>
      <SettingsSection title="F2L" />
      <Setting label="Focus on what's missing" hint="Grey out learnt cases">
        <OnOff value={focusMissing} onChange={(on) => updateF2lSettings({ focusMissing: on })} />
      </Setting>
    </>
  )
}
