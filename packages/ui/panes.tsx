// The app's layout primitives (openspec/specs/library/design): a Workspace fills the page under
// the top bar with Panes side by side, split by hairlines. A Pane has a thin header bar (title,
// a note, small actions) over a scrolling body. Lists in a pane use PaneGroup (an uppercase
// heading) and PaneRow (a dense, selectable row).
import type { ReactNode } from 'react'

/** Fills the page under the top bar, edge to edge; its children are Panes. */
export function Workspace({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={'workspace' + (className ? ` ${className}` : '')}>{children}</div>
}

export function Pane({
  title,
  note,
  actions,
  width,
  children,
  className,
}: {
  title: ReactNode
  /** Quieter text after the title. */
  note?: ReactNode
  /** Small buttons at the right of the header (PaneButton). */
  actions?: ReactNode
  /** A fixed width in px; without one the pane takes the room left. */
  width?: number
  children: ReactNode
  className?: string
}) {
  return (
    <section className={'pane' + (className ? ` ${className}` : '')} style={width ? { flex: `0 0 ${width}px` } : undefined}>
      <header className="pane-head">
        <span className="pane-title">{title}</span>
        {note && <span className="pane-note">{note}</span>}
        {actions && <span className="pane-actions">{actions}</span>}
      </header>
      <div className="pane-body">{children}</div>
    </section>
  )
}

/** A small icon button for a pane header. */
export function PaneButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className="pane-button" onClick={onClick} title={label} aria-label={label}>
      {children}
    </button>
  )
}

/** A group in a pane's list, under an uppercase heading. */
export function PaneGroup({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div className="pane-group">
      <h2 className="pane-group-head">
        {title}
        {count !== undefined && <span className="pane-count">{count}</span>}
      </h2>
      {children}
    </div>
  )
}

/** A row in a pane's list: a link (`href`) or a button (`onClick`), marked when it's the one shown. */
export function PaneRow({ href, onClick, current, children }: { href?: string; onClick?: () => void; current?: boolean; children: ReactNode }) {
  const className = 'pane-row' + (current ? ' current' : '')
  return href ? (
    <a href={href} className={className} aria-current={current ? 'page' : undefined}>
      {children}
    </a>
  ) : (
    <button className={className} onClick={onClick} aria-current={current ? 'true' : undefined}>
      {children}
    </button>
  )
}
