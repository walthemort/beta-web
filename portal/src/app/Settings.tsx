import { APP_NAME } from '../components/brand'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, ExternalLink, Mail, Plus, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react'
import { Modal, useConfirm } from '../components/ui'
import { useUndo } from '../components/Undo'
import { Tabs, StatusPill } from '../components/kit'
import { digestEmail, mailto } from '../data/emails'
import { MEMBER_COLOURS, normalizeState } from '../data/defaults'
import { seed } from '../data/seed'
import { formatDate, formatHours, sampleWorkspace, timeAgo, uid, useDownloadBackup, useStore, workflowOf } from '../data/store'
import { ROLES, type Role, type State } from '../data/types'
import { MemberAvatar } from './shared'
import { activeLang, dateLocale, useT } from '../data/i18n'
import { accentColours } from '../data/theme'
import { WORKFLOW_PRESETS, workflowFrom } from '../data/workflows'
import { canAdd, hasFeature, planOf, storageGb } from '../data/plans'
import { COUNTRIES, guessCountry } from '../data/countries'
import { LimitNote, PlanSettings, UpgradeNote } from './Plan'
import { AccentField, AccentPairPicker, LogoSlot, PortalPreview } from '../features/brandKit'
import { CloudSettings } from '../features/cloud/CloudSettings'

export default function Settings() {
  const tr = useT()
  const { section = 'studio' } = useParams()
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('Your studio')}</span>
          <h1>{tr('Settings')}</h1>
        </div>
      </div>
      <Tabs
        tabs={[
          { to: '/app/settings', label: 'Studio', end: true },
          { to: '/app/settings/team', label: 'Team' },
          { to: '/app/settings/workflow', label: 'Workflow' },
          { to: '/app/settings/templates', label: 'Templates' },
          { to: '/app/settings/emails', label: 'Emails' },
          { to: '/app/settings/portal', label: 'Your brand' },
          { to: '/app/settings/cloud', label: 'Cloud' },
          { to: '/app/settings/data', label: 'Data' },
          { to: '/app/settings/plan', label: 'Plan§subscription' },
        ]}
      />
      {section === 'studio' && <StudioSettings />}
      {section === 'team' && <TeamSettings />}
      {section === 'workflow' && <WorkflowSettings />}
      {section === 'templates' && <TemplateSettings />}
      {section === 'emails' && <EmailSettings />}
      {section === 'portal' && <PortalSettings />}
      {section === 'cloud' && <CloudSettings />}
      {section === 'data' && <DataSettings />}
      {section === 'plan' && <PlanSettings />}
    </>
  )
}

function Saved({ show }: { show: boolean }) {
  const tr = useT()
  return show ? <span className="muted" style={{ fontSize: 13 }}>{tr('Saved')}</span> : null
}

function useSaved() {
  const [saved, setSaved] = useState(false)
  return { saved, flash: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) } }
}

/* ---------- Studio ---------- */

