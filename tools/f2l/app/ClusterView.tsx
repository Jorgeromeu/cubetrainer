import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  SLOTS,
  SLOT_NAMES,
  clusterTitle,
  clustersById,
  neighbourClusters,
  equivalentIn,
  getAlg,
  getCase,
  getSlotCase,
  groupAlgs,
  linkPhrase,
  linkSetSummary,
  linksBetween,
  slotCaseIdFor,
  slotCasesById,
  betterAlg,
  caseSetup,
  leftRightMirror,
  mainHasBetter,
  recommendationsOf,
  RECOMMENDERS,
  type CatalogAlg,
  type Cluster,
  type Recommender,
  type Slot,
} from './catalog.ts'
import { Cube } from '../../../packages/ui/cube/Cube.tsx'
import { EdgeTag } from './EdgeTag.tsx'
import { AlgMoves } from './Moves.tsx'
import { Notation } from '../../../packages/ui/notation/Notation.tsx'
import { startsWithMoves } from '../../../packages/core/notation/moves.ts'
import { useF2lFilter } from './filter.ts'
import { useF2lFocus } from './focus.ts'
import { updateF2lSettings, useF2lSettings, type SetupMode } from './settings.ts'
import { StatusMark } from './ProgressBits.tsx'
import {
  STATUS_LABEL,
  ALG_STATUS_LABEL,
  addUserAlg,
  algStateOf,
  deleteUserAlg,
  fillUserAlg,
  isPlaceholder,
  nextAlgStatus,
  notesOn,
  sameAlg,
  saveNote,
  setAlgStatus,
  setMainAlg,
  setVideoLink,
  statusOf,
  useProgress,
  type AlgRef,
  type AlgState,
  type AlgStatus,
  noteReach,
  type Note,
  type NoteFollows,
  type SlotCaseState,
  type UserAlg,
  type VideoLink,
  algKey,
  userAlgsOf,
  userRef,
} from './progress.ts'
import { MAX_NOTE_LENGTH, MAX_USER_ALG_LENGTH, MAX_VIDEO_URL_LENGTH } from '../contract.ts'
import { checkAlg, readMoves, simplifyMoves, useKPuzzle, type AlgCheck } from './checkAlg.ts'
import { isRotation } from '../../../packages/core/notation/moves.ts'
import { useDismiss } from '../../../packages/ui/dismiss.ts'
import { LinkKindsPicker, LinkSetIcon } from './LinkKindsPicker.tsx'
import { f2lHref } from './route.ts'
import { SlotGridKey } from './SlotGridKey.tsx'

/**
 * Keys for the selected alg: toggle main, cycle status, edit its note, edit its video
 * link, go to its equivalent in another case; focusing the search, and adding an alg of your own.
 */
