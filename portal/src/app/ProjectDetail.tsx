import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Archive, ArrowLeft, ArrowUpRight, Check, Copy, Lock, Mail, MoreHorizontal, Palette, Pencil, Plus, Printer, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import { Modal, ProjectCover, useConfirm } from '../components/ui'
import { useUndo } from '../components/Undo'
import { CopyLink, StatusPill, AutoText } from '../components/kit'
import { formatDate, formatKr, isOverdue, stageLabel, stageProgress, stagesOf, taskCount, uid, useStore, workflowOf } from '../data/store'
import { SERVICES, type Member, type Project, type Service } from '../data/types'
import { duplicateProject } from '../data/templates'
import { useSrc } from '../data/blobs'
import { NewInvoiceModal } from './Invoices'
import { MemberAvatar } from './shared'
import { FileReview, ProjectFiles } from '../features/files'
import { ProjectProposal, clientUrl } from '../features/proposals'
import { ProjectContract } from '../features/contracts'
import { ProjectDiscovery, discoveryStatus } from '../features/discovery'
import { HubEditor } from '../features/hub'
import { DeckReview, ProjectDecks } from '../features/decks'
import { ProjectChoices } from '../features/choices'
import { ProjectFinancePanel, ProjectTime } from '../features/time'
import { FeedbackSummary } from '../features/feedback'
import { ProjectExpenses } from '../features/expenses'
import { RetainerPanel } from '../features/retainer'
import { HandoverEditor } from '../features/handover'
import { ClientUpdateModal } from '../features/clientUpdate'
import { useT } from '../data/i18n'

/**
 * A project's pages grouped into the phases of the work: win it, create it, deliver it.
 * A phase gets a tick once its last step is done, so the bar doubles as a progress view.
 */
const PHASES = [
  { key: 'overview', label: 'Overview', tabs: ['overview'] },
  { key: 'win', label: 'Win', n: 1, tabs: ['discovery', 'proposal', 'contract'] },
  { key: 'create', label: 'Create', n: 2, tabs: ['presentations', 'routes', 'files'] },
  { key: 'deliver', label: 'Deliver', n: 3, tabs: ['hub', 'handover'] },
  { key: 'money', label: 'Money & time', tabs: ['money', 'invoices'] },
] as const

const TAB_LABEL: Record<string, string> = {
  discovery: 'Discovery', proposal: 'Proposal', contract: 'Contract',
  presentations: 'Presentations', routes: 'Pick a route', files: 'Files',
  hub: 'Brand hub', handover: 'Handover',
}

function PhaseNav({ project, tab, deckComments, fileComments }: { project: Project; tab: string; deckComments: number; fileComments: number }) {
  const tr = useT()
  const { state } = useStore()
  const base = `/app/projects/${project.id}`
  const files = state.files.filter((f) => f.projectId === project.id && f.uploadedBy !== 'client')
  const done: Record<string, boolean> = {
    win: state.contracts.some((c) => c.projectId === project.id && c.status === 'Signed'),
    create: files.length > 0 && files.every((f) => f.status === 'Approved'),
    deliver: !!project.handover?.sharedAt,
  }
  const badges: Record<string, number> = { presentations: deckComments, files: fileComments }
  const current = PHASES.find((p) => (p.tabs as readonly string[]).includes(tab)) ?? PHASES[0]
  const to = (t: string) => (t === 'overview' ? base : `${base}/${t}`)
  return (
    <>
      <nav className="phases" aria-label={tr('Project phases')}>
        {PHASES.map((p) => {
          const badge = p.tabs.reduce((n, t) => n + (badges[t] ?? 0), 0)
          return (
            <Link key={p.key} to={to(p.tabs[0])} replace className={'phase' + (p === current ? ' active' : '') + (done[p.key] ? ' done' : '')} aria-current={p === current ? 'page' : undefined}>
              {'n' in p && <span className="phase-n">{done[p.key] ? <Check size={11} strokeWidth={3} /> : p.n}</span>}
              {tr(p.label)}
              {badge > 0 && <span className="tab-badge">{badge}</span>}
            </Link>
          )
        })}
      </nav>
      {current.tabs.length > 1 && current.key !== 'money' && (
        <nav className="subtabs" aria-label={tr('Sections')}>
          {current.tabs.map((t) => (
            <Link key={t} to={to(t)} replace className={'subtab' + (t === tab ? ' active' : '')} aria-current={t === tab ? 'page' : undefined}>
              {tr(TAB_LABEL[t])}
              {(badges[t] ?? 0) > 0 && <span className="tab-badge">{badges[t]}</span>}
            </Link>
          ))}
        </nav>
      )}
    </>
  )
}

