import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import {
  SLOTS,
  SLOT_NAMES,
  clusterTitle,
  familyRelation,
  getAlg,
  getCase,
  getSlotCase,
  slotCaseIdFor,
  slotCasesById,
  slotRelation,
  executionPeers,
  betterAlg,
  caseSetup,
  leftRightMirror,
  mainHasBetter,
  popularity,
  type CatalogAlg,
  type Cluster,
  type Slot,
} from './catalog.ts'
import { Cube } from '../../common/cube/Cube.tsx'
import { EdgeTag } from './EdgeTag.tsx'
import { AlgMoves } from './Moves.tsx'
import { Notation } from '../../common/notation/Notation.tsx'
import { startsWithMoves } from '../../common/notation/moves.ts'
import { useF2lFocus } from './focus.ts'
import { updateF2lSettings, useF2lSettings, type SetupMode } from './settings.ts'
import { StatusMark } from './ProgressBits.tsx'
import {
  STATUS_LABEL,
  ALG_STATUS_LABEL,
  algStateOf,
  nextAlgStatus,
  notesFor,
  saveNote,
  setAlgStatus,
  setMainAlg,
  statusOf,
  useProgress,
  type AlgRef,
  type AlgState,
  type AlgStatus,
  type Note,
  type NoteSymmetry,
  type SlotCaseState,
} from './progress.ts'
import { MAX_NOTE_LENGTH, NOTE_SYMMETRIES } from '../../../../shared/f2l/progress.ts'
import { f2lHref } from './route.ts'
import { SlotGridKey, SlotIcon } from './SlotIcon.tsx'

/** Keys for the selected alg: toggle main, cycle status, edit its note; and focusing the search. */
const SHORTCUTS = { main: 'f', status: 'k', note: 'n', search: '/' }

const catalogRef = (alg: CatalogAlg): AlgRef => ({ kind: 'catalog', id: alg.id })

/** The setup line's styles (see SetupMode); the choice is remembered and the family map follows it. */
const SETUP_MODES: { value: SetupMode; label: string; title: string }[] = [
  { value: 'colours', label: 'Colours', title: 'Green in front: other slots set up with B/L/F turns' },
  { value: 'rotation', label: 'FR + y', title: 'The FR setup, then a y rotation to bring the pair to this slot' },
]

/** Algs shown before "…" expands the list (more if the selected or main alg sits further down). */
const INITIAL_SHOWN = 4

interface Props {
  cluster: Cluster
  slotCaseId?: string
  algId?: string
}