const SHORTCUTS = { main: 'f', status: 'k', note: 'n', video: 'v', equivalent: 'g', search: '/', add: 'a' }

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
  const userAlgs = progress.load === 'ready' ? userAlgsOf(progress.userAlgs, slotCase.id) : []
  const userMain = userAlgs.find((u) => sameAlg(slotProgress?.mainAlg, userRef(u)))
  // With no alg in the URL, open on the user's main alg (a catalog one or one of yours).
  const urlAlg = algs.find((a) => a.id === algId)
  const selectedUser = urlAlg ? undefined : (userAlgs.find((u) => u.id === algId) ?? (mainAlgId ? undefined : userMain))
  // The catalog alg the family map works from: the selected one, else the main or the first.
  // With one of your algs selected, the map just shows the cluster (no family to mark).
  const alg = urlAlg ?? algs.find((a) => a.id === mainAlgId) ?? algs[0]
  const caseInfo = getCase(slotCase.caseId)
  const { setupMode } = useF2lSettings()
  const { setup, pairSlot } = caseSetup(slotCase, setupMode)
  /** slot-case id -> the selected alg's exact mirrored/turned version there. */
  const familyAlgIds = new Map(
    selectedUser ? [] : Object.values(alg.familyAlgIds ?? {}).map((id) => [getAlg(id).slotCaseId, id] as const),
  )
  // Adding an alg of your own: the cube previews the moves typed so far (see AddAlg).
  const [draft, setDraft] = useState<{ slotCaseId: string; moves: string }>()
  const preview = draft?.slotCaseId === slotCase.id ? draft.moves : undefined

  const href = (scId: string, aId?: string) => f2lHref({ clusterId: cluster.id, slotCaseId: scId, algId: aId })

  // Setup mode plays the setup from a solved cube instead of the alg. It's tied to the
  // current slot-case + alg, so picking another one drops back to the alg.
  const viewKey = `${slotCase.id}/${selectedUser?.id ?? alg.id}`
  const [setupViewKey, setSetupViewKey] = useState<string | null>(null)
  const showingSetup = setupViewKey === viewKey

  // "Go to equivalent" (the button on an alg's row, or G for the selected alg): a mode on
  // the family map, tied to the alg it started from, so landing on another alg ends it.
  // Esc or a click outside the map cancels.
  const [pickKey, setPickKey] = useState<string | null>(null)
  const picking = pickKey === viewKey
  const familyRef = useRef<HTMLElement>(null)
  useDismiss(familyRef, picking, () => setPickKey(null), '.equivalent-toggle')
  const togglePicking = (from: CatalogAlg) => {
    const key = `${slotCase.id}/${from.id}`
    if (pickKey === key) return setPickKey(null)
    setPickKey(key)
    // Picking from another row selects that alg first: the map works from the selected alg.
    if (from.id !== alg.id) location.hash = href(slotCase.id, from.id)
  }
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== SHORTCUTS.equivalent || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return
    if (selectedUser) return // your own algs have no links to follow
    e.preventDefault()
    togglePicking(alg)
  })
  useEffect(() => {
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  return (
    // Three areas the stylesheet arranges: viewer left of family map + algs when wide;
    // family map, viewer, algs stacked when narrow. The alg list scrolls on its own.
    <main className="cluster-view">
      {/* Focus mode: viewing a learnt slot-case greys the viewer a little. */}
      <section className={'viewer' + (focus.isDone(slotCase.id) ? ' done' : '')}>
        <div className="selected-title">
          F2L {caseInfo.number} · {SLOT_NAMES[slotCase.slot]}
          <EdgeTag slotCase={slotCase} />
          {preview !== undefined && <span className="tag preview-tag" title="The cube shows the moves typed so far">
              Preview
            </span>}
        </div>
        {preview !== undefined ? (
          <Cube setup={setup} alg={preview} slot={slotCase.slot} pairSlot={pairSlot} size={380} interactive at="end" />
        ) : (
          <Cube
            setup={showingSetup ? '' : setup}
            alg={showingSetup ? setup : (selectedUser?.moves ?? alg.moves)}
            triggers={showingSetup || selectedUser ? undefined : alg.triggers}
            slot={slotCase.slot}
            pairSlot={pairSlot}
            size={380}
            interactive
          />
        )}
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

      <section className="family" ref={familyRef}>
        <div className="family-tools">
          <LinkFilter />
        </div>
        {picking && (
          <div className="pick-hint">
            Pick a case to go to the alg most like{' '}
            <code>
              <Notation moves={alg.moves} />
            </code>{' '}
            there · <kbd>Esc</kbd> cancels
          </div>
        )}
        <FamilyMap cluster={cluster} selected={alg} familyIds={familyAlgIds} hrefFor={href} picking={picking} />
      </section>

      <AlgList
        key={slotCase.id}
        algs={algs}
        userAlgs={userAlgs}
        setup={slotCase.setup}
        onDraft={(moves) => setDraft(moves === undefined ? undefined : { slotCaseId: slotCase.id, moves })}
        selectedId={selectedUser?.id ?? alg.id}
        mainId={mainAlgId ?? userMain?.id}
        stateOf={(a) => algStateOf(slotProgress, catalogRef(a))}
        showProgress={progress.load === 'ready'}
        hrefFor={(id) => href(slotCase.id, id)}
        pickingId={picking ? alg.id : undefined}
        onPick={togglePicking}
      />
    </main>
  )
}

/** Shift+← / Shift+→: the previous / next cluster in overview order (plain arrows step the cube). */
const NEIGHBOUR_KEYS: Record<string, 'previous' | 'next'> = { ArrowLeft: 'previous', ArrowRight: 'next' }

const clusterName = (cluster: Cluster) => `${cluster.caseIds.length === 2 ? 'Cases' : 'Case'} ${clusterTitle(cluster)}`

/**
 * The cluster's place in the top bar: back to the overview, its title between previous /
 * next arrows (also Shift+←/→), and tags.
 */
export function ClusterCrumb({ cluster }: { cluster: Cluster }) {
  const neighbours = neighbourClusters(cluster)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const direction = NEIGHBOUR_KEYS[e.key]
      if (!direction || !e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      location.hash = f2lHref({ clusterId: neighbourClusters(cluster)[direction].id })
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [cluster])

  const step = (direction: 'previous' | 'next') => (
    <a
      className="cluster-step"
      href={f2lHref({ clusterId: neighbours[direction].id })}
      title={`${direction === 'previous' ? 'Previous' : 'Next'}: ${clusterName(neighbours[direction])} (Shift+${direction === 'previous' ? '←' : '→'})`}
      aria-label={`${direction === 'previous' ? 'Previous' : 'Next'} cluster`}
    >
      {direction === 'previous' ? '‹' : '›'}
    </a>
  )

  return (
    <nav className="crumb">
      <a href={f2lHref({})} className="back" title="All cases">
        ← <span>All cases</span>
      </a>
      <div className="cluster-steps">
        {step('previous')}
        <h1>{clusterName(cluster)}</h1>
        {step('next')}
      </div>
      <span className="tag">{getCase(cluster.caseIds[0]).group}</span>
      {cluster.caseIds.length === 1 && <span className="tag">self-mirror</span>}
    </nav>
  )
}

/** Slots as they sit on the cube seen from above: back row on top, front row below. */
const MAP_ORDER = ['BL', 'BR', 'FL', 'FR'] as const

/**
 * The cluster's family grids, cells in MAP_ORDER: one grid per case of the cluster, with
 * that case at front-right and back-left and its mirror in the other two slots.
 */
function familyGrids(cluster: Cluster) {
  return cluster.caseIds.map((caseId) => {
    const mirrorId = getCase(caseId).mirrorCaseId
    return {
      caseId,
      cells: MAP_ORDER.map((slot) => ({
        slot: slot as Slot,
        slotCaseId: slotCaseIdFor(slot === 'FR' || slot === 'BL' ? caseId : mirrorId, slot),
      })),
    }
  })
}

/** Group tints for the family map (index.css: --group-0 …); more groups reuse them. */
const GROUP_TINTS = 5

const cellName = (slotCaseId: string) => {
  const sc = getSlotCase(slotCaseId)
  return `F2L ${getCase(sc.caseId).number} ${SLOT_NAMES[sc.slot].toLowerCase()}`
}

interface FamilyMapProps {
  cluster: Cluster
  selected: CatalogAlg
  /** Slot-cases holding the selected alg's exact mirrored/turned versions, mapped to that alg. */
  familyIds: Map<string, string>
  hrefFor: (slotCaseId: string, algId?: string) => string
  /** "Go to equivalent": cells link to the selected alg's equivalent there (see equivalentIn). */
  picking: boolean
}

/**
 * The cluster as top-down grids of 4, one per alg family. In a grid, side-by-side cells
 * are left-right mirrors, front/back cells are front-back mirrors, and diagonal cells are
 * the same case turned 180°. So the case X at front-right also sits back-left, and its
 * mirror fills the other diagonal. A pair gets two grids (each case at front-right once);
 * a self-mirror case only one, since both would be the same.
 *
 * Cells whose main algs are linked, by the kinds you count as the same (settings
 * linkKinds), share a tint: one tint per group, across both grids. A main linked to no
 * other stays plain.
 */
function FamilyMap({ cluster, selected, familyIds, hrefFor, picking }: FamilyMapProps) {
  const { load, bySlotCase } = useProgress()
  const filter = useF2lFilter()
  const focus = useF2lFocus()
  const { setupMode, linkKinds } = useF2lSettings()
  const grids = familyGrids(cluster)
  const mainOf = (slotCaseId: string) => {
    const main = load === 'ready' ? bySlotCase.get(slotCaseId)?.mainAlg : undefined
    return main?.kind === 'catalog' ? getAlg(main.id) : undefined
  }
  const slotCaseIds = [...new Set(grids.flatMap((g) => g.cells.map((c) => c.slotCaseId)))]
  const mains = slotCaseIds.flatMap((id) => mainOf(id) ?? [])
  // Biggest group first, so the same situation gets the same tint in every cluster.
  const groups = groupAlgs(mains, linkKinds)
    .filter((g) => g.length > 1)
    .sort((a, b) => b.length - a.length)
  const groupOf = new Map(groups.flatMap((g, i) => g.map((a) => [a.slotCaseId, i % GROUP_TINTS])))

  const cell = (slot: Slot, slotCaseId: string) => {
    const sc = getSlotCase(slotCaseId)
    const caseNumber = getCase(sc.caseId).number
    const status = statusOf(bySlotCase.get(sc.id))
    const main = mainOf(sc.id)
    const better = load === 'ready' ? mainHasBetter(main?.id) : undefined
    const statusNote =
      (load === 'ready' ? ` · ${STATUS_LABEL[status]}` : '') +
      (better ? ` · more popular alg: ${better.moves} (${votesText(better)})` : '')
    // How the selected alg's exact version in this cell relates to the main alg chosen there.
    const familyAlgId = familyIds.get(sc.id)
    const mark = load === 'ready' && familyAlgId ? mainMark(bySlotCase.get(sc.id), familyAlgId) : undefined
    const familyLink = familyAlgId && linksBetween(selected, getAlg(familyAlgId))[0]
    const familyNote = familyLink ? ` · the selected alg's ${linkPhrase(selected, familyLink)}` : ''
    // Every direct link from this main to the other cells' mains; uncounted kinds say so.
    const linkNote = main
      ? mains
          .filter((other) => other !== main)
          .flatMap((other) =>
            linksBetween(main, other).map(
              (l) => ` · ${cellName(other.slotCaseId)}: ${linkPhrase(main, l)}${linkKinds.includes(l.kind) ? '' : ' (not counted)'}`,
            ),
          )
          .join('')
      : ''

    // Picking: the cell leads to the selected alg's equivalent there, if anything is linked.
    const here = sc.id === selected.slotCaseId
    const equivalent = picking && !here ? equivalentIn(selected, sc.id, main?.id) : undefined
    const pickNote = !picking
      ? ''
      : here
        ? ' · you are here'
        : equivalent
          ? ` · go to ${equivalent.links[0] ? linkPhrase(selected, equivalent.links[0]) : `an alg ${equivalent.steps} links away`}` +
            `${equivalent.alg === main ? ' (your main)' : ''}: ${equivalent.alg.moves}`
          : ' · nothing linked to the selected alg here'

    const title = picking
      ? `F2L ${caseNumber} · ${SLOT_NAMES[slot]}${pickNote}`
      : `F2L ${caseNumber} · ${SLOT_NAMES[slot]}${statusNote}${familyNote}${mark ? ` · ${MAIN_MARK_NOTE[mark]}` : ''}${linkNote}`
    const content = (
      <>
        {mark === 'main' && <MainBadge />}
        <Cube {...caseSetup(sc, setupMode)} slot={slot} size={76} />
        <span className="slot-cell-label">
          F2L {caseNumber}
          {load === 'ready' && <StatusMark status={status} />}
          {better && (
            <span className="better-mark" aria-label="A more popular alg exists">
              ↑
            </span>
          )}
        </span>
      </>
    )
    // Focus mode: a learnt slot-case is greyed out (still clickable); so is one outside the overview's filter.
    const className =
      'slot-cell' +
      (here ? ' selected' : '') +
      (focus.isDone(sc.id) && !picking ? ' done' : '') +
      (!filter.matches(sc.id) && !picking ? ' filtered-out' : '') +
      (picking ? (equivalent ? ' pickable' : ' unpickable') : '')
    const group = groupOf.get(sc.id)
    const common = { className, 'data-reveal': true, 'data-slot': slot, 'data-group': group, title }
    if (picking && !equivalent)
      return (
        <span key={slot} {...common} aria-disabled>
          {content}
        </span>
      )
    return (
      <a key={slot} {...common} href={equivalent ? hrefFor(sc.id, equivalent.alg.id) : hrefFor(sc.id)}>
        {content}
      </a>
    )
  }

  return (
    <div className={'family-map' + (picking ? ' picking' : '')}>
      {grids.map(({ caseId, cells }) => (
        <div key={caseId} className="family-grid">
          {cells.map(({ slot, slotCaseId }) => cell(slot, slotCaseId))}
          <SlotGridKey selected={cells.find((c) => c.slotCaseId === selected.slotCaseId)?.slot} />
        </div>
      ))}
    </div>
  )
}

/** "Count as linked" next to the family map: which link kinds group (tint) the cells. */
function LinkFilter() {
  const { linkKinds } = useF2lSettings()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, () => setOpen(false))
  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className={'family-tool' + (open ? ' active' : '')}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={`Counted as the same alg: ${linkSetSummary(linkKinds, 'nothing')}. Cells whose main algs are linked this way share a tint`}
      >
        <LinkSetIcon kinds={linkKinds} size={16} />
        Count as linked
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Count as linked">
          <div className="popover-title">Count as the same alg</div>
          <LinkKindsPicker value={linkKinds} onChange={(kinds) => updateF2lSettings({ linkKinds: kinds })} />
          <p className="popover-note">Tints group cells whose main algs are linked this way. Also in Settings → F2L.</p>
        </div>
      )}
    </div>
  )
}

