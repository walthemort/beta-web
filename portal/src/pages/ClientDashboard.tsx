import { BrandMark } from '../app/Plan'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Logo, ProjectCover } from '../components/ui'
import { LangProvider, LangSwitch, useT } from '../data/i18n'
import { isOverdue, stageName, useStore } from '../data/store'
import type { Project } from '../data/types'
import { StudioBrand, useBranded } from './ClientPortal'
import '../app/app.css'
import './landing.css'
import './portal.css'

/** Everything waiting for the client in one project (same rules as the portal's "Waiting for you"). */
function useTodoCount() {
  const { state } = useStore()
  return (p: Project) =>
    (p.discovery.sentAt && !p.discovery.submittedAt ? 1 : 0) +
    state.proposals.filter((x) => x.projectId === p.id && x.status === 'Sent').length +
    state.contracts.filter((x) => x.projectId === p.id && x.status === 'Sent').length +
    state.decks.filter((x) => x.projectId === p.id && x.status === 'In review').length +
    state.choices.filter((x) => x.projectId === p.id && x.status === 'Open').length +
    state.files.filter((x) => x.projectId === p.id && x.status === 'In review' && x.uploadedBy !== 'client').length +
    state.invoices.filter((x) => x.projectId === p.id && isOverdue(x)).length
}

/** One link per client, across all their projects (#45). */
export default function ClientDashboard() {
  const { cid } = useParams()
  const { state } = useStore()
  const client = state.clients.find((c) => c.id === cid)
  return (
    <LangProvider initial={client?.language ?? 'en'}>
      <Dashboard />
    </LangProvider>
  )
}

function Dashboard() {
  const { cid } = useParams()
  const { state } = useStore()
  const t = useT()
  const todo = useTodoCount()
  const branded = useBranded()
  const client = state.clients.find((c) => c.id === cid)
  const projects = state.projects.filter((p) => p.clientId === cid && !p.archived)

  useEffect(() => {
    // The studio's name, not ours: this page belongs to their client, not to Aftryk.
    document.title = client ? `${client.name} — ${state.studio.name}` : state.studio.name
  }, [client, state.studio.name])

  if (!client)
    return (
      <div className="landing portal">
        <header className="l-header"><Link to="/"><Logo /></Link></header>
        <main className="portal-main"><h1>{t('Link not found.')}</h1><p className="muted">{t('Ask your studio for a new link.')}</p></main>
      </div>
    )

  const first = client.contactName.split(' ')[0]
  return (
    <div className={'cp ' + branded.className} style={branded.style}>
      <header className="cp-head">
        <span className="cp-brand"><StudioBrand /> <span className="muted">×</span> <b>{client.name}</b></span>
        <LangSwitch />
      </header>
      <main className="cp-main">
        <div>
          <span className="eyebrow">{t('Your projects')}</span>
          <h1 className="cp-h1">{t('Hi')}{first ? ` ${first}` : ''}.</h1>
        </div>
        {projects.length === 0 && <div className="empty"><p>{t('No updates yet.')}</p></div>}
        <div className="grid-cards">
          {projects.map((p) => {
            const n = todo(p)
            return (
              <Link key={p.id} to={`/p/${p.id}`} className="card pcard">
                <ProjectCover project={p} height={170} />
                <div className="pcard-body">
                  <div className="pcard-title"><b>{p.name}</b><span className="pill">{t(stageName(state, p.stage, p))}</span></div>
                  <span className={n ? '' : 'muted'} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {n > 0 && <span className="tab-badge">{n}</span>}
                    {n > 0 ? t('Waiting for you') : t('Nothing right now. We’ll let you know when there’s something to look at.')}
                    <ArrowRight size={14} style={{ marginLeft: 'auto' }} />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
      <footer className="l-footer cp-foot">
        <span>{t('Shared by')} {state.studio.name} · {state.studio.email}</span>
        <BrandMark />
      </footer>
    </div>
  )
}
