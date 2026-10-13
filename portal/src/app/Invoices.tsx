import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CreditCard, Plus, Printer, Trash2 } from 'lucide-react'
import { Modal } from '../components/ui'
import { useUndo } from '../components/Undo'
import { formatDate, formatKr, formatKrExact, isOverdue, today, useStore } from '../data/store'
import { projectVatRate, splitVat, vatLabel, withVat } from '../data/vat'
import { mailto, reminderEmail } from '../data/emails'
import type { InvoiceStatus } from '../data/types'
import { useT } from '../data/i18n'

const STATUS: InvoiceStatus[] = ['Draft', 'Issued', 'Paid']
const statusClass = { Draft: '', Issued: 'pill-amber', Paid: 'pill-green' } as const

export function NewInvoiceModal({ onClose, projectId }: { onClose: () => void; projectId?: string }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const [pid, setPid] = useState(projectId ?? state.projects[0]?.id ?? '')
  const project = state.projects.find((p) => p.id === pid)
  const [amount, setAmount] = useState('')
  // Studios think in prices excl. VAT; the invoice stores the total incl. VAT.
  const [inclVat, setInclVat] = useState(false)
  const rate = projectVatRate(state, pid)
  const entered = Number(amount) || 0
  const { net, vat, total } = splitVat(inclVat ? entered : withVat(entered, rate), rate)

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (!project) return
    dispatch({
      type: 'addInvoice',
      invoice: { clientId: project.clientId, projectId: project.id, amount: total, vatRate: rate, description: d.description || undefined, due: d.due || undefined, status: 'Draft' },
    })
    onClose()
  }

  return (
    <Modal title={tr('New invoice')} subtitle={tr('This will be {x0}. Numbers are never reused.', { x0: `INV-${String(state.nextInvoiceNumber).padStart(3, '0')}` })} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="ni-project">{tr('Project')}</label>
          <select id="ni-project" className="input" value={pid} onChange={(e) => setPid(e.target.value)} required>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ni-desc">{tr('Description')}</label>
          <input id="ni-desc" name="description" className="input" placeholder={tr('e.g. 50% at start – brand identity')} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ni-amount">{tr('Amount (kr.)')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input id="ni-amount" name="amount" type="number" min="0.01" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              <select className="input" style={{ width: 'auto' }} value={inclVat ? 'incl' : 'excl'} onChange={(e) => setInclVat(e.target.value === 'incl')} aria-label={tr('Amount is')}>
                <option value="excl">{tr('excl. VAT')}</option>
                <option value="incl">{tr('incl. VAT')}</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="ni-due">{tr('Pay by')}</label>
            <input id="ni-due" name="due" type="date" className="input" required />
          </div>
        </div>
        {entered > 0 && (
          <div className="totals" aria-live="polite">
            <div><span className="muted">{tr('Excl. VAT')}</span><span>{formatKrExact(net)}</span></div>
            <div><span className="muted">{vatLabel(state, pid)}</span><span>{formatKrExact(vat)}</span></div>
            <div className="grand"><span>{tr('Total')}</span><span>{formatKrExact(total)}</span></div>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" className="btn btn-primary">{tr('Create draft')}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Invoices() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const overdue = state.invoices.filter(isOverdue)
  const outstanding = state.invoices.filter((i) => i.status === 'Issued').reduce((s, i) => s + i.amount, 0)
  const drafts = state.invoices.filter((i) => i.status === 'Draft').reduce((s, i) => s + i.amount, 0)
  const invoices = [...state.invoices].sort((a, b) => b.number.localeCompare(a.number))

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('The business of good design')}</span>
          <h1>{tr('Invoices')}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)} disabled={!state.projects.length}>
          <Plus size={16} /> {tr('New invoice')}
        </button>
      </div>

      <div className="card stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat">
          <span className="stat-top">{tr('Outstanding')}</span>
          <b>{formatKr(outstanding)}</b>
          <small>{tr('Issued, not yet paid · incl. tax')}</small>
        </div>
        <div className="stat">
          <span className="stat-top">{tr('Overdue')}</span>
          <b style={{ color: overdue.length ? 'var(--danger)' : undefined }}>{formatKr(overdue.reduce((n, i) => n + i.amount, 0))}</b>
          <small>{overdue.length === 1 ? tr('1 invoice') : tr('{n} invoices', { n: overdue.length })}</small>
        </div>
        <div className="stat" style={{ borderBottom: 0 }}>
          <span className="stat-top">{tr('In draft')}</span>
          <b>{formatKr(drafts)}</b>
          <small>{tr('Not sent yet')}</small>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="empty"><p>{tr('No invoices yet.')}</p></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table stack">
            <thead>
              <tr><th>{tr('Invoice')}</th><th>{tr('Project')}</th><th>{tr('Due')}</th><th className="num">{tr('Amount')}</th><th>{tr('Status')}</th><th /></tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const p = state.projects.find((x) => x.id === i.projectId)
                const c = state.clients.find((x) => x.id === i.clientId)
                return (
                  <tr key={i.id}>
                    <td><b style={{ fontWeight: 500, fontFamily: 'var(--mono)', fontSize: 13 }}>{i.number}</b></td>
                    <td className="wide">
                      {p ? <Link to={`/app/projects/${p.id}/invoices`} className="cell-title"><span>{i.description ?? p.name}</span><small>{p.name}</small></Link> : c?.name}
                    </td>
                    <td data-label={tr('Due')}>
                      <span className={isOverdue(i) ? 'error' : undefined}>{formatDate(i.due)}</span>
                      {isOverdue(i) && <small className="error" style={{ display: 'block', fontSize: 11 }}>{tr('Overdue')}{i.remindersSent.length ? ' · ' + (i.remindersSent.length === 1 ? tr('1 reminder') : tr('{n} reminders', { n: i.remindersSent.length })) : ''}</small>}
                    </td>
                    <td data-label={tr('Amount')} className="num">{formatKr(i.amount)}</td>
                    <td>
                      <select
                        className={'pill ' + statusClass[i.status]}
                        style={{ border: 0, cursor: 'pointer' }}
                        value={i.status}
                        aria-label={tr('Status of {number}', { number: i.number })}
                        onChange={(e) => dispatch({ type: 'setInvoiceStatus', id: i.id, status: e.target.value as InvoiceStatus })}
                      >
                        {STATUS.map((s) => <option key={s} value={s}>{tr(s)}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isOverdue(i) && (() => {
                        const email = reminderEmail(state, i)
                        return email ? (
                          <a
                            className="btn btn-ghost btn-icon"
                            href={mailto(email)}
                            aria-label={tr('Send a reminder for {number}', { number: i.number })}
                            title={tr('Send a friendly reminder')}
                            onClick={() => dispatch({ type: 'update', coll: 'invoices', id: i.id, fn: (x) => ({ ...x, remindersSent: [...x.remindersSent, today()] }) })}
                          >
                            <BellRing size={15} />
                          </a>
                        ) : null
                      })()}
                      <button className="btn btn-ghost btn-icon" aria-label={tr('Payment link for {number}', { number: i.number })} title={i.paymentLink ? tr('Payment link set') : tr('Add a payment link')} onClick={() => setEditing(i.id)}>
                        <CreditCard size={15} style={{ color: i.paymentLink ? 'var(--green)' : undefined }} />
                      </button>
                      <Link className="btn btn-ghost btn-icon" to={`/print/invoice/${i.id}`} target="_blank" aria-label={tr('Print {number}', { number: i.number })}>
                        <Printer size={15} />
                      </Link>
                      <button
                        className="btn btn-ghost btn-icon"
                        aria-label={tr('Delete {number}', { number: i.number })}
                        onClick={() => undoable(tr('Invoice {number} deleted', { number: i.number }), () => dispatch({ type: 'deleteInvoice', id: i.id }))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12 }}>
        {tr('Issued invoices appear in the client portal with a Pay button when they have a payment link. Export for bookkeeping in')} <Link to="/app/reports" className="link-btn">{tr('Reports')}</Link>.
      </p>
      {editing && <PaymentLinkModal id={editing} onClose={() => setEditing(null)} />}

      {creating && <NewInvoiceModal onClose={() => setCreating(false)} />}
    </>
  )
}

/** Payment link (#32): MobilePay Box, Stripe Payment Link or similar. */
function PaymentLinkModal({ id, onClose }: { id: string; onClose: () => void }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const inv = state.invoices.find((i) => i.id === id)!
  const [url, setUrl] = useState(inv.paymentLink ?? '')
  const valid = !url.trim() || /^https:\/\/\S+$/.test(url.trim())
  return (
    <Modal title={tr('Payment link for {number}', { number: inv.number })} subtitle={tr('The client sees a Pay button next to the invoice in their portal and in reminder emails.')} onClose={onClose}>
      <div className="form">
        <div className="field">
          <label htmlFor="pay-url">{tr('Link')}</label>
          <input id="pay-url" className="input" placeholder={tr('https://buy.stripe.com/… or a MobilePay link')} value={url} onChange={(e) => setUrl(e.target.value)} />
          {!valid && <small className="error">{tr('The link must start with https://')}</small>}
          <small>{tr('Create one in Stripe (Payment Links) or MobilePay. Automatic payment links arrive when Stripe is connected.')}</small>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={() => {
              dispatch({ type: 'update', coll: 'invoices', id, fn: (x) => ({ ...x, paymentLink: url.trim() || undefined }) })
              onClose()
            }}
          >
            {tr('Save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