interface AlgListProps {
  algs: CatalogAlg[]
  /** The algs you added for this slot-case (empty while progress isn't loaded). */
  userAlgs: UserAlg[]
  /** The slot-case's setup (face turns), to check an alg being added against. */
  setup: string
  /** The moves typed so far while adding an alg (undefined when not adding), for the cube's preview. */
  onDraft: (moves?: string) => void
  /** The selected alg: a catalog alg or one of yours. */
  selectedId: string
  /** The main alg: a catalog alg or one of yours. */
  mainId?: string
  /** The user's status and note for an alg, if any. */
  stateOf: (alg: CatalogAlg) => AlgState | undefined
  /** False while progress is loading or the server is unreachable: no star/learnt toggles. */
  showProgress: boolean
  hrefFor: (algId: string) => string
  /** The alg "Go to equivalent" is picking from, if it's on. */
  pickingId?: string
  /** Starts (or stops) "Go to equivalent" from an alg. */
  onPick: (alg: CatalogAlg) => void
}

function AlgList({ algs, userAlgs, setup, onDraft, selectedId, mainId, stateOf, showProgress, hrefFor, pickingId, onPick }: AlgListProps) {
  const [showAll, setShowAll] = useState(false)
  const { bySlotCase, notes, videos } = useProgress()
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
  // The main alg always comes first, in its own section; then yours, oldest first; the rest
  // keep the catalog's order.
  const main = algs.find((a) => a.id === mainId)
  const userMain = userAlgs.find((u) => u.id === mainId)
  const others = algs.filter((a) => a.id !== mainId)
  const userOthers = userAlgs.filter((u) => u.id !== mainId)
  const [adding, setAdding] = useState(false)
  /** The placeholder whose moves are being typed in. */
  const [fillingId, setFillingId] = useState<string>()

  // When a star moves a row between sections, it slides from where it was clicked to
  // where it lands (FLIP), then glows, so the eye can follow it.
  const listRef = useRef<HTMLDivElement>(null)
  const flip = useRef<{ id: string; top: number } | null>(null)
  const [movedId, setMovedId] = useState<string>()
  /** The alg whose note box is open (one at a time), and whether it should take focus. */
  const [openNote, setOpenNote] = useState<{ id: string; focus: boolean }>()
  const noteOpenId = openNote?.id
  /** The alg whose video link popover is open (one at a time). */
  const [videoOpenId, setVideoOpenId] = useState<string>()
  // The selected alg, as a ref: a catalog alg or one of yours.
  const selectedCatalog = algs.find((a) => a.id === selectedId)
  const selectedOwn = userAlgs.find((u) => u.id === selectedId)
  const selectedRef = selectedCatalog ? catalogRef(selectedCatalog) : selectedOwn && userRef(selectedOwn)
  // Selecting an alg that has a note shows it, without taking focus (so F/K/N still work).
  // Closing it keeps it closed until the selection changes.
  const selectedHasNote = !!selectedRef && notesOn(notes, selectedRef).length > 0
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
    if (id === selectedId && location.hash !== hrefFor(id)) location.replace(hrefFor(id))
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
  // N = edit its note, V = edit its video link, A = add an alg of your own.
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
    const key = e.key.toLowerCase()
    if (key === SHORTCUTS.add) {
      e.preventDefault()
      setAdding(true)
      return
    }
    if (!selectedRef) return
    const { id } = selectedRef
    const slotCaseId = (selectedCatalog ?? selectedOwn)!.slotCaseId
    if (key === SHORTCUTS.main) {
      e.preventDefault()
      const isMain = id === mainId
      beforeMainToggle(id)
      setMainAlg(slotCaseId, isMain ? null : selectedRef)
    } else if (key === SHORTCUTS.status) {
      e.preventDefault()
      setAlgStatus(slotCaseId, selectedRef, nextAlgStatus(algStateOf(bySlotCase.get(slotCaseId), selectedRef)?.status))
    } else if (key === SHORTCUTS.note) {
      e.preventDefault()
      // Opens (and focuses) the note; if it's already open, just focuses it.
      if (noteOpenId === id) [...(listRef.current?.querySelectorAll<HTMLTextAreaElement>('.alg-note textarea') ?? [])].at(-1)?.focus()
      else setOpenNote({ id, focus: true })
    } else if (key === SHORTCUTS.video) {
      e.preventDefault()
      setVideoOpenId(videoOpenId === id ? undefined : id)
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
    const algNotes = showProgress ? notesOn(notes, catalogRef(a)) : []
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
            alg={catalogRef(a)}
            isMain={a.id === mainId}
            onBeforeToggle={() => beforeMainToggle(a.id)}
          />
          <StatusToggle slotCaseId={a.slotCaseId} alg={catalogRef(a)} status={state?.status ?? null} />
          <NoteToggle
            notes={algNotes}
            open={noteOpen}
            onClick={() => setOpenNote(noteOpen ? undefined : { id: a.id, focus: true })}
          />
          <VideoToggle
            owner={{ alg: catalogRef(a), slotCaseId: a.slotCaseId }}
            video={videos.get(algKey(catalogRef(a)))}
            open={videoOpenId === a.id}
            onOpenChange={(open) => setVideoOpenId(open ? a.id : undefined)}
          />
        </>
      )}
      <a href={hrefFor(a.id)} className="alg-moves" title={a.moves}>
        <AlgMoves alg={a} />
      </a>
      {/* Votes and move count: numbers right-aligned on their digits, so they line up. */}
      <span className="alg-metrics">
        <Picks alg={a} />
        <Votes alg={a} />
        <span className="alg-stm" title={a.stm !== undefined ? 'Move count (STM)' : undefined}>
          <span className="num">{a.stm}</span>
          <span className="unit"> STM</span>
        </span>
      </span>
      <EquivalentToggle on={pickingId === a.id} onClick={() => onPick(a)} />
      </li>,
      // An open note sits right under its alg, across the whole row.
      noteOpen && (
        <li key={`${a.id}-note`} className="alg-note">
          <NotesStrip
            key={a.id}
            owner={{ alg: catalogRef(a), slotCaseId: a.slotCaseId }}
            notes={algNotes}
            autoFocus={!!openNote?.focus}
            onClose={() => setOpenNote(undefined)}
          />
        </li>
      ),
    ]
  }

  /** A row for an alg of yours: like a catalog alg's, without votes or links, and it can be deleted. */
  const userRow = (u: UserAlg) => {
    const ref = userRef(u)
    const owner = { alg: ref, slotCaseId: u.slotCaseId }
    const state = algStateOf(bySlotCase.get(u.slotCaseId), ref)
    const algNotes = notesOn(notes, ref)
    const noteOpen = noteOpenId === u.id
    const placeholder = isPlaceholder(u)
    return [
      <li
        key={u.id}
        data-alg-id={u.id}
        className={['user-alg', placeholder && 'placeholder', u.id === selectedId && 'selected', u.id === mainId && 'main', state?.status].filter(Boolean).join(' ')}
      >
        <MainStar
          slotCaseId={u.slotCaseId}
          alg={ref}
          isMain={u.id === mainId}
          onBeforeToggle={() => beforeMainToggle(u.id)}
        />
        <StatusToggle slotCaseId={u.slotCaseId} alg={ref} status={state?.status ?? null} />
        <NoteToggle notes={algNotes} open={noteOpen} onClick={() => setOpenNote(noteOpen ? undefined : { id: u.id, focus: true })} />
        <VideoToggle
          owner={owner}
          video={videos.get(algKey(ref))}
          open={videoOpenId === u.id}
          onOpenChange={(open) => setVideoOpenId(open ? u.id : undefined)}
        />
        {placeholder ? (
          <span className="alg-moves placeholder-moves">
            <a href={hrefFor(u.id)} title={algNotes[0]?.text}>
              <em>No moves yet</em>
              {algNotes[0] && <span className="placeholder-note"> · {algNotes[0].text}</span>}
            </a>
            <button className="link-button" onClick={() => setFillingId(u.id)} title="Type in its moves; they're checked on the cube">
              Add moves
            </button>
          </span>
        ) : (
          <a href={hrefFor(u.id)} className="alg-moves" title={u.moves}>
            <Notation moves={u.moves} />
          </a>
        )}
        <span className="alg-metrics">
          <span className="alg-picks">
            <span className="pick yours" title="An alg you added">
              YOU
            </span>
          </span>
          <span className="alg-votes" />
          <span className="alg-mirror-votes" />
          <span className="alg-stm" title="Move count (STM)">
            <span className="num">{placeholder ? '–' : u.moves.split(' ').filter((m) => !isRotation(m)).length}</span>
            <span className="unit"> STM</span>
          </span>
        </span>
        <DeleteUserAlg alg={u} />
      </li>,
      fillingId === u.id && (
        <li key={`${u.id}-fill`} className="add-alg-row">
          <AddAlg
            slotCaseId={u.slotCaseId}
            setup={setup}
            taken={[...algs, ...userAlgs]}
            hrefFor={hrefFor}
            onDraft={onDraft}
            fill={u}
            onClose={(id) => {
              setFillingId(undefined)
              if (id) location.hash = hrefFor(id)
            }}
          />
        </li>
      ),
      noteOpen && (
        <li key={`${u.id}-note`} className="alg-note">
          <NotesStrip key={u.id} owner={owner} notes={algNotes} autoFocus={!!openNote?.focus} onClose={() => setOpenNote(undefined)} />
        </li>
      ),
    ]
  }

  return (
    <div
      className="alg-list"
      ref={listRef}
      // The vote columns are as wide as this list's widest counts (2 digits almost always).
      style={{
        ['--vote-chars' as string]: Math.max(...algs.map((a) => String(a.votes ?? 0).length)),
        ['--mirror-vote-chars' as string]: Math.max(...algs.map((a) => String(leftRightMirror(a)?.votes ?? 0).length)),
      }}
    >
      <h3>
        Algorithms ({algs.length})
        {showProgress && (
          <span className="shortcut-hint" title="Keyboard shortcuts for the selected alg">
            <kbd>{SHORTCUTS.main.toUpperCase()}</kbd> main · <kbd>{SHORTCUTS.status.toUpperCase()}</kbd> learning/learnt ·{' '}
            <kbd>{SHORTCUTS.note.toUpperCase()}</kbd> note · <kbd>{SHORTCUTS.video.toUpperCase()}</kbd> video ·{' '}
            <kbd>{SHORTCUTS.equivalent.toUpperCase()}</kbd> go to equivalent · <kbd>{SHORTCUTS.add.toUpperCase()}</kbd> add alg
          </span>
        )}
      </h3>
      {/* Column labels for the numbers at the end of each row (Votes), shaped like a row. */}
      <div className="alg-columns">
        <span className="alg-metrics">
          <span className="alg-picks" title={PICKS_HINT}>
            <span className="col-label">Picks</span>
          </span>
          <span className="alg-votes" title="SpeedCubeDB votes for the alg itself">
            <span className="col-label">Votes</span>
          </span>
          <span
            className="alg-mirror-votes"
            title={'SpeedCubeDB votes for its left-right mirror (the same alg with the other hand). "More popular" counts both'}
          >
            <span className="col-label">Mirror</span>
          </span>
          <span className="alg-stm" />
        </span>
        <span className="alg-columns-end" />
      </div>
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
            ) : userMain ? (
              userRow(userMain)
            ) : (
              <li className="alg-main-empty">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1.03 6L12 17l-5.38 2.85 1.03-6L3.3 9.6l6-.9z" />
                </svg>
                Star an alg to make it your main
              </li>
            )}
          </ol>
          <div className="alg-section-label">
            Your algs
            {!adding && (
              <button
                className="link-button add-alg-button"
                onClick={() => setAdding(true)}
                title={`Type in an alg of your own; it's checked on the cube · ${SHORTCUTS.add.toUpperCase()}`}
              >
                + Add alg
              </button>
            )}
          </div>
          {(userOthers.length > 0 || adding) && (
            <ol className="alg-own">
              {userOthers.map(userRow)}
              {adding && (
                <li className="add-alg-row">
                  <AddAlg
                    slotCaseId={algs[0].slotCaseId}
                    setup={setup}
                    taken={[...algs, ...userAlgs]}
                    hrefFor={hrefFor}
                    onDraft={onDraft}
                    onClose={(id) => {
                      setAdding(false)
                      if (id) location.hash = hrefFor(id)
                    }}
                  />
                </li>
              )}
            </ol>
          )}
          {othersLabel(main || userMain ? 'Other algs' : 'All algs')}
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

