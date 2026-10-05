// The shell: top bar (brand + trainer menu, stealth toggle, the trainer's crumb, settings)
// around the current trainer, picked from the hash (route.ts).
import { useEffect, useState } from 'react'
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

  const { View, Crumb, Settings } = trainer
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <TrainerSwitch current={trainer} />
          <StealthToggle />
          {Crumb && <Crumb path={path} />}
          <SettingsMenu TrainerSettings={Settings} />
        </div>
      </header>
      <div className="app">
        <View path={path} />
      </div>
    </>
  )
}
