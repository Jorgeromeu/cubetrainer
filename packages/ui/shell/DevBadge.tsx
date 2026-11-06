// The top bar's branch badge: which branch this app runs on and whose data it uses, so two
// checkouts open side by side can't be mixed up. Hidden on main with main's data.
import { isPlainMain } from '../../core/devInfo.ts'
import { branchColour, useDevInfo } from './devInfo.ts'

const day = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function DevBadge() {
  const info = useDevInfo()
  if (!info?.branch || isPlainMain(info)) return null
  const branch = info.branch
  const own = info.dataDir !== info.mainDataDir
  const title = [
    `Branch ${branch}`,
    info.checkout === 'worktree' ? `Worktree ${info.root}` : `Main checkout ${info.root}`,
    `Data ${info.dataDir}${own ? '' : ' (your real data)'}`,
    info.copiedAt && `Copied from main ${day(info.copiedAt)}`,
    own && (info.unpushed ? `${info.unpushed} row(s) main doesn't have: npm run data:push after merging` : 'Nothing main doesn\'t have'),
    `Server :${info.serverPort}`,
  ]
    .filter(Boolean)
    .join('\n')
  return (
    <span className="dev-badge" style={{ ['--branch' as string]: branchColour(branch) }} title={title}>
      <span className="dev-badge-dot" aria-hidden />
      {branch}
      <span className="dev-badge-data">
        {own ? 'own data' : 'main data'}
        {own && info.unpushed > 0 && ` · ${info.unpushed} unpushed`}
      </span>
    </span>
  )
}
