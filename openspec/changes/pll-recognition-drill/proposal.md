# Proposal: PLL drill that trains recognition, not just execution

Status: draft, captured from the user's request. Write design, specs and tasks after
`restructure-workspaces` is done and the smart cube work is merged into the new layout: the
overlay and smart mode this builds on only exist in the `smartcube` worktree today.

## Why

The PLL tool is meant to practise recognition as well as execution. Today it shows which case
is coming while you scramble, so by the time the cube is scrambled the recognition is already done.

## What Changes

- **No case while scrambling.** Only the scramble is shown. The case (name, icon, alg) stays
  hidden until the solve ends or you ask for it.
- **Smart cube overlay blacked out while scrambling.** The 3D cube shows only the move arrows
  plus the centres, so you still know how the cube is held, but no sticker gives the case away.
- **Last-move warning.** Instead of a recognition timer, the drill warns you on the scramble's
  last move, so you can make that move and look straight at the cube to recognise the case.
  (A small recognition + execution timer was considered and set aside in favour of this.)
- **The case icon shows the case itself**, without the AUF the scramble left it at.
- **"Show me the alg".** When you get a case and don't know it, one action reveals the case and
  its alg. That attempt is logged as revealed (not as a normal timed solve), so stats can tell
  "didn't recognise / didn't know" apart from slow solves.

## Capabilities

### Modified Capabilities

- `pll-trainer`: hidden case while scrambling, last-move warning, unrotated case icon,
  reveal-and-log for unknown cases.
- Smart cube capability (spec to be written when smart cube is merged): overlay mode for
  scrambling, with arrows and centres only.

## Stealth

The blacked-out overlay is already neutral. The last-move warning has to work without colour
(shape or text, not just red/green).

## Open questions

- Without a smart cube, how does the drill know you reached the last move? Maybe only show the
  last-move warning in smart mode, and keep the plain "hidden case" behaviour otherwise.
- Does a revealed attempt still count toward the case's average? Proposal: no, it's logged
  separately as a reveal.
- Does the last-move warning replace the hold-Space start in smart mode, or come before it?
