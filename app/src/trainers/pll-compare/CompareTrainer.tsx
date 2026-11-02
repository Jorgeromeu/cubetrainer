// The board: any number of PLL cubes side by side, each with its own case, U turns and
// view (dragged on its own, snapping to a two-sided view; camera.ts). Its turn spins the top (another angle, another pattern);
// its variant turns U before the case (the same pattern, its colours shifted against the
// centres). The board lives in the URL (board.ts), and can be saved as a named set (sets.ts).
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'
import type { TwistyPlayer } from 'cubing/twisty'
import type { TrainerProps } from '../../common/trainer.ts'
import { trainerHref } from '../../common/trainer.ts'
import { setStealthPalette } from '../../common/cube/stealthCube.ts'
import { PllIcon } from '../../common/pll/PllIcon.tsx'
import { BLOCK_COLORS, MAX_CAPTION, MAX_SET_NAME } from '../../../../shared/pll-compare/sets.ts'
import {
  baseSetup,
  boardPath,
  cubeLabel,
  MAX_CUBES,
  onBoard,
  paint,
  parseBoard,
  quarters,
  removeBlock,
  sameCubes,
  setCaption,
  withBlocks,
  type BoardCube,
} from './board.ts'
import { PRESETS, BoardCamera } from './camera.ts'
import { pllCases, pllCasesById, pllGroups } from './catalog.ts'
import { CompareCube } from './CompareCube.tsx'
import { useFit } from './fit.ts'
import { copyBoardImage } from './image.ts'
import { PALETTE } from './marks.ts'
import { deleteSet, saveSet, useSets, type CompareSet } from './sets.ts'

const ID = 'pll-compare'

const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable]')

/** Top bar content. */
export function CompareCrumb() {
  return (
    <nav className="crumb">
      <h1>Compare cases</h1>
    </nav>
  )
}

