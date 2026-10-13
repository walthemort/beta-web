import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { StatusPill } from '../components/kit'
import { formatDate, formatKr, proposalScope, proposalTotals, useStore } from '../data/store'
import { projectVatRate } from '../data/vat'
import type { ReviewStatus } from '../data/types'
import { Thumb } from '../features/files'
import { discoveryStatus } from '../features/discovery'
import { useT } from '../data/i18n'

function Head({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
    </div>
  )
}

const FILTERS: (ReviewStatus | 'All')[] = ['All', 'In review', 'Changes requested', 'Approved', 'Not shared']

function FileList() {
  const tr = useT()
  const { state } = useStore()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const files = state.files
    .filter((f) => filter === 'All' || f.status === filter)
    .sort((a, b) => (b.versions.at(-1)!.createdAt).localeCompare(a.versions.at(-1)!.createdAt))
  return (
    <>
      <div className="seg" role="group" aria-label={tr('Filter by status')} style={{ justifySelf: 'start', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {tr(f)} <span className="muted">{f === 'All' ? state.files.length : state.files.filter((x) => x.status === f).length}</span>
          </button>
        ))}
      </div>
      {files.length === 0 ? (
        <div className="empty"><p>{tr('No files here.')}</p></div>
      ) : (
        <div className="card">
          {files.map((f) => {
            const p = state.projects.find((x) => x.id === f.projectId)
            const open = f.comments.filter((c) => c.fromClient && !c.resolved).length
            return (
              <Link key={f.id} to={`/app/projects/${f.projectId}/files/${f.id}`} className="file-row">
                <Thumb file={f} size={48} />
                <span className="cell-title" style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{f.name}</b>
                  <small>{p?.name} {tr('· Version')} {f.versions.length} · {formatDate(f.versions.at(-1)!.createdAt)}</small>
                </span>
                {open > 0 && <span className="pill pill-blue"><MessageCircle size={12} /> {open}</span>}
                <StatusPill status={f.status} />
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

/**
 * Every client-facing document in one place: one row per project, one column per step, so you
 * can see where each project stands and what is waiting on whom. The file review list sits beside it.
 */
export function DocumentsPage() {
  const tr = useT()
  const { state } = useStore()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'files' ? 'files' : 'steps'
  const setView = (v: string) => setParams(v === 'steps' ? {} : { view: v }, { replace: true })
  const needsReview = state.files.filter((f) => f.status === 'Changes requested' || f.comments.some((c) => c.fromClient && !c.resolved)).length
  return (
    <>
      <Head eyebrow={tr('The process')} title={tr('Documents & review')} sub={tr('Questionnaires, proposals, contracts and files for every project. Writing happens inside each project.')} />
      <div className="seg" role="group" aria-label={tr('View')} style={{ justifySelf: 'start' }}>
        <button aria-pressed={view === 'steps'} onClick={() => setView('steps')}>{tr('Where each project stands')}</button>
        <button aria-pressed={view === 'files'} onClick={() => setView('files')}>{tr('Files & review')} {needsReview > 0 && <span className="tab-badge">{needsReview}</span>}</button>
      </div>
      {view === 'files' ? <FileList /> : <StepMatrix />}
    </>
  )
}

function StepMatrix() {
  const tr = useT()
  const { state } = useStore()
  const projects = state.projects.filter((p) => !p.archived)
  if (!projects.length) return <div className="empty"><p>{tr('Documents live inside projects. Create a project to get started.')}</p><Link to="/app/projects?new=1" className="btn">{tr('New project')}</Link></div>
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table className="table stack">
        <thead><tr><th>{tr('Project')}</th><th>{tr('Discovery')}</th><th>{tr('Proposal')}</th><th>{tr('Contract')}</th><th>{tr('Files')}</th></tr></thead>
        <tbody>
          {projects.map((p) => {
            const pr = state.proposals.find((x) => x.projectId === p.id)
            const c = state.contracts.find((x) => x.projectId === p.id)
            const files = state.files.filter((f) => f.projectId === p.id)
            const answered = p.discovery.questions.filter((q) => q.a.trim()).length
            const base = `/app/projects/${p.id}`
            return (
              <tr key={p.id}>
                <td className="wide"><Link to={base} className="cell-title"><b style={{ fontWeight: 500 }}>{p.name}</b><small>{state.clients.find((x) => x.id === p.clientId)?.name}</small></Link></td>
                <td data-label={tr('Discovery')}>
                  <Link to={`${base}/discovery`} className="cell-title step-cell"><StatusPill status={discoveryStatus(p)} /><small>{answered} {tr('of')} {p.discovery.questions.length} {tr('answered')}</small></Link>
                </td>
                <td data-label={tr('Proposal')}>
                  <Link to={`${base}/proposal`} className="cell-title step-cell"><StatusPill status={pr?.status ?? 'Not started'} />{pr && <small>{formatKr(proposalTotals(proposalScope(pr), projectVatRate(state, p.id)).total)}</small>}</Link>
                </td>
                <td data-label={tr('Contract')}>
                  <Link to={`${base}/contract`} className="cell-title step-cell"><StatusPill status={c?.status ?? 'Not started'} />{c?.signedBy && <small>{c.signedBy}, {formatDate(c.signedAt)}</small>}</Link>
                </td>
                <td data-label={tr('Files')}>
                  <Link to={`${base}/files`} className="cell-title step-cell">
                    <span>{files.filter((f) => f.status === 'Approved').length}/{files.length} {tr('approved')}</span>
                    {files.some((f) => f.status === 'Changes requested') && <small className="error">{tr('Changes requested')}</small>}
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
