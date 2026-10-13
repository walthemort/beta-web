/** Set up a monthly retainer on a project and see this month's hours against it. */
import { useState, type FormEvent } from 'react'
import { CalendarClock, Receipt } from 'lucide-react'
import { formatHours, formatKr, useStore } from '../data/store'
import { activeLang, useT } from '../data/i18n'
import type { Project } from '../data/types'
import { monthLabel, retainerUsage } from '../data/retainers'
import { projectVatRate, withVat } from '../data/vat'

const thisMonth = () => new Date().toISOString().slice(0, 7)

export function RetainerPanel({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const r = project.retainer
  const month = thisMonth()
  const lang = activeLang()

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const retainer = {
      monthlyFee: Number(d.fee),
      hoursIncluded: Number(d.hours),
      startMonth: d.start || month,
      endMonth: d.end || undefined,
      invoicedMonths: r?.invoicedMonths ?? [],
      extraInvoicedMonths: r?.extraInvoicedMonths ?? [],
    }
    dispatch({ type: 'updateProject', id: project.id, patch: { retainer }, log: { text: r ? 'Retainer updated' : `Retainer set up: ${formatKr(retainer.monthlyFee)} a month`, projectId: project.id } })
    setEditing(false)
  }

  if (editing || !r)
    return (
      <section className="card panel">
        <h3><CalendarClock size={16} style={{ verticalAlign: -2 }} /> {tr('Monthly retainer')}</h3>
        {!editing ? (
          <>
            <p className="muted" style={{ fontSize: 13 }}>{tr('A fixed monthly fee for a set number of hours. A draft invoice is made on the 1st of every month, and you see the hours used as you go.')}</p>
            <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => setEditing(true)}>{tr('Set up retainer')}</button>
          </>
        ) : (
          <form className="form" onSubmit={save}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="rt-fee">{tr('Monthly fee (kr. excl. VAT)')}</label>
                <input id="rt-fee" name="fee" type="number" min="1" step="1" className="input" defaultValue={r?.monthlyFee} required />
              </div>
              <div className="field">
                <label htmlFor="rt-hours">{tr('Hours included')}</label>
                <input id="rt-hours" name="hours" type="number" min="0" step="0.5" className="input" defaultValue={r?.hoursIncluded} required />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="rt-start">{tr('First month')}</label>
                <input id="rt-start" name="start" type="month" className="input" defaultValue={r?.startMonth ?? month} required />
              </div>
              <div className="field">
                <label htmlFor="rt-end">{tr('Last month')} <span className="muted">{tr('(optional)')}</span></label>
                <input id="rt-end" name="end" type="month" className="input" defaultValue={r?.endMonth} />
              </div>
            </div>
            <small className="muted">{tr('Months from the first month until now are invoiced straight away (as drafts).')}</small>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setEditing(false)}>{tr('Cancel')}</button>
              <button type="submit" className="btn btn-primary">{tr('Save')}</button>
            </div>
          </form>
        )}
      </section>
    )

  const u = retainerUsage(state, project, month)
  const ended = !!r.endMonth && r.endMonth < month
  const extraDone = r.extraInvoicedMonths?.includes(month)

  function invoiceExtra() {
    const rate = projectVatRate(state, project.id)
    const hours = Math.round(u.over * 2) / 2
    dispatch({
      type: 'addInvoice',
      invoice: {
        clientId: project.clientId,
        projectId: project.id,
        amount: withVat(hours * state.studio.hourlyRate, rate),
        vatRate: rate,
        description: `${tr('Extra hours')} ${monthLabel(month, lang)} (${hours} × ${formatKr(state.studio.hourlyRate)}) – ${project.name}`,
        due: new Date(Date.now() + state.studio.paymentTermsDays * 864e5).toISOString().slice(0, 10),
        status: 'Draft',
      },
    })
    dispatch({ type: 'updateProject', id: project.id, patch: { retainer: { ...r!, extraInvoicedMonths: [...(r!.extraInvoicedMonths ?? []), month] } } })
  }

  return (
    <section className="card panel">
      <div className="section-head" style={{ margin: 0 }}>
        <h3 style={{ margin: 0 }}><CalendarClock size={16} style={{ verticalAlign: -2 }} /> {tr('Monthly retainer')}</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>{tr('Edit')}</button>
      </div>
      <div className="kv" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div><small>{tr('Per month')}</small>{formatKr(r.monthlyFee)}</div>
        <div><small>{tr('Hours included')}</small>{formatHours(r.hoursIncluded)}</div>
      </div>
      {ended ? (
        <p className="muted" style={{ fontSize: 13 }}>{tr('Ended {month}.', { month: monthLabel(r.endMonth!, lang) })}</p>
      ) : (
        <>
          <div className="retainer-usage">
            <div className="retainer-bar" role="meter" aria-valuemin={0} aria-valuemax={u.included} aria-valuenow={u.used} aria-label={tr('Hours used this month')}>
              <i style={{ width: `${Math.min(100, u.share * 100)}%`, background: u.share > 1 ? 'var(--danger)' : u.share > 0.8 ? 'var(--amber)' : 'var(--green)' }} />
            </div>
            <small>{tr('{used} of {included} used in {month}', { used: formatHours(u.used), included: formatHours(u.included), month: monthLabel(month, lang) })}</small>
          </div>
          {u.over > 0 && (
            extraDone ? (
              <small className="muted">{tr('Extra hours for this month are invoiced.')}</small>
            ) : (
              <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={invoiceExtra}>
                <Receipt size={14} /> {tr('Invoice {hours} extra at {rate}/h', { hours: formatHours(Math.round(u.over * 2) / 2), rate: formatKr(state.studio.hourlyRate) })}
              </button>
            )
          )}
        </>
      )}
      <small className="muted">{tr('Invoiced for {n} months so far.', { n: r.invoicedMonths.length })} {r.endMonth && !ended ? tr('Runs until {month}.', { month: monthLabel(r.endMonth, lang) }) : ''}</small>
    </section>
  )
}
