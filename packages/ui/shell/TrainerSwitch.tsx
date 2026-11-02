// The brand in the top bar, with the current trainer's name. Hovering (or focusing) the
// name opens a menu to switch to another trainer. In stealth the brand goes neutral.
import { BRAND, STEALTH_BRAND, useStealth } from '../stealth.ts'
import { trainerHref, type Trainer } from '../tool.ts'

export function TrainerSwitch({ trainers, current }: { trainers: readonly Trainer[]; current: Trainer }) {
  const stealth = useStealth()
  return (
    <div className="brand">
      <a href={trainerHref(current.id)}>{stealth ? STEALTH_BRAND : BRAND}</a>
      <div className="trainer-switch">
        <button className="trainer-current" aria-haspopup="menu">
          {current.name}
          <svg viewBox="0 0 10 6" width="9" height="6" aria-hidden>
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
        <div className="trainer-menu" role="menu">
          {trainers.map((t) => (
            <a
              key={t.id}
              href={trainerHref(t.id)}
              role="menuitem"
              className={t === current ? 'current' : undefined}
              onClick={(e) => e.currentTarget.blur()}
            >
              <strong>{t.name}</strong>
              <span>{t.description}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
