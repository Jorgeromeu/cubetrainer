import { OnOff, Segmented, Setting, SettingsSection } from '../../../../packages/ui/settings.tsx'
import { COUNTDOWNS, updatePllSettings, usePllSettings } from './settings.ts'

/** PLL's section in the settings menu. */
export function PllSettings() {
  const { start, countdown, sound } = usePllSettings()
  const hold = start === 'hold'
  return (
    <>
      <SettingsSection title="PLL" />
      <Setting label="Start" hint="Countdown: scramble under the table, lift at 0 (no inspection). Hold: hold Space, release to start">
        <Segmented
          options={[
            { value: 'countdown' as const, label: 'Countdown' },
            { value: 'hold' as const, label: 'Hold' },
          ]}
          value={start}
          onChange={(s) => updatePllSettings({ start: s })}
        />
      </Setting>
      <Setting label="Countdown" disabled={hold} hint="Seconds from Space to the timer starting: lift the cube at 0">
        <Segmented
          options={COUNTDOWNS.map((s) => ({ value: s, label: `${s}s` }))}
          value={countdown}
          onChange={(s) => updatePllSettings({ countdown: s })}
        />
      </Setting>
      <Setting label="Countdown sound" disabled={hold} hint="Ticks, and a beep at 0. Always off in stealth mode">
        <OnOff value={sound} onChange={(on) => updatePllSettings({ sound: on })} />
      </Setting>
    </>
  )
}
