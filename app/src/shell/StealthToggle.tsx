import { useEffect } from 'react'
import { STEALTH_HOTKEY, isStealth, setStealth, useStealth } from '../common/stealth.ts'

/**
 * Button next to the brand that switches stealth mode, plus its page-wide hotkey. Shows a
 * cube normally; in stealth a plain half-filled circle that could pass for a theme switch.
 */
export function StealthToggle() {
  const stealth = useStealth()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== STEALTH_HOTKEY || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input:not([type=range]), textarea, select, [contenteditable]'))
        return
      e.preventDefault()
      setStealth(!isStealth())
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  // In stealth the tooltip gives nothing away either.
  const label = `${stealth ? 'Theme' : 'Stealth mode'} (${STEALTH_HOTKEY})`
  return (
    <button
      className="stealth-toggle"
      onClick={() => setStealth(!stealth)}
      aria-pressed={stealth}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        {stealth ? (
          <>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4a8 8 0 0 1 0 16z" className="fill" />
          </>
        ) : (
          <g className="cube-icon">
            <path d="M12 3 20 7.5 12 12 4 7.5z" className="top" />
            <path d="M4 7.5 12 12v9l-8-4.5z" className="front" />
            <path d="M20 7.5v9L12 21v-9z" className="right" />
          </g>
        )}
      </svg>
    </button>
  )
}
