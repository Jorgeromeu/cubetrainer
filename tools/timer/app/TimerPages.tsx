// The timer tool's top-bar crumb (its two pages) and the view picking the page.
import type { ToolProps } from '../../../packages/ui/tool.ts'
import { pageHref, pageOf, type TimerPage } from './route.ts'
import { StatsView } from './Stats.tsx'
import { TimerView } from './TimerView.tsx'

const PAGES: [TimerPage, string][] = [
  ['timer', 'Timer'],
  ['stats', 'Stats'],
]

/** Top bar: the tool's two pages. */
export function TimerCrumb({ path }: ToolProps) {
  const current = pageOf(path)
  return (
    <nav className="crumb">
      <div className="speed timer-pages">
        {PAGES.map(([page, label]) => (
          <a key={page} href={pageHref(page)} className={page === current ? 'active' : undefined} aria-current={page === current ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </div>
    </nav>
  )
}

export function TimerPages({ path }: ToolProps) {
  return pageOf(path) === 'stats' ? <StatsView /> : <TimerView />
}
