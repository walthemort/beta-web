import { useState, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Building2, Download, Lock, Plus, Search, Send, Trash2, TrendingUp } from 'lucide-react'
import { Modal } from '../components/ui'
import { useUndo } from '../components/Undo'
import { StatusPill } from '../components/kit'
import { formatDate, formatKr, now, today, uid, useStore } from '../data/store'
import { useT } from '../data/i18n'
import { DEFAULT_LOOKUP, lookupCompany, type CompanyHit } from '../data/cvr'
import { leadStats, lostReasons, nudges, isOpenLead } from '../features/sales'
import { LeadFinderPage, downloadCsv, leadsCsv } from '../features/leadFinder'
import { projectFromTemplate } from '../data/templates'
import { EarlyAccessNote, useEarlyAccess } from './Plan'
import { COVERS } from './shared'
import {
  LEAD_SOURCES, LOST_REASONS, OPEN_LEAD_STAGES,
  type Lead, type LeadSource, type LeadStage, type LostReason, type Service,
} from '../data/types'

/** Where the next project comes from: leads, the pipeline, and what needs chasing today. */
export default function Sales() {
  const tr = useT()
  const { tab } = useParams()
  // Pipeline and Find leads are tabs of the Clients section (see Layout).
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('Where the next project comes from')}</span>
          <h1>{tab === 'find' ? tr('Find leads') : tr('Pipeline')}</h1>
        </div>
      </div>
      {tab === 'find' ? <FindLeads /> : <Pipeline />}
    </>
  )
}

/** Searching the company register – in early access, so studios ask for it first. */
function FindLeads() {
  const tr = useT()
  const { on } = useEarlyAccess('companyLookup')
  if (on) return <LeadFinderPage />
  return (
    <EarlyAccessNote
      feature="companyLookup"
      title={tr('Find leads in the company register')}
      text={tr('Search the Danish company register (CVR) by trade, size and town, and add companies as leads in one go. It’s in early access for now.')}
    />
  )
}

