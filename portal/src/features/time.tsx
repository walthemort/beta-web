import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play, Plus, Trash2 } from 'lucide-react'
import { formatDate, formatHours, formatKr, hoursLogged, proposalScope, proposalTotals, today, uid, useCurrentMember, useStore } from '../data/store'
import type { Project, State } from '../data/types'
import { MemberAvatar } from '../app/shared'
import { invoiceVatRate, splitVat } from '../data/vat'
import { useUndo } from '../components/Undo'
import { useT } from '../data/i18n'

/* ---------- Money maths ---------- */

/** Everything money-related for one project, excl. VAT. */
export function projectFinance(s: State, projectId: string) {
  const project = s.projects.find((p) => p.id === projectId)
  const invoices = s.invoices.filter((i) => i.projectId === projectId)
  const invoiced = invoices.filter((i) => i.status !== 'Draft').reduce((n, i) => n + splitVat(i.amount, invoiceVatRate(s, i)).net, 0)
  const paid = invoices.filter((i) => i.status === 'Paid').reduce((n, i) => n + splitVat(i.amount, invoiceVatRate(s, i)).net, 0)
  const proposal = s.proposals.find((p) => p.projectId === projectId && p.status === 'Accepted')
  // Without an accepted proposal, the work invoiced so far (not re-billed expenses) is what was quoted.
  const quoted = proposal
    ? proposalTotals(proposalScope(proposal), 0).subtotal
    : invoices.filter((i) => !i.expenseIds?.length).reduce((n, i) => n + splitVat(i.amount, invoiceVatRate(s, i)).net, 0)
  // What's been proposed but not agreed yet – shown apart so it isn't mistaken for a deal.
  const open = s.proposals.find((p) => p.projectId === projectId && p.status === 'Sent')
  const proposed = open ? proposalTotals(proposalScope(open), 0).subtotal : 0
  const costs = s.expenses.filter((e) => e.projectId === projectId)
  const expenses = costs.reduce((n, e) => n + e.amount, 0)
  // Billable expenses are passed on to the client, so only the rest comes out of the studio's pocket.
  const ownExpenses = costs.filter((e) => !e.billable).reduce((n, e) => n + e.amount, 0)
  const earned = quoted - ownExpenses
  const hours = hoursLogged(s, projectId)
  const budget = project?.budgetHours
  const cost = hours * s.studio.hourlyRate
  return {
    quoted,
    /** Where `quoted` comes from: the accepted proposal, or (without one) what has been invoiced. */
    quotedFrom: proposal ? ('proposal' as const) : ('invoices' as const),
    proposed,
    invoiced,
    paid,
    expenses,
    ownExpenses,
    /** The quote minus the expenses the studio pays itself. */
    earned,
    hours,
    budget,
    /** What each hour actually earned, after the studio's own expenses. */
    effectiveRate: hours > 0 ? earned / hours : 0,
    /** Earned minus the value of the time spent at the studio's hourly rate. */
    margin: earned - cost,
    budgetUsed: budget ? hours / budget : 0,
  }
}

/* ---------- Running timer (one at a time, survives reloads) ---------- */

const TIMER_KEY = 'forme:timer'
type Running = { projectId: string; memberId: string; startedAt: number }

function readTimer(): Running | null {
  try {
    return JSON.parse(localStorage.getItem(TIMER_KEY) || 'null')
  } catch {
    return null
  }
}

export function useTimer() {
  const [running, setRunning] = useState<Running | null>(readTimer)
  const [, tick] = useState(0)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === TIMER_KEY && setRunning(readTimer())
    const onLocal = () => setRunning(readTimer())
    window.addEventListener('storage', onStorage)
    window.addEventListener('forme-timer', onLocal)
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('forme-timer', onLocal)
      clearInterval(t)
    }
  }, [])
  const save = (r: Running | null) => {
    try {
      r ? localStorage.setItem(TIMER_KEY, JSON.stringify(r)) : localStorage.removeItem(TIMER_KEY)
    } catch {
      /* ignore */
    }
    setRunning(r)
    window.dispatchEvent(new Event('forme-timer'))
  }
  const seconds = running ? Math.floor((Date.now() - running.startedAt) / 1000) : 0
  return { running, seconds, start: (projectId: string, memberId: string) => save({ projectId, memberId, startedAt: Date.now() }), stop: () => save(null) }
}

/** Stops the running timer and saves it as a time entry. */
export function useStopTimer() {
  const { dispatch } = useStore()
  const { running, seconds, stop } = useTimer()
  return () => {
    if (!running) return
    const minutes = Math.max(1, Math.round(seconds / 60))
    dispatch({ type: 'insert', coll: 'timeEntries', item: { id: uid(), projectId: running.projectId, memberId: running.memberId, minutes, note: 'Timer', date: today() } })
    stop()
  }
}

