// The brand in the top bar, with the current tool's name. Hovering (or focusing) the
// name opens a menu to switch to another tool. In stealth the brand goes neutral.
import { BRAND, STEALTH_BRAND, useStealth } from '../stealth.ts'
import { toolHref, type Tool } from '../tool.ts'

export function ToolSwitch({ tools, current }: { tools: readonly Tool[]; current: Tool }) {
  const stealth = useStealth()
  return (
    <div className="brand">
      <a href={toolHref(current.id)}>{stealth ? STEALTH_BRAND : BRAND}</a>
      <div className="tool-switch">
        <button className="tool-current" aria-haspopup="menu">
          {current.name}
          <svg viewBox="0 0 10 6" width="9" height="6" aria-hidden>
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
        <div className="tool-menu" role="menu">
          {tools.map((t) => (
            <a
              key={t.id}
              href={toolHref(t.id)}
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
