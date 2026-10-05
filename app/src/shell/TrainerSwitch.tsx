// The brand in the top bar, with the current trainer's name. Hovering (or focusing) the
// name opens a menu to switch to another trainer.
import { trainerHref, type Trainer } from '../common/trainer.ts'
import { TRAINERS } from './trainers.ts'

export function TrainerSwitch({ current }: { current: Trainer }) {
  return (
    <div className="brand">
      <a href={trainerHref(current.id)}>Cubetrainer</a>
      <div className="trainer-switch">
        <button className="trainer-current" aria-haspopup="menu">
          {current.name}
          <svg viewBox="0 0 10 6" width="9" height="6" aria-hidden>
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
        <div className="trainer-menu" role="menu">
          {TRAINERS.map((t) => (
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