export function CompareTrainer({ path }: TrainerProps) {
  const [camera] = useState(() => new BoardCamera())
  const [cubes, setCubes] = useState(() => parseBoard(path[0]))
  /** The cube under the pointer, which the keys act on. */
  const [hovered, setHovered] = useState<number | null>(null)
  /** The sidebar, or the board alone. */
  const [open, setOpen] = useState(true)
  /** Columns on the board; null fits them to the window. */
  const [columns, setColumns] = useState<number | null>(null)
  /** The colour Shift+click paints with (PALETTE). */
  const [color, setColor] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  // "Copied" goes again after a moment.
  useEffect(() => {
    if (copied !== 'copied') return
    const timer = setTimeout(() => setCopied(null), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  // PLL is read from the side colours: in stealth, all four sides get their own grey.
  useEffect(() => setStealthPalette('sides'), [])

  // The URL follows the board without adding history entries; a link to another board
  // (a real hash change) replaces it.
  const urlBoard = path[0] ?? ''
  const written = useRef(urlBoard)
  useEffect(() => {
    if (urlBoard === written.current) return
    written.current = urlBoard
    setCubes(parseBoard(urlBoard))
  }, [urlBoard])
  useEffect(() => {
    written.current = boardPath(cubes)
    history.replaceState(history.state, '', trainerHref(ID, written.current))
  }, [cubes])

  const update = (key: number, change: (c: BoardCube) => Partial<BoardCube>) =>
    setCubes((cs) => cs.map((c) => (c.key === key ? { ...c, ...change(c) } : c)))
  const turnBy = (key: number, n: number) => update(key, (c) => ({ turn: quarters(c.turn + n) }))
  const variantBy = (key: number, n: number) => update(key, (c) => ({ variant: quarters(c.variant + n) }))
  /** Through all 16 states: the turn first, then the variant. */
  const stateBy = (key: number, n: number) =>
    update(key, (c) => {
      const i = (((c.variant * 4 + c.turn + n) % 16) + 16) % 16
      return { variant: Math.floor(i / 4), turn: i % 4 }
    })
  const add = (caseId: string) =>
    setCubes((cs) => (cs.length >= MAX_CUBES ? cs : [...cs, onBoard({ caseId, variant: 0, turn: 0 })]))
  const remove = (key: number) => {
    setCubes((cs) => cs.filter((c) => c.key !== key))
    if (hovered === key) setHovered(null)
  }

  // 1-4 pick the paint colour. The rest act on the cube under the pointer: ←/→ rotate the
  // view, ↑/↓ variant, Shift+↑/↓ all 16 states, u / U turn.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || isTextField(e.target)) return
    const digit = Number(e.key)
    if (digit >= 1 && digit <= BLOCK_COLORS) {
      setColor(digit - 1)
      return
    }
    if (hovered === null) return
    const handlers: Record<string, () => void> = {
      ArrowLeft: () => camera.rotate(hovered, -1),
      ArrowRight: () => camera.rotate(hovered, 1),
      ArrowUp: () => (e.shiftKey ? stateBy : variantBy)(hovered, 1),
      ArrowDown: () => (e.shiftKey ? stateBy : variantBy)(hovered, -1),
      u: () => turnBy(hovered, 1),
      U: () => turnBy(hovered, -1),
    }
    const handler = handlers[e.key]
    if (!handler) return
    e.preventDefault()
    handler()
  })
  useEffect(() => {
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  // Scrolling over a cube zooms them all (cubing.js has no zoom of its own).
  const boardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.target as Element).closest('.compare-cube')) return
      e.preventDefault()
      camera.zoom(Math.exp(e.deltaY * 0.001))
    }
    board.addEventListener('wheel', onWheel, { passive: false })
    return () => board.removeEventListener('wheel', onWheel)
  }, [camera])
  const fit = useFit(boardRef, cubes.length, columns, Math.max(0, ...cubes.map((c) => c.blocks?.length ?? 0)))

  const card = (cube: BoardCube) => {
    const pll = pllCasesById.get(cube.caseId)!
    return (
      <div
        key={cube.key}
        className={'cmp-card' + (hovered === cube.key ? ' hovered' : '')}
        onPointerEnter={() => setHovered(cube.key)}
        onPointerLeave={() => setHovered((h) => (h === cube.key ? null : h))}
      >
        <div className="cmp-stage">
          <CompareCube
            id={cube.key}
            base={baseSetup(cube)}
            turn={cube.turn}
            blocks={cube.blocks}
            camera={camera}
            onPick={(sticker) => update(cube.key, (c) => paint(c, sticker, color))}
          />
          <div className="cmp-tools">
            <div
              className="cmp-variant"
              role="group"
              aria-label="Variant"
              title="Variant (↑/↓ over the cube): a U before the case. The same pattern, its colours shifted against the centres"
            >
              <button onClick={() => variantBy(cube.key, -1)} aria-label="Previous variant">
                ‹
              </button>
              <span>v{cube.variant + 1}</span>
              <button onClick={() => variantBy(cube.key, 1)} aria-label="Next variant">
                ›
              </button>
            </div>
            <div className="cmp-turn" role="group" aria-label="Turn the top" title="Turn the top (u / Shift+u over the cube)">
              <button onClick={() => turnBy(cube.key, -1)}>U'</button>
              <button onClick={() => turnBy(cube.key, 2)}>U2</button>
              <button onClick={() => turnBy(cube.key, 1)}>U</button>
            </div>
            <button
              className="cmp-icon-button"
              onClick={() => update(cube.key, () => ({ variant: 0, turn: 0 }))}
              disabled={!cube.variant && !cube.turn}
              title="Back to the case as drawn"
              aria-label="Reset"
            >
              ↺
            </button>
            <button className="cmp-icon-button" onClick={() => remove(cube.key)} title="Remove" aria-label="Remove">
              ×
            </button>
          </div>
        </div>

        <select
          className="cmp-name"
          value={cube.caseId}
          onChange={(e) => update(cube.key, (c) => withBlocks({ ...c, caseId: e.target.value }, []))}
          title={`Set up as ${cubeLabel(cube)}: the variant's U, the case (${pll.name}), then the turn`}
          aria-label="Case"
        >
          {pllGroups.map(({ group, cases }) => (
            <optgroup key={group} label={group}>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {cube.blocks?.map((block) => (
          <div
            key={block.color}
            className="cmp-caption"
            style={{ '--ink': PALETTE[block.color].ink, '--frame': PALETTE[block.color].frame } as CSSProperties}
          >
            <input
              value={block.caption}
              onChange={(e) => update(cube.key, (c) => setCaption(c, block.color, e.target.value))}
              placeholder="Caption"
              maxLength={MAX_CAPTION}
              aria-label="Caption"
            />
            <button
              onClick={() => update(cube.key, (c) => removeBlock(c, block.color))}
              title="Unpaint these stickers"
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    )
  }

  const copy = async () => {
    const players = [...(boardRef.current?.querySelectorAll('twisty-player') ?? [])] as TwistyPlayer[]
    if (!fit || players.length !== cubes.length) return
    setCopied('copying')
    try {
      await copyBoardImage(cubes, players, fit.columns)
      setCopied('copied')
    } catch (e) {
      setCopied(`Couldn't copy: ${(e as Error).message}`)
    }
  }

  return (
    <div className="cmp">
      {open ? (
        <aside className="cmp-side">
          <div className="cmp-side-head">
            <h2>{cubes.length >= MAX_CUBES ? `Full (${MAX_CUBES} cubes)` : 'Add a cube'}</h2>
            <button className="cmp-icon-button" onClick={() => setOpen(false)} title="Hide" aria-label="Hide the sidebar">
              «
            </button>
          </div>
          <Bank full={cubes.length >= MAX_CUBES} onAdd={add} />

          <section className="cmp-side-section">
            <h2>Marks</h2>
            <div className="cmp-palette" role="group" aria-label="Paint colour">
              {PALETTE.map((c, i) => (
                <button
                  key={c.frame}
                  className={color === i ? 'active' : undefined}
                  style={{ background: c.frame }}
                  onClick={() => setColor(i)}
                  title={`Paint in this colour (${i + 1})`}
                  aria-label={`Colour ${i + 1}`}
                  aria-pressed={color === i}
                />
              ))}
            </div>
            <p className="cmp-hint">
              Shift+click stickers to paint them in this colour (again to unpaint), then caption them under the cube.
            </p>
            <div className="cmp-copy">
              <button onClick={() => void copy()} disabled={!cubes.length || copied === 'copying'}>
                Copy as image
              </button>
              {copied === 'copied' && <span className="cmp-note">Copied</span>}
              {copied?.startsWith("Couldn't") && <span className="cmp-error">{copied}</span>}
            </div>
          </section>

          <section className="cmp-side-section">
            <h2>View</h2>
            <div className="segmented" role="group" aria-label="View">
              {PRESETS.map((p) => (
                <button key={p.label} title={p.title} onClick={() => camera.set(p.view)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="Zoom">
              <button onClick={() => camera.zoom(1 / 1.15)} title="Zoom in (or scroll over a cube)">
                +
              </button>
              <button onClick={() => camera.resetZoom()} title="Reset zoom">
                Zoom
              </button>
              <button onClick={() => camera.zoom(1.15)} title="Zoom out">
                −
              </button>
            </div>
            <div className="segmented" role="group" aria-label="Columns">
              {[null, 1, 2, 3, 4, 5, 6].map((c) => (
                <button
                  key={c ?? 'fit'}
                  className={columns === c ? 'active' : undefined}
                  onClick={() => setColumns(c)}
                  title={c ? `${c} a row` : 'As many a row as gives the biggest cubes'}
                >
                  {c ?? 'Fit'}
                </button>
              ))}
            </div>
            <p className="cmp-hint">
              Drag a cube to turn it: it snaps to the nearest two-sided view. Over a cube: ←/→
              rotate, ↑/↓ variant, Shift+↑/↓ all 16, u / Shift+u turn.
            </p>
          </section>

          <SetsBar cubes={cubes} onLoad={(set) => setCubes(set.cubes.map(onBoard))} />

          {cubes.length > 0 && (
            <button className="link-button cmp-clear" onClick={() => setCubes([])}>
              Clear the board
            </button>
          )}
        </aside>
      ) : (
        <button
          className="cmp-icon-button cmp-side-show"
          onClick={() => setOpen(true)}
          title="Cases, views and sets"
          aria-label="Show the sidebar"
        >
          »
        </button>
      )}

      <div
        className="cmp-board"
        ref={boardRef}
        style={fit ? { gridTemplateColumns: `repeat(${fit.columns}, ${fit.width}px)` } : undefined}
        data-reveal
      >
        {cubes.map(card)}
        {!cubes.length && <p className="cmp-empty">Pick a case to start</p>}
      </div>
    </div>
  )
}

/** Every case, click to add a cube with it. */
function Bank({ full, onAdd }: { full: boolean; onAdd: (caseId: string) => void }) {
  return (
    <div className="cmp-add-grid">
      {pllCases.map((c) => (
        <button key={c.id} onClick={() => onAdd(c.id)} disabled={full} title={`Add ${c.name}`}>
          <PllIcon pll={c} size={36} />
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  )
}

/** The saved sets (click to load, × to delete), and saving the board under a name. */
function SetsBar({ cubes, onLoad }: { cubes: readonly BoardCube[]; onLoad: (set: CompareSet) => void }) {
  const { load, sets } = useSets()
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()
  const named = sets.find((s) => s.name.toLowerCase() === trimmed.toLowerCase())
  /** The set the board is exactly. */
  const current = sets.find((s) => sameCubes(s.cubes, cubes))

  const save = async () => {
    setSaving(true)
    try {
      await saveSet(named?.id ?? crypto.randomUUID(), trimmed, cubes)
      setError(undefined)
    } catch (e) {
      setError(`Couldn't save: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }
  const remove = async (set: CompareSet) => {
    if (!confirm(`Delete the set "${set.name}"?`)) return
    try {
      await deleteSet(set.id)
    } catch (e) {
      setError(`Couldn't delete: ${(e as Error).message}`)
    }
  }

  return (
    <section className="cmp-side-section">
      <h2>Sets</h2>
      {load === 'offline' && <span className="cmp-note">No server: sets can't be loaded or saved</span>}
      {load === 'ready' && !sets.length && (
        <span className="cmp-note">None yet: add cubes, then save them under a name</span>
      )}
      <div className="cmp-sets">
        {sets.map((s) => (
          <span key={s.id} className={'cmp-set' + (s === current ? ' active' : '')}>
            <button
              className="cmp-set-name"
              onClick={() => {
                onLoad(s)
                setName(s.name)
              }}
              title={s.cubes.map(cubeLabel).join('\n')}
            >
              {s.name}
            </button>
            <button className="cmp-set-delete" onClick={() => remove(s)} title="Delete" aria-label={`Delete ${s.name}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        className="cmp-save"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this board"
          maxLength={MAX_SET_NAME}
          disabled={load !== 'ready'}
          aria-label="Set name"
        />
        <button
          type="submit"
          disabled={load !== 'ready' || saving || !cubes.length || !trimmed || (named && sameCubes(named.cubes, cubes))}
          title={named ? `Replace "${named.name}" with this board` : 'Save this board as a set'}
        >
          {named ? 'Update' : 'Save'}
        </button>
      </form>
      {error && <span className="cmp-error">{error}</span>}
    </section>
  )
}