function StudioSettings() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const { saved, flash } = useSaved()
  const s = state.studio
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    dispatch({
      type: 'updateStudio',
      patch: {
        name: d.name, owner: d.owner, email: d.email, cvr: d.cvr, address: d.address, country: d.country, bank: d.bank, cvrLookupUrl: d.cvrLookupUrl === undefined ? s.cvrLookupUrl : d.cvrLookupUrl.trim() || undefined,
        tidyNames: d.tidyNames === 'on',
        vatRate: Number(d.vatRate) / 100, paymentTermsDays: Number(d.paymentTermsDays), hourlyRate: Number(d.hourlyRate),
      },
    })
    flash()
  }
  return (
    <form className="card panel form" onSubmit={submit} style={{ maxWidth: 720 }}>
      <h3>{tr('Studio details')}</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: -8 }}>{tr('Shown on invoices, proposals, contracts and the client portal.')}</p>
      <div className="form-row">
        <div className="field"><label htmlFor="s-name">{tr('Studio name')}</label><input id="s-name" name="name" className="input" defaultValue={s.name} required /></div>
        <div className="field"><label htmlFor="s-owner">{tr('Your name')}</label><input id="s-owner" name="owner" className="input" defaultValue={s.owner} required /></div>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor="s-email">{tr('Email')}</label><input id="s-email" name="email" type="email" className="input" defaultValue={s.email} /></div>
        <div className="field"><label htmlFor="s-cvr">{tr('CVR number')}</label><input id="s-cvr" name="cvr" className="input" defaultValue={s.cvr} /></div>
      </div>
      <div className="field"><label htmlFor="s-address">{tr('Address')}</label><input id="s-address" name="address" className="input" defaultValue={s.address} /></div>
      <div className="field">
        <label htmlFor="s-country">{tr('Country')}</label>
        <select id="s-country" name="country" className="input" defaultValue={s.country ?? guessCountry()}>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{tr(c.name)}</option>)}
        </select>
        <small>{tr('Sets the currency of {app}’s prices and the VAT on {app}’s invoices to you. A running subscription keeps its currency.', { app: APP_NAME })}</small>
      </div>
      <div className="field"><label htmlFor="s-bank">{tr('Bank details (shown on invoices)')}</label><input id="s-bank" name="bank" className="input" defaultValue={s.bank} /></div>
      <label className="toggle-row">
        <input type="checkbox" name="tidyNames" defaultChecked={s.tidyNames !== false} />
        <span>
          {tr('Tidy up file names when uploading')}
          <small className="muted" style={{ display: 'block' }}>{tr('“RAY Logo (FINAL v2).svg” becomes “ray_logo-final-v2.svg”, which every server and computer can handle.')}</small>
        </span>
      </label>
      {hasFeature(state, 'companyLookup') && <div className="field">
        <label htmlFor="s-cvrapi">{tr('Company lookup endpoint')} <span className="muted">{tr('(optional)')}</span></label>
        <input id="s-cvrapi" name="cvrLookupUrl" className="input" defaultValue={s.cvrLookupUrl ?? ''} placeholder="https://ditstudie.dk/api/cvr?q={q}" />
        <small className="muted">{tr('Leave empty to use {app}’s own /api/cvr (set VIRK_URL, VIRK_USER and VIRK_PASSWORD where the app is hosted). Never point it at a service that needs a key in the browser – anything there is public.', { app: APP_NAME })}</small>
      </div>}
      <div className="form-row">
        <div className="field"><label htmlFor="s-vat">{tr('VAT (%)')}</label><input id="s-vat" name="vatRate" type="number" min="0" max="100" className="input" defaultValue={Math.round(s.vatRate * 100)} /></div>
        <div className="field"><label htmlFor="s-terms">{tr('Payment terms (days)')}</label><input id="s-terms" name="paymentTermsDays" type="number" min="0" className="input" defaultValue={s.paymentTermsDays} /></div>
      </div>
      <div className="field">
        <label htmlFor="s-rate">{tr('Hourly rate (kr. excl. VAT)')}</label>
        <input id="s-rate" name="hourlyRate" type="number" min="0" className="input" defaultValue={s.hourlyRate} />
        <small>{tr('Used for extra revision rounds and to judge whether projects are profitable.')}</small>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn btn-primary" type="submit">{tr('Save')}</button>
        <Saved show={saved} />
      </div>
    </form>
  )
}

/* ---------- Team (#4) ---------- */