/**
 * Typing in an alg of your own. The big cube previews the moves typed so far (onDraft),
 * so you can do it slowly, move by move; below, how far it got: unreadable, how many F2L
 * pieces are still off, solved after an AUF, or solved. Only an alg that solves the case
 * (and isn't in the list yet) can be added. Enter adds, Esc cancels.
 */
function AddAlg({ slotCaseId, setup, taken, hrefFor, onDraft, fill, onClose }: {
  slotCaseId: string
  /** The slot-case's setup (face turns), to check the alg against. */
  setup: string
  /** The slot-case's algs already listed (catalog and yours): adding one again is refused. */
  taken: { id: string; moves: string }[]
  hrefFor: (algId: string) => string
  onDraft: (moves?: string) => void
  /** A placeholder of yours to fill in the moves of, instead of adding a new alg. */
  fill?: UserAlg
  /** Closes the editor; with the alg's id when one was added (or filled in). */
  onClose: (addedId?: string) => void
}) {
  const [text, setText] = useState('')
  const kpuzzle = useKPuzzle()
  const typed = readMoves(text)
  // The cube previews the moves as typed; what's saved (and compared) has redundant turns merged.
  const moves = typed.moves.join(' ')
  const saved = simplifyMoves(typed.moves).join(' ')
  const check: AlgCheck | undefined = kpuzzle && checkAlg(kpuzzle, setup, typed)
  const duplicate = check?.result === 'solves' ? taken.find((a) => a.moves === saved) : undefined
  const tooLong = saved.length > MAX_USER_ALG_LENGTH
  // A first note can go with a new alg; with a note, the moves can wait (a placeholder,
  // filled in later). Moves that are typed must solve the case.
  const [note, setNote] = useState('')
  const noteText = note.trim()
  const noMoves = check?.result === 'empty'
  const solves = check?.result === 'solves' && !duplicate && !tooLong
  const canAdd = fill ? solves : solves || (noMoves && !!noteText && noteText.length <= MAX_NOTE_LENGTH)

  const draft = useEffectEvent((moves?: string) => onDraft(moves))
  useEffect(() => draft(moves), [moves])
  useEffect(() => () => draft(undefined), [])

  const add = () => {
    if (!canAdd) return
    if (fill) {
      fillUserAlg(fill, saved)
      return onClose(fill.id)
    }
    const id = addUserAlg(slotCaseId, noMoves ? '' : saved)
    if (id && noteText)
      saveNote(crypto.randomUUID(), { alg: { kind: 'user', id }, slotCaseId, follows: DEFAULT_FOLLOWS, text: noteText })
    onClose(id)
  }

  let tone: 'good' | 'bad' | '' = ''
  let status: ReactNode
  if (!check) status = 'Loading the cube…'
  else if (tooLong) [tone, status] = ['bad', `Longer than ${MAX_USER_ALG_LENGTH} characters`]
  else if (check.result === 'empty')
    [tone, status] =
      !fill && noteText
        ? ['good', 'No moves yet: added with just the note, fill them in later']
        : ['', fill ? 'Type the moves, spaces optional. The cube follows as you type.' : 'Type the moves (spaces optional; the cube follows), or leave them empty and just write a note.']
  else if (check.result === 'unreadable')
    [tone, status] = [
      'bad',
      <>
        Not a move: <code>{check.text}</code>
      </>,
    ]
  else if (check.result === 'unsolved') status = `Not solved yet: ${check.off} F2L piece${check.off === 1 ? '' : 's'} out of place`
  else if (check.result === 'needsAuf')
    status = (
      <>
        Solves it after a{' '}
        <code>
          <Notation moves={check.auf} />
        </code>{' '}
        first.{' '}
        <button type="button" className="link-button" onClick={() => setText(`${check.auf} ${text.trimStart()}`)}>
          Start with <Notation moves={check.auf} />
        </button>
      </>
    )
  else if (duplicate)
    status = (
      <>
        Solves it, but it's already in the list:{' '}
        <a href={hrefFor(duplicate.id)} onClick={() => onClose()}>
          go to it
        </a>
      </>
    )
  else [tone, status] = ['good', '✓ Solves the case']

  return (
    <form
      className="add-alg"
      onSubmit={(e) => {
        e.preventDefault()
        add()
      }}
    >
      <input
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
        placeholder={fill ? "Its moves, e.g. U R U' R'" : "Your alg, e.g. U R U' R' (or leave empty)"}
        aria-label="Moves of your alg"
        aria-invalid={tone === 'bad'}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
      />
      {!fill && (
        <textarea
          className="add-alg-note"
          value={note}
          rows={2}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Note (optional): where it's from, how to do it…"
          aria-label="A first note on your alg"
        />
      )}
      <div className="add-alg-foot">
        <span className={'add-alg-status' + (tone ? ` ${tone}` : '')} role="status">
          {status}
        </span>
        <span className="add-alg-actions">
          <button type="button" className="link-button" onClick={() => onClose()}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canAdd}
            title={
              canAdd
                ? 'Add it (Enter; Ctrl+Enter in the note)'
                : fill
                  ? 'Only moves that solve the case can be saved'
                  : 'Add moves that solve the case, or leave them empty and write a note'
            }
          >
            {fill ? 'Save moves' : 'Add'}
          </button>
        </span>
      </div>
    </form>
  )
}

