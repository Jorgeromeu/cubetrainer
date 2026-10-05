import type { Slot } from './catalog.ts'

/** Top-left corner of the filled square, in a top view with the back at the top. */
const CORNER: Record<Slot, [number, number]> = { BL: [1, 1], BR: [9, 1], FL: [1, 9], FR: [9, 9] }

/** The U face from above (back at the top) as an outlined square, with the slot's corner filled. */
export function SlotIcon({ slot, size = 16 }: { slot: Slot; size?: number }) {
  const [x, y] = CORNER[slot]
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <rect x={x} y={y} width="6" height="6" rx="1.5" fill="currentColor" />
    </svg>
  )
}

/**
 * The slot icon's square, drawn bigger at the centre of a family grid: the U face from
 * above, with the selected slot's corner filled (none if the selection is in another grid).
 */
export function SlotGridKey({ selected }: { selected?: Slot }) {
  const corner = selected && CORNER[selected]
  return (
    <svg className="slot-grid-key" viewBox="0 0 16 16" width={26} height={26} aria-hidden>
      <rect x="1" y="1" width="14" height="14" rx="2.5" className="key-plate" />
      {corner && <rect x={corner[0]} y={corner[1]} width="6" height="6" rx="1.5" className="key-corner" />}
    </svg>
  )
}