function TeamSettings() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const [adding, setAdding] = useState(false)
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    dispatch({
      type: 'insert',
      coll: 'team',
      item: { id: uid(), name: d.name, email: d.email, role: d.role as Role, capacity: Number(d.capacity) || 30, colour: MEMBER_COLOURS[state.team.length % MEMBER_COLOURS.length] },
    })
    setAdding(false)
  }
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 820 }}>
      <div className="section-head" style={{ margin: 0 }}>
        <p className="muted" style={{ fontSize: 14 }}>{tr('People get assigned to projects and tasks, log time and show up in Capacity. Real invites and permissions arrive with login.')}</p>
        {canAdd(state, 'members') ? (
          <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> {tr('Add person')}</button>
        ) : (
          <LimitNote what="members" />
        )}
      </div>
      <div className="card">
        {state.team.map((m) => {
          const projects = state.projects.filter((p) => p.memberIds.includes(m.id) && !p.archived).length
          const upd = (patch: Partial<typeof m>) => dispatch({ type: 'update', coll: 'team', id: m.id, fn: (x) => ({ ...x, ...patch }) })
          return (
            <div key={m.id} className="file-row team-row">
              <label className="colour-dot" title={tr('Colour')}>
                <MemberAvatar member={m} size={34} />
                <input type="color" value={m.colour} onChange={(e) => upd({ colour: e.target.value })} aria-label={tr('Colour for {name}', { name: m.name })} />
              </label>
              <input className="input input-sm" style={{ flex: '1 1 140px' }} value={m.name} onChange={(e) => upd({ name: e.target.value })} aria-label={tr('Name')} />
              <input className="input input-sm" style={{ flex: '1 1 180px' }} value={m.email} onChange={(e) => upd({ email: e.target.value })} aria-label={tr('Email')} />
              <select className="input input-sm" value={m.role} onChange={(e) => upd({ role: e.target.value as Role })} aria-label={tr('Role')} disabled={m.role === 'Owner' && state.team.filter((x) => x.role === 'Owner').length === 1}>
                {ROLES.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
              </select>
              <label className="usage">
                <input className="input input-sm" type="number" min="0" max="60" style={{ width: 60 }} value={m.capacity} onChange={(e) => upd({ capacity: Number(e.target.value) })} aria-label={tr('Hours per week')} /> {tr('h/wk')}
              </label>
              <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{projects} {tr('projects')}</span>
              <button
                className="btn btn-ghost btn-icon"
                aria-label={tr('Remove {name}', { name: m.name })}
                disabled={m.role === 'Owner' || m.id === state.currentMemberId}
                title={m.role === 'Owner' ? tr('The owner can’t be removed') : undefined}
                onClick={() =>
                  undoable(tr('{name} removed from the team', { name: m.name }), () => {
                    dispatch({ type: 'remove', coll: 'team', id: m.id })
                    state.projects.filter((p) => p.memberIds.includes(m.id)).forEach((p) => dispatch({ type: 'updateProject', id: p.id, patch: { memberIds: p.memberIds.filter((x) => x !== m.id) } }))
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="card panel" style={{ fontSize: 14 }}>
        <h3>{tr('What each role can do (once login is connected)')}</h3>
        <p><b>{tr('Owner')}</b> {tr('— everything, including money, settings and the team.')}</p>
        <p><b>{tr('Designer')}</b> {tr('— all projects, files, presentations and the brand hub. No invoices or reports.')}</p>
        <p><b>{tr('Freelancer')}</b> {tr('— only the projects they are added to. No money.')}</p>
      </div>
      {adding && (
        <Modal title={tr('Add person')} onClose={() => setAdding(false)}>
          <form className="form" onSubmit={add}>
            <div className="field"><label htmlFor="m-name">{tr('Name')}</label><input id="m-name" name="name" className="input" required /></div>
            <div className="field"><label htmlFor="m-email">{tr('Email')}</label><input id="m-email" name="email" type="email" className="input" required /></div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="m-role">{tr('Role')}</label>
                <select id="m-role" name="role" className="input" defaultValue="Designer">{ROLES.filter((r) => r !== 'Owner').map((r) => <option key={r} value={r}>{tr(r)}</option>)}</select>
              </div>
              <div className="field"><label htmlFor="m-cap">{tr('Hours per week')}</label><input id="m-cap" name="capacity" type="number" min="0" className="input" defaultValue={30} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setAdding(false)}>{tr('Cancel')}</button>
              <button type="submit" className="btn btn-primary">{tr('Add')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ---------- Workflow: the studio’s own stages ---------- */

const STAGE_COLOURS = ['#9a9993', '#c08a2e', '#8a4fff', '#1a4dff', '#e0673a', '#2f7a4a', '#c2342b', '#0f8b8d']

/** The steps Aftryk takes by itself, so nothing waits on someone remembering. */
function AutomationSettings() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const auto = state.studio.automations
  const toggle = (k: keyof typeof auto) => dispatch({ type: 'updateStudio', patch: { automations: { ...auto, [k]: !auto[k] } } })
  return (
    <section className="card panel">
      <h3>{tr('Automations')}</h3>
      <p className="muted" style={{ fontSize: 13 }}>{tr('What happens by itself when a client says yes.')}</p>
      <label className="toggle-row">
        <input type="checkbox" checked={auto.contractFromProposal} onChange={() => toggle('contractFromProposal')} />
        <span>{tr('Proposal accepted → draft the contract from your template')}</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={auto.deliverWhenApproved} onChange={() => toggle('deliverWhenApproved')} />
        <span>{tr('Every file in review approved → move the project to Delivery')}</span>
      </label>
      <p className="muted" style={{ fontSize: 12 }}>{tr('Always on: payment plans create draft invoices when a contract is signed, at delivery and on completion.')}</p>
    </section>
  )
}

function WorkflowSettings() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const { confirm, confirmNode } = useConfirm()
  const flows = state.studio.workflows
  const [flowId, setFlowId] = useState(flows[0].id)
  const flow = flows.find((w) => w.id === flowId) ?? flows[0]
  const stages = flow.stages
  const onFlow = state.projects.filter((p) => workflowOf(state, p).id === flow.id && !p.archived)
  const set = (next: typeof stages) => dispatch({ type: 'setStages', workflowId: flow.id, stages: next })
  const setFlows = (workflows: typeof flows) => dispatch({ type: 'setWorkflows', workflows })
  const count = (i: number) => onFlow.filter((p) => p.stage === i).length
  const move = (i: number, d: number) => {
    const next = [...stages]
    const [x] = next.splice(i, 1)
    next.splice(i + d, 0, x)
    set(next)
  }
  function addFlow(value: string) {
    const preset = WORKFLOW_PRESETS.find((p) => p.id === value)
    const w = workflowFrom(preset ?? { name: tr('New workflow') }, flows.map((x) => x.id))
    setFlows([...flows, preset ? { ...w, name: tr(preset.name) } : w])
    setFlowId(w.id)
  }
  return (
    <div className="split" style={{ alignItems: 'start' }}>
      <section className="card panel">
        <h3>{tr('Workflows')}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{tr('One for each kind of work you do – e.g. brand identities and websites. Every project follows one of them.')}</p>
        <div className="flow-tabs" role="tablist">
          {flows.map((w) => {
            const n = state.projects.filter((p) => workflowOf(state, p).id === w.id && !p.archived).length
            return (
              <button key={w.id} role="tab" aria-selected={w.id === flow.id} className={'chip' + (w.id === flow.id ? ' on' : '')} onClick={() => setFlowId(w.id)}>
                {tr(w.name)} <span className="muted">{n}</span>
              </button>
            )
          })}
          <select className="input input-sm" style={{ width: 'auto' }} value="" onChange={(e) => e.target.value && addFlow(e.target.value)} aria-label={tr('Add a workflow')}>
            <option value="">{tr('+ Add a workflow')}</option>
            {WORKFLOW_PRESETS.map((p) => <option key={p.id} value={p.id}>{tr(p.name)} – {tr(p.hint)}</option>)}
            <option value="blank">{tr('Something else – start blank')}</option>
          </select>
        </div>
        <div className="flow-head">
          <input className="input" value={flow.name} onChange={(e) => setFlows(flows.map((w) => (w.id === flow.id ? { ...w, name: e.target.value } : w)))} aria-label={tr('Workflow name')} />
          {flows.length > 1 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                confirm(
                  onFlow.length
                    ? tr('Delete the workflow “{name}”? Its {n} projects move to “{first}”.', { name: flow.name, n: onFlow.length, first: flows.find((w) => w.id !== flow.id)!.name })
                    : tr('Delete the workflow “{name}”?', { name: flow.name }),
                  () => {
                    const rest = flows.filter((w) => w.id !== flow.id)
                    setFlows(rest)
                    setFlowId(rest[0].id)
                  },
                )
              }
            >
              <Trash2 size={14} /> {tr('Delete workflow')}
            </button>
          )}
        </div>
        <h3 style={{ marginTop: 8 }}>{tr('Stages')}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{tr('Name them the way your studio works. The last stage means “complete”. Projects keep their place when you rename or reorder.')}</p>
        {stages.map((st, i) => (
          <div key={st.id} className="stage-edit">
            <label className="colour-dot" title={tr('Colour')}>
              <span className="stage-swatch" style={{ background: st.colour }} />
              <input type="color" value={st.colour} onChange={(e) => set(stages.map((x) => (x.id === st.id ? { ...x, colour: e.target.value } : x)))} aria-label={tr('Colour for {name}', { name: st.name })} />
            </label>
            <input className="input input-sm" style={{ flex: 1 }} value={st.name} onChange={(e) => set(stages.map((x) => (x.id === st.id ? { ...x, name: e.target.value } : x)))} aria-label={tr('Stage name')} />
            <span className="muted" style={{ fontSize: 12, width: 70 }}>{count(i) === 1 ? tr('1 project') : tr('{n} projects', { n: count(i) })}</span>
            <label className="muted" style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }} title={tr('Reaching this stage triggers “At delivery” invoices')}>
              <input type="radio" name={`delivery-${flow.id}`} checked={!!st.delivery} onChange={() => set(stages.map((x) => ({ ...x, delivery: x.id === st.id })))} /> {tr('Delivery')}
            </label>
            <button className="btn btn-ghost btn-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tr('Move {name} up', { name: st.name })}>↑</button>
            <button className="btn btn-ghost btn-icon" disabled={i === stages.length - 1} onClick={() => move(i, 1)} aria-label={tr('Move {name} down', { name: st.name })}>↓</button>
            <button
              className="btn btn-ghost btn-icon"
              disabled={stages.length <= 2}
              aria-label={tr('Delete {name}', { name: st.name })}
              onClick={() =>
                confirm(
                  count(i) ? count(i) === 1 ? tr('Delete “{name}”? Its project moves to the stage before.', { name: st.name }) : tr('Delete “{name}”? Its {n} projects move to the stage before.', { name: st.name, n: count(i) }) : tr('Delete “{name}”?', { name: st.name }),
                  () => set(stages.filter((x) => x.id !== st.id)),
                )
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          className="btn btn-ghost"
          style={{ justifySelf: 'start' }}
          onClick={() => {
            const next = [...stages]
            // New stages go before the final “complete” stage.
            next.splice(stages.length - 1, 0, { id: uid(), name: 'New stage', colour: STAGE_COLOURS[stages.length % STAGE_COLOURS.length] })
            set(next)
          }}
        >
          <Plus size={15} /> {tr('Add stage')}
        </button>
      </section>
      <section className="card panel">
        <h3>{tr('Preview')}</h3>
        <div className="stage-preview">
          {stages.map((st, i) => (
            <span key={st.id} style={{ background: st.colour }} title={tr(st.name)}>
              <b>{tr(st.name)}</b>
              <small>{i === stages.length - 1 ? tr('Complete') : st.delivery ? tr('Delivery') : ''}</small>
            </span>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12 }}>{tr('These colours are used on the board, the status grid, the project cards and the client portal.')}</p>
      </section>
      <AutomationSettings />
      {confirmNode}
    </div>
  )
}

/* ---------- Templates (#27, #39) ---------- */

function TemplateSettings() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  return (
    <div className="split" style={{ alignItems: 'start' }}>
      <section className="card panel">
        <h3>{tr('Project templates')}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{tr('Picked when you create a project: tasks with dates, questionnaire, budget and a draft proposal.')}</p>
        {state.projectTemplates.map((t) => {
          const upd = (patch: Partial<typeof t>) => dispatch({ type: 'update', coll: 'projectTemplates', id: t.id, fn: (x) => ({ ...x, ...patch }) })
          return (
            <details key={t.id} className="tpl-edit">
              <summary><b>{t.name}</b> <span className="muted">{t.tasks.length} {tr('tasks ·')} {t.questions.length} {tr('questions ·')} {formatHours(t.budgetHours ?? 0)}</span></summary>
              <div className="form" style={{ paddingTop: 12 }}>
                <div className="form-row">
                  <div className="field"><label>{tr('Name')}</label><input className="input input-sm" value={t.name} onChange={(e) => upd({ name: e.target.value })} /></div>
                  <div className="field"><label>{tr('Budget (h)')}</label><input className="input input-sm" type="number" value={t.budgetHours ?? ''} onChange={(e) => upd({ budgetHours: e.target.value ? Number(e.target.value) : undefined })} /></div>
                </div>
                <div className="field">
                  <label>{tr('Tasks')} <span className="muted">{tr('(“title | days after start”, one per line)')}</span></label>
                  <textarea
                    className="input"
                    rows={6}
                    defaultValue={t.tasks.map((x) => (x.offsetDays !== undefined ? `${x.title} | ${x.offsetDays}` : x.title)).join('\n')}
                    onBlur={(e) =>
                      upd({
                        tasks: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
                          const [title, days] = l.split('|').map((x) => x.trim())
                          return { title, offsetDays: days ? Number(days) : undefined }
                        }),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>{tr('Discovery questions')} <span className="muted">{tr('(one per line)')}</span></label>
                  <textarea className="input" rows={5} defaultValue={t.questions.join('\n')} onBlur={(e) => upd({ questions: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })} />
                </div>
                <div className="field">
                  <label>{tr('Proposal template')}</label>
                  <select className="input input-sm" value={t.proposalTemplateId ?? ''} onChange={(e) => upd({ proposalTemplateId: e.target.value || undefined })}>
                    <option value="">{tr('None')}</option>
                    {state.proposalTemplates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <button className="btn btn-ghost btn-danger btn-sm" style={{ justifySelf: 'start' }} onClick={() => undoable(tr('“{name}” template deleted', { name: t.name }), () => dispatch({ type: 'remove', coll: 'projectTemplates', id: t.id }))}>
                  <Trash2 size={14} /> {tr('Delete template')}
                </button>
              </div>
            </details>
          )
        })}
        <button
          className="btn btn-ghost"
          style={{ justifySelf: 'start' }}
          onClick={() => dispatch({ type: 'insert', coll: 'projectTemplates', item: { id: uid(), name: 'New template', service: 'Brand identity', description: '', tasks: [], questions: [], roundsIncluded: 2 } })}
        >
          <Plus size={15} /> {tr('New project template')}
        </button>
      </section>

      <section className="card panel">
        <h3>{tr('Proposal templates')}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{tr('Save any proposal as a template from its Proposal tab. Here you can rename or delete them.')}</p>
        {state.proposalTemplates.map((t) => (
          <div key={t.id} className="list-item">
            <input
              className="input input-sm"
              style={{ flex: 1 }}
              value={t.name}
              aria-label={tr('Template name')}
              onChange={(e) => dispatch({ type: 'update', coll: 'proposalTemplates', id: t.id, fn: (x) => ({ ...x, name: e.target.value }) })}
            />
            <small>{t.packages.length ? tr('{length} packages', { length: t.packages.length }) : tr('{length} lines', { length: t.items.length })} · {t.addons.length} {tr('add-ons')}</small>
            <button className="btn btn-ghost btn-icon" aria-label={tr('Delete {name}', { name: t.name })} onClick={() => undoable(tr('“{name}” template deleted', { name: t.name }), () => dispatch({ type: 'remove', coll: 'proposalTemplates', id: t.id }))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}

/* ---------- Emails (#2, #3, #34) ---------- */

function EmailSettings() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const [preview, setPreview] = useState<State['outbox'][number] | null>(null)
  const e = state.studio.emails
  const toggle = (k: keyof typeof e) => dispatch({ type: 'updateStudio', patch: { emails: { ...e, [k]: !e[k] } } })
  const queued = state.outbox.filter((m) => m.status === 'Queued')

  return (
    <div className="split" style={{ alignItems: 'start' }}>
      <section style={{ display: 'grid', gap: 16 }}>
        <div className="card panel" style={{ background: 'var(--blue-soft)', borderColor: 'transparent' }}>
          <h3>{tr('No email service connected yet')}</h3>
          <p style={{ fontSize: 14 }}>
            {tr('Emails are prepared automatically and wait here. Click')} <b>{tr('Open in Mail')}</b> {tr('to send one from your own mail app. Once an email service (e.g. Resend) is connected, they go out by themselves.')}
          </p>
        </div>
        <div className="section-head" style={{ margin: 0 }}>
          <h2 style={{ fontSize: 18 }}>{tr('Outbox')} <span className="count">{queued.length} {tr('waiting')}</span></h2>
          <button className="btn btn-sm" onClick={() => dispatch({ type: 'queueEmail', email: digestEmail(state) })}>{tr('Create weekly summary now')}</button>
        </div>
        {state.outbox.length === 0 && <div className="empty"><p>{tr('Nothing yet.')}</p></div>}
        <div className="card">
          {state.outbox.slice(0, 40).map((m) => (
            <div key={m.id} className="file-row">
              <Mail size={16} className="muted" />
              <button className="cell-title link-plain" style={{ flex: 1, minWidth: 0 }} onClick={() => setPreview(m)}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</span>
                <small>{tr('To')} {m.to} · {m.kind} · {timeAgo(m.at)}</small>
              </button>
              <StatusPill status={m.status === 'Queued' ? 'Draft' : 'Sent'} />
              <a className="btn btn-sm" href={mailto(m)} onClick={() => dispatch({ type: 'emailOpened', id: m.id })}>
                <ExternalLink size={13} /> {tr('Open in Mail')}
              </a>
            </div>
          ))}
        </div>
      </section>
      <section className="card panel">
        <h3>{tr('What gets emailed')}</h3>
        {[
          ['notifyStudio', 'To you: client comments, approvals, choices, signatures'],
          ['notifyClient', 'To clients: new things to review, stage changes, invoices'],
          ['weeklyDigest', 'To you: a weekly summary every Monday'],
          ['overdueReminders', 'To clients: a friendly reminder when an invoice is overdue (max. once a week)'],
        ].map(([k, label]) => (
          <label key={k} className="toggle-row">
            <input type="checkbox" checked={e[k as keyof typeof e]} onChange={() => toggle(k as keyof typeof e)} />
            <span>{tr(label)}</span>
          </label>
        ))}
        <p className="muted" style={{ fontSize: 12 }}>{tr('Client emails use each client’s language (English or Danish).')}</p>
      </section>
      {preview && (
        <Modal title={preview.subject} subtitle={tr('To {to}', { to: preview.to })} onClose={() => setPreview(null)}>
          <pre className="email-preview">{preview.body}</pre>
          <div className="modal-actions">
            <a className="btn btn-primary" href={mailto(preview)} onClick={() => dispatch({ type: 'emailOpened', id: preview.id })}>{tr('Open in Mail')}</a>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ---------- Your brand: how the studio looks to clients, in light and dark (#5) ---------- */

function PortalSettings() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const b = state.studio.brand
  const set = (patch: Partial<typeof b>) => dispatch({ type: 'updateStudio', patch: { brand: { ...b, ...patch } } })
  const host = b.portalDomain?.trim()
  const c = accentColours(b)
  const theme = b.portalTheme ?? 'auto'

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section className="card panel">
        <div>
          <span className="eyebrow">{tr('Your brand hub')}</span>
          <h3>{tr('How your studio looks to clients')}</h3>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>{tr('Clients see your logo and colour on every portal page, proposal and brand hub. Some of them use dark mode, so give {app} a version for each.', { app: APP_NAME })}</p>

        <h4 className="brand-h">{tr('Logo')}</h4>
        <div className="brand-grid">
          <LogoSlot tone="light" src={b.logoSrc} onChange={(logoSrc) => set({ logoSrc })} label={tr('On light')} hint={tr('Your main logo')} />
          <LogoSlot tone="dark" src={b.logoDarkSrc} onChange={(logoDarkSrc) => set({ logoDarkSrc })} label={tr('On dark')} hint={b.logoDarkSrc ? tr('Used in dark mode') : tr('Optional – e.g. a white version')} />
        </div>
        {b.logoSrc && !b.logoDarkSrc && theme !== 'light' && <small className="muted">{tr('Without a dark version, your main logo is shown in dark mode too. Check it’s visible on the dark tile above.')}</small>}

        <h4 className="brand-h">{tr('Accent colour')}</h4>
        <AccentPairPicker value={b} onChange={set} />
        <div className="brand-grid">
          <AccentField tone="light" value={c.light} ratio={c.lightRatio} onChange={(accent) => set({ accent })} />
          <AccentField tone="dark" value={c.dark} ratio={c.darkRatio} auto={c.autoDark} onChange={(accentDark) => set({ accentDark })} onAuto={() => set({ accentDark: undefined })} />
        </div>

        <h4 className="brand-h">{tr('Theme for clients')}</h4>
        <div className="seg" role="group" aria-label={tr('Theme for clients')} style={{ justifySelf: 'start', flexWrap: 'wrap' }}>
          {([['auto', 'Follow their device'], ['light', 'Always light'], ['dark', 'Always dark']] as const).map(([v, label]) => (
            <button key={v} aria-pressed={theme === v} onClick={() => set({ portalTheme: v })}>{tr(label)}</button>
          ))}
        </div>
        <small className="muted">{tr('Each brand hub can override this in its own settings.')}</small>
      </section>

      <div className="split" style={{ alignItems: 'start' }}>
        <section className="card panel">
          <h3>{tr('Preview')}</h3>
          <div className="brand-grid">
            {(['light', 'dark'] as const).filter((tone) => theme === 'auto' || theme === tone).map((tone) => (
              <PortalPreview key={tone} tone={tone} look={b} name={state.studio.name} />
            ))}
          </div>
          <Link to={`/p/${state.projects[0]?.id ?? ''}`} target="_blank" className="btn btn-sm" style={{ justifySelf: 'start' }}>{tr('Open a real portal')} <ExternalLink size={13} /></Link>
        </section>
        <section className="card panel form">
          <h3>{tr('Your own portal address')}</h3>
          <p className="muted" style={{ fontSize: 13 }}>{tr('Clients open their portal, proposals and brand hub on your own domain instead of {app}’s – e.g. clients.yourstudio.dk.', { app: APP_NAME })}</p>
          {hasFeature(state, 'customDomain') ? (
            <div className="field">
              <label htmlFor="p-domain">{tr('Address')}</label>
              <input id="p-domain" className="input" placeholder={tr('clients.yourstudio.dk')} value={b.portalDomain ?? ''} onChange={(e) => set({ portalDomain: e.target.value })} />
            </div>
          ) : (
            <UpgradeNote feature="customDomain" compact />
          )}
          {host && hasFeature(state, 'customDomain') && (
            <div className="dns">
              <p style={{ fontSize: 13 }}>{tr('When {app} is online, add this record where your domain is managed (e.g. Simply.com, One.com, GoDaddy):', { app: APP_NAME })}</p>
              <table className="table">
                <thead><tr><th>{tr('Type')}</th><th>{tr('Name')}</th><th>{tr('Value')}</th></tr></thead>
                <tbody><tr><td>{tr('CNAME')}</td><td><code>{host.split('.')[0]}</code></td><td><code>cname.vercel-dns.com</code></td></tr></tbody>
              </table>
              <p className="muted" style={{ fontSize: 12 }}>{tr('This only works after hosting is set up (Vercel). Until then, client links use this computer’s address.')}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/* ---------- Data ---------- */

/** A full stop after a date – unless it already ends in one (Danish months: “20. sep.”). */
const endSentence = (s: string) => (s.endsWith('.') ? s : s + '.')

function DataSettings() {
  const tr = useT()
  const { state, dispatch, storage } = useStore()
  const [files, setFiles] = useState<number | null>(null)
  useEffect(() => {
    // Uploaded files live in IndexedDB; the browser can estimate how much space they take.
    navigator.storage?.estimate?.().then((e) => setFiles(Math.max(0, (e.usage ?? 0) - storage.bytes))).catch(() => undefined)
  }, [storage.bytes])
  const pct = Math.min(100, Math.round((storage.bytes / storage.limit) * 100))
  // In the viewer's language: “0,05 MB” in Danish, “0.05 MB” in English.
  const mb = (n: number) => `${new Intl.NumberFormat(dateLocale(activeLang()), { maximumFractionDigits: n < 1024 * 1024 ? 2 : 1 }).format(n / 1024 / 1024)} MB`
  const samples = state.projects.filter((p) => p.sample)
  const own = state.projects.filter((p) => !p.sample)
  const { confirm, confirmNode } = useConfirm()

  /**
   * The sample projects exactly as they ship, while the studio stays itself: its name, plan,
   * branding, team and workflows are kept, so a demo can be run again from a clean sheet.
   */
  const freshSamples = (s: State): State => {
    const fresh = sampleWorkspace()
    return { ...fresh, studio: s.studio, team: s.team, currentMemberId: s.currentMemberId }
  }
  const [importError, setImportError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const exportData = useDownloadBackup()

  async function importData(file: File) {
    setImportError(null)
    try {
      const data = JSON.parse(await file.text()) as State
      if (!Array.isArray(data.projects) || !data.studio) throw new Error()
      confirm(tr('Replace everything with the backup “{name}”? Current data will be overwritten.', { name: file.name }), () =>
        dispatch({ type: 'replace', state: normalizeState(data as State & Record<string, unknown>, seed) }),
      )
    } catch {
      setImportError('That file isn’t a Aftryk backup.')
    }
  }

  return (
    <section className="card panel" style={{ maxWidth: 720 }}>
      <h3>{tr('Your data')}</h3>
      <div className="storage-meter">
        <div className="section-head" style={{ margin: 0 }}>
          <span style={{ fontSize: 14 }}>{tr('Projects, comments and settings')}</span>
          <span className={pct > 80 ? 'error' : 'muted'} style={{ fontSize: 13 }}>{mb(storage.bytes)} {tr('of about')} {mb(storage.limit)} ({pct}%)</span>
        </div>
        <div className="progress" style={{ height: 8 }}><span style={{ width: pct + '%', background: pct > 90 ? 'var(--danger)' : pct > 80 ? 'var(--amber)' : undefined }} /></div>
        {files !== null && <small className="muted">{tr('Uploaded files use about')} {mb(files)} {tr('more, in separate storage with much more room.')}</small>}
        <small className="muted">
          {tr('Your plan has room for {gb} GB of files.', { gb: storageGb(state) })}{' '}
          <Link to="/app/settings/plan">{planOf(state).id === 'free' ? tr('Need more space? See the plans') : tr('Add more space')}</Link>
        </small>
        {storage.error && <p className="error">{tr('Saving failed: storage is full. Download a backup, then free up space below.')}</p>}
        <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => dispatch({ type: 'trimHistory' })}>
          {tr('Free up space (clear old activity, read notifications and sent emails)')}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        {tr('Everything is saved in this browser for now. Download a backup regularly — uploaded files stay in the browser and aren’t part of the backup. Last change:')} {endSentence(formatDate(state.projects.map((p) => p.updatedAt).sort().at(-1)))}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={exportData}><Download size={15} /> {tr('Download backup')}</button>
        {state.studio.lastBackupAt && <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>{tr('Last backup')} {timeAgo(state.studio.lastBackupAt)}</span>}
        <button className="btn" onClick={() => fileInput.current?.click()}><Upload size={15} /> {tr('Restore backup')}</button>
        {samples.length > 0 && (
          <button
            className="btn"
            onClick={() =>
              confirm(tr('Remove the {length} sample projects and their clients? Your own work stays.', { length: samples.length }), () => {
                samples.forEach((p) => dispatch({ type: 'deleteProject', id: p.id }))
                state.clients.filter((c) => c.sample).forEach((c) => dispatch({ type: 'deleteClient', id: c.id }))
                state.invoices.filter((i) => samples.some((p) => p.id === i.projectId)).forEach((i) => dispatch({ type: 'deleteInvoice', id: i.id }))
              }, 'Remove')
            }
          >
            <Trash2 size={15} /> {tr('Remove sample projects')}
          </button>
        )}
        <button
          className="btn"
          onClick={() =>
            confirm(
              own.length
                ? tr('Put the sample projects back as they were? Your {count} own projects are deleted too – download a backup first.', { count: own.length })
                : tr('Put the sample projects back as they were, with every change to them undone?'),
              () => dispatch({ type: 'replace', state: freshSamples(state) }),
              'Reset the demo',
            )
          }
        >
          <Sparkles size={15} /> {tr('Reset the demo workspace')}
        </button>
        <button className="btn btn-ghost btn-danger" onClick={() => confirm(tr('Start over? Everything is deleted and you go through the first-time setup again. Download a backup first if you want to keep anything.'), () => dispatch({ type: 'reset' }), 'Start over')}>
          <RotateCcw size={15} /> {tr('Start over')}
        </button>
        <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = '' }} />
      </div>
      {importError && <p className="error">{importError}</p>}
      {confirmNode}
    </section>
  )
}
