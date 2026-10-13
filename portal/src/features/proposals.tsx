import { APP_NAME } from '../components/brand'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, BookmarkPlus, Check, FileSignature, Plus, Printer, Send, Sparkles, Star, Trash2, X } from 'lucide-react'
import { AutoText, CopyLink, StatusPill } from '../components/kit'
import { Modal } from '../components/ui'
import { useUndo } from '../components/Undo'
import { DEFAULT_CONTRACT } from '../data/seed'
import { formatDate, formatDateLong, formatKr, now, proposalScope, proposalTotals, uid, useStore } from '../data/store'
import { proposalFromTemplate, templateFromProposal } from '../data/templates'
import { projectVatRate, vatLabel } from '../data/vat'
import { PAYMENT_TRIGGERS, type LineItem, type PaymentTrigger, type Project, type Proposal } from '../data/types'
import { translate, useT } from '../data/i18n'
import { draftRequest, fetchDraft, proposalFromDraft } from '../data/proposalDraft'
import { hasFeature } from '../data/plans'
import { UpgradeNote } from '../app/Plan'

export const clientUrl = (path: string) => `${location.origin}${path}`

/* ---------- Line item editor (used for fixed scope, packages and add-ons) ---------- */

function ItemsEditor({ items, onChange, disabled, addLabel = 'Add line' }: { items: LineItem[]; onChange: (items: LineItem[]) => void; disabled?: boolean; addLabel?: string }) {
  const tr = useT()
  const upd = (id: string, patch: Partial<LineItem>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  return (
    <>
      <table className="items">
        <thead>
          <tr><th>{tr('Description')}</th><th className="num" style={{ width: 70 }}>{tr('Qty')}</th><th className="num" style={{ width: 130 }}>{tr('Price (kr.)')}</th><th style={{ width: 40 }} /></tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td><input className="input" disabled={disabled} value={it.description} placeholder={tr('What’s included')} onChange={(e) => upd(it.id, { description: e.target.value })} aria-label={tr('Line description')} /></td>
              <td className="num"><input className="input" disabled={disabled} type="number" min="0" value={it.qty} onChange={(e) => upd(it.id, { qty: Number(e.target.value) })} aria-label={tr('Quantity')} /></td>
              <td className="num"><input className="input" disabled={disabled} type="number" min="0" step="100" value={it.price} onChange={(e) => upd(it.id, { price: Number(e.target.value) })} aria-label={tr('Price')} /></td>
              <td>
                {!disabled && (
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={tr('Remove line')} onClick={() => onChange(items.filter((x) => x.id !== it.id))}><X size={15} /></button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!disabled && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => onChange([...items, { id: uid(), description: '', qty: 1, price: 0 }])}>
          <Plus size={14} /> {tr(addLabel)}
        </button>
      )}
    </>
  )
}

const sum = (items: LineItem[]) => items.reduce((n, i) => n + i.qty * i.price, 0)

/* ---------- Studio editor ---------- */