/** Less-used project actions behind one button. */
function MoreMenu({ children }: { children: React.ReactNode }) {
  const tr = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="more" ref={ref} onClick={(e) => (e.target as HTMLElement).closest('.menu-item') && setOpen(false)}>
      <button className="btn btn-icon" aria-label={tr('More actions')} aria-expanded={open} onClick={() => setOpen(!open)}><MoreHorizontal size={16} /></button>
      {open && <div className="menu card" role="menu">{children}</div>}
    </div>
  )
}

export default function ProjectDetail() {
  const tr = useT()
  const { id, tab = 'overview', fileId, deckId } = useParams()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [caseStudy, setCaseStudy] = useState(false)
  // "?update=1" (from the inbox) opens the client update straight away.
  const [params, setParams] = useSearchParams()
  const [updating, setUpdating] = useState(() => params.get('update') === '1')
  useEffect(() => {
    if (params.get('update')) setParams({}, { replace: true })
  }, [params, setParams])

  const project = state.projects.find((p) => p.id === id)
  if (!project)
    return (
      <div className="empty">
        <p>{tr('This project doesn’t exist any more.')}</p>
        <Link to="/app/projects" className="btn">{tr('Back to projects')}</Link>
      </div>
    )

  const client = state.clients.find((c) => c.id === project.clientId)
  const unresolved = (list: { comments: { fromClient: boolean; resolved?: boolean }[] }[]) =>
    list.reduce((n, x) => n + x.comments.filter((c) => c.fromClient && !c.resolved).length, 0)
  const deckComments = unresolved(state.decks.filter((d) => d.projectId === project.id))
  const fileComments = unresolved(state.files.filter((f) => f.projectId === project.id))
  const base = `/app/projects/${project.id}`

  if (deckId)
    return (
      <>
        <Link to={`${base}/presentations`} className="link-arrow"><ArrowLeft size={14} /> {project.name} {tr('/ Presentations')}</Link>
        <DeckReview deckId={deckId} mode="studio" />
      </>
    )

  if (fileId)
    return (
      <>
        <Link to={`${base}/files`} className="link-arrow"><ArrowLeft size={14} /> {project.name} {tr('/ Files')}</Link>
        <FileReview fileId={fileId} mode="studio" />
      </>
    )

  function duplicate() {
    const { project: copy, proposal } = duplicateProject(state, project!)
    dispatch({ type: 'addProject', project: copy })
    if (proposal) dispatch({ type: 'insert', coll: 'proposals', item: proposal })
    navigate(`/app/projects/${copy.id}`)
  }

  return (
    <>
      {project.archived && (
        <div className="banner">
          <Archive size={15} /> {tr('This project is archived. It’s hidden from your lists but nothing is deleted.')}
          <button className="btn btn-sm" onClick={() => dispatch({ type: 'updateProject', id: project.id, patch: { archived: false } })}>{tr('Restore')}</button>
        </div>
      )}
      <div className="page-head">
        <div>
          <span className="eyebrow">{client?.name}{project.sample && tr(' / Sample project')}</span>
          <h1>{project.name}</h1>
          {project.description && <p className="muted">{project.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setEditing(true)}><Pencil size={15} /> {tr('Edit')}</button>
          <Link className="btn" to={`${base}/hub`}><Palette size={15} /> {tr('Brand hub')}</Link>
          <button className="btn" onClick={() => setUpdating(true)} title={tr('Write this week’s status email to the client')}><Mail size={15} /> {tr('Client update')}</button>
          <Link className="btn" to={`/p/${project.id}`} target="_blank">{tr('Client portal')} <ArrowUpRight size={15} /></Link>
          <MoreMenu>
            <button className="menu-item" onClick={duplicate} title={tr('Copy tasks, questionnaire, hub setup and proposal into a new project')}><Copy size={15} /> {tr('Duplicate')}</button>
            <button className="menu-item" onClick={() => setCaseStudy(true)}><Sparkles size={15} /> {tr('Case study')}</button>
            {!project.archived && (
              <button className="menu-item" onClick={() => dispatch({ type: 'updateProject', id: project.id, patch: { archived: true }, log: { text: 'Project archived', projectId: project.id } })}>
                <Archive size={15} /> {tr('Archive')}
              </button>
            )}
          </MoreMenu>
        </div>
      </div>

      <PhaseNav project={project} tab={tab} deckComments={deckComments} fileComments={fileComments} />

      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'discovery' && <ProjectDiscovery project={project} />}
      {tab === 'presentations' && <ProjectDecks project={project} />}
      {tab === 'routes' && <ProjectChoices project={project} />}
      {tab === 'proposal' && <ProjectProposal project={project} />}
      {tab === 'contract' && <ProjectContract project={project} />}
      {tab === 'files' && <ProjectFiles projectId={project.id} />}
      {tab === 'hub' && <HubEditor project={project} />}
      {tab === 'handover' && <HandoverEditor project={project} />}
      {(tab === 'money' || tab === 'invoices') && <MoneyTab project={project} />}

      {editing && <EditProjectModal project={project} onClose={() => setEditing(false)} />}
      {caseStudy && <CaseStudyModal project={project} onClose={() => setCaseStudy(false)} />}
      {updating && <ClientUpdateModal project={project} onClose={() => setUpdating(false)} />}
    </>
  )
}

