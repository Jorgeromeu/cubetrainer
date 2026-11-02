// The shell: top bar (brand + trainer menu, stealth toggle, the trainer's crumb, its settings)
// around the current trainer, picked from the hash (route.ts). The host passes the trainers,
// in menu order; the first is the default.
import { useEffect, useState } from 'react'
import { MoveHintLayer } from '../notation/MoveHint.tsx'
import { BRAND, STEALTH_BRAND, useStealth } from '../stealth.ts'
import { parseHash } from './route.ts'
import { SettingsMenu } from './SettingsMenu.tsx'
import { StealthToggle } from './StealthToggle.tsx'
import { TrainerSwitch } from './TrainerSwitch.tsx'
import type { Trainer } from '../tool.ts'

export function App({ trainers }: { trainers: readonly Trainer[] }) {
  const [{ trainer, path }, setRoute] = useState(() => parseHash(trainers))

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(trainers))
    addEventListener('hashchange', onHashChange)
    return () => removeEventListener('hashchange', onHashChange)
  }, [trainers])

  useEffect(() => {
    scrollTo(0, 0)
  }, [trainer])

  // The tab's title: brand and trainer, the brand neutral in stealth.
  const stealth = useStealth()
  useEffect(() => {
    document.title = `${stealth ? STEALTH_BRAND : BRAND} · ${trainer.name}`
  }, [trainer, stealth])

  const { View, Crumb, Settings } = trainer
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <TrainerSwitch trainers={trainers} current={trainer} />
          <StealthToggle />
          {Crumb && <Crumb path={path} />}
          {Settings && <SettingsMenu key={trainer.id} TrainerSettings={Settings} />}
        </div>
      </header>
      <div className="app">
        <View path={path} />
      </div>
      <MoveHintLayer />
    </>
  )
}