/** The questionnaire is in: let Claude write the first draft from the client's own answers. */
function DraftFromDiscovery({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const [busy, setBusy] = useState(false)
  const answered = project.discovery.questions.filter((q) => q.a.trim()).length
  if (!answered) return null
  async function draft() {
    setBusy(true)
    // Free plans get the draft made from the template; Pro and up have it written by AI.
    const { draft, ai } = await fetchDraft(draftRequest(state, project), hasFeature(state, 'aiDrafts'))
    setBusy(false)
    dispatch({
      type: 'insert',
      coll: 'proposals',
      item: proposalFromDraft(state, project, draft),
      log: { text: ai ? 'Proposal drafted by AI from the discovery answers' : 'Proposal drafted from the discovery answers', projectId: project.id },
    })
  }
  return (
    <section className="card panel ai-draft">
      <div>
        <span className="eyebrow"><Sparkles size={12} style={{ verticalAlign: -1 }} /> {tr('From the discovery answers')}</span>
        <h3>{tr('Let {app} write the first draft', { app: APP_NAME })}</h3>
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        {tr('{n} answers from {client}, your template and what similar projects cost become a proposal you can edit. Nothing is sent to the client.', { n: answered, client: state.clients.find((c) => c.id === project.clientId)?.name ?? '' })}
      </p>
      <button className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={draft} disabled={busy}>
        <Sparkles size={15} /> {busy ? tr('Writing… (about half a minute)') : tr('Draft the proposal')}
      </button>
      {!hasFeature(state, 'aiDrafts') && <UpgradeNote feature="aiDrafts" compact />}
    </section>
  )
}

export function ProjectProposal({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const undoable = useUndo()
  const [savingTemplate, setSavingTemplate] = useState(false)
  const client = state.clients.find((c) => c.id === project.clientId)
  const proposal = state.proposals.find((p) => p.projectId === project.id)
  const contract = state.contracts.find((c) => c.projectId === project.id)

  if (!proposal)
    return (
      <div style={{ display: 'grid', gap: 16 }}>
      <DraftFromDiscovery project={project} />
      <div className="card panel">
        <h3>{tr('Start a proposal')}</h3>
        <div className="tpl-pick">
          {state.proposalTemplates.map((t) => (
            <button
              key={t.id}
              className="tpl"
              onClick={() => dispatch({ type: 'insert', coll: 'proposals', item: proposalFromTemplate(t, project.id, client?.name ?? project.name), log: { text: 'Proposal started', projectId: project.id } })}
            >
              <b>{t.name}</b>
              <small>{t.packages.length ? tr('{length} packages', { length: t.packages.length }) : tr('{length} lines', { length: t.items.length })} · {t.addons.length} {tr('add-ons')}</small>
            </button>
          ))}
          <button className="tpl" onClick={() => dispatch({ type: 'insert', coll: 'proposals', item: proposalFromTemplate(undefined, project.id, client?.name ?? project.name) })}>
            <b>{tr('Blank')}</b>
            <small>{tr('Start from scratch')}</small>
          </button>
        </div>
      </div>
      </div>
    )

  const locked = proposal.status === 'Accepted'
  const set = (fn: (p: Proposal) => Proposal, log?: string, notify?: boolean) =>
    dispatch({ type: 'update', coll: 'proposals', id: proposal.id, fn, log: log ? { text: log, projectId: project.id, notify, link: `/p/${project.id}/proposal` } : undefined })
  const mode = proposal.packages.length ? 'packages' : 'fixed'
  const scope = proposalScope(proposal)
  const { subtotal, vat, total } = proposalTotals(scope, projectVatRate(state, proposal.projectId))
  const planSum = proposal.paymentPlan.reduce((n, s) => n + s.percent, 0)
  const link = `/p/${project.id}/proposal`

  return (
    <div className="split split-aside">
      <div className="doc-editor">
        {locked && (
          <p className="pill pill-green" style={{ justifySelf: 'start', height: 'auto', padding: '6px 12px' }}>
            {tr('Accepted by')} {proposal.respondedBy} {tr('on')} {formatDateLong(proposal.respondedAt)} {tr('— locked for editing.')}
          </p>
        )}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
          <input className="input title" value={proposal.title} onChange={(e) => set((p) => ({ ...p, title: e.target.value }))} aria-label={tr('Proposal title')} />
          <AutoText value={proposal.intro} placeholder={tr('A short, personal introduction…')} onChange={(e) => set((p) => ({ ...p, intro: e.target.value }))} aria-label={tr('Introduction')} />
          {proposal.sections.map((s) => (
            <div key={s.id} className="section-edit">
              <input className="input" value={s.title} aria-label={tr('Section title')} onChange={(e) => set((p) => ({ ...p, sections: p.sections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) }))} />
              <AutoText value={s.body} placeholder={tr('Write this section…')} aria-label={tr('{title} text', { title: s.title })} onChange={(e) => set((p) => ({ ...p, sections: p.sections.map((x) => (x.id === s.id ? { ...x, body: e.target.value } : x)) }))} />
              {!locked && (
                <button type="button" className="btn btn-ghost btn-icon del" aria-label={tr('Remove section {title}', { title: s.title })} onClick={() => set((p) => ({ ...p, sections: p.sections.filter((x) => x.id !== s.id) }))}>
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={() => set((p) => ({ ...p, sections: [...p.sections, { id: uid(), title: 'New section', body: '' }] }))}>
            <Plus size={15} /> {tr('Add section')}
          </button>

          {/* Pricing */}
          <div className="card panel">
            <div className="section-head" style={{ margin: 0 }}>
              <h3>{tr('Investment')}</h3>
              <div className="seg" role="group" aria-label={tr('Pricing')}>
                <button
                  type="button"
                  aria-pressed={mode === 'fixed'}
                  onClick={() => set((p) => ({ ...p, packages: [], items: p.items.length ? p.items : p.packages[0]?.items ?? [] }))}
                >
                  {tr('Fixed price')}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'packages'}
                  onClick={() =>
                    mode === 'fixed' &&
                    set((p) => ({
                      ...p,
                      packages: [
                        { id: uid(), name: 'Essential', description: '', items: p.items.map((i) => ({ ...i, id: uid() })) },
                        { id: uid(), name: 'Complete', description: '', recommended: true, items: p.items.map((i) => ({ ...i, id: uid() })) },
                      ],
                    }))
                  }
                >
                  {tr('Packages')}
                </button>
              </div>
            </div>

            {mode === 'fixed' ? (
              <ItemsEditor items={proposal.items} disabled={locked} onChange={(items) => set((p) => ({ ...p, items }))} />
            ) : (
              <div className="pkg-edit">
                {proposal.packages.map((pk) => {
                  const upd = (patch: Partial<typeof pk>) => set((p) => ({ ...p, packages: p.packages.map((x) => (x.id === pk.id ? { ...x, ...patch } : x)) }))
                  return (
                    <div key={pk.id} className={'pkg' + (pk.recommended ? ' rec' : '')}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input className="input input-sm" style={{ fontWeight: 500, flex: 1 }} value={pk.name} onChange={(e) => upd({ name: e.target.value })} aria-label={tr('Package name')} />
                        <button
                          type="button"
                          className={'btn btn-sm' + (pk.recommended ? ' btn-primary' : '')}
                          onClick={() => set((p) => ({ ...p, packages: p.packages.map((x) => ({ ...x, recommended: x.id === pk.id })) }))}
                          title={tr('Show as recommended')}
                        >
                          <Star size={13} /> {pk.recommended ? tr('Recommended') : tr('Recommend')}
                        </button>
                        {proposal.packages.length > 1 && (
                          <button type="button" className="btn btn-ghost btn-icon" aria-label={tr('Remove {name}', { name: pk.name })} onClick={() => set((p) => ({ ...p, packages: p.packages.filter((x) => x.id !== pk.id) }))}><X size={15} /></button>
                        )}
                      </div>
                      <input className="input input-sm" value={pk.description} placeholder={tr('Who is this package for?')} onChange={(e) => upd({ description: e.target.value })} aria-label={tr('Package description')} />
                      <ItemsEditor items={pk.items} disabled={locked} onChange={(items) => upd({ items })} />
                      <p className="muted" style={{ fontSize: 13, textAlign: 'right' }}>{formatKr(sum(pk.items))} {tr('excl. VAT')}</p>
                    </div>
                  )
                })}
                {proposal.packages.length < 3 && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => set((p) => ({ ...p, packages: [...p.packages, { id: uid(), name: 'New package', description: '', items: [] }] }))}>
                    <Plus size={14} /> {tr('Add package')}
                  </button>
                )}
              </div>
            )}

            <h3 style={{ marginTop: 10 }}>{tr('Optional add-ons')}</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>{tr('The client can tick these on or off; the total updates live.')}</p>
            <ItemsEditor items={proposal.addons} disabled={locked} onChange={(addons) => set((p) => ({ ...p, addons }))} addLabel={tr('Add add-on')} />

            <div className="totals">
              <div><span className="muted">{mode === 'packages' ? tr('Recommended package') : tr('Subtotal')}</span><span>{formatKr(subtotal)}</span></div>
              <div><span className="muted">{vatLabel(state, proposal.projectId)}</span><span>{formatKr(vat)}</span></div>
              <div className="grand"><span>{tr('Total')}</span><span>{formatKr(total)}</span></div>
              {proposal.addons.length > 0 && (
                <div><span className="muted">{tr('With all add-ons')}</span><span className="muted">{formatKr(proposalTotals(proposalScope(proposal, undefined, proposal.addons.map((a) => a.id)), projectVatRate(state, proposal.projectId)).total)}</span></div>
              )}
            </div>
          </div>

          {/* Payment plan */}
          <div className="card panel">
            <div className="section-head" style={{ margin: 0 }}>
              <h3>{tr('Payment plan')}</h3>
              <span className={planSum === 100 ? 'pill pill-green' : 'pill pill-red'}>{planSum}%</span>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>{tr('Draft invoices are created automatically when each step is reached.')}</p>
            {proposal.paymentPlan.map((step) => {
              const upd = (patch: Partial<typeof step>) => set((p) => ({ ...p, paymentPlan: p.paymentPlan.map((x) => (x.id === step.id ? { ...x, ...patch } : x)) }))
              const inv = state.invoices.find((i) => i.id === step.invoiceId)
              return (
                <div key={step.id} className="plan-row">
                  <input className="input input-sm" style={{ flex: 1, minWidth: 120 }} value={step.label} onChange={(e) => upd({ label: e.target.value })} aria-label={tr('Step label')} />
                  <label className="usage"><input className="input input-sm" type="number" min="0" max="100" style={{ width: 60 }} value={step.percent} onChange={(e) => upd({ percent: Number(e.target.value) })} aria-label={tr('Percent')} />%</label>
                  <select className="input input-sm" value={step.trigger} onChange={(e) => upd({ trigger: e.target.value as PaymentTrigger })} aria-label={tr('When')}>
                    {PAYMENT_TRIGGERS.map((t) => <option key={t} value={t}>{tr(t)}</option>)}
                  </select>
                  {inv ? (
                    <Link to="/app/invoices" className="pill pill-green">{inv.number}</Link>
                  ) : (
                    !locked && <button type="button" className="btn btn-ghost btn-icon" aria-label={tr('Remove step')} onClick={() => set((p) => ({ ...p, paymentPlan: p.paymentPlan.filter((x) => x.id !== step.id) }))}><X size={14} /></button>
                  )}
                </div>
              )
            })}
            {!locked && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => set((p) => ({ ...p, paymentPlan: [...p.paymentPlan, { id: uid(), label: 'Payment', percent: Math.max(0, 100 - planSum), trigger: 'At delivery' }] }))}>
                <Plus size={14} /> {tr('Add step')}
              </button>
            )}
          </div>
        </fieldset>
      </div>

      <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 72, alignContent: 'start' }}>
        <section className="card panel">
          <div className="section-head" style={{ margin: 0 }}>
            <h3>{tr('Status')}</h3>
            <StatusPill status={proposal.status} />
          </div>
          <div className="field">
            <label htmlFor="valid">{tr('Valid until')}</label>
            <input id="valid" type="date" className="input input-sm" style={{ width: '100%' }} disabled={locked} value={proposal.validUntil ?? ''} onChange={(e) => set((p) => ({ ...p, validUntil: e.target.value || undefined }))} />
          </div>
          {proposal.status === 'Draft' && (
            <button className="btn btn-primary" onClick={() => set((p) => ({ ...p, status: 'Sent', sentAt: now() }), 'Your proposal is ready', true)} disabled={total === 0 || (proposal.paymentPlan.length > 0 && planSum !== 100)}>
              <Send size={15} /> {tr('Send to client')}
            </button>
          )}
          {proposal.paymentPlan.length > 0 && planSum !== 100 && proposal.status === 'Draft' && <p className="error" style={{ fontSize: 12 }}>{tr('The payment plan must add up to 100%.')}</p>}
          {proposal.status !== 'Draft' && <CopyLink url={clientUrl(link)} />}
          {proposal.status === 'Declined' && (
            <button className="btn" onClick={() => set((p) => ({ ...p, status: 'Draft', respondedAt: undefined, respondedBy: undefined }))}>{tr('Revise and resend')}</button>
          )}
          <Link className="btn" to={link} target="_blank">{tr('Preview as client')} <ArrowUpRight size={15} /></Link>
          <Link className="btn" to={`/print/proposal/${proposal.id}`} target="_blank"><Printer size={15} /> {tr('Print / PDF')}</Link>
          <button className="btn btn-ghost" onClick={() => setSavingTemplate(true)}><BookmarkPlus size={15} /> {tr('Save as template')}</button>
        </section>

        {proposal.status === 'Accepted' && (
          <section className="card panel">
            <h3>{tr('Next steps')}</h3>
            {proposal.chosenPackageId && <p className="muted" style={{ fontSize: 13 }}>{tr('Chose')} <b>{proposal.packages.find((p) => p.id === proposal.chosenPackageId)?.name}</b>{proposal.chosenAddonIds.length > 0 && ' + ' + (proposal.chosenAddonIds.length === 1 ? tr('1 add-on') : tr('{n} add-ons', { n: proposal.chosenAddonIds.length }))}.</p>}
            {contract ? (
              <Link className="btn" to={`/app/projects/${project.id}/contract`}><FileSignature size={15} /> {tr('Open contract')}</Link>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => {
                  dispatch({
                    type: 'insert',
                    coll: 'contracts',
                    item: { id: uid(), projectId: project.id, proposalId: proposal.id, title: `${tr('Project agreement')} – ${client?.name ?? project.name}`, body: contractBody(proposal), status: 'Draft', createdAt: now() },
                    log: { text: 'Contract drafted from proposal', projectId: project.id },
                  })
                  navigate(`/app/projects/${project.id}/contract`)
                }}
              >
                <FileSignature size={15} /> {tr('Create contract')}
              </button>
            )}
            {proposal.paymentPlan.length > 0 && (
              <div className="list">
                {proposal.paymentPlan.map((s) => {
                  const inv = state.invoices.find((i) => i.id === s.invoiceId)
                  return (
                    <div key={s.id} className="list-item">
                      <span className="grow"><span>{tr(s.label)}</span><small>{inv ? `${inv.number} · ${tr(inv.status)}` : tr('Invoiced automatically {x0}', { x0: tr(s.trigger).toLowerCase() })}</small></span>
                      {!inv && (
                        <button className="btn btn-sm" onClick={() => set((p) => ({ ...p, paymentPlan: p.paymentPlan.map((x) => (x.id === s.id ? { ...x, invoiceNow: true } : x)) }))}>
                          {tr('Invoice now')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {!locked && (
          <button className="btn btn-ghost btn-danger" style={{ justifySelf: 'start' }} onClick={() => undoable(tr('Proposal deleted'), () => dispatch({ type: 'remove', coll: 'proposals', id: proposal.id }))}>
            <Trash2 size={15} /> {tr('Delete proposal')}
          </button>
        )}
      </aside>
      {savingTemplate && <SaveTemplateModal proposal={proposal} onClose={() => setSavingTemplate(false)} />}
    </div>
  )
}

/** The contract's payment clause follows the proposal's payment plan. */
/** The standard terms in the studio's language, with the proposal's own payment plan written in. */
function contractBody(p: Proposal) {
  const body = translate(DEFAULT_CONTRACT)
  if (!p.paymentPlan.length) return body
  const plan = p.paymentPlan.map((s) => `${s.percent}% ${translate(s.trigger).toLowerCase()}`).join(', ')
  const standard = translate('50% is invoiced at start and 50% at delivery.')
  return body.replace(standard, translate('Payment is invoiced as follows: {plan}.', { plan }))
}

function SaveTemplateModal({ proposal, onClose }: { proposal: Proposal; onClose: () => void }) {
  const tr = useT()
  const { dispatch } = useStore()
  const [name, setName] = useState(proposal.title.replace(/^A new chapter for /, '') + ' template')
  return (
    <Modal title={tr('Save as template')} subtitle={tr('Reuse the sections, prices, add-ons and payment plan in future proposals.')} onClose={onClose}>
      <div className="form">
        <div className="field"><label htmlFor="tpl-name">{tr('Template name')}</label><input id="tpl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => {
              dispatch({ type: 'insert', coll: 'proposalTemplates', item: templateFromProposal(proposal, name.trim()) })
              onClose()
            }}
          >
            {tr('Save template')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- The proposal as a document (client view + print) ---------- */

export function ProposalDocument({
  proposal,
  selection,
  onSelect,
}: {
  proposal: Proposal
  /** The client's current picks (interactive) – defaults to what was saved. */
  selection?: { packageId?: string; addonIds: string[] }
  onSelect?: (s: { packageId?: string; addonIds: string[] }) => void
}) {
  const tr = useT()
  const { state } = useStore()
  const project = state.projects.find((p) => p.id === proposal.projectId)
  const client = state.clients.find((c) => c.id === project?.clientId)
  const sel = selection ?? { packageId: proposal.chosenPackageId, addonIds: proposal.chosenAddonIds }
  const pkg = proposal.packages.find((p) => p.id === sel.packageId) ?? proposal.packages.find((p) => p.recommended) ?? proposal.packages[0]
  const scope = proposalScope(proposal, pkg?.id, sel.addonIds)
  const { subtotal, vat, total } = proposalTotals(scope, projectVatRate(state, proposal.projectId))
  const interactive = !!onSelect

  return (
    <article className="doc">
      <header className="doc-head">
        <span className="eyebrow">{state.studio.name} × {client?.name}</span>
        <h1>{proposal.title}</h1>
        <p className="muted">
          {tr('Proposal ·')} {formatDateLong(proposal.sentAt ?? proposal.createdAt)}
          {proposal.validUntil && <> {tr('· Valid until')} {formatDateLong(proposal.validUntil)}</>}
        </p>
      </header>
      {proposal.intro && <p className="doc-lead">{tr(proposal.intro)}</p>}
      {proposal.sections.filter((s) => s.body.trim()).map((s) => (
        <section key={s.id}>
          <h2>{tr(s.title)}</h2>
          <p>{tr(s.body)}</p>
        </section>
      ))}

      <section>
        <h2>{tr('Investment')}</h2>
        {proposal.packages.length > 0 && (
          <div className="pkgs">
            {proposal.packages.map((p) => {
              const on = p.id === pkg?.id
              return (
                <button
                  key={p.id}
                  type="button"
                  className={'pkg-card' + (on ? ' on' : '')}
                  disabled={!interactive}
                  onClick={() => onSelect?.({ ...sel, packageId: p.id })}
                  aria-pressed={on}
                >
                  {p.recommended && <span className="pkg-rec"><Star size={11} /> {tr('Recommended')}</span>}
                  <b>{tr(p.name)}</b>
                  {p.description && <span className="muted">{p.description}</span>}
                  <ul>{p.items.map((i) => <li key={i.id}>{tr(i.description)}</li>)}</ul>
                  <span className="pkg-price">{formatKr(sum(p.items))} <small>{tr('excl. VAT')}</small></span>
                  {interactive && <span className="pkg-radio">{on ? <><Check size={13} /> {tr('Selected')}</> : tr('Choose')}</span>}
                </button>
              )
            })}
          </div>
        )}

        <table className="doc-table">
          <tbody>
            {scope.filter((i) => i.description && !proposal.addons.some((a) => a.id === i.id)).map((i) => (
              <tr key={i.id}>
                <td>{tr(i.description)}{i.qty !== 1 && <span className="muted"> × {i.qty}</span>}</td>
                <td className="num">{formatKr(i.qty * i.price)}</td>
              </tr>
            ))}
            {proposal.addons.map((a) => {
              const on = sel.addonIds.includes(a.id)
              if (!interactive && !on) return null
              return (
                <tr key={a.id} className={'addon' + (on ? ' on' : '')}>
                  <td>
                    {interactive ? (
                      <label className="addon-check">
                        <input type="checkbox" checked={on} onChange={() => onSelect?.({ ...sel, addonIds: on ? sel.addonIds.filter((x) => x !== a.id) : [...sel.addonIds, a.id] })} />
                        <span>{tr(a.description)}{a.qty !== 1 && <span className="muted"> × {a.qty}</span>} <span className="pill">{tr('Optional')}</span></span>
                      </label>
                    ) : (
                      <>{tr(a.description)} <span className="muted">{tr('(add-on)')}</span></>
                    )}
                  </td>
                  <td className="num">{on ? '' : '+ '}{formatKr(a.qty * a.price)}</td>
                </tr>
              )
            })}
            <tr className="sub"><td>{tr('Subtotal')}</td><td className="num">{formatKr(subtotal)}</td></tr>
            <tr className="sub"><td>{vatLabel(state, proposal.projectId)}</td><td className="num">{formatKr(vat)}</td></tr>
            <tr className="total"><td>{tr('Total')}</td><td className="num">{formatKr(total)}</td></tr>
          </tbody>
        </table>
      </section>

      {proposal.paymentPlan.length > 0 && (
        <section>
          <h2>{tr('Payment')}</h2>
          <table className="doc-table">
            <tbody>
              {proposal.paymentPlan.map((s) => (
                <tr key={s.id}>
                  <td>{tr(s.label)} <span className="muted">· {tr(s.trigger).toLowerCase()}</span></td>
                  <td className="num">{formatKr(Math.round((total * s.percent) / 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 13 }}>{tr('Payment terms:')} {state.studio.paymentTermsDays} {tr('days. Valid until')} {formatDate(proposal.validUntil)}.</p>
        </section>
      )}
    </article>
  )
}
