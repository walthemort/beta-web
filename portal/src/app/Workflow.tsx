import { APP_NAME } from '../components/brand'
import { useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CalendarPlus, ChevronLeft, ChevronRight, Download, Palmtree, Share2, Trash2 } from 'lucide-react'
import { CopyLink } from '../components/kit'
import { availableHours, daysOff, formatDate, formatHours, formatKr, hoursLogged, isComplete, stageName, stageProgress, stagesOf, today, uid, useCurrentMember, useStore, workflowOf } from '../data/store'
import { TIME_OFF_KINDS, type Member, type Project, type TimeOffKind } from '../data/types'
import { MemberAvatar } from './shared'
import { projectFinance } from '../features/time'
import { invoiceVatRate, splitVat } from '../data/vat'
import { calendarEvents, toIcs, type CalEvent } from '../data/calendar'
import { feedbackStats } from '../features/feedback'
import { Modal } from '../components/ui'
import { useUndo } from '../components/Undo'
import { useT, activeLang, dateLocale } from '../data/i18n'
import { ContentPlan } from '../features/apps/social'
import { AppGate } from './Apps'
import { hasApp } from '../data/plans'

function Head({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

const active = (projects: Project[]) => projects.filter((p) => !p.archived)

/* ---------- My tasks (#40) ---------- */

export function MyTasks() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const me = useCurrentMember()
  const [who, setWho] = useState(me.id)
  const [showDone, setShowDone] = useState(false)
  const t = today()
  const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
  const tasks = active(state.projects)
    .flatMap((p) => p.tasks.map((task) => ({ ...task, project: p })))
    .filter((x) => (who === 'all' ? true : who === 'none' ? !x.assigneeId : x.assigneeId === who) && (showDone || !x.done))
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  const groups = [
    { label: 'Overdue', items: tasks.filter((x) => !x.done && x.due && x.due < t) },
    { label: 'This week', items: tasks.filter((x) => !x.done && x.due && x.due >= t && x.due <= week) },
    { label: 'Later', items: tasks.filter((x) => !x.done && x.due && x.due > week) },
    { label: 'No date', items: tasks.filter((x) => !x.done && !x.due) },
    { label: 'Done', items: tasks.filter((x) => x.done) },
  ].filter((g) => g.items.length)

  return (
    <>
      <Head eyebrow={tr('Keep it moving')} title={who === me.id ? tr('My tasks') : tr('Tasks')}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="input input-sm" value={who} onChange={(e) => setWho(e.target.value)} aria-label={tr('Whose tasks')}>
            {state.team.map((m) => <option key={m.id} value={m.id}>{m.id === me.id ? tr('Me ({x0})', { x0: m.name.split(' ')[0] }) : m.name}</option>)}
            <option value="all">{tr('Everyone')}</option>
            <option value="none">{tr('Unassigned')}</option>
          </select>
          <label className="muted" style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> {tr('Show done')}
          </label>
        </div>
      </Head>
      {groups.length === 0 && <div className="empty"><p>{tr('Nothing here. Enjoy the calm.')}</p></div>}
      {groups.map((g) => (
        <section key={g.label}>
          <div className="section-head"><h2 style={{ fontSize: 16, color: g.label === 'Overdue' ? 'var(--danger)' : undefined }}>{tr(g.label)} <span className="count">{g.items.length}</span></h2></div>
          <div className="card" style={{ padding: '0 16px' }}>
            {g.items.map((x) => (
              <div key={x.project.id + x.id} className={'task' + (x.done ? ' done' : '')}>
                <input type="checkbox" checked={x.done} aria-label={tr('Done: {title}', { title: x.title })} onChange={() => dispatch({ type: 'toggleTask', projectId: x.project.id, taskId: x.id })} />
                <span className="grow cell-title">
                  <span>{x.title}</span>
                  <Link to={`/app/projects/${x.project.id}`} className="muted" style={{ fontSize: 12 }}>{x.project.name}</Link>
                </span>
                {who === 'all' && <MemberAvatar member={state.team.find((m) => m.id === x.assigneeId)} size={22} />}
                <small className={x.due && x.due < t && !x.done ? 'error' : 'muted'}>{x.due ? formatDate(x.due) : ''}</small>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

/* ---------- Kanban board (#37) ---------- */

export function Board() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'grid' ? 'grid' : 'kanban'
  const clientFilter = params.get('clients')?.split(',').filter(Boolean) ?? []
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const flows = state.studio.workflows
  // The kanban shows one workflow at a time – its stages are the columns. The status grid shows all.
  const flow = flows.find((w) => w.id === params.get('flow')) ?? flows[0]
  const all = active(state.projects).filter((p) => !clientFilter.length || clientFilter.includes(p.clientId))
  const projects = view === 'grid' ? all : all.filter((p) => workflowOf(state, p).id === flow.id)
  const stages = flow.stages
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    v ? next.set(k, v) : next.delete(k)
    setParams(next, { replace: true })
  }
  const toggleClient = (id: string) => setParam('clients', (clientFilter.includes(id) ? clientFilter.filter((x) => x !== id) : [...clientFilter, id]).join(','))
  const token = state.studio.boardShareToken
  const shareUrl = token ? `${location.origin}/share/board/${token}` : ''

  const drop = (e: DragEvent, stage: number) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || dragging
    const p = projects.find((x) => x.id === id)
    if (p && p.stage !== stage) dispatch({ type: 'setStage', id: p.id, stage })
    setDragging(null)
    setOver(null)
  }

  return (
    <>
      <Head eyebrow={tr('Project management')} title={tr('Board')} sub={view === 'grid' ? tr('Every project as a square in its stage colour. Share it as a read-only live view.') : tr('Drag a project to move it to the next stage. Your client sees the new stage in their portal.')}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="seg" role="group" aria-label={tr('View')}>
            <button aria-pressed={view === 'kanban'} onClick={() => setParam('view', '')}>{tr('Kanban')}</button>
            <button aria-pressed={view === 'grid'} onClick={() => setParam('view', 'grid')}>{tr('Status grid')}</button>
          </div>
          {view === 'grid' &&
            (token ? (
              <CopyLink url={shareUrl} label={tr('Copy share link')} className="btn btn-sm" />
            ) : (
              <button className="btn btn-sm" onClick={() => dispatch({ type: 'updateStudio', patch: { boardShareToken: crypto.randomUUID().replace(/-/g, '').slice(0, 16) } })}>
                <Share2 size={14} /> {tr('Create share link')}
              </button>
            ))}
          {view === 'grid' && token && (
            <button className="btn btn-sm btn-ghost" title={tr('The old link stops working')} onClick={() => dispatch({ type: 'updateStudio', patch: { boardShareToken: undefined } })}>{tr('Turn off sharing')}</button>
          )}
        </div>
      </Head>
      {view === 'kanban' && flows.length > 1 && (
        <div className="seg" role="group" aria-label={tr('Workflow')} style={{ justifySelf: 'start', flexWrap: 'wrap' }}>
          {flows.map((w) => (
            <button key={w.id} aria-pressed={w.id === flow.id} onClick={() => setParam('flow', w.id === flows[0].id ? '' : w.id)}>
              {tr(w.name)} <span className="muted">{all.filter((p) => workflowOf(state, p).id === w.id).length}</span>
            </button>
          ))}
        </div>
      )}
      <div className="client-filter">
        <span className="muted" style={{ fontSize: 13 }}>{tr('Clients:')}</span>
        {state.clients.filter((c) => active(state.projects).some((p) => p.clientId === c.id)).map((c) => (
          <button key={c.id} className={'chip' + (clientFilter.includes(c.id) ? ' on' : '')} style={{ paddingLeft: 10 }} aria-pressed={clientFilter.includes(c.id)} onClick={() => toggleClient(c.id)}>{c.name}</button>
        ))}
        {clientFilter.length > 0 && <button className="link-btn" onClick={() => setParam('clients', '')}>{tr('Show all')}</button>}
      </div>
      {view === 'grid' ? <StatusGrid projects={projects} linkTo={(p) => `/app/projects/${p.id}`} /> : (
      <div
        className="kanban"
        // Empty stages shrink to a slim strip, and open up again while a project is being dragged.
        style={{ gridTemplateColumns: stages.map((_, i) => (dragging || projects.some((p) => p.stage === i) ? 'minmax(200px, 1fr)' : '52px')).join(' ') }}
      >
        {stages.map((st, i) => {
          const col = projects.filter((p) => p.stage === i)
          const slim = !dragging && col.length === 0
          return (
            <div
              key={st.id}
              title={slim ? tr(st.name) : undefined}
              className={'kcol' + (over === i ? ' over' : '') + (slim ? ' slim' : '')}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(i)
              }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(e) => drop(e, i)}
            >
              <div className="kcol-head" style={{ borderTopColor: st.colour }}><span><i className="stage-dot" style={{ background: st.colour }} /> {tr(st.name)}</span><span className="count">{col.length}</span></div>
              {col.map((p) => {
                const client = state.clients.find((c) => c.id === p.clientId)
                const open = p.tasks.filter((t) => !t.done).length
                return (
                  <div
                    key={p.id}
                    className={'kcard' + (dragging === p.id ? ' dragging' : '')}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', p.id)
                      setDragging(p.id)
                    }}
                    onDragEnd={() => {
                      setDragging(null)
                      setOver(null)
                    }}
                  >
                    <i className="kcard-cover" style={{ background: p.cover.bg }} />
                    <Link to={`/app/projects/${p.id}`} className="kcard-title">{p.name}</Link>
                    <span className="muted" style={{ fontSize: 12 }}>{client?.name} · {open === 1 ? tr('1 open task') : tr('{n} open tasks', { n: open })}</span>
                    <div className="kcard-foot">
                      <span className={p.due && p.due < today() ? 'error' : 'muted'} style={{ fontSize: 12 }}>{p.due ? formatDate(p.due) : tr('No due date')}</span>
                      <span className="avatars">{p.memberIds.map((id) => <MemberAvatar key={id} member={state.team.find((m) => m.id === id)} size={20} />)}</span>
                    </div>
                    {/* Keyboard / touch alternative to dragging */}
                    <select
                      className="kcard-move"
                      value={p.stage}
                      aria-label={tr('Move {name} to stage', { name: p.name })}
                      onChange={(e) => dispatch({ type: 'setStage', id: p.id, stage: Number(e.target.value) })}
                    >
                      {stages.map((x, j) => <option key={x.id} value={j}>{tr(x.name)}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      )}
    </>
  )
}

/**
 * Status grid: one coloured square per project, grouped by client. Used in the app (with links)
 * and on the read-only share page.
 */
export function StatusGrid({ projects, linkTo }: { projects: Project[]; linkTo?: (p: Project) => string }) {
  const tr = useT()
  const { state } = useStore()
  const clients = state.clients.filter((c) => projects.some((p) => p.clientId === c.id))
  // One legend line per workflow that's in use (named when there's more than one).
  const flows = state.studio.workflows.filter((w) => projects.some((p) => workflowOf(state, p).id === w.id))
  if (!projects.length) return <div className="empty"><p>{tr('No projects to show.')}</p></div>
  return (
    <div className="sgrid-wrap">
      {flows.map((w) => (
        <div key={w.id} className="sgrid-legend">
          {flows.length > 1 && <b style={{ fontWeight: 500 }}>{tr(w.name)}:</b>}
          {w.stages.map((st, i) => (
            <span key={st.id}><i style={{ background: st.colour }} /> {tr(st.name)} <b>{projects.filter((p) => workflowOf(state, p).id === w.id && p.stage === i).length}</b></span>
          ))}
        </div>
      ))}
      {clients.map((c) => {
        const list = projects.filter((p) => p.clientId === c.id).sort((a, b) => stageProgress(a, state) - stageProgress(b, state))
        return (
          <section key={c.id} className="sgrid-group">
            <h3>{c.name} <span className="count">{list.length}</span></h3>
            <div className="sgrid">
              {list.map((p) => {
                const st = stagesOf(state, p)[p.stage]
                const inner = (
                  <>
                    <b>{p.name.replace(`${c.name} – `, '')}</b>
                    <small>{st?.name}</small>
                    {p.due && <small className="sq-due">{formatDate(p.due)}</small>}
                  </>
                )
                const style = { background: st?.colour ?? '#9a9993' }
                return linkTo ? (
                  <Link key={p.id} to={linkTo(p)} className="sq" style={style} title={`${p.name} · ${st?.name}`}>{inner}</Link>
                ) : (
                  <div key={p.id} className="sq" style={style} title={`${p.name} · ${st?.name}`}>{inner}</div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ---------- Calendar & timeline (#38) ---------- */

function useEvents(): CalEvent[] {
  const { state } = useStore()
  return useMemo(() => calendarEvents(state), [state])
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function CalendarPage() {
  const tr = useT()
  const [view, setView] = useState<'month' | 'timeline'>('month')
  const [exporting, setExporting] = useState(false)
  // Social Planner: the content plan is its own view of the calendar.
  if (useParams().view === 'social')
    return (
      <AppGate id="socialPlanner">
        <Head eyebrow={tr('Social Planner')} title={tr('Content plan')} />
        <ContentPlan />
      </AppGate>
    )
  return (
    <>
      <Head eyebrow={tr('Plan ahead')} title={tr('Calendar')}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setExporting(true)}><CalendarPlus size={15} /> {tr('Add to your calendar')}</button>
          <div className="seg" role="group" aria-label={tr('View')}>
            <button aria-pressed={view === 'month'} onClick={() => setView('month')}>{tr('Month')}</button>
            <button aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}>{tr('Timeline')}</button>
          </div>
        </div>
      </Head>
      {view === 'month' ? <Month /> : <Timeline />}
      {exporting && <CalendarExport onClose={() => setExporting(false)} />}
    </>
  )
}

/** Google / Apple / Outlook: a calendar file now; a live subscription link once Aftryk is online. */
function CalendarExport({ onClose }: { onClose: () => void }) {
  const tr = useT()
  const { state } = useStore()
  const me = useCurrentMember()
  const [mine, setMine] = useState(false)
  const all = calendarEvents(state).filter((e) => e.date >= today())
  const events = mine ? all.filter((e) => e.kind !== 'task' || e.memberId === me.id) : all

  function download() {
    const ics = toIcs(events, { name: `${state.studio.name}${mine ? ` · ${me.name.split(' ')[0]}` : ''}`, origin: location.origin })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    a.download = `${APP_NAME.toLowerCase()}-calendar${mine ? '-mine' : ''}-${today()}.ics`
    a.click()
  }

  return (
    <Modal title={tr('Add to your calendar')} subtitle={tr('Deadlines, tasks, client reviews and invoice due dates as all-day events in Google Calendar, Apple Calendar or Outlook.')} onClose={onClose}>
      <div className="form">
        <div className="seg" role="group" aria-label={tr('Which events')}>
          <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>{tr('Everything')}</button>
          <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>{tr('Only my tasks + deadlines')}</button>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>{events.length} {tr('upcoming')} {events.length === 1 ? tr('event') : tr('events')}{tr('. Events don’t block your time (they show as “free”).')}</p>
        <ol className="cal-steps">
          <li><b>{tr('Google Calendar:')}</b> {tr('Settings → Import & export → Import, and pick a calendar.')}</li>
          <li><b>{tr('Apple Calendar:')}</b> {tr('open the file, then choose a calendar.')}</li>
          <li><b>{tr('Outlook:')}</b> {tr('Add calendar → Upload from file.')}</li>
        </ol>
        <p className="muted" style={{ fontSize: 13 }}>
          {tr('Tip: import into a separate “{app}” calendar. The file is a snapshot of today – to update, delete that calendar and import a new file. Once {app} is online, this becomes a live link your calendar keeps up to date by itself.', { app: APP_NAME })}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Close')}</button>
          <button type="button" className="btn btn-primary" onClick={download} disabled={!events.length}><Download size={15} /> {tr('Download calendar file')}</button>
        </div>
      </div>
    </Modal>
  )
}

function Month() {
  const tr = useT()
  const { state } = useStore()
  const events = useEvents()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const first = new Date(cursor)
  const offset = (first.getDay() + 6) % 7 // Monday first
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const t = today()
  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))

  return (
    <div className="card cal">
      <div className="cal-head">
        <button className="btn btn-ghost btn-icon" onClick={() => move(-1)} aria-label={tr('Previous month')}><ChevronLeft size={16} /></button>
        <b>{cursor.toLocaleDateString(dateLocale(activeLang()), { month: 'long', year: 'numeric' })}</b>
        <button className="btn btn-ghost btn-icon" onClick={() => move(1)} aria-label={tr('Next month')}><ChevronRight size={16} /></button>
        <span className="cal-legend">
          <i className="deadline" /> {tr('Deadline')} <i className="task" /> {tr('Task')} <i className="review" /> {tr('Client review')} <i className="invoice" /> {tr('Invoice')}
          {hasApp(state, 'socialPlanner') && <><i className="post" /> {tr('Social post')}</>}
        </span>
      </div>
      <div className="cal-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="cal-dow">{tr(d)}</span>)}
        {days.map((d) => {
          const key = ymd(d)
          const ev = events.filter((e) => e.date === key)
          return (
            <div key={key} className={'cal-day' + (d.getMonth() !== cursor.getMonth() ? ' other' : '') + (key === t ? ' today' : '')}>
              <span className="cal-num">{d.getDate()}</span>
              {ev.slice(0, 3).map((e, i) => (
                <Link key={i} to={e.to} className={'cal-ev ' + e.kind} title={e.label} style={e.kind === 'task' && e.colour ? { borderLeftColor: e.colour } : undefined}>
                  {e.label}
                </Link>
              ))}
              {ev.length > 3 && <span className="cal-more">+{ev.length - 3} {tr('more')}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Timeline() {
  const tr = useT()
  const { state } = useStore()
  const projects = active(state.projects).filter((p) => p.due)
  const undated = active(state.projects).filter((p) => !p.due)
  const startMs = Math.min(Date.now() - 14 * 864e5, ...projects.map((p) => new Date(p.startDate).getTime()))
  const endMs = Math.max(Date.now() + 60 * 864e5, ...projects.map((p) => new Date(p.due!).getTime() + 7 * 864e5))
  const span = endMs - startMs
  const pct = (ms: number) => ((ms - startMs) / span) * 100
  const weeks: Date[] = []
  for (let d = new Date(startMs); d.getTime() < endMs; d = new Date(d.getTime() + 7 * 864e5)) weeks.push(d)

  return (
    <div className="card timeline">
      <div className="tl-scale">
        {weeks.map((w) => (
          <span key={w.getTime()} style={{ left: pct(w.getTime()) + '%' }}>{w.toLocaleDateString(dateLocale(activeLang()), { day: 'numeric', month: 'short' })}</span>
        ))}
      </div>
      <div className="tl-rows">
        <i className="tl-today" style={{ left: `calc(200px + (100% - 200px) * ${pct(Date.now()) / 100})` }} title={tr('Today')} />
        {projects.map((p) => {
          const a = pct(new Date(p.startDate).getTime())
          const b = pct(new Date(p.due!).getTime() + 864e5)
          return (
            <div key={p.id} className="tl-row">
              <Link to={`/app/projects/${p.id}`} className="tl-label">{p.name}</Link>
              <div className="tl-track">
                <Link to={`/app/projects/${p.id}`} className="tl-bar" style={{ left: a + '%', width: Math.max(2, b - a) + '%', background: p.cover.bg, color: p.cover.fg }}>
                  <span>{tr(stageName(state, p.stage, p))}</span>
                </Link>
                {p.tasks.filter((t) => t.due).map((t) => (
                  <i key={t.id} className={'tl-dot' + (t.done ? ' done' : '')} style={{ left: pct(new Date(t.due!).getTime()) + '%' }} title={`${t.title} · ${formatDate(t.due)}`} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {undated.length > 0 && <p className="muted" style={{ fontSize: 12, padding: '0 16px 14px' }}>{tr('Not shown (no due date):')} {undated.map((p) => p.name).join(', ')}</p>}
    </div>
  )
}

/* ---------- Capacity (#41) ---------- */

/**
 * Remaining budget hours on each project are spread evenly over the weeks until its due date,
 * and split between the people on it. Compared with each person's weekly capacity.
 */
export function Capacity() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const [addingOff, setAddingOff] = useState(false)
  const upcomingOff = [...state.timeOff].filter((o) => o.to >= today()).sort((a, b) => a.from.localeCompare(b.from))
  const WEEKS = 8
  const monday = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  })()
  const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(monday.getTime() + i * 7 * 864e5))

  const WEEK = 7 * 864e5
  const load = (m: Member) =>
    weeks.map((_, i) => {
      let hours = 0
      const parts: string[] = []
      for (const p of active(state.projects)) {
        if (!p.memberIds.includes(m.id) || !p.budgetHours || isComplete(state, p)) continue
        const remaining = Math.max(0, p.budgetHours - hoursLogged(state, p.id))
        // Projects without a due date are assumed to run six more weeks.
        const end = p.due ? new Date(p.due).getTime() : monday.getTime() + 6 * WEEK
        const weeksLeft = Math.max(1, Math.ceil((end - monday.getTime()) / WEEK))
        if (i >= weeksLeft) continue
        const h = remaining / weeksLeft / p.memberIds.length
        hours += h
        if (h > 0.5) parts.push(`${p.name}: ${Math.round(h)} h`)
      }
      return { hours, parts }
    })

  return (
    <>
      <Head eyebrow={tr('Plan ahead')} title={tr('Capacity')} sub={tr('Remaining budget hours spread over each project’s weeks and split between the people on it.')}>
        <button className="btn" onClick={() => setAddingOff(true)}><Palmtree size={15} /> {tr('Add time off')}</button>
      </Head>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table cap">
          <thead>
            <tr>
              <th>{tr('Person')}</th>
              {weeks.map((w) => <th key={w.getTime()}>{tr('Week of')} {w.toLocaleDateString(dateLocale(activeLang()), { day: 'numeric', month: 'short' })}</th>)}
            </tr>
          </thead>
          <tbody>
            {state.team.map((m) => (
              <tr key={m.id}>
                <td>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <MemberAvatar member={m} />
                    <span className="cell-title"><span>{m.name}</span><small>{m.capacity} {tr('h / week')}</small></span>
                  </span>
                </td>
                {load(m).map((l, i) => {
                  const off = daysOff(state, m.id, ymd(weeks[i]))
                  const avail = availableHours(state, m, ymd(weeks[i]))
                  if (off === 5)
                    return (
                      <td key={i} className="cap-cell off" title={tr('Off all week')}>
                        <b>{tr('Off')}</b>
                        <small>{l.hours >= 1 ? formatHours(Math.round(l.hours)) : '—'}</small>
                      </td>
                    )
                  const ratio = avail ? l.hours / avail : 0
                  const cls = ratio > 1 ? 'over' : ratio > 0.8 ? 'full' : ratio > 0.4 ? 'busy' : 'free'
                  const offNote = off ? (off === 1 ? tr('1 day off') : tr('{n} days off', { n: off })) : ''
                  return (
                    <td key={i} className={'cap-cell ' + cls} title={[offNote, ...l.parts].filter(Boolean).join('\n') || tr('Free§capacity')}>
                      <b>{Math.round(ratio * 100)}%</b>
                      <small>{formatHours(Math.round(l.hours))}{off > 0 && <> · <Palmtree size={10} aria-label={offNote} /> {off}</>}</small>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{tr('Green = room for more · amber = nearly full · red = overbooked. Set budgets and teams on each project for accurate numbers.')}</p>

      <section>
        <div className="section-head"><h2>{tr('Time off')}</h2></div>
        {upcomingOff.length === 0 ? (
          <p className="muted">{tr('No time off planned. Holidays and sick days lower that week’s capacity.')}</p>
        ) : (
          <div className="card list">
            {upcomingOff.map((o) => {
              const m = state.team.find((x) => x.id === o.memberId)
              return (
                <div key={o.id} className="list-item">
                  <MemberAvatar member={m} size={24} />
                  <span className="grow">
                    <span>{m?.name ?? '—'} · {tr(o.kind)}</span>
                    <small>{o.from === o.to ? formatDate(o.from) : `${formatDate(o.from)} → ${formatDate(o.to)}`}{o.note ? ` · ${o.note}` : ''}</small>
                  </span>
                  <button
                    className="btn btn-ghost btn-icon"
                    aria-label={tr('Delete time off')}
                    onClick={() => undoable(tr('Time off deleted'), () => dispatch({ type: 'remove', coll: 'timeOff', id: o.id }))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
      {addingOff && <TimeOffModal onClose={() => setAddingOff(false)} />}
    </>
  )
}

function TimeOffModal({ onClose }: { onClose: () => void }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const me = useCurrentMember()
  const [from, setFrom] = useState(today())

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const to = d.to && d.to >= d.from ? d.to : d.from
    dispatch({ type: 'insert', coll: 'timeOff', item: { id: uid(), memberId: d.memberId, from: d.from, to, kind: d.kind as TimeOffKind, note: d.note.trim() || undefined } })
    onClose()
  }

  return (
    <Modal title={tr('Add time off')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="to-member">{tr('Person')}</label>
            <select id="to-member" name="memberId" className="input" defaultValue={me.id}>
              {state.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="to-kind">{tr('Type')}</label>
            <select id="to-kind" name="kind" className="input" defaultValue="Holiday">
              {TIME_OFF_KINDS.map((k) => <option key={k} value={k}>{tr(k)}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="to-from">{tr('From')}</label>
            <input id="to-from" name="from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="to-to">{tr('To (inclusive)')}</label>
            <input id="to-to" name="to" type="date" className="input" min={from} defaultValue={from} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="to-note">{tr('Note')} <span className="muted">{tr('(optional)')}</span></label>
          <input id="to-note" name="note" className="input" placeholder={tr('e.g. Summer holiday')} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" className="btn btn-primary">{tr('Add time off')}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Reports: profitability (#36) + accounting export (#33) ---------- */

/** Scores and quotes from finished projects. */
function ClientHappiness() {
  const tr = useT()
  const { state } = useStore()
  const f = feedbackStats(state)
  if (!f.count) return null
  return (
    <section>
      <div className="section-head"><h2>{tr('Client happiness')}</h2></div>
      <div className="card stats">
        <div className="stat"><span className="stat-top">{tr('Average score')}</span><b>{f.average.toFixed(1).replace('.', activeLang() === 'da' ? ',' : '.')}</b><small>{tr('out of 10')}</small></div>
        <div className="stat"><span className="stat-top">NPS</span><b style={{ color: f.nps >= 50 ? 'var(--green)' : f.nps < 0 ? 'var(--danger)' : undefined }}>{f.nps > 0 ? '+' : ''}{f.nps}</b><small>{tr('from −100 to +100')}</small></div>
        <div className="stat"><span className="stat-top">{tr('Answers')}</span><b>{f.count}</b><small>{tr('finished projects')}</small></div>
      </div>
      {f.quotes.length > 0 && (
        <div className="fb-quotes">
          {f.quotes.map(({ project, fb }) => (
            <blockquote key={project.id} className="fb-quote card">
              “{fb.quote}”
              <footer>— {fb.by}, {state.clients.find((c) => c.id === project.clientId)?.name} · {fb.score}/10</footer>
            </blockquote>
          ))}
        </div>
      )}
    </section>
  )
}

export function Reports() {
  const tr = useT()
  const { state } = useStore()
  const rows = state.projects.map((p) => ({ p, f: projectFinance(state, p.id), client: state.clients.find((c) => c.id === p.clientId) }))
  const byClient = state.clients
    .map((c) => {
      const r = rows.filter((x) => x.p.clientId === c.id)
      const quoted = r.reduce((n, x) => n + x.f.quoted, 0)
      const earned = r.reduce((n, x) => n + x.f.earned, 0)
      const hours = r.reduce((n, x) => n + x.f.hours, 0)
      return { c, quoted, hours, rate: hours ? earned / hours : 0, projects: r.length }
    })
    .filter((x) => x.projects)
    .sort((a, b) => b.quoted - a.quoted)
  const totalQuoted = rows.reduce((n, x) => n + x.f.quoted, 0)
  const totalHours = rows.reduce((n, x) => n + x.f.hours, 0)
  const totalEarned = rows.reduce((n, x) => n + x.f.earned, 0)
  const totalExpenses = rows.reduce((n, x) => n + x.f.expenses, 0)
  const paid = rows.reduce((n, x) => n + x.f.paid, 0)
  const target = state.studio.hourlyRate
  const rateColour = (r: number, h: number) => (!h ? undefined : r >= target ? 'var(--green)' : 'var(--danger)')

  return (
    <>
      <Head eyebrow={tr('The business of good design')} title={tr('Reports')} sub={tr('Excl. VAT. Your target hourly rate is {x0} (change it in Settings).', { x0: formatKr(target) })}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => exportInvoices(state, 'economic')}><Download size={14} /> {tr('e-conomic CSV')}</button>
          <button className="btn btn-sm" onClick={() => exportInvoices(state, 'dinero')}><Download size={14} /> {tr('Dinero CSV')}</button>
        </div>
      </Head>
      <div className="card stats stats-3">
        <div className="stat"><span className="stat-top">{tr('Agreed')}</span><b>{formatKr(totalQuoted)}</b><small>{tr('Accepted proposals, or invoiced')}</small></div>
        <div className="stat"><span className="stat-top">{tr('Proposed')}</span><b>{formatKr(rows.reduce((n, x) => n + x.f.proposed, 0))}</b><small>{tr('Sent, not accepted yet')}</small></div>
        <div className="stat"><span className="stat-top">{tr('Paid')}</span><b>{formatKr(paid)}</b><small>{tr('Money in')}</small></div>
        <div className="stat"><span className="stat-top">{tr('Expenses')}</span><b>{formatKr(totalExpenses)}</b><small>{tr('Fonts, stock, print, freelancers')}</small></div>
        <div className="stat"><span className="stat-top">{tr('Hours')}</span><b>{formatHours(totalHours)}</b><small>{tr('Logged')}</small></div>
        <div className="stat"><span className="stat-top">{tr('Earned per hour')}</span><b style={{ color: rateColour(totalEarned / (totalHours || 1), totalHours) }}>{totalHours ? formatKr(totalEarned / totalHours) : '—'}</b><small>{tr('vs.')} {formatKr(target)}</small></div>
      </div>

      <ClientHappiness />

      <section>
        <div className="section-head"><h2>{tr('Per project')}</h2></div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table stack">
            <thead><tr><th>{tr('Project')}</th><th className="num">{tr('Agreed')}</th><th className="num">{tr('Expenses')}</th><th className="num">{tr('Hours')}</th><th className="num">{tr('Budget')}</th><th className="num">{tr('Per hour')}</th></tr></thead>
            <tbody>
              {rows.map(({ p, f, client }) => (
                <tr key={p.id}>
                  <td className="wide"><Link to={`/app/projects/${p.id}/money`} className="cell-title"><b style={{ fontWeight: 500 }}>{p.name}</b><small>{client?.name}{p.archived ? tr(' · archived') : ''}</small></Link></td>
                  <td data-label={tr('Agreed')} className="num">
                    <span className="cell-title" style={{ justifyItems: 'end' }}>
                      {f.quoted ? formatKr(f.quoted) : '—'}
                      {f.quoted > 0 && f.quotedFrom === 'invoices' && <small>{tr('invoiced so far')}</small>}
                      {f.proposed > 0 && <small>{tr('{amount} proposed', { amount: formatKr(f.proposed) })}</small>}
                    </span>
                  </td>
                  <td data-label={tr('Expenses')} className="num">{f.expenses ? formatKr(f.expenses) : '—'}</td>
                  <td data-label={tr('Hours')} className="num">{formatHours(f.hours)}</td>
                  <td data-label={tr('Budget')} className="num" style={{ color: f.budget && f.hours > f.budget ? 'var(--danger)' : undefined }}>{f.budget ? tr('{x0}% of {budget} h', { x0: Math.round(f.budgetUsed * 100), budget: f.budget }) : '—'}</td>
                  <td data-label={tr('Per hour')} className="num" style={{ color: rateColour(f.effectiveRate, f.hours) }}>{f.hours ? formatKr(f.effectiveRate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="section-head"><h2>{tr('Per client')}</h2></div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table stack">
            <thead><tr><th>{tr('Client')}</th><th className="num">{tr('Projects')}</th><th className="num">{tr('Agreed')}</th><th className="num">{tr('Hours')}</th><th className="num">{tr('Per hour')}</th></tr></thead>
            <tbody>
              {byClient.map((x) => (
                <tr key={x.c.id}>
                  <td className="wide"><b style={{ fontWeight: 500 }}>{x.c.name}</b></td>
                  <td data-label={tr('Projects')} className="num">{x.projects}</td>
                  <td data-label={tr('Agreed')} className="num">{formatKr(x.quoted)}</td>
                  <td data-label={tr('Hours')} className="num">{formatHours(x.hours)}</td>
                  <td data-label={tr('Per hour')} className="num" style={{ color: rateColour(x.rate, x.hours) }}>{x.hours ? formatKr(x.rate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/**
 * Invoice export for bookkeeping. The column layouts follow the manual import screens of
 * e-conomic and Dinero; a direct API connection comes later (needs your API key).
 */
function exportInvoices(state: ReturnType<typeof useStore>['state'], target: 'economic' | 'dinero') {
  const rows = state.invoices
    .filter((i) => i.status !== 'Draft')
    .map((i) => {
      const client = state.clients.find((c) => c.id === i.clientId)
      const rate = invoiceVatRate(state, i)
      const { net, vat } = splitVat(i.amount, rate)
      return target === 'economic'
        ? [i.number, i.issuedAt ?? '', i.due ?? '', client?.name ?? '', client?.contactEmail ?? '', i.description ?? '', net, vat, i.amount, i.status === 'Paid' ? 'Betalt' : 'Ubetalt']
        : [i.issuedAt ?? '', i.number, client?.name ?? '', i.description ?? '', net, `${Math.round(rate * 100)}%`, i.amount, i.due ?? '']
    })
  const header =
    target === 'economic'
      ? ['Fakturanr', 'Dato', 'Forfaldsdato', 'Kunde', 'Email', 'Tekst', 'Beløb ekskl. moms', 'Moms', 'Beløb inkl. moms', 'Status']
      : ['Dato', 'Bilagsnr', 'Kunde', 'Beskrivelse', 'Beløb ekskl. moms', 'Momssats', 'Beløb inkl. moms', 'Forfaldsdato']
  // Semicolons + decimal commas so it opens correctly in Danish Excel.
  const cell = (v: string | number) => (typeof v === 'number' ? String(v).replace('.', ',') : `"${v.replace(/"/g, '""')}"`)
  const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `${APP_NAME.toLowerCase()}-invoices-${target}-${today()}.csv`
  a.click()
}