export const clock = (sec: number) => `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

/** Topbar widget: shows the running timer anywhere in the app. */
export function TimerWidget() {
  const tr = useT()
  const { state } = useStore()
  const { running, seconds } = useTimer()
  const stopAndLog = useStopTimer()
  if (!running) return null
  const project = state.projects.find((p) => p.id === running.projectId)
  return (
    <span className="timer-widget">
      <span className="timer-dot" />
      <Link to={`/app/projects/${running.projectId}`}>{project?.name ?? tr('Project')}</Link>
      <code>{clock(seconds)}</code>
      <button
        className="btn btn-ghost btn-icon"
        aria-label={tr('Stop timer and log time')}
        onClick={stopAndLog}
      >
        <Pause size={15} />
      </button>
    </span>
  )
}

/* ---------- Project time panel ---------- */

export function ProjectTime({ project, compact }: { project: Project; compact?: boolean }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const me = useCurrentMember()
  const { running, start, seconds } = useTimer()
  const stopAndLog = useStopTimer()
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [memberId, setMemberId] = useState(me.id)
  const f = projectFinance(state, project.id)
  const entries = state.timeEntries.filter((t) => t.projectId === project.id).sort((a, b) => b.date.localeCompare(a.date))
  const mine = running?.projectId === project.id

  function log(e: FormEvent) {
    e.preventDefault()
    const h = parseFloat(hours.replace(',', '.'))
    if (!(h > 0)) return
    dispatch({ type: 'insert', coll: 'timeEntries', item: { id: uid(), projectId: project.id, memberId, minutes: Math.round(h * 60), note: note.trim(), date: today() } })
    setHours('')
    setNote('')
  }

  const over = f.budget && f.hours > f.budget

  return (
    <section className="card panel">
      <div className="section-head" style={{ margin: 0 }}>
        <h3>{tr('Time')}</h3>
        <button className={'btn btn-sm' + (mine ? ' btn-primary' : '')} onClick={() => (mine ? stopAndLog() : start(project.id, me.id))} disabled={!!running && !mine} title={running && !mine ? tr('Another timer is running') : undefined}>
          {mine ? <><Pause size={13} /> {tr('Stop')} {clock(seconds)}</> : <><Play size={13} /> {tr('Start timer')}</>}
        </button>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
          <span><b style={{ fontWeight: 500 }}>{formatHours(f.hours)}</b> <span className="muted">{tr('logged')}</span></span>
          <span className={over ? 'error' : 'muted'}>{f.budget ? tr('of {budget} h budget', { budget: f.budget }) : tr('No budget set')}</span>
        </div>
        {f.budget ? (
          <div className="progress" style={{ height: 6 }}>
            <span style={{ width: Math.min(100, f.budgetUsed * 100) + '%', background: over ? 'var(--danger)' : f.budgetUsed > 0.8 ? 'var(--amber)' : undefined }} />
          </div>
        ) : null}
        {over && <p className="error" style={{ marginTop: 6 }}>{formatHours(f.hours - f.budget!)} {tr('over budget.')}</p>}
      </div>
      <form className="log-time" onSubmit={log}>
        <input className="input input-sm" style={{ width: 70 }} placeholder={tr('Hours')} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} aria-label={tr('Hours')} />
        <input className="input input-sm" style={{ flex: 1, minWidth: 100 }} placeholder={tr('What did you work on?')} value={note} onChange={(e) => setNote(e.target.value)} aria-label={tr('Note')} />
        <select className="input input-sm" value={memberId} onChange={(e) => setMemberId(e.target.value)} aria-label={tr('Who')}>
          {state.team.map((m) => <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>)}
        </select>
        <button className="btn btn-sm" type="submit" aria-label={tr('Log time')}><Plus size={14} /></button>
      </form>
      {!compact && entries.length > 0 && (
        <div className="list">
          {entries.map((t) => {
            const m = state.team.find((x) => x.id === t.memberId)
            return (
              <div key={t.id} className="list-item">
                <MemberAvatar member={m} size={22} />
                <span className="grow"><span>{t.note || tr('Work')}</span><small>{m?.name.split(' ')[0]} · {formatDate(t.date)}</small></span>
                <span style={{ fontSize: 13 }}>{formatHours(t.minutes / 60)}</span>
                <button className="btn btn-ghost btn-icon" aria-label={tr('Delete time entry')} onClick={() => undoable(tr('Time entry deleted'), () => dispatch({ type: 'remove', coll: 'timeEntries', id: t.id }))}>
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function ProjectFinancePanel({ project }: { project: Project }) {
  const tr = useT()
  const { state } = useStore()
  const f = projectFinance(state, project.id)
  const target = state.studio.hourlyRate
  return (
    <section className="card panel">
      <h3>{tr('Profitability')}</h3>
      <div className="kv" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div><small>{tr('Quoted (excl. VAT)')}</small>{formatKr(f.quoted)}</div>
        <div><small>{tr('Invoiced')}</small>{formatKr(f.invoiced)}</div>
        <div><small>{tr('Expenses')}</small>{formatKr(f.expenses)}{f.expenses > f.ownExpenses && <small className="muted" style={{ display: 'block', textTransform: 'none', letterSpacing: 0 }}>{tr('{amount} billable', { amount: formatKr(f.expenses - f.ownExpenses) })}</small>}</div>
        <div><small>{tr('Earned after expenses')}</small>{formatKr(f.earned)}</div>
        <div><small>{tr('Hours')}</small>{formatHours(f.hours)}</div>
        <div>
          <small>{tr('Earned per hour')}</small>
          <span style={{ color: f.hours === 0 ? undefined : f.effectiveRate >= target ? 'var(--green)' : 'var(--danger)' }}>
            {f.hours ? formatKr(f.effectiveRate) : '—'}
          </span>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        {tr('Your hourly rate: {rate}', { rate: formatKr(target) })}{f.hours > 0 && <> · {f.margin >= 0 ? tr('{amount} more than the hours are worth.', { amount: formatKr(f.margin) }) : tr('{amount} less than the hours are worth.', { amount: formatKr(-f.margin) })}</>}
      </p>
    </section>
  )
}