/** One status for a group of reviewable items (files or presentations). */
function combinedStatus(items: { status: string }[]) {
  if (!items.length) return 'Not started'
  if (items.some((i) => i.status === 'Changes requested')) return 'Changes requested'
  if (items.some((i) => i.status === 'In review')) return 'In review'
  return items.every((i) => i.status === 'Approved') ? 'Approved' : 'Not shared'
}

function OverviewTab({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const navigate = useNavigate()
  const { confirm, confirmNode } = useConfirm()
  const [taskTitle, setTaskTitle] = useState('')
  const client = state.clients.find((c) => c.id === project.clientId)
  const base = `/app/projects/${project.id}`
  const files = state.files.filter((f) => f.projectId === project.id)
  const decks = state.decks.filter((d) => d.projectId === project.id)
  const proposal = state.proposals.find((p) => p.projectId === project.id)
  const contract = state.contracts.find((c) => c.projectId === project.id)
  const choice = state.choices.find((c) => c.projectId === project.id)
  const members = project.memberIds.map((id) => state.team.find((m) => m.id === id)).filter(Boolean) as Member[]

  function addTask(e: FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim()) return
    dispatch({ type: 'addTask', projectId: project.id, task: { id: uid(), title: taskTitle.trim(), done: false, assigneeId: members[0]?.id } })
    setTaskTitle('')
  }

  // The project's journey, one row per step, each linking to its tab.
  const journey = [
    { label: 'Discovery questionnaire', status: discoveryStatus(project), to: `${base}/discovery` },
    { label: 'Presentations', status: combinedStatus(decks), to: `${base}/presentations` },
    { label: 'Pick a route', status: choice ? (choice.status === 'Decided' ? 'Approved' : choice.status === 'Open' ? 'In review' : 'Draft') : 'Not started', to: `${base}/routes` },
    { label: 'Proposal', status: proposal?.status ?? 'Not started', to: `${base}/proposal` },
    { label: 'Contract', status: contract?.status ?? 'Not started', to: `${base}/contract` },
    { label: 'Files in review', status: combinedStatus(files.filter((f) => f.uploadedBy !== 'client')), to: `${base}/files` },
  ]

  return (
    <>
      <section className="card phero">
        <ProjectCover project={project} height={150} />
        <div className="phero-body">
          <div className="stepper" role="group" aria-label={tr('Project stage')}>
            {stagesOf(state, project).map(({ id, name: s, colour }, i) => (
              <button
                key={id}
                style={i === project.stage ? { borderColor: colour, color: colour, background: `color-mix(in srgb, ${colour} 10%, var(--surface))` } : undefined}
                className={'step' + (i < project.stage ? ' done' : i === project.stage ? ' current' : '')}
                aria-current={i === project.stage ? 'step' : undefined}
                onClick={() => dispatch({ type: 'setStage', id: project.id, stage: i })}
                title={tr('Move to {s}', { s: tr(s) })}
              >
                <small>{i < project.stage ? <Check size={11} /> : String(i + 1).padStart(2, '0')}</small>
                {tr(s)}
              </button>
            ))}
          </div>
          <div className="kv">
            <div><small>{tr('Client')}</small>{client?.name ?? '—'}</div>
            <div><small>{tr('Dates')}</small>{formatDate(project.startDate)} → {formatDate(project.due)}</div>
            <div><small>{tr('Revision rounds')}</small>{project.roundsIncluded} {tr('included')}</div>
            <div><small>{tr('Progress')}</small>{stageProgress(project, state)}% <span className="muted" style={{ fontSize: 12 }}>{stageLabel(project, state)}</span></div>
          </div>
        </div>
      </section>

      <div className="split">
        <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
          <section className="card panel">
            <div className="section-head" style={{ margin: 0 }}>
              <h3>{tr('Next steps')}</h3>
              <span className="count">{taskCount(project)}</span>
            </div>
            <div>
              {project.tasks.length === 0 && <p className="muted" style={{ fontSize: 14 }}>{tr('No tasks yet. Add the first one below.')}</p>}
              {project.tasks.map((t) => {
                const late = !t.done && t.due && t.due < new Date().toISOString().slice(0, 10)
                return (
                  <div key={t.id} className={'task' + (t.done ? ' done' : '')}>
                    <input
                      type="checkbox"
                      checked={t.done}
                      aria-label={tr('Done: {title}', { title: t.title })}
                      onChange={() => dispatch({ type: 'toggleTask', projectId: project.id, taskId: t.id })}
                    />
                    <span className="grow">{t.title}</span>
                    <label className="task-who" title={state.team.find((m) => m.id === t.assigneeId)?.name ?? tr('Assign someone')}>
                      {t.assigneeId && state.team.some((m) => m.id === t.assigneeId) ? (
                        <MemberAvatar member={state.team.find((m) => m.id === t.assigneeId)} size={24} />
                      ) : (
                        <span className="avatar task-nobody">+</span>
                      )}
                      <select
                        value={t.assigneeId ?? ''}
                        aria-label={tr('Who does “{title}”', { title: t.title })}
                        onChange={(e) => dispatch({ type: 'updateTask', projectId: project.id, taskId: t.id, patch: { assigneeId: e.target.value || undefined } })}
                      >
                        <option value="">{tr('Nobody')}</option>
                        {state.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </label>
                    <input
                      type="date"
                      className={'task-date' + (late ? ' late' : '')}
                      value={t.due ?? ''}
                      aria-label={tr('Due date for “{title}”', { title: t.title })}
                      onChange={(e) => dispatch({ type: 'updateTask', projectId: project.id, taskId: t.id, patch: { due: e.target.value || undefined } })}
                    />
                    <button
                      className="btn btn-ghost btn-icon del"
                      aria-label={tr('Delete task: {title}', { title: t.title })}
                      onClick={() => undoable(tr('Task deleted'), () => dispatch({ type: 'deleteTask', projectId: project.id, taskId: t.id }))}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
            <form className="add-task" onSubmit={addTask}>
              <input className="input" placeholder={tr('Add a task…')} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} aria-label={tr('New task')} />
              <button className="btn" type="submit" aria-label={tr('Add task')}><Plus size={16} /></button>
            </form>
          </section>

          <section className="card panel notes">
            <div className="section-head" style={{ margin: 0 }}>
              <h3>{tr('Internal notes')}</h3>
              <span className="pill"><Lock size={11} /> {tr('Only your team')}</span>
            </div>
            <AutoText
              value={project.notes}
              placeholder={tr('Anything the team should know: preferences, decisions, budget talk…')}
              onChange={(e) => dispatch({ type: 'updateProject', id: project.id, patch: { notes: e.target.value } })}
              aria-label={tr('Internal notes')}
            />
          </section>
        </div>

        <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
          <FeedbackSummary project={project} />
          <section className="card panel">
            <h3>{tr('The journey')}</h3>
            <div className="list">
              {journey.map((j) => (
                <Link key={j.label} to={j.to} className="list-item">
                  <span className="grow">{tr(j.label)}</span>
                  <StatusPill status={j.status} />
                </Link>
              ))}
            </div>
            <Link className="link-arrow" style={{ fontSize: 13 }} to={`/print/approvals/${project.id}`} target="_blank">
              <ShieldCheck size={14} /> {tr('Approval record (PDF)')} <small className="muted">· {tr('who approved what, and when')}</small>
            </Link>
          </section>

          <section className="card panel">
            <h3>{tr('Team')}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {state.team.map((m) => {
                const on = project.memberIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    className={'chip' + (on ? ' on' : '')}
                    aria-pressed={on}
                    onClick={() =>
                      dispatch({ type: 'updateProject', id: project.id, patch: { memberIds: on ? project.memberIds.filter((x) => x !== m.id) : [...project.memberIds, m.id] } })
                    }
                  >
                    <MemberAvatar member={m} size={20} /> {m.name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </section>

          <ProjectTime project={project} compact />

          <section className="card panel">
            <h3>{tr('Client portal')}</h3>
            <p className="muted" style={{ fontSize: 14 }}>
              {client?.contactName ? tr('{contactName} sees', { contactName: client.contactName }) : tr('Your client sees')} {tr('the stage, presentations, files to review, proposal, contract and brand hub.')}
            </p>
            <CopyLink url={clientUrl(`/p/${project.id}`)} />
          </section>

          <section className="card panel">
            <div className="section-head" style={{ margin: 0 }}>
              <h3>{tr('Client onboarding')}</h3>
              {project.onboarding.completedAt ? <span className="pill pill-green">{tr('Done')} {formatDate(project.onboarding.completedAt)}</span> : <span className="pill">{tr('Not done')}</span>}
            </div>
            <p className="muted" style={{ fontSize: 13 }}>{tr('A short welcome flow: your message and video, their team, the questionnaire and their material.')}</p>
            <AutoText
              value={project.onboarding.welcome}
              placeholder={tr('Welcome message, e.g. “So happy to work with you! Here’s how we’ll get started…”')}
              onChange={(e) => dispatch({ type: 'updateProject', id: project.id, patch: { onboarding: { ...project.onboarding, welcome: e.target.value } } })}
              aria-label={tr('Welcome message')}
            />
            <input
              className="input input-sm"
              placeholder={tr('Welcome video (YouTube, Vimeo or Loom link)')}
              value={project.onboarding.videoUrl ?? ''}
              onChange={(e) => dispatch({ type: 'updateProject', id: project.id, patch: { onboarding: { ...project.onboarding, videoUrl: e.target.value || undefined } } })}
              aria-label={tr('Welcome video link')}
            />
            <CopyLink url={clientUrl(`/p/${project.id}/welcome`)} label={tr('Copy onboarding link')} />
          </section>

          <button
            className="btn btn-ghost btn-danger"
            style={{ justifySelf: 'start' }}
            onClick={() =>
              confirm(tr('Delete “{name}”? Its files, proposal, contract and time entries will be removed. This can’t be undone. (Archive keeps everything.)', { name: project.name }), () => {
                dispatch({ type: 'deleteProject', id: project.id })
                navigate('/app/projects')
              })
            }
          >
            <Trash2 size={15} /> {tr('Delete project')}
          </button>
        </div>
      </div>
      {confirmNode}
    </>
  )
}

function MoneyTab({ project }: { project: Project }) {
  const tr = useT()
  const { state } = useStore()
  const [creating, setCreating] = useState(false)
  const invoices = state.invoices.filter((i) => i.projectId === project.id)
  return (
    <div className="split">
      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <div className="section-head" style={{ margin: 0 }}>
          <h2 style={{ fontSize: 18 }}>{tr('Invoices')}</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={15} /> {tr('New invoice')}</button>
        </div>
        {invoices.length === 0 ? (
          <div className="empty"><p>{tr('No invoices yet. Accept a proposal with a payment plan and they appear here automatically.')}</p></div>
        ) : (
          <div className="card">
            {invoices.map((i) => (
              <div key={i.id} className="file-row">
                <span className="cell-title" style={{ flex: 1 }}>
                  <b style={{ fontWeight: 500, fontFamily: 'var(--mono)', fontSize: 13 }}>{i.number}</b>
                  <small>{i.description ?? tr('Invoice')} {tr('· Due')} {formatDate(i.due)}</small>
                </span>
                <span>{formatKr(i.amount)}</span>
                <StatusPill status={isOverdue(i) ? 'Overdue' : i.status} />
                <Link className="btn btn-ghost btn-icon" to={`/print/invoice/${i.id}`} target="_blank" aria-label={tr('Print {number}', { number: i.number })}><Printer size={15} /></Link>
              </div>
            ))}
          </div>
        )}
        <ProjectExpenses project={project} />
        <ProjectTime project={project} />
      </div>
      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <RetainerPanel project={project} />
        <ProjectFinancePanel project={project} />
      </div>
      {creating && <NewInvoiceModal projectId={project.id} onClose={() => setCreating(false)} />}
    </div>
  )
}

function CaseStudyModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const images = state.files.filter((f) => f.projectId === project.id && f.versions.at(-1)?.mime.startsWith('image/') && f.uploadedBy !== 'client')
  const cs = project.caseStudy ?? { published: false, intro: project.description, fileIds: images.filter((f) => f.status === 'Approved').map((f) => f.id) }
  const [intro, setIntro] = useState(cs.intro)
  const [picked, setPicked] = useState<string[]>(cs.fileIds)
  const quotable = project.feedback?.mayQuote && project.feedback.quote
  const [showQuote, setShowQuote] = useState(cs.showQuote ?? !!quotable)
  const save = (published: boolean) => {
    dispatch({ type: 'updateProject', id: project.id, patch: { caseStudy: { published, intro, fileIds: picked, showQuote: !!quotable && showQuote } }, log: published ? { text: 'Case study published', projectId: project.id } : undefined })
  }
  return (
    <Modal title={tr('Case study')} subtitle={tr('A portfolio page built from the project’s approved work and brand hub.')} onClose={onClose}>
      <div className="form">
        <div className="field">
          <label htmlFor="cs-intro">{tr('Intro')}</label>
          <textarea id="cs-intro" className="input" value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={tr('The brief, the idea and the result in a few sentences.')} />
        </div>
        <div className="field">
          <label>{tr('Images')}</label>
          {images.length === 0 && <small>{tr('Upload images in the Files tab first.')}</small>}
          <div className="cs-pick">
            {images.map((f) => {
              const on = picked.includes(f.id)
              return (
                <button key={f.id} type="button" className={'cs-img' + (on ? ' on' : '')} onClick={() => setPicked(on ? picked.filter((x) => x !== f.id) : [...picked, f.id])} aria-pressed={on} title={f.name}>
                  <ThumbImg src={f.versions.at(-1)!.src} />
                  {on && <span className="cs-check"><Check size={12} /></span>}
                </button>
              )
            })}
          </div>
        </div>
        {quotable && (
          <label className="toggle-row">
            <input type="checkbox" checked={showQuote} onChange={(e) => setShowQuote(e.target.checked)} />
            <span>{tr('Show the client’s quote')} <small className="muted">“{project.feedback!.quote}”</small></span>
          </label>
        )}
        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          {project.caseStudy?.published ? <Link className="btn btn-ghost" to={`/case/${project.id}`} target="_blank">{tr('View page')} <ArrowUpRight size={14} /></Link> : <span />}
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => { save(false); onClose() }}>{tr('Save draft')}</button>
            <button className="btn btn-primary" onClick={() => { save(true); window.open(`/case/${project.id}`, '_blank'); onClose() }}>{tr('Publish')}</button>
          </span>
        </div>
      </div>
    </Modal>
  )
}

function ThumbImg({ src }: { src: string }) {
  const url = useSrc(src)
  return url ? <img src={url} alt="" /> : null
}

function EditProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const flows = state.studio.workflows
  const current = workflowOf(state, project)
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    // Switching workflow keeps the project the same share of the way through the work.
    const flow = flows.find((w) => w.id === d.workflowId) ?? current
    const stage = flow.id === current.id ? project.stage : Math.round((project.stage / Math.max(1, current.stages.length - 1)) * (flow.stages.length - 1))
    dispatch({
      type: 'updateProject',
      id: project.id,
      patch: {
        name: d.name,
        tagline: d.tagline,
        description: d.description,
        service: d.service as Service,
        startDate: d.startDate || project.startDate,
        due: d.due || undefined,
        budgetHours: d.budgetHours ? Number(d.budgetHours) : undefined,
        roundsIncluded: Number(d.roundsIncluded) || 0,
        cover: { ...project.cover, wordmark: d.wordmark || project.cover.wordmark, bg: d.bg, fg: d.fg },
        workflowId: flow.id,
        stage,
      },
      log: { text: 'Project details updated', projectId: project.id },
    })
    onClose()
  }
  return (
    <Modal title={tr('Edit project')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="ep-name">{tr('Project name')}</label>
          <input id="ep-name" name="name" className="input" required defaultValue={project.name} />
        </div>
        {flows.length > 1 && (
          <div className="field">
            <label htmlFor="ep-flow">{tr('Workflow')}</label>
            <select id="ep-flow" name="workflowId" className="input" defaultValue={current.id}>
              {flows.map((w) => <option key={w.id} value={w.id}>{tr(w.name)}</option>)}
            </select>
          </div>
        )}
        <div className="form-row">
          <div className="field">
            <label htmlFor="ep-wordmark">{tr('Cover wordmark')}</label>
            <input id="ep-wordmark" name="wordmark" className="input" defaultValue={project.cover.wordmark} />
          </div>
          <div className="field">
            <label htmlFor="ep-tagline">{tr('Tagline')}</label>
            <input id="ep-tagline" name="tagline" className="input" placeholder={tr('Add a tagline')} defaultValue={project.tagline} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ep-bg">{tr('Cover colour')}</label>
            <input id="ep-bg" name="bg" type="color" className="input" defaultValue={project.cover.bg} style={{ padding: 4 }} />
          </div>
          <div className="field">
            <label htmlFor="ep-fg">{tr('Cover text colour')}</label>
            <input id="ep-fg" name="fg" type="color" className="input" defaultValue={project.cover.fg} style={{ padding: 4 }} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ep-desc">{tr('Description')}</label>
          <textarea id="ep-desc" name="description" className="input" defaultValue={project.description} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ep-service">{tr('Service')}</label>
            <select id="ep-service" name="service" className="input" defaultValue={project.service}>
              {SERVICES.map((s) => <option key={s} value={s}>{tr(s)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ep-rounds">{tr('Revision rounds included')}</label>
            <input id="ep-rounds" name="roundsIncluded" type="number" min="0" max="10" className="input" defaultValue={project.roundsIncluded} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ep-start">{tr('Start date')}</label>
            <input id="ep-start" name="startDate" type="date" className="input" defaultValue={project.startDate} />
          </div>
          <div className="field">
            <label htmlFor="ep-due">{tr('Due date')}</label>
            <input id="ep-due" name="due" type="date" className="input" defaultValue={project.due} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ep-budget">{tr('Time budget (hours)')}</label>
          <input id="ep-budget" name="budgetHours" type="number" min="0" className="input" defaultValue={project.budgetHours} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" className="btn btn-primary">{tr('Save changes')}</button>
        </div>
      </form>
    </Modal>
  )
}
