// The shell: top bar (brand + trainer menu, stealth toggle, the trainer's crumb, its settings)
// around the current trainer, picked from the hash (route.ts).
import { useEffect, useState } from 'react'
import { MoveHintLayer } from '../common/notation/MoveHint.tsx'
import { BRAND, STEALTH_BRAND, useStealth } from '../common/stealth.ts'
import { parseHash } from './route.ts'
import { SettingsMenu } from './SettingsMenu.tsx'
import { StealthToggle } from './StealthToggle.tsx'
import { TrainerSwitch } from './TrainerSwitch.tsx'

export default function App() {
  const [{ trainer, path }, setRoute] = useState(parseHash)

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash())
    addEventListener('hashchange', onHashChange)
    return () => removeEventListener('hashchange', onHashChange)
  }, [])

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
          <TrainerSwitch current={trainer} />
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
