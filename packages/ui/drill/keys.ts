// Keys drills share: Enter / → / n for the next item, ← / p for the previous one, unless
// the key goes to a control (a focused button, a link, a text field).

export const NEXT_KEYS = ['Enter', 'ArrowRight', 'n']
export const PREV_KEYS = ['ArrowLeft', 'p']

export const isControl = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest('button, a, input, textarea, select, [contenteditable]')

export const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable]')