/** The leads you already have, from first contact to won or lost. */
function Pipeline() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const [editing, setEditing] = useState<Lead | 'new' | null>(null)
  const [winning, setWinning] = useState<Lead | null>(null)
  const [listId, setListId] = useState<string>('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<LeadStage | null>(null)

  // With a list chosen, every number and column below is about that list only.
  const leads = state.leads.filter((l) => !listId || !!l.listIds?.includes(listId))
  const list = state.leadLists.find((x) => x.id === listId)
  const stats = leadStats(listId ? { ...state, leads } : state)
  const todo = nudges(state)
  const lost = lostReasons(state)
  const decided = leads.filter((l) => !isOpenLead(l)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const move = (id: string, stage: LeadStage) => {
    const lead = state.leads.find((l) => l.id === id)
    if (!lead || lead.stage === stage) return
    if (stage === 'Won') return setWinning(lead)
    dispatch({ type: 'update', coll: 'leads', id, fn: (l) => ({ ...l, stage, updatedAt: now() }) })
  }
  const drop = (e: DragEvent, stage: LeadStage) => {
    e.preventDefault()
    setOver(null)
    setDragging(null)
    move(e.dataTransfer.getData('text/plain'), stage)
  }

  return (
    <>
      <div className="page-head" style={{ marginTop: 0 }}>
        <span />
        <button className="btn" onClick={() => setEditing('new')}><Plus size={16} /> {tr('Add lead')}</button>
      </div>

      {state.leadLists.length > 0 && (
        <div className="lead-lists">
          <button className={'chip' + (listId === '' ? ' on' : '')} onClick={() => setListId('')}>{tr('All leads')} <span>{state.leads.length}</span></button>
          {state.leadLists.map((l) => {
            const count = state.leads.filter((x) => x.listIds?.includes(l.id)).length
            const who = state.team.find((m) => m.id === l.assigneeId)
            return (
              <button key={l.id} className={'chip' + (listId === l.id ? ' on' : '')} onClick={() => setListId(l.id)} title={who ? tr('Assigned to {name}', { name: who.name }) : undefined}>
                {l.name} <span>{count}</span>
              </button>
            )
          })}
        </div>
      )}
      {list && (
        <div className="banner">
          <span>{tr('Showing the list “{name}”', { name: list.name })}{list.query ? ' · ' + list.query : ''}</span>
          <button className="btn btn-sm" onClick={() => downloadCsv(list.name, leadsCsv(leads))}><Download size={14} /> {tr('Download CSV')}</button>
          <button
            className="btn btn-sm btn-ghost"
            style={{ marginLeft: 0 }}
            onClick={() =>
              undoable(tr('“{name}” deleted', { name: list.name }), () => {
                dispatch({ type: 'remove', coll: 'leadLists', id: list.id })
                setListId('')
              })
            }
          >
            {tr('Delete list')}
          </button>
        </div>
      )}

      <div className="card stats">
        <div className="stat"><span className="stat-top">{tr('Open leads')}</span><b>{stats.open}</b><small>{tr('In the pipeline')}</small></div>
        <div className="stat"><span className="stat-top">{tr('Pipeline value')}</span><b>{formatKr(stats.pipeline)}</b><small>{tr('Excl. VAT, if all land')}</small></div>
        <div className="stat"><span className="stat-top">{tr('Won this year')}</span><b>{formatKr(stats.wonValue)}</b><small>{stats.wonThisYear === 1 ? tr('1 project') : tr('{n} projects', { n: stats.wonThisYear })}</small></div>
        <div className="stat">
          <span className="stat-top">{tr('Win rate')}</span>
          <b>{stats.decided ? `${Math.round(stats.winRate * 100)}%` : '—'}</b>
          <small>{tr('Of {n} decided', { n: stats.decided })}</small>
        </div>
      </div>

      {todo.length > 0 && (
        <section>
          <div className="section-head"><h2>{tr('Waiting on you')} <span className="count">{todo.length}</span></h2></div>
          <div className="card list">
            {todo.map((n) =>
              n.kind === 'lead' ? (
                <div key={n.id} className="list-item">
                  <Building2 size={15} className="muted" />
                  <span className="grow">
                    <span>{n.what}</span>
                    <small>{n.lead.company} · {tr('Due')} {formatDate(n.since)}</small>
                  </span>
                  <button className="btn btn-sm" onClick={() => setEditing(n.lead)}>{tr('Open')}</button>
                </div>
              ) : (
                <div key={n.id} className="list-item">
                  <Send size={15} className="muted" />
                  <span className="grow">
                    <span>{tr('No answer on “{title}”', { title: n.what })}</span>
                    <small>{tr('Sent {n} days ago', { n: n.days })} · {formatKr(n.total)}</small>
                  </span>
                  <Link className="btn btn-sm" to={`/app/projects/${n.proposal.projectId}/proposal`}>{tr('Follow up')}</Link>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <section>
        <div className="section-head"><h2>{tr('Pipeline')}</h2></div>
        {leads.length === 0 ? (
          <div className="empty"><p>{tr('No leads yet. Add the next company you’d like to work with – an enquiry, a referral, someone you met.')}</p></div>
        ) : (
          <div className="kanban sales">
            {OPEN_LEAD_STAGES.map((stage) => {
              const col = leads.filter((l) => l.stage === stage)
              return (
                <div
                  key={stage}
                  className={'kcol' + (over === stage ? ' over' : '')}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOver(stage)
                  }}
                  onDragLeave={() => setOver((o) => (o === stage ? null : o))}
                  onDrop={(e) => drop(e, stage)}
                >
                  <div className="kcol-head"><span>{tr(stage)}</span><span className="count">{col.length}</span></div>
                  {col.map((l) => (
                    <div
                      key={l.id}
                      className={'kcard' + (dragging === l.id ? ' dragging' : '')}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', l.id)
                        setDragging(l.id)
                      }}
                      onDragEnd={() => {
                        setDragging(null)
                        setOver(null)
                      }}
                    >
                      <button className="kcard-title link-btn" style={{ textAlign: 'left' }} onClick={() => setEditing(l)}>{l.company}</button>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {l.contactName || l.industry || tr(l.source)}{l.value ? ` · ${formatKr(l.value)}` : ''}
                        {l.assigneeId && <> · {state.team.find((m) => m.id === l.assigneeId)?.name.split(' ')[0]}</>}
                      </span>
                      {l.nextStep && (
                        <span className={l.nextStepDue && l.nextStepDue <= today() ? 'error' : 'muted'} style={{ fontSize: 12 }}>
                          {l.nextStep}{l.nextStepDue ? ` · ${formatDate(l.nextStepDue)}` : ''}
                        </span>
                      )}
                      <select
                        className="kcard-move"
                        value={l.stage}
                        aria-label={tr('Move {name} to stage', { name: l.company })}
                        onChange={(e) => move(l.id, e.target.value as LeadStage)}
                      >
                        {[...OPEN_LEAD_STAGES, 'Won' as const, 'Lost' as const].map((x) => <option key={x} value={x}>{tr(x)}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <div className="split">
          <section>
            <div className="section-head"><h2>{tr('Won and lost')}</h2></div>
            <div className="card list">
              {decided.slice(0, 8).map((l) => (
                <div key={l.id} className="list-item">
                  <span className="grow">
                    <span>{l.projectId ? <Link to={`/app/projects/${l.projectId}`}>{l.company}</Link> : l.company}</span>
                    <small>{formatDate(l.updatedAt.slice(0, 10))}{l.lostReason ? ` · ${tr(l.lostReason)}` : ''}{l.value ? ` · ${formatKr(l.value)}` : ''}</small>
                  </span>
                  <StatusPill status={l.stage === 'Won' ? 'Accepted' : 'Declined'} />
                  <button
                    className="btn btn-ghost btn-icon"
                    aria-label={tr('Delete {name}', { name: l.company })}
                    onClick={() => undoable(tr('{name} deleted', { name: l.company }), () => dispatch({ type: 'remove', coll: 'leads', id: l.id }))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          {lost.length > 0 && (
            <section>
              <div className="section-head"><h2>{tr('Why we lose')}</h2></div>
              <div className="card list">
                {lost.map((r) => (
                  <div key={r.reason} className="list-item">
                    <TrendingUp size={15} className="muted" />
                    <span className="grow">{tr(r.reason)}</span>
                    <b>{r.count}</b>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {editing && <LeadModal lead={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onWin={(l) => setWinning(l)} />}
      {winning && <WinModal lead={winning} onClose={() => setWinning(null)} />}
    </>
  )
}

/* ---------- Add or edit a lead ---------- */

function LeadModal({ lead, onClose, onWin }: { lead?: Lead; onClose: () => void; onWin: (l: Lead) => void }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const endpoint = state.studio.cvrLookupUrl?.trim() || DEFAULT_LOOKUP
  const lookup = useEarlyAccess('companyLookup')
  const [hits, setHits] = useState<CompanyHit[] | null>(null)
  const [looking, setLooking] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [fields, setFields] = useState<Partial<Lead>>(lead ?? { source: 'Referral', stage: 'New' })
  const set = (patch: Partial<Lead>) => setFields((f) => ({ ...f, ...patch }))

  async function look() {
    if (!endpoint || !fields.company?.trim()) return
    setLooking(true)
    setLookupError(null)
    try {
      setHits(await lookupCompany(endpoint, fields.company.trim()))
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : String(err))
    } finally {
      setLooking(false)
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const company = (fields.company ?? '').trim()
    if (!company) return
    const base: Lead = {
      id: lead?.id ?? uid(),
      company,
      cvr: fields.cvr?.trim() || undefined,
      address: fields.address?.trim() || undefined,
      contactName: fields.contactName?.trim() || undefined,
      email: fields.email?.trim() || undefined,
      phone: fields.phone?.trim() || undefined,
      website: fields.website?.trim() || undefined,
      source: (fields.source ?? 'Referral') as LeadSource,
      stage: (fields.stage ?? 'New') as LeadStage,
      value: fields.value ? Number(fields.value) : undefined,
      note: fields.note?.trim() || undefined,
      nextStep: fields.nextStep?.trim() || undefined,
      nextStepDue: fields.nextStepDue || undefined,
      lostReason: fields.stage === 'Lost' ? ((fields.lostReason ?? 'Other') as LostReason) : undefined,
      clientId: lead?.clientId,
      projectId: lead?.projectId,
      createdAt: lead?.createdAt ?? now(),
      updatedAt: now(),
    }
    if (lead) dispatch({ type: 'update', coll: 'leads', id: lead.id, fn: () => base })
    else dispatch({ type: 'insert', coll: 'leads', item: base })
    if (base.stage === 'Won' && !base.projectId) onWin(base)
    onClose()
  }

  return (
    <Modal title={lead ? lead.company : tr('Add lead')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="ld-company">{tr('Company')}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input id="ld-company" className="input" value={fields.company ?? ''} onChange={(e) => set({ company: e.target.value })} required autoFocus />
            {lookup.on ? (
              <button type="button" className="btn" onClick={look} disabled={looking || !fields.company?.trim()}>
                <Search size={15} /> {looking ? tr('Looking…') : tr('Look up')}
              </button>
            ) : (
              <button type="button" className="btn" onClick={lookup.request} disabled={!!lookup.requestedAt} title={tr('Looking companies up in the company register is in early access.')}>
                <Lock size={15} /> {lookup.requestedAt ? tr('Access requested') : tr('Request access')}
              </button>
            )}
          </div>
          <small className="muted">{lookup.on ? tr('Look up fills in CVR, address and industry from the company register.') : tr('Looking companies up in the company register is in early access.')}</small>
          {lookupError && <small className="error">{lookupError}</small>}
          {hits && hits.length === 0 && <small className="muted">{tr('Nothing found.')}</small>}
          {hits && hits.length > 0 && (
            <div className="list" style={{ marginTop: 6 }}>
              {hits.map((h) => (
                <button
                  key={h.cvr ?? h.company}
                  type="button"
                  className="list-item"
                  style={{ textAlign: 'left', width: '100%' }}
                  onClick={() => {
                    set({ company: h.company, cvr: h.cvr, address: h.address, email: h.email ?? fields.email, phone: h.phone ?? fields.phone, website: h.website ?? fields.website })
                    setHits(null)
                  }}
                >
                  <span className="grow">
                    <span>{h.company}{h.active === false && <span className="muted"> · {tr('closed')}</span>}</span>
                    <small>{[h.cvr && `CVR ${h.cvr}`, h.industry, h.employees && tr('{n} employees', { n: h.employees }), h.address?.replace('\n', ', ')].filter(Boolean).join(' · ')}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ld-contact">{tr('Contact person')}</label>
            <input id="ld-contact" className="input" value={fields.contactName ?? ''} onChange={(e) => set({ contactName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ld-email">{tr('Contact email')}</label>
            <input id="ld-email" type="email" className="input" value={fields.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ld-source">{tr('Where did they come from?')}</label>
            <select id="ld-source" className="input" value={fields.source ?? 'Referral'} onChange={(e) => set({ source: e.target.value as LeadSource })}>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{tr(s)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ld-value">{tr('Expected value (kr. excl. VAT)')}</label>
            <input id="ld-value" type="number" min="0" step="1000" className="input" value={fields.value ?? ''} onChange={(e) => set({ value: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ld-next">{tr('Next step')}</label>
            <input id="ld-next" className="input" placeholder={tr('e.g. Send proposal')} value={fields.nextStep ?? ''} onChange={(e) => set({ nextStep: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ld-due">{tr('By when')}</label>
            <input id="ld-due" type="date" className="input" value={fields.nextStepDue ?? ''} onChange={(e) => set({ nextStepDue: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ld-stage">{tr('Stage')}</label>
            <select id="ld-stage" className="input" value={fields.stage ?? 'New'} onChange={(e) => set({ stage: e.target.value as LeadStage })}>
              {[...OPEN_LEAD_STAGES, 'Won' as const, 'Lost' as const].map((s) => <option key={s} value={s}>{tr(s)}</option>)}
            </select>
          </div>
          {fields.stage === 'Lost' && (
            <div className="field">
              <label htmlFor="ld-lost">{tr('Why?')}</label>
              <select id="ld-lost" className="input" value={fields.lostReason ?? 'Other'} onChange={(e) => set({ lostReason: e.target.value as LostReason })}>
                {LOST_REASONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="ld-note">{tr('Note')}</label>
          <textarea id="ld-note" className="input" rows={2} value={fields.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" className="btn btn-primary">{lead ? tr('Save') : tr('Add lead')}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Won: turn it into real work ---------- */

function WinModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [templateId, setTemplateId] = useState(state.projectTemplates[0]?.id ?? '')
  const tpl = state.projectTemplates.find((t) => t.id === templateId)

  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const clientId = lead.clientId ?? uid()
    if (!lead.clientId)
      dispatch({
        type: 'addClient',
        client: {
          id: clientId,
          name: lead.company,
          contactName: lead.contactName ?? '',
          contactEmail: lead.email ?? '',
          contacts: [],
          language: 'da',
          cvr: lead.cvr,
          address: lead.address,
          vat: 'dk',
        },
      })
    const project = projectFromTemplate(tpl, {
      name: d.name.trim() || lead.company,
      clientId,
      service: (tpl?.service ?? 'Brand identity') as Service,
      startDate: d.startDate || today(),
      due: d.due || undefined,
      cover: { ...COVERS[0], wordmark: lead.company },
      memberIds: [state.currentMemberId],
    })
    dispatch({ type: 'addProject', project })
    dispatch({
      type: 'update',
      coll: 'leads',
      id: lead.id,
      fn: (l) => ({ ...l, stage: 'Won', clientId, projectId: project.id, updatedAt: now() }),
      log: { text: `Won: ${lead.company}`, projectId: project.id },
    })
    onClose()
    navigate(`/app/projects/${project.id}`)
  }

  return (
    <Modal title={tr('Won — nice one.')} subtitle={tr('{company} becomes a client and a project. Everything you filled in comes with it.', { company: lead.company })} onClose={onClose}>
      <form className="form" onSubmit={create}>
        <div className="field">
          <label>{tr('Start from')}</label>
          <div className="tpl-pick">
            {state.projectTemplates.map((t) => (
              <button type="button" key={t.id} className={'tpl' + (t.id === templateId ? ' on' : '')} onClick={() => setTemplateId(t.id)} aria-pressed={t.id === templateId}>
                <b>{t.name}</b>
                <small>{t.tasks.length} {tr('tasks ·')} {t.questions.length} {tr('questions')}</small>
              </button>
            ))}
            <button type="button" className={'tpl' + (templateId === '' ? ' on' : '')} onClick={() => setTemplateId('')} aria-pressed={templateId === ''}>
              <b>{tr('Blank')}</b>
              <small>{tr('Start from scratch')}</small>
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="wn-name">{tr('Project name')}</label>
          <input id="wn-name" name="name" className="input" defaultValue={`${lead.company} – ${tpl?.name ?? tr('Brand identity')}`} required />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="wn-start">{tr('Start date')}</label>
            <input id="wn-start" name="startDate" type="date" className="input" defaultValue={today()} />
          </div>
          <div className="field">
            <label htmlFor="wn-due">{tr('Deadline')} <span className="muted">{tr('(optional)')}</span></label>
            <input id="wn-due" name="due" type="date" className="input" />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" className="btn btn-primary">{tr('Create client and project')}</button>
        </div>
      </form>
    </Modal>
  )
}
