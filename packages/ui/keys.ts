// Which keys a page may take: none while the user types in a field, and not Enter / Space
// while a control has focus (it's that control's). Every tool's keyboard handling uses these.

/** Focus is in a text field, where keys are text. A slider isn't one: its keys stay the page's. */
export const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest('input:not([type=range]), textarea, select, [contenteditable]')

/** Focus is on a control (a button, a link, a field) that takes Enter or Space itself. */
export const isControl = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest('button, a, input, textarea, select, [contenteditable]')
