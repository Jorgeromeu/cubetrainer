// The one visual language for "which link kinds": an icon that shows a set of them, and
// the picker that edits one. Used by the family map's "Count as linked", by notes and in
// Settings → F2L.
import type { ReactNode } from 'react'
import { LINK_HINT, LINK_KINDS, LINK_LABEL, type LinkKind } from './catalog.ts'

/**
 * Each kind's mark on a top view of the cube (back at the top, like the slot icons): the
 * mirrors are their mirror lines (left-right: vertical, front-back: horizontal), the
 * transpose is the diagonal through FR (swapping R and F reflects across it), and the
 * rotation is the outline itself, opened into a turning arrow.
 */
const MARKS: Record<LinkKind, ReactNode> = {
  mirrorLR: <path d="M10 5.6v8.8" />,
  mirrorFB: <path d="M5.6 10h8.8" />,
  transpose: <path d="M6.4 6.4l7.2 7.2" />,
  rotation: (
    <>
      <path d="M17.5 7.6V14a3.5 3.5 0 0 1-3.5 3.5H6A3.5 3.5 0 0 1 2.5 14V6A3.5 3.5 0 0 1 6 2.5h6.3" />
      <path d="M10.6 1l1.9 1.5-1.9 1.5" />
    </>
  ),
}

/**
 * A set of link kinds at a glance: every kind's mark, the ones in `kinds` lit. With
 * `only`, just that kind's mark (lit if it's in `kinds`) in a plain outline.
 */
export function LinkSetIcon({ kinds, only, size = 18 }: { kinds: readonly LinkKind[]; only?: LinkKind; size?: number }) {
  return (
    <svg className="link-set-icon" viewBox="0 0 20 20" width={size} height={size} aria-hidden>
      {only && only !== 'rotation' && <rect className="frame" x="2.5" y="2.5" width="15" height="15" rx="3.5" />}
      {(only ? [only] : LINK_KINDS).map((kind) => (
        // The rotation mark is the outline too: off, it still frames the icon.
        <g key={kind} className={(kinds.includes(kind) ? 'on' : 'off') + (kind === 'rotation' ? ' outline' : '')}>
          {MARKS[kind]}
        </g>
      ))}
    </svg>
  )
}

/** Toggles for a set of link kinds, in LINK_KINDS order: each row its mark, name and hint. */
export function LinkKindsPicker({ value, onChange }: { value: readonly LinkKind[]; onChange: (kinds: LinkKind[]) => void }) {
  return (
    <div className="link-kinds">
      {LINK_KINDS.map((kind) => (
        <label key={kind}>
          <input
            type="checkbox"
            checked={value.includes(kind)}
            onChange={(e) => onChange(LINK_KINDS.filter((k) => (k === kind ? e.target.checked : value.includes(k))))}
          />
          <LinkSetIcon kinds={value} only={kind} size={22} />
          <span>
            {LINK_LABEL[kind]}
            <small>{LINK_HINT[kind]}</small>
          </span>
        </label>
      ))}
    </div>
  )
}