export function ClusterView({ cluster, slotCaseId, algId }: Props) {
  const requested = slotCaseId ? slotCasesById.get(slotCaseId) : undefined
  const focus = useF2lFocus()
  // With no slot-case in the URL, open on the first one; in focus mode, the first missing one.
  const firstMissing = cluster.caseIds
    .flatMap((caseId) => SLOTS.map((slot) => slotCaseIdFor(caseId, slot)))
    .find((id) => !focus.isDone(id))
  const slotCase =
    requested && cluster.caseIds.includes(requested.caseId)
      ? requested
      : getSlotCase(firstMissing ?? slotCaseIdFor(cluster.caseIds[0], 'FR'))
  const algs = slotCase.algIds.map(getAlg)
  const progress = useProgress()
  const slotProgress = progress.bySlotCase.get(slotCase.id)
  const mainAlgId = slotProgress?.mainAlg?.kind === 'catalog' ? slotProgress.mainAlg.id : undefined
  // With no alg in the URL, open on the user's main alg.
  const alg = algs.find((a) => a.id === algId) ?? algs.find((a) => a.id === mainAlgId) ?? algs[0]
  const caseInfo = getCase(slotCase.caseId)
  const { setupMode } = useF2lSettings()
  const { setup, pairSlot } = caseSetup(slotCase, setupMode)
  /** slot-case id -> the selected alg's family member there. */
  const familyAlgIds = new Map(Object.values(alg.familyAlgIds ?? {}).map((id) => [getAlg(id).slotCaseId, id]))

  const href = (scId: string, aId?: string) => f2lHref({ clusterId: cluster.id, slotCaseId: scId, algId: aId })

  // Setup mode plays the setup from a solved cube instead of the alg. It's tied to the
  // current slot-case + alg, so picking another one drops back to the alg.
  const viewKey = `${slotCase.id}/${alg.id}`
  const [setupViewKey, setSetupViewKey] = useState<string | null>(null)
  const showingSetup = setupViewKey === viewKey

  return (
    // Three areas the stylesheet arranges: viewer left of family map + algs when wide;
    // family map, viewer, algs stacked when narrow. The alg list scrolls on its own.
    <main className="cluster-view">
      {/* Focus mode: viewing a learnt slot-case greys the viewer a little. */}
      <section className={'viewer' + (focus.isDone(slotCase.id) ? ' done' : '')}>
        <div className="selected-title">
          F2L {caseInfo.number} · {SLOT_NAMES[slotCase.slot]}
          <EdgeTag slotCase={slotCase} />
        </div>
        <Cube
          setup={showingSetup ? '' : setup}
          alg={showingSetup ? setup : alg.moves}
          triggers={showingSetup ? undefined : alg.triggers}
          slot={slotCase.slot}
          pairSlot={pairSlot}
          size={380}
          interactive
        />
        <div className={'setup-line' + (showingSetup ? ' active' : '')}>
          <div className="setup-head">
            <span className="setup-label">Setup</span>
            <div className="segmented setup-mode" role="group" aria-label="Setup style">
              {SETUP_MODES.map(({ value, label, title }) => (
                <button
                  key={value}
                  className={setupMode === value ? 'active' : undefined}
                  title={title}
                  onClick={() => updateF2lSettings({ setupMode: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <code>
            <Notation moves={setup} />
          </code>
          <button onClick={() => setSetupViewKey(showingSetup ? null : viewKey)}>
            {showingSetup ? 'Back to alg' : 'Show on cube'}
          </button>
        </div>
      </section>

      <section className="family">
        <FamilyMap
          cluster={cluster}
          selectedId={slotCase.id}
          familyIds={familyAlgIds}
          hrefFor={(scId) => href(scId, familyAlgIds.get(scId))}
        />
      </section>

      <AlgList
        key={slotCase.id}
        algs={algs}
        selectedId={alg.id}
        mainId={mainAlgId}
        stateOf={(a) => algStateOf(slotProgress, catalogRef(a))}
        showProgress={progress.load === 'ready'}
        hrefFor={(a) => href(slotCase.id, a.id)}
        familyHrefFor={(id) => href(getAlg(id).slotCaseId, id)}
        isDone={focus.isDone}
      />
    </main>
  )
}

/** The cluster's place in the top bar: back to the overview, its title and tags. */
export function ClusterCrumb({ cluster }: { cluster: Cluster }) {
  return (
    <nav className="crumb">
      <a href={f2lHref({})} className="back" title="All cases">
        ← <span>All cases</span>
      </a>
      <h1>
        {cluster.caseIds.length === 2 ? 'Cases' : 'Case'} {clusterTitle(cluster)}
      </h1>
      <span className="tag">{getCase(cluster.caseIds[0]).group}</span>
      {cluster.caseIds.length === 1 && <span className="tag">self-mirror</span>}
    </nav>
  )
}

/** Slots as they sit on the cube seen from above: back row on top, front row below. */
const MAP_ORDER = ['BL', 'BR', 'FL', 'FR'] as const

interface FamilyMapProps {
  cluster: Cluster
  selectedId: string
  /** Slot-cases holding the selected alg's family, mapped to that alg. */
  familyIds: Map<string, string>
  hrefFor: (slotCaseId: string) => string
}

/**
 * The cluster as top-down grids of 4, one per alg family. In a grid, side-by-side cells
 * are left-right mirrors, front/back cells are front-back mirrors, and diagonal cells are
 * the same case turned 180°. So the case X at front-right also sits back-left, and its
 * mirror fills the other diagonal. A pair gets two grids (each case at front-right once);
 * a self-mirror case only one, since both would be the same.
 */
function FamilyMap({ cluster, selectedId, familyIds, hrefFor }: FamilyMapProps) {
  const { load, bySlotCase } = useProgress()
  const focus = useF2lFocus()
  const { setupMode } = useF2lSettings()
  const cell = (caseId: string, slot: Slot) => {
    const sc = getSlotCase(slotCaseIdFor(caseId, slot))
    const status = statusOf(bySlotCase.get(sc.id))
    const main = bySlotCase.get(sc.id)?.mainAlg
    const better = load === 'ready' ? mainHasBetter(main?.kind === 'catalog' ? main.id : undefined) : undefined
    const statusNote =
      (load === 'ready' ? ` · ${STATUS_LABEL[status]}` : '') +
      (better ? ` · more popular alg: ${better.moves} (▲${popularity(better)})` : '')
    // How the selected alg's version in this cell relates to the main alg chosen there.
    const familyAlgId = familyIds.get(sc.id)
    const mark = load === 'ready' && familyAlgId ? mainMark(bySlotCase.get(sc.id), familyAlgId) : undefined
    const familyNote = familyIds.has(sc.id)
      ? ` · ${familyRelation(getSlotCase(selectedId).slot, slot).toLowerCase()} of the selected alg`
      : ''
    const title = `F2L ${getCase(caseId).number} · ${SLOT_NAMES[slot]}${statusNote}${familyNote}${mark ? ` · ${MAIN_MARK_NOTE[mark]}` : ''}`
    const content = (
      <>
        {mark === 'main' && <MainBadge />}
        <Cube {...caseSetup(sc, setupMode)} slot={slot} size={76} />
        <span className="slot-cell-label">
          F2L {getCase(caseId).number}
          {load === 'ready' && <StatusMark status={status} />}
          {better && (
            <span className="better-mark" aria-label="A more popular alg exists">
              ↑
            </span>
          )}
        </span>
      </>
    )
    // Focus mode: a learnt slot-case is greyed out (still clickable).
    const className = 'slot-cell' + (sc.id === selectedId ? ' selected' : '') + (focus.isDone(sc.id) ? ' done' : '')
    return (
      <a key={slot} href={hrefFor(sc.id)} className={className} data-reveal data-slot={slot} title={title}>
        {content}
      </a>
    )
  }

  return (
    <div className="family-map">
      {cluster.caseIds.map((caseId) => {
        const mirrorId = getCase(caseId).mirrorCaseId
        const caseAt = (slot: Slot) => (slot === 'FR' || slot === 'BL' ? caseId : mirrorId)
        return (
          <div key={caseId} className="family-grid">
            {MAP_ORDER.map((slot) => cell(caseAt(slot), slot))}
            <SlotGridKey selected={MAP_ORDER.find((slot) => slotCaseIdFor(caseAt(slot), slot) === selectedId)} />
          </div>
        )
      })}
    </div>
  )
}

interface AlgListProps {
  algs: CatalogAlg[]
  selectedId: string
  mainId?: string
  /** Focus mode: whether a slot-case is learnt (its family links are then greyed out). */
  isDone: (slotCaseId: string) => boolean
  /** The user's status and note for an alg, if any. */
  stateOf: (alg: CatalogAlg) => AlgState | undefined
  /** False while progress is loading or the server is unreachable: no star/learnt toggles. */
  showProgress: boolean
  hrefFor: (alg: CatalogAlg) => string
  familyHrefFor: (algId: string) => string
}

function AlgList({ algs, selectedId, mainId, stateOf, showProgress, hrefFor, familyHrefFor, isDone }: AlgListProps) {
  const [showAll, setShowAll] = useState(false)
  const { bySlotCase, notes } = useProgress()
  // Search by moves: the other algs narrow to those starting with what's typed. It's for
  // this slot-case's list, so moving to another case clears it.
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const listKey = algs[0]?.slotCaseId
  const [queryKey, setQueryKey] = useState(listKey)
  if (listKey !== queryKey) {
    setQueryKey(listKey)
    setQuery('')
  }
  const searching = query.trim() !== ''
  // The main alg always comes first, in its own section; the rest keep the catalog's order.
  const main = algs.find((a) => a.id === mainId)
  const others = algs.filter((a) => a.id !== mainId)

  // When a star moves a row between sections, it slides from where it was clicked to
  // where it lands (FLIP), then glows, so the eye can follow it.
  const listRef = useRef<HTMLDivElement>(null)
  const flip = useRef<{ id: string; top: number } | null>(null)
  const [movedId, setMovedId] = useState<string>()
  /** The alg whose note box is open (one at a time), and whether it should take focus. */
  const [openNote, setOpenNote] = useState<{ id: string; focus: boolean }>()
  const noteOpenId = openNote?.id
  // Selecting an alg that has a note shows it, without taking focus (so F/K/N still work).
  // Closing it keeps it closed until the selection changes.
  const selectedAlg = algs.find((a) => a.id === selectedId)
  const selectedHasNote = !!selectedAlg && notesFor(notes, selectedAlg).length > 0
  const autoNoteId = showProgress && selectedHasNote ? selectedId : undefined
  const [lastAutoNoteId, setLastAutoNoteId] = useState<string>()
  if (autoNoteId !== lastAutoNoteId) {
    setLastAutoNoteId(autoNoteId)
    if (autoNoteId) setOpenNote({ id: autoNoteId, focus: false })
  }
  const rowEl = (id: string) => listRef.current?.querySelector<HTMLElement>(`[data-alg-id="${id}"]`)
  const beforeMainToggle = (id: string) => {
    // With no alg in the URL the selection follows the main alg; pin it first so unsetting
    // the main alg doesn't move the selection (and the next F/K) to another alg.
    const alg = algs.find((a) => a.id === id)
    if (id === selectedId && alg && location.hash !== hrefFor(alg)) location.replace(hrefFor(alg))
    const el = rowEl(id)
    if (el) flip.current = { id, top: el.getBoundingClientRect().top }
    setMovedId(id)
  }
  useLayoutEffect(() => {
    const pending = flip.current
    flip.current = null
    const el = pending && rowEl(pending.id)
    if (!pending || !el) return
    const dy = pending.top - el.getBoundingClientRect().top
    if (dy && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
        duration: 300,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      })
    el.classList.remove('just-moved')
    void el.offsetWidth // restart the glow if it's still running
    el.classList.add('just-moved')
  }, [mainId])

  // Keyboard: F = make the selected alg main (or unset it), K = cycle its status,
  // N = edit its note.
  // Text fields keep their keys, like the player's shortcuts in Cube.tsx.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.target instanceof HTMLElement && e.target.closest('input:not([type=range]), textarea, select, [contenteditable]'))
      return
    if (e.key === SHORTCUTS.search && searchRef.current) {
      e.preventDefault()
      searchRef.current?.focus()
      return
    }
    if (!showProgress) return
    const selected = algs.find((a) => a.id === selectedId)
    if (!selected) return
    const key = e.key.toLowerCase()
    if (key === SHORTCUTS.main) {
      e.preventDefault()
      const isMain = selected.id === mainId
      beforeMainToggle(selected.id)
      setMainAlg(selected.slotCaseId, isMain ? null : { kind: 'catalog', id: selected.id })
    } else if (key === SHORTCUTS.status) {
      e.preventDefault()
      setAlgStatus(selected.slotCaseId, catalogRef(selected), nextAlgStatus(stateOf(selected)?.status))
    } else if (key === SHORTCUTS.note) {
      e.preventDefault()
      // Opens (and focuses) the note; if it's already open, just focuses it.
      if (noteOpenId === selected.id) [...(listRef.current?.querySelectorAll<HTMLTextAreaElement>('.alg-note textarea') ?? [])].at(-1)?.focus()
      else setOpenNote({ id: selected.id, focus: true })
    }
  })
  useEffect(() => {
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  // An unstarred alg drops back to its catalog position: keep it in view even there.
  const keepShown = Math.max(
    INITIAL_SHOWN,
    others.findIndex((a) => a.id === selectedId) + 1,
    others.findIndex((a) => a.id === movedId) + 1,
  )
  const matches = searching ? others.filter((a) => startsWithMoves(a.moves, query)) : others
  const shown = searching || showAll ? matches : others.slice(0, keepShown)

  // Search only where the list is long enough to be folded behind "… N more".
  const canSearch = others.length > INITIAL_SHOWN
  const searchBox = canSearch && (
    <label className="alg-search">
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m15 15 5 5" />
      </svg>
      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // Escape clears the search, then (once empty) leaves the box so the shortcuts work again.
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          e.preventDefault()
          if (query) setQuery('')
          else e.currentTarget.blur()
        }}
        placeholder={`Search moves  ${SHORTCUTS.search}`}
        aria-label="Search algs by their first moves"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
      />
    </label>
  )
  const othersLabel = (label: string) => (
    <div className="alg-section-label">
      <span>
        {label}
        {searching && (
          <span className="alg-search-count">
            {' '}
            · {matches.length} of {others.length}
          </span>
        )}
      </span>
      {searchBox}
    </div>
  )

  const row = (a: CatalogAlg) => {
    const state = stateOf(a)
    const algNotes = showProgress ? notesFor(notes, a) : []
    const noteOpen = showProgress && noteOpenId === a.id
    return [
      <li
        key={a.id}
        data-alg-id={a.id}
        className={[a.id === selectedId && 'selected', a.id === mainId && 'main', state?.status].filter(Boolean).join(' ') || undefined}
      >
      {showProgress && (
        <>
          <MainStar
            slotCaseId={a.slotCaseId}
            algId={a.id}
            isMain={a.id === mainId}
            onBeforeToggle={() => beforeMainToggle(a.id)}
          />
          <StatusToggle slotCaseId={a.slotCaseId} algId={a.id} status={state?.status ?? null} />
          <NoteToggle
            notes={algNotes}
            open={noteOpen}
            onClick={() => setOpenNote(noteOpen ? undefined : { id: a.id, focus: true })}
          />
        </>
      )}
      <a href={hrefFor(a)} className="alg-moves" title={a.moves}>
        <AlgMoves alg={a} />
      </a>
      {/* Votes and move count: numbers right-aligned on their digits, so they line up. */}
      <span className="alg-metrics">
        <span className="alg-votes" title={votesHint(a)}>
          ▲<span className="num">{popularity(a)}</span>
        </span>
        <span className="alg-stm" title={a.stm !== undefined ? 'Move count (STM)' : undefined}>
          <span className="num">{a.stm}</span>
          <span className="unit"> STM</span>
        </span>
      </span>
      <AlgFamily
        alg={a}
        slot={getSlotCase(a.slotCaseId).slot}
        bySlotCase={showProgress ? bySlotCase : undefined}
        hrefFor={familyHrefFor}
        isDone={isDone}
      />
      <ExecutionLink alg={a} hrefFor={familyHrefFor} />
      </li>,
      // An open note sits right under its alg, across the whole row.
      noteOpen && (
        <li key={`${a.id}-note`} className="alg-note">
          <NotesStrip
            key={a.id}
            alg={a}
            notes={algNotes}
            autoFocus={!!openNote?.focus}
            onClose={() => setOpenNote(undefined)}
          />
        </li>
      ),
    ]
  }

  return (
    <div
      className="alg-list"
      ref={listRef}
      // The votes column is as wide as this list's widest count (2 digits almost always).
      style={{ ['--vote-chars' as string]: Math.max(...algs.map((a) => String(popularity(a)).length)) }}
    >
      <h3>
        Algorithms ({algs.length})
        {showProgress && (
          <span className="shortcut-hint" title="Keyboard shortcuts for the selected alg">
            <kbd>{SHORTCUTS.main.toUpperCase()}</kbd> main · <kbd>{SHORTCUTS.status.toUpperCase()}</kbd> learning/learnt ·{' '}
            <kbd>{SHORTCUTS.note.toUpperCase()}</kbd> note
          </span>
        )}
      </h3>
      {/* Offline there's no main alg to show, so the list is just the catalog's. */}
      {showProgress && (
        <>
          <div className="alg-section-label">
            Main alg
            {main && <UseInAllSlots alg={main} bySlotCase={bySlotCase} />}
          </div>
          <ol className="alg-main">
            {main ? (
              <>
                {row(main)}
                <BetterHint main={main} hrefFor={hrefFor} />
              </>
            ) : (
              <li className="alg-main-empty">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1.03 6L12 17l-5.38 2.85 1.03-6L3.3 9.6l6-.9z" />
                </svg>
                Star an alg to make it your main
              </li>
            )}
          </ol>
          {othersLabel(main ? 'Other algs' : 'All algs')}
        </>
      )}
      {!showProgress && canSearch && othersLabel('All algs')}
      <ol>
        {shown.map(row)}
        {searching && !matches.length && <li className="alg-search-empty">No algs start with {query.trim()}</li>}
      </ol>
      {!searching && others.length > shown.length && (
        <button className="link-button" onClick={() => setShowAll(true)} title="Show all algorithms">
          … {others.length - shown.length} more
        </button>
      )}
    </div>
  )
}

/** How an alg relates to the main alg of its slot-case: it is the main, or another alg is. */
type MainMark = 'main' | 'other'

const MAIN_MARK_NOTE: Record<MainMark, string> = {
  main: 'your main alg there',
  other: 'you chose a different main alg there',
}

const mainMark = (p: SlotCaseState | undefined, algId: string): MainMark | undefined =>
  !p?.mainAlg ? undefined : p.mainAlg.kind === 'catalog' && p.mainAlg.id === algId ? 'main' : 'other'

/** Small star over the corner of a slot icon or cell: this alg is the main alg there. */
function MainBadge() {
  return (
    <svg className="main-badge" viewBox="0 0 24 24" aria-hidden>
      <path d="m12 2.5 2.9 5.9 6.5 1-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4-4.7-4.6 6.5-1z" />
    </svg>
  )
}

/**
 * Makes the main alg's family (its mirrored/turned versions) the main alg in the other
 * slots too. Only shown while some slot with a family version doesn't have it as main;
 * asks before replacing a different main alg.
 */
function UseInAllSlots({ alg, bySlotCase }: { alg: CatalogAlg; bySlotCase: ReadonlyMap<string, SlotCaseState> }) {
  const targets = Object.values(alg.familyAlgIds ?? {})
    .map((id) => ({ id, slotCaseId: getAlg(id).slotCaseId }))
    .map((t) => ({ ...t, mark: mainMark(bySlotCase.get(t.slotCaseId), t.id) }))
    .filter((t) => t.mark !== 'main')
  if (!targets.length) return null

  const replacing = targets.filter((t) => t.mark === 'other').length
  const apply = () => {
    if (
      replacing &&
      !confirm(`This replaces the main alg you chose in ${replacing} other slot${replacing > 1 ? 's' : ''}. Continue?`)
    )
      return
    for (const t of targets) setMainAlg(t.slotCaseId, { kind: 'catalog', id: t.id })
  }
  return (
    <button
      className="link-button use-in-all"
      onClick={apply}
      title="Make this alg's mirrored/turned versions your main alg in the other slots"
    >
      Use in all slots ({targets.length})
    </button>
  )
}

/** Fixed order for the family row: front pair, then back pair. */
const FAMILY_ORDER = ['FL', 'FR', 'BL', 'BR'] as const

/**
 * The alg in all four slots, as top-view slot icons: its own slot highlighted, the slots
 * where the catalog has its mirrored/turned version as links, the rest faded.
 */
interface AlgFamilyProps {
  alg: CatalogAlg
  slot: Slot
  /** Progress, to mark which family members (in the other slots) are main algs. Omitted when offline. */
  bySlotCase?: ReadonlyMap<string, SlotCaseState>
  hrefFor: (algId: string) => string
  /** Focus mode: links to learnt slot-cases are greyed out. */
  isDone: (slotCaseId: string) => boolean
}

function AlgFamily({ alg, slot, bySlotCase, hrefFor, isDone }: AlgFamilyProps) {
  return (
    <span className="alg-family" aria-label="This alg in each slot">
      {FAMILY_ORDER.map((s) => {
        if (s === slot)
          return (
            <span key={s} className="family-slot current" title={`${SLOT_NAMES[s]} (this alg)`}>
              <SlotIcon slot={s} />
            </span>
          )
        const id = alg.familyAlgIds?.[s]
        if (!id)
          return (
            <span key={s} className="family-slot missing" title={`${SLOT_NAMES[s]}: no exact version in the catalog`}>
              <SlotIcon slot={s} />
            </span>
          )
        const mark = bySlotCase && mainMark(bySlotCase.get(getAlg(id).slotCaseId), id)
        const note = mark ? ` · ${MAIN_MARK_NOTE[mark]}` : ''
        return (
          <a key={s} href={hrefFor(id)} className={'family-slot' + (isDone(getAlg(id).slotCaseId) ? ' done' : '')} title={`${SLOT_NAMES[s]}: ${familyRelation(slot, s).toLowerCase()}${note}`}>
            <SlotIcon slot={s} />
            {mark === 'main' && <MainBadge />}
          </a>
        )
      })}
    </span>
  )
}

interface AlgToggleProps {
  slotCaseId: string
  algId: string
}

/** Star: makes this the slot-case's main alg; click again to unset. */
function MainStar({ slotCaseId, algId, isMain, onBeforeToggle }: AlgToggleProps & { isMain: boolean; onBeforeToggle: () => void }) {
  const label = `${isMain ? 'Main alg (click to unset)' : 'Make this my main alg'} · ${SHORTCUTS.main.toUpperCase()} on the selected alg`
  return (
    <button
      className={'alg-toggle alg-star' + (isMain ? ' on' : '')}
      onClick={() => {
        onBeforeToggle()
        setMainAlg(slotCaseId, isMain ? null : { kind: 'catalog', id: algId })
      }}
      aria-pressed={isMain}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
        <path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1.03 6L12 17l-5.38 2.85 1.03-6L3.3 9.6l6-.9z" />
      </svg>
    </button>
  )
}

const STATUS_HINT: Record<AlgStatus | 'none', string> = {
  none: 'Mark as learning',
  learning: 'Learning (click: mark learnt)',
  learnt: 'Learnt (click: clear)',
}

/** Status of this alg, independent of which alg is main. Cycles nothing → learning → learnt. */
function StatusToggle({ slotCaseId, algId, status }: AlgToggleProps & { status: AlgStatus | null }) {
  const label = `${STATUS_HINT[status ?? 'none']} · ${SHORTCUTS.status.toUpperCase()} on the selected alg`
  return (
    <button
      className={'alg-toggle alg-status' + (status ? ` ${status}` : '')}
      onClick={() => setAlgStatus(slotCaseId, { kind: 'catalog', id: algId }, nextAlgStatus(status))}
      aria-label={`${status ? ALG_STATUS_LABEL[status] : 'No status'}. ${label}`}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        {status === 'learning' && <path className="half" d="M12 3.5a8.5 8.5 0 0 0 0 17z" />}
        {status !== 'learning' && <path d="m8.2 12.3 2.6 2.6 5-5.3" />}
      </svg>
    </button>
  )
}

/** Opens/closes the alg's notes. Filled when the alg has any (hover shows them). */
function NoteToggle({ notes, open, onClick }: { notes: Note[]; open: boolean; onClick: () => void }) {
  const hasNotes = notes.length > 0
  const label = `${open ? 'Close notes' : hasNotes ? 'Open notes' : 'Add a note'} · ${SHORTCUTS.note.toUpperCase()} on the selected alg`
  return (
    <button
      className={'alg-toggle alg-note-toggle' + (hasNotes ? ' has-note' : '') + (open ? ' open' : '')}
      onClick={onClick}
      aria-expanded={open}
      aria-label={label}
      title={hasNotes && !open ? `${notes.map((n) => n.text).join('\n\n')}\n\n${label}` : label}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
        <path className="page" d="M6 3.5h8.5l3.5 3.5v13.5H6z" />
        <path d="M14.5 3.5V7H18 M9 11.5h6 M9 15h4" />
      </svg>
    </button>
  )
}

/** Symmetry for a new note: just this alg; widening it is one click on its grid. */
const DEFAULT_SYMMETRY: NoteSymmetry = 'none'

interface NotesStripProps {
  alg: CatalogAlg
  /** The notes shown on this alg (notesFor). */
  notes: Note[]
  /** Focus the "add a note" row on open: when opened on purpose, not for a selected alg. */
  autoFocus: boolean
  onClose: () => void
}

/**
 * The alg's notes under its row: one line per note (its own, and mirrored versions'
 * notes that reach it). "+" on the last note's bar adds an empty one; with no notes yet,
 * the empty one shows straight away. A new note's row keeps its React key (its id) once
 * saved, so typing is never interrupted. Esc closes the strip.
 */
function NotesStrip({ alg, notes, autoFocus, onClose }: NotesStripProps) {
  const [draftId, setDraftId] = useState(() => crypto.randomUUID())
  // An empty note to type in: shown straight away when the alg has no notes yet, otherwise
  // only after "+" (on the last note's bar).
  const [adding, setAdding] = useState(() => notes.length === 0)
  const [focusDraft, setFocusDraft] = useState(autoFocus)
  const draftSaved = notes.some((n) => n.id === draftId)
  const rows = notes.filter((n) => n.id !== draftId)
  const showDraft = adding || draftSaved
  const own = { alg: catalogRef(alg), slotCaseId: alg.slotCaseId }
  const startAdding = () => {
    setAdding(true)
    setFocusDraft(true)
  }
  return (
    <div className="notes-strip">
      {rows.map((n, i) => (
        <NoteRow
          key={n.id}
          id={n.id}
          owner={ownerOf(n)}
          note={n}
          viewSlot={slotOf(alg)}
          onAdd={!showDraft && i === rows.length - 1 ? startAdding : undefined}
          onClose={onClose}
        />
      ))}
      {showDraft && (
        <NoteRow
          key={draftId}
          id={draftId}
          owner={own}
          note={notes.find((n) => n.id === draftId)}
          viewSlot={slotOf(alg)}
          draft
          autoFocus={focusDraft}
          onAdd={draftSaved ? startAdding : undefined}
          onBlur={() => {
            // Written: it becomes a regular note (same key, so nothing remounts). Left
            // empty: it goes away again, unless it's the only row.
            if (draftSaved) setDraftId(crypto.randomUUID())
            if (draftSaved || rows.length > 0) setAdding(false)
          }}
          onClose={onClose}
        />
      )}
    </div>
  )
}

const slotOf = (alg: CatalogAlg) => getSlotCase(alg.slotCaseId).slot
const ownerOf = (n: Note) => ({ alg: n.alg, slotCaseId: n.slotCaseId })

interface NoteRowProps {
  id: string
  /** The alg the note is (or will be) written on. */
  owner: { alg: AlgRef; slotCaseId: string }
  note?: Note
  /** The slot of the alg being viewed, outlined in the symmetry grid. */
  viewSlot: Slot
  /** The empty "add a note" row (until it's saved). */
  draft?: boolean
  autoFocus?: boolean
  /** Shows "+" at the end of the bar, to add another note (on the last note only). */
  onAdd?: () => void
  onBlur?: () => void
  onClose: () => void
}

/**
 * One note: its symmetry grid and its text. Grows with the text, saves a moment after
 * typing stops (never deleting mid-edit), and on blur/close, when empty text deletes it.
 * Keeps its own draft, so saves coming back never disturb what's being typed.
 */
function NoteRow({ id, owner, note, viewSlot, draft, autoFocus, onAdd, onBlur, onClose }: NoteRowProps) {
  const [text, setText] = useState(note?.text ?? '')
  const [symmetry, setSymmetry] = useState<NoteSymmetry>(note?.symmetry ?? DEFAULT_SYMMETRY)
  const latest = useRef({ text, symmetry })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const ref = useRef<HTMLTextAreaElement>(null)

  const save = (allowDelete: boolean) => {
    clearTimeout(timer.current)
    if (!allowDelete && !latest.current.text.trim()) return
    saveNote(id, { ...owner, ...latest.current })
  }
  // Save whatever is pending when the row goes away (strip closed, alg changed). Deps are
  // plain strings: the owner object is new on every render.
  const { kind, id: algId } = owner.alg
  const { slotCaseId } = owner
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      saveNote(id, { alg: { kind, id: algId }, slotCaseId, ...latest.current })
    },
    [id, kind, algId, slotCaseId],
  )
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const ownerSlot = getSlotCase(owner.slotCaseId).slot
  return (
    <div className={'note-row' + (draft && !note ? ' note-draft' : '')}>
      <SymmetryPicker
        symmetry={symmetry}
        ownerSlot={ownerSlot}
        viewSlot={viewSlot}
        onChange={(next) => {
          setSymmetry(next)
          latest.current = { ...latest.current, symmetry: next }
          save(false)
        }}
      />
      <textarea
        ref={ref}
        rows={1}
        value={text}
        maxLength={MAX_NOTE_LENGTH}
        placeholder={note || !draft ? '' : 'Add a note…'}
        aria-label="Note"
        onChange={(e) => {
          setText(e.target.value)
          latest.current = { ...latest.current, text: e.target.value }
          clearTimeout(timer.current)
          timer.current = setTimeout(() => save(false), NOTE_SAVE_DELAY_MS)
        }}
        onBlur={() => {
          save(true)
          onBlur?.()
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          e.stopPropagation()
          onClose()
        }}
      />
      {onAdd && (
        <button className="note-add" onClick={onAdd} title="Add another note" aria-label="Add another note">
          +
        </button>
      )}
    </div>
  )
}

/** How long typing pauses before a note saves. Leaving the field saves straight away. */
const NOTE_SAVE_DELAY_MS = 700

const SYMMETRY_LABEL: Record<NoteSymmetry, string> = {
  none: 'Only on the alg it was written on',
  lr: 'Also on its left-right mirror',
  fb: 'Also on its front-back mirror',
  both: 'On the alg in all four slots',
  linked: 'Everywhere linked: mirrors, rotation versions, and theirs',
}

/** Slots as seen from above: back row on top, as in the slot icons. */
const GRID_SLOTS = ['BL', 'BR', 'FL', 'FR'] as const

/**
 * A note's symmetry as a tiny top view: filled squares are the slots the note shows in,
 * the viewed alg's slot is outlined. Click cycles none → lr → fb → both.
 */
function SymmetryPicker({ symmetry, ownerSlot, viewSlot, onChange }: {
  symmetry: NoteSymmetry
  ownerSlot: Slot
  viewSlot: Slot
  onChange: (next: NoteSymmetry) => void
}) {
  const shows = (slot: Slot) => {
    const relation = slotRelation(ownerSlot, slot)
    return relation === 'same' || symmetry === 'both' || symmetry === relation
  }
  const next = NOTE_SYMMETRIES[(NOTE_SYMMETRIES.indexOf(symmetry) + 1) % NOTE_SYMMETRIES.length]
  return (
    <button
      className={'symmetry-picker' + (symmetry === 'linked' ? ' linked' : '')}
      onClick={() => onChange(next)}
      title={`${SYMMETRY_LABEL[symmetry]}. Click: ${SYMMETRY_LABEL[next].toLowerCase()}`}
      aria-label={`Note shows: ${SYMMETRY_LABEL[symmetry]}. Change`}
    >
      {symmetry === 'linked' ? (
        <LinkIcon />
      ) : (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
        {GRID_SLOTS.map((slot, i) => (
          <rect
            key={slot}
            x={i % 2 ? 9 : 1}
            y={i < 2 ? 1 : 9}
            width="6"
            height="6"
            rx="1.5"
            className={(shows(slot) ? 'on' : 'off') + (slot === viewSlot ? ' here' : '')}
          />
        ))}
      </svg>
      )}
    </button>
  )
}

function LinkIcon() {
  return (
    <svg className="link-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.9.9 M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9" />
    </svg>
  )
}

/**
 * Same execution elsewhere: the alg's moves with a different leading y rotation (or none),
 * in another slot of the case. Links to the first; the tooltip lists them all. Keeps its
 * column even when empty, so rows stay aligned.
 */
function ExecutionLink({ alg, hrefFor }: { alg: CatalogAlg; hrefFor: (algId: string) => string }) {
  const peers = executionPeers(alg)
  if (!peers.length) return <span className="execution-link" />
  const list = peers.map((p) => `${SLOT_NAMES[getSlotCase(p.slotCaseId).slot]}: ${p.moves}`).join('\n')
  return (
    <a className="execution-link" href={hrefFor(peers[0].id)} title={`Same execution, a rotation apart:\n${list}`}>
      <LinkIcon />
    </a>
  )
}

/** Tooltip for an alg's vote count: pooled with its left-right mirror (see popularity). */
function votesHint(alg: CatalogAlg) {
  const mirror = leftRightMirror(alg)
  return mirror
    ? `SpeedCubeDB votes for this alg and its left-right mirror (this ${alg.votes ?? 0}, mirror ${mirror.votes ?? 0})`
    : 'SpeedCubeDB votes'
}

/** Under the main alg: a clearly more popular alternative, if there is one (see betterAlg). */
function BetterHint({ main, hrefFor }: { main: CatalogAlg; hrefFor: (alg: CatalogAlg) => string }) {
  const better = betterAlg(main)
  if (!better) return null
  return (
    <li className="alg-better">
      <span className="better-mark">↑</span>
      More popular:
      <a href={hrefFor(better)} className="alg-better-moves">
        <AlgMoves alg={better} />
      </a>
      <span className="alg-better-votes">
        ▲{popularity(better)} vs ▲{popularity(main)}
      </span>
    </li>
  )
}
