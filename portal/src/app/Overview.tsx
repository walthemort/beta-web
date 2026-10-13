import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckSquare, Clock, Layers, MessageCircle, Plus, Receipt, Sparkles, Timer, TrendingUp, Wallet } from 'lucide-react'
import { formatDate, formatHours, formatKr, isComplete, stageColour, stageName, stageProgress, timeAgo, today, useCurrentMember, useStore } from '../data/store'
import { NewProjectModal, StagePill } from './shared'
import { inboxItems, type InboxKind } from './inbox'
import { useT, activeLang, dateLocale } from '../data/i18n'

const KIND_ICON: Record<InboxKind, typeof Clock> = { feedback: MessageCircle, task: CheckSquare, invoice: Receipt, lead: TrendingUp, next: Sparkles }

/** Monday of this week as YYYY-MM-DD. */
const monday = () => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** Home: what needs you, what's waiting on clients, and the projects on the floor – at a glance. */
export default function Overview() {
  const tr = useT()
  const { state } = useStore()
  const me = useCurrentMember()
  const [creating, setCreating] = useState(false)
  const active = state.projects.filter((p) => !p.archived && !isComplete(state, p))
  const outstanding = state.invoices.filter((i) => i.status === 'Issued').reduce((n, i) => n + i.amount, 0)
  const weekStart = monday()
  const hoursThisWeek = state.timeEntries.filter((e) => e.date >= weekStart).reduce((n, e) => n + e.minutes, 0) / 60
  const inbox = inboxItems(state, me)
  // Everything waiting on a client: files and presentations in review, sent proposals, unsigned contracts.
  const project = (id: string) => state.projects.find((p) => p.id === id)
  const awaiting = [
    ...state.files.filter((f) => f.status === 'In review').map((f) => ({ id: f.id, title: f.name, what: 'Review', projectId: f.projectId, to: `/app/projects/${f.projectId}/files/${f.id}` })),
    ...state.decks.filter((d) => d.status === 'In review').map((d) => ({ id: d.id, title: d.title, what: 'Review', projectId: d.projectId, to: `/app/projects/${d.projectId}/presentations/${d.id}` })),
    ...state.proposals.filter((p) => p.status === 'Sent').map((p) => ({ id: p.id, title: p.title, what: 'Proposal', projectId: p.projectId, to: `/app/projects/${p.projectId}/proposal` })),
    ...state.contracts.filter((c) => c.status === 'Sent').map((c) => ({ id: c.id, title: c.title, what: 'Signature', projectId: c.projectId, to: `/app/projects/${c.projectId}/contract` })),
  ].filter((x) => !project(x.projectId)?.archived)

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const todayLabel = new Date().toLocaleDateString(dateLocale(activeLang()), { weekday: 'long', day: 'numeric', month: 'long' })

  const stats = [
    { label: 'Active projects', value: String(active.length), hint: 'From first idea to final file', icon: Layers, to: '/app/projects' },
    { label: 'Awaiting clients', value: String(awaiting.length), hint: 'Reviews, proposals & signatures', icon: Clock, to: '/app/documents' },
    { label: 'Outstanding', value: formatKr(outstanding), hint: 'Issued, not yet paid', icon: Wallet, to: '/app/invoices' },
    { label: 'Hours this week', value: formatHours(hoursThisWeek), hint: 'Logged by the whole team', icon: Timer, to: '/app/capacity' },
  ]

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{todayLabel}</span>
          <h1>{tr(greeting)}, {me.name.split(' ')[0]}.</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> {tr('New project')}
        </button>
      </div>

      <div className="card stats">
        {stats.map(({ label, value, hint, icon: Icon, to }) => (
          <Link key={label} to={to} className="stat">
            <span className="stat-top">{tr(label)} <Icon size={15} strokeWidth={1.5} /></span>
            <b className={value.length > 6 ? 'stat-long' : undefined}>{value}</b>
            <small>{tr(hint)}</small>
          </Link>
        ))}
      </div>

      <div className="split">
        <section className="card panel">
          <div>
            <span className="eyebrow">{tr('Needs you')}</span>
            <h3>{tr('Inbox')} {inbox.length > 0 && <span className="tab-badge">{inbox.length}</span>}</h3>
          </div>
          <div className="list">
            {inbox.length === 0 && <p className="muted">{tr('Inbox zero. Go make something good.')}</p>}
            {inbox.slice(0, 10).map((x) => {
              const Icon = KIND_ICON[x.kind]
              return (
                <Link key={x.id} to={x.to} className="list-item">
                  <span className={'inbox-icon inbox-' + x.kind}><Icon size={14} /></span>
                  <span className="grow">
                    <span>{tr(x.title, x.vars)}</span>
                    <small>{tr(x.detail, x.vars)}{x.projectId && (x.kind === 'feedback' || x.kind === 'task') ? ` · ${project(x.projectId)?.name ?? ''}` : ''}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              )
            })}
            {inbox.length > 10 && <p className="muted" style={{ fontSize: 13 }}>{tr('+ {n} more', { n: inbox.length - 10 })}</p>}
          </div>
        </section>
        <section className="card panel">
          <div>
            <span className="eyebrow">{tr('Ball is in their court')}</span>
            <h3>{tr('Waiting on clients')}</h3>
          </div>
          <div className="list">
            {awaiting.length === 0 && <p className="muted">{tr('Nothing out with clients right now.')}</p>}
            {awaiting.slice(0, 8).map((x) => (
              <Link key={x.id} to={x.to} className="list-item">
                <span className="grow">
                  <span>{x.title}</span>
                  <small>{tr(x.what)} · {project(x.projectId)?.name}</small>
                </span>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section>
        <div className="section-head">
          <h2>{tr('On the studio floor')} <span className="count">{active.length}</span></h2>
          <Link to="/app/projects" className="link-arrow">{tr('All projects')} <ArrowUpRight size={14} /></Link>
        </div>
        {active.length ? (
          <div className="card floor">
            {active.map((p) => {
              const c = state.clients.find((x) => x.id === p.clientId)
              const open = p.tasks.filter((t) => !t.done)
              const late = p.due && p.due < today()
              return (
                <Link key={p.id} to={`/app/projects/${p.id}`} className="floor-row">
                  <span className="floor-swatch" style={{ background: p.cover.bg, color: p.cover.fg }}>{p.cover.wordmark.slice(0, 2)}</span>
                  <span className="cell-title grow">
                    <b style={{ fontWeight: 500 }}>{p.name}</b>
                    <small>{c?.name} · {open.length === 1 ? tr('1 open task') : tr('{n} open tasks', { n: open.length })}</small>
                  </span>
                  <span className="floor-stage">
                    <StagePill stage={p.stage} project={p} />
                    <span className="progress" title={tr(stageName(state, p.stage, p))}>
                      <span style={{ width: stageProgress(p, state) + '%', background: stageColour(state, p.stage, p) }} />
                    </span>
                  </span>
                  <small className={late ? 'error' : 'muted'} style={{ minWidth: 60, textAlign: 'right' }}>{p.due ? formatDate(p.due) : tr('No due date')}</small>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="empty">
            <p>{tr('No active projects yet.')}</p>
            <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> {tr('Start your first project')}</button>
          </div>
        )}
      </section>

      <section className="card panel">
        <div>
          <span className="eyebrow">{tr('Recent activity')}</span>
          <h3>{tr('Around the studio')}</h3>
        </div>
        <div className="list">
          {[...state.activity].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6).map((a) => {
            const p = state.projects.find((x) => x.id === a.projectId)
            return (
              <div key={a.id} className="list-item">
                {a.fromClient && <span className="avatar client" title={tr('From the client')}>C</span>}
                <span className="grow">
                  <span>{a.text}</span>
                  <small>{p?.name ?? tr('Studio')} · {timeAgo(a.at)}</small>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </>
  )
}