/** Deletes an alg of yours, after asking: its notes, status and video link go with it. */
function DeleteUserAlg({ alg }: { alg: UserAlg }) {
  const label = 'Delete this alg of yours'
  return (
    <button
      className="alg-toggle delete-user-alg"
      onClick={() => {
        const what = isPlaceholder(alg) ? 'this alg with no moves yet' : `your alg ${alg.moves}`
        if (confirm(`Delete ${what}? Its notes, status and video link are deleted too.`)) deleteUserAlg(alg)
      }}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
        <path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10.5 10.5v6M13.5 10.5v6" />
      </svg>
    </button>
  )
}

interface AlgToggleProps {
  slotCaseId: string
  alg: AlgRef
}

/** Star: makes this the slot-case's main alg; click again to unset. */
function MainStar({ slotCaseId, alg, isMain, onBeforeToggle }: AlgToggleProps & { isMain: boolean; onBeforeToggle: () => void }) {
  const label = `${isMain ? 'Main alg (click to unset)' : 'Make this my main alg'} · ${SHORTCUTS.main.toUpperCase()} on the selected alg`
  return (
    <button
      className={'alg-toggle alg-star' + (isMain ? ' on' : '')}
      onClick={() => {
        onBeforeToggle()
        setMainAlg(slotCaseId, isMain ? null : alg)
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
  none: 'Mark as want to learn',
  wanted: 'Want to learn (click: mark learning)',
  learning: 'Learning (click: mark learnt)',
  learnt: 'Learnt (click: clear)',
}

/** Status of this alg, independent of which alg is main. Cycles nothing → want to learn → learning → learnt. */
function StatusToggle({ slotCaseId, alg, status }: AlgToggleProps & { status: AlgStatus | null }) {
  const label = `${STATUS_HINT[status ?? 'none']} · ${SHORTCUTS.status.toUpperCase()} on the selected alg`
  return (
    <button
      className={'alg-toggle alg-status' + (status ? ` ${status}` : '')}
      onClick={() => setAlgStatus(slotCaseId, alg, nextAlgStatus(status))}
      aria-label={`${status ? ALG_STATUS_LABEL[status] : 'No status'}. ${label}`}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        {status === 'wanted' && <circle className="dot" cx="12" cy="12" r="3" />}
        {status === 'learning' && <path className="half" d="M12 3.5a8.5 8.5 0 0 0 0 17z" />}
        {status !== 'learning' && status !== 'wanted' && <path d="m8.2 12.3 2.6 2.6 5-5.3" />}
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

/** The link as the server stores it, or undefined if it isn't an http(s) link. */
function normalizeVideoUrl(text: string): string | undefined {
  try {
    const url = new URL(text.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

/**
 * The alg's video link. Filled when it has one; click opens a small popover to open,
 * change or remove it (or paste one). Enter saves, Esc closes.
 */
/** The alg a note or video belongs to, with its slot-case. */
interface AlgOwner {
  alg: AlgRef
  slotCaseId: string
}

function VideoToggle({ owner, video, open, onOpenChange }: {
  owner: AlgOwner
  video?: VideoLink
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, () => onOpenChange(false))
  const label = `${video ? 'Video link' : 'Add a video link'} · ${SHORTCUTS.video.toUpperCase()} on the selected alg`
  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className={'alg-toggle alg-video-toggle' + (video ? ' has-video' : '') + (open ? ' open' : '')}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={label}
        title={video ? `${video.url}\n\n${label}` : label}
      >
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
          <rect className="screen" x="3.5" y="5.5" width="17" height="13" rx="3" />
          <path className="play" d="m10.2 9.4 4.6 2.6-4.6 2.6z" />
        </svg>
      </button>
      {open && <VideoPopover key={video?.url} owner={owner} video={video} onClose={() => onOpenChange(false)} />}
    </div>
  )
}

function VideoPopover({ owner, video, onClose }: { owner: AlgOwner; video?: VideoLink; onClose: () => void }) {
  const [text, setText] = useState(video?.url ?? '')
  const url = normalizeVideoUrl(text)
  const invalid = text.trim() !== '' && !url
  const save = () => {
    if (text.trim() === '') setVideoLink(owner.slotCaseId, owner.alg, null)
    else if (url) setVideoLink(owner.slotCaseId, owner.alg, url)
    else return
    onClose()
  }
  return (
    <form
      className="popover video-popover"
      role="dialog"
      aria-label="Video link"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="popover-title">Video for this alg</div>
      {video && (
        <a className="video-open" href={video.url} target="_blank" rel="noreferrer noopener" title={video.url}>
          Open video ↗
        </a>
      )}
      <input
        type="url"
        value={text}
        autoFocus
        maxLength={MAX_VIDEO_URL_LENGTH}
        placeholder="Paste a link (YouTube, …)"
        aria-label="Video link"
        aria-invalid={invalid}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
      {invalid && <p className="popover-note video-error">Not an http(s) link</p>}
      <div className="video-actions">
        {video && (
          <button
            type="button"
            className="link-button video-remove"
            onClick={() => {
              setVideoLink(owner.slotCaseId, owner.alg, null)
              onClose()
            }}
          >
            Remove
          </button>
        )}
        <button type="submit" className="video-save" disabled={invalid || (url ?? null) === (video?.url ?? null)}>
          Save
        </button>
      </div>
    </form>
  )
}

/** A new note shows only on its own alg; its picker widens it to linked algs. */
const DEFAULT_FOLLOWS: NoteFollows = []

interface NotesStripProps {
  owner: AlgOwner
  /** The notes shown on this alg (notesOn). */
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
function NotesStrip({ owner: own, notes, autoFocus, onClose }: NotesStripProps) {
  const [draftId, setDraftId] = useState(() => crypto.randomUUID())
  // An empty note to type in: shown straight away when the alg has no notes yet, otherwise
  // only after "+" (on the last note's bar).
  const [adding, setAdding] = useState(() => notes.length === 0)
  const [focusDraft, setFocusDraft] = useState(autoFocus)
  const draftSaved = notes.some((n) => n.id === draftId)
  const rows = notes.filter((n) => n.id !== draftId)
  const showDraft = adding || draftSaved
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
          viewSlotCaseId={own.slotCaseId}
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
          viewSlotCaseId={own.slotCaseId}
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

const ownerOf = (n: Note) => ({ alg: n.alg, slotCaseId: n.slotCaseId })

interface NoteRowProps {
  id: string
  /** The alg the note is (or will be) written on. */
  owner: AlgOwner
  note?: Note
  /** The slot-case of the alg being viewed, outlined in the note's map. */
  viewSlotCaseId: string
  /** The empty "add a note" row (until it's saved). */
  draft?: boolean
  autoFocus?: boolean
  /** Shows "+" at the end of the bar, to add another note (on the last note only). */
  onAdd?: () => void
  onBlur?: () => void
  onClose: () => void
}

/**
 * One note: where it shows (FollowsPicker) and its text. Grows with the text, saves a moment after
 * typing stops (never deleting mid-edit), and on blur/close, when empty text deletes it.
 * Keeps its own draft, so saves coming back never disturb what's being typed.
 */
function NoteRow({ id, owner, note, viewSlotCaseId, draft, autoFocus, onAdd, onBlur, onClose }: NoteRowProps) {
  const [text, setText] = useState(note?.text ?? '')
  const [follows, setFollows] = useState<NoteFollows>(note?.follows ?? DEFAULT_FOLLOWS)
  const latest = useRef({ text, follows })
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

  return (
    <div className={'note-row' + (draft && !note ? ' note-draft' : '')}>
      {/* Your own algs have no links, so their notes stay on them. */}
      {owner.alg.kind === 'catalog' && (
        <FollowsPicker
          owner={owner}
          follows={follows}
          viewSlotCaseId={viewSlotCaseId}
          onChange={(next) => {
            setFollows(next)
            latest.current = { ...latest.current, follows: next }
            save(false)
          }}
        />
      )}
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

/**
 * Where a note shows: the link kinds it follows (LinkSetIcon); click to pick them. The
 * popover previews the result on a tiny map of the cluster's family grids (filled =
 * slot-cases where it shows on some alg, outlined = the one being viewed).
 */
function FollowsPicker({ owner, follows, viewSlotCaseId, onChange }: {
  owner: { alg: AlgRef; slotCaseId: string }
  follows: NoteFollows
  viewSlotCaseId: string
  onChange: (next: NoteFollows) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, () => setOpen(false))
  const reach = noteReach(owner.alg, follows)
  const reachedSlotCases = new Set([...reach].map((id) => getAlg(id).slotCaseId))
  const grids = familyGrids(clustersById.get(getCase(getSlotCase(owner.slotCaseId).caseId).clusterId)!)
  const where = reach.size > 1 ? `${reach.size} algs in ${reachedSlotCases.size} slot-cases` : 'just this alg'
  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className={'follows-picker' + (follows.length ? ' on' : '')}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={`Also shows on: ${linkSetSummary(follows, 'nothing else')} (${where}). Click to change`}
        aria-label={`Note shows on ${where}. Change`}
      >
        <LinkSetIcon kinds={follows} />
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Where this note shows">
          <div className="popover-title">Also show this note on</div>
          <LinkKindsPicker value={follows} onChange={onChange} />
          <div className="reach-preview">
            <svg viewBox={`0 0 ${grids.length * 18 - 2} 16`} width={(grids.length * 18 - 2) * 1.5} height="24" aria-hidden>
              {grids.flatMap(({ caseId, cells }, g) =>
                cells.map(({ slotCaseId }, i) => (
                  <rect
                    key={`${caseId}-${i}`}
                    x={g * 18 + (i % 2 ? 9 : 1)}
                    y={i < 2 ? 1 : 9}
                    width="6"
                    height="6"
                    rx="1.5"
                    className={(reachedSlotCases.has(slotCaseId) ? 'on' : 'off') + (slotCaseId === viewSlotCaseId ? ' here' : '')}
                  />
                )),
              )}
            </svg>
            <span>
              Shows on {where}, following these links any number of steps. Mirrors and transposes land on the
              mirror case.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Starts "Go to equivalent" from the alg: then a case picked on the family map leads to its equivalent there. */
function EquivalentToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  const label = `${on ? 'Picking: click a case on the map (click again to cancel)' : 'Go to the equivalent alg in another case or slot'} · ${SHORTCUTS.equivalent.toUpperCase()} on the selected alg`
  return (
    <button className={'alg-toggle equivalent-toggle' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        <path d="M10.5 7h4.5a2.5 2.5 0 0 1 2.5 2.5v1.5m-2-2 2 2 2-2" />
      </svg>
    </button>
  )
}

/**
 * An alg's SpeedCubeDB votes, as two numbers: its own (▲), and its left-right mirror's
 * (the mirror mark), which `popularity` adds in since votes outside front-right are
 * sparse. The mirror column stays (empty) when the catalog has no exact mirror, so rows
 * line up.
 */
function Votes({ alg }: { alg: CatalogAlg }) {
  const mirror = leftRightMirror(alg)
  const mirrorSlot = mirror && SLOT_NAMES[getSlotCase(mirror.slotCaseId).slot].toLowerCase()
  return (
    <>
      <span className="alg-votes" title="SpeedCubeDB votes for this alg">
        ▲<span className="num">{alg.votes ?? 0}</span>
      </span>
      <span
        className="alg-mirror-votes"
        title={mirror ? `SpeedCubeDB votes for its left-right mirror (${mirror.moves}, ${mirrorSlot}). "More popular" counts both` : undefined}
      >
        {mirror && (
          <>
            <LinkSetIcon kinds={['mirrorLR']} only="mirrorLR" size={11} />
            <span className="num">{mirror.votes ?? 0}</span>
          </>
        )}
      </span>
    </>
  )
}

/** Recommendation sheets, as short pill labels (full names in the tooltips). */
const PICK_LABEL: Record<Recommender, string> = { jperm: 'JP', cubeskills: 'CS' }

const PICKS_HINT = (Object.keys(RECOMMENDERS) as Recommender[])
  .map((r) => `${PICK_LABEL[r]}: ${RECOMMENDERS[r].name}'s ${RECOMMENDERS[r].sheet}`)
  .join('\n')
  .concat("\nSolid: the sheet's exact moves for this slot. Outlined: the same alg as the sheet's pick for this slot, in another grip.")
  .concat("\nJ Perm's sheet only covers front right; CubeSkills' covers all four slots.")

/** The sheets recommending the alg for its slot (recommendationsOf): solid as written, outlined in another grip. */
function Picks({ alg }: { alg: CatalogAlg }) {
  return (
    <span className="alg-picks">
      {recommendationsOf(alg).map(({ by, via }) => {
        const { name, sheet } = RECOMMENDERS[by]
        const title = via
          ? `The same alg as ${name}'s pick here, written with another grip: ${via.moves} (${sheet})`
          : `${name}'s pick, exactly as written on ${sheet}${alg.source === by ? '. Not on SpeedCubeDB: from the sheet' : ''}`
        return (
          <span key={by} className={'pick' + (via ? ' via' : '')} title={title}>
            {PICK_LABEL[by]}
          </span>
        )
      })}
    </span>
  )
}

/** Votes as text, for tooltips: "▲16 + 4 on its mirror". */
function votesText(alg: CatalogAlg) {
  const mirror = leftRightMirror(alg)
  return `▲${alg.votes ?? 0}${mirror ? ` + ${mirror.votes ?? 0} on its mirror` : ''}`
}

/** Under the main alg: a clearly more popular alternative, if there is one (see betterAlg). */
function BetterHint({ main, hrefFor }: { main: CatalogAlg; hrefFor: (algId: string) => string }) {
  const better = betterAlg(main)
  if (!better) return null
  return (
    <li className="alg-better">
      <span className="better-mark">↑</span>
      More popular:
      <a href={hrefFor(better.id)} className="alg-better-moves">
        <AlgMoves alg={better} />
      </a>
      <span className="alg-better-votes" title="SpeedCubeDB votes, each alg's own plus its left-right mirror's">
        {votesText(better)} vs {votesText(main)}
      </span>
    </li>
  )
}
