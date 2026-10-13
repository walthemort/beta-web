/**
 * The purchase window: plan, monthly or yearly, extra space, who Aftryk invoices, and the total with
 * VAT – then either Stripe's secure payment page or, while payments are off, straight to the plan.
 */
import { APP_NAME } from '../components/brand'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, CreditCard, Lock, Minus, Plus, Sparkles } from 'lucide-react'
import { Modal } from '../components/ui'
import { formatDateLong, useStore } from '../data/store'
import { countryOf, formatMoney, taxFor } from '../data/countries'
import { FEATURES, PLANS, STORAGE_PACK, YEARLY_MONTHS, currencyOf, priceFor, type Period, type PlanId } from '../data/plans'
import { paymentsLive, periodEnd, startCheckout } from '../data/billing'
import { useT } from '../data/i18n'

export function Checkout({ planId, onClose }: { planId: PlanId; onClose: () => void }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1]
  const current = state.studio.billing
  const currency = currencyOf(state)
  const country = countryOf(state.studio.country)
  const [period, setPeriod] = useState<Period>(current?.period ?? 'monthly')
  const [extra, setExtra] = useState(current?.extraStorage ?? 0)
  const [details, setDetails] = useState(
    current?.details ?? { company: state.studio.name, email: state.studio.email, address: state.studio.address, vatNumber: country.code === 'DK' && state.studio.cvr ? `DK${state.studio.cvr}` : '' },
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const planPrice = priceFor(plan.prices[currency], period)
  const spacePrice = priceFor(STORAGE_PACK.prices[currency], period) * extra
  const subtotal = planPrice + spacePrice
  const tax = taxFor(country.code, !!details.vatNumber?.trim())
  const vat = Math.round(subtotal * tax.rate * 100) / 100
  const per = period === 'yearly' ? tr('a year') : tr('a month')
  const taxNote = {
    dk: tr('Danish VAT {rate}%', { rate: 25 }),
    reverse: tr('Reverse charge – no VAT (EU business with a VAT number)'),
    oss: tr('VAT {rate}% ({country})', { rate: Math.round(tax.rate * 1000) / 10, country: tr(country.name) }),
    export: tr('No VAT (outside the EU)'),
  }[tax.note]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await startCheckout({ plan: plan.id, period, extraStorage: extra, currency, country: country.code, details })
      if (result.kind === 'redirect') {
        window.location.href = result.url
        return
      }
      dispatch({ type: 'updateStudio', patch: { plan: result.plan, billing: result.billing } })
      dispatch({ type: 'log', log: { text: `Plan changed to ${plan.name}` } })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Something went wrong. Nothing was charged.'))
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <Modal title={tr('You’re on {plan}', { plan: tr(plan.name) })} onClose={onClose}>
        <div className="checkout-done">
          <span className="checkout-tick"><Check size={22} /></span>
          <p>{tr('Everything in {plan} is unlocked:', { plan: tr(plan.name) })}</p>
          <ul className="plan-list">
            {FEATURES.filter((f) => plan.features.includes(f.id)).map((f) => <li key={f.id}><Check size={14} /> {tr(f.name)}</li>)}
            <li><Check size={14} /> {tr('{gb} GB for files', { gb: plan.limits.storageGb + extra * STORAGE_PACK.gb })}</li>
          </ul>
          {!paymentsLive() && <p className="muted" style={{ fontSize: 13 }}>{tr('Free while {app} is in beta – you’ll hear from us well before any payment.', { app: APP_NAME })}</p>}
          <div className="modal-actions">
            {plan.limits.apps > 0 && <Link className="btn" to="/app/apps" onClick={onClose}>{tr('Choose your apps')}</Link>}
            <button className="btn btn-primary" onClick={onClose}>{tr('Done')}</button>
          </div>
        </div>
      </Modal>
    )

  return (
    <Modal title={tr('Upgrade to {plan}', { plan: tr(plan.name) })} subtitle={tr(plan.tagline)} onClose={onClose}>
      <form className="checkout" onSubmit={submit}>
        <div className="seg checkout-period" role="group" aria-label={tr('Billing period')}>
          <button type="button" aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>{tr('Monthly')}</button>
          <button type="button" aria-pressed={period === 'yearly'} onClick={() => setPeriod('yearly')}>
            {tr('Yearly')} <span className="checkout-save">{tr('{n} months free', { n: 12 - YEARLY_MONTHS })}</span>
          </button>
        </div>

        <div className="checkout-line">
          <span><b>{tr(plan.name)}</b> <small className="muted">{plan.limits.storageGb} GB · {plan.limits.members === Infinity ? tr('Unlimited team') : tr('{n} team members', { n: plan.limits.members })}</small></span>
          <span>{formatMoney(planPrice, currency)}</span>
        </div>
        <div className="checkout-line">
          <span>
            <b>{tr('Extra file space')}</b> <small className="muted">{tr('{price} per {gb} GB', { price: formatMoney(priceFor(STORAGE_PACK.prices[currency], period), currency), gb: STORAGE_PACK.gb })}</small>
          </span>
          <span className="checkout-stepper">
            <button type="button" className="btn btn-sm btn-icon" onClick={() => setExtra(Math.max(0, extra - 1))} disabled={!extra} aria-label={tr('Less space')}><Minus size={13} /></button>
            <b>{extra * STORAGE_PACK.gb} GB</b>
            <button type="button" className="btn btn-sm btn-icon" onClick={() => setExtra(Math.min(20, extra + 1))} aria-label={tr('More space')}><Plus size={13} /></button>
          </span>
        </div>

        <fieldset className="checkout-details">
          <legend>{tr('Invoice to')}</legend>
          <div className="form-row">
            <label>{tr('Company')}<input className="input" required value={details.company} onChange={(e) => setDetails({ ...details, company: e.target.value })} /></label>
            <label>{tr('Email for receipts')}<input className="input" type="email" required value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} /></label>
          </div>
          <label>{tr('Address')}<input className="input" value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} /></label>
          <div className="form-row">
            <label>
              {tr('VAT number')} <small className="muted">{tr('(optional)')}</small>
              <input className="input" placeholder={country.code === 'DK' ? 'DK12345678' : ''} value={details.vatNumber ?? ''} onChange={(e) => setDetails({ ...details, vatNumber: e.target.value })} />
            </label>
            <label>
              {tr('Country')}
              <span className="checkout-country">{tr(country.name)} <Link to="/app/settings" onClick={onClose}>{tr('Change')}</Link></span>
            </label>
          </div>
        </fieldset>

        <div className="checkout-total">
          <div><span>{tr('Subtotal')}</span><span>{formatMoney(subtotal, currency)}</span></div>
          <div className="muted"><span>{taxNote}</span><span>{formatMoney(vat, currency)}</span></div>
          <div className="checkout-sum"><span>{tr('Total {period}', { period: per })}</span><span>{formatMoney(subtotal + vat, currency)}</span></div>
          <small className="muted">{tr('Renews {date}. Cancel any time – the plan runs to the end of the period you paid for.', { date: formatDateLong(periodEnd(new Date(), period)) })}</small>
        </div>

        {paymentsLive() ? (
          <p className="checkout-pay"><Lock size={14} /> {tr('You pay on Stripe’s secure page – card, Apple Pay or Google Pay. {app} never sees your card details.', { app: APP_NAME })}</p>
        ) : (
          <p className="checkout-pay beta"><Sparkles size={14} /> {tr('Payments aren’t switched on yet. While {app} is in beta, {plan} starts right away – free.', { app: APP_NAME, plan: tr(plan.name) })}</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button className="btn btn-primary" disabled={busy}>
            {paymentsLive() ? <><CreditCard size={15} /> {busy ? tr('Opening…') : tr('Continue to payment')}</> : busy ? tr('Starting…') : tr('Start {plan}', { plan: tr(plan.name) })}
          </button>
        </div>
      </form>
    </Modal>
  )
}
