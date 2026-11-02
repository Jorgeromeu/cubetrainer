// Closing something open (a popover, a mode) by clicking outside it or pressing Escape.
import { useEffect, useEffectEvent, type RefObject } from 'react'

/**
 * While `open`, a pointer down outside `ref`'s element or Escape calls `onDismiss`.
 * Pointer downs on elements matching `ignore` (e.g. the toggle that opened it) don't.
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void, ignore?: string) {
  const dismiss = useEffectEvent(onDismiss)
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element
      if (ref.current?.contains(target) || (ignore && target.closest?.(ignore))) return
      dismiss()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      dismiss()
    }
    addEventListener('pointerdown', onPointer)
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('pointerdown', onPointer)
      removeEventListener('keydown', onKey)
    }
  }, [open, ref, ignore])
}
