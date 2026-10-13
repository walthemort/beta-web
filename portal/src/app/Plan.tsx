/**
 * Settings → Plan: what the studio's plan includes, how much of it is used, and the other plans.
 * Also the small “part of Pro” note that sits wherever a locked feature would be.
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Lock, Minus, Sparkles } from 'lucide-react'
import { formatDate, formatDateLong, now, useStore } from '../data/store'
import { FEATURES, PLANS, aiAllowance, STORAGE_PACK, currencyOf, formatPrice, hasFeature, isPlanId, planFor, planOf, priceFor, storageGb, usage, type EarlyFeature, type Feature, type Plan, type PlanId } from '../data/plans'
import { countryOf } from '../data/countries'
import { confirmCheckout, openBillingPortal } from '../data/billing'
import { Checkout } from './Checkout'
import { Logo, useConfirm } from '../components/ui'
import { activeLang, dateLocale, useT } from '../data/i18n'

const limit = (n: number, tr: ReturnType<typeof useT>) => (n === Infinity ? tr('Unlimited') : String(n))

/** Where a locked feature would be: what it is, and which plan has it. */
export function UpgradeNote({ feature, compact }: { feature: Exclude<Feature, EarlyFeature>; compact?: boolean }) {
  const tr = useT()
  const plan = planFor(feature)
  const f = FEATURES.find((x) => x.id === feature)!
  return (
    <div className={'upgrade' + (compact ? ' compact' : '')}>
      <Sparkles size={15} />
      <span className="grow">
        <b>{tr('{feature} is part of {plan}', { feature: tr(f.name), plan: tr(plan.name) })}</b>
        {!compact && <small>{tr(f.hint)}</small>}
      </span>
      <Link className="btn btn-sm btn-primary" to={`/app/settings/plan?highlight=${plan.id}`}>{tr('See {plan}', { plan: tr(plan.name) })}</Link>
    </div>
  )
}

/** A feature in early access: whether the studio has it, has asked for it, and a way to ask. */
export function useEarlyAccess(feature: EarlyFeature) {
  const { state, dispatch } = useStore()
  const requestedAt = state.studio.earlyAccess?.[feature]?.requestedAt
  return {
    on: hasFeature(state, feature),
    requestedAt,
    // No backend yet: the request is kept with the studio until Aftryk has its database.
    request: () => {
      dispatch({ type: 'updateStudio', patch: { earlyAccess: { ...state.studio.earlyAccess, [feature]: { ...state.studio.earlyAccess?.[feature], requestedAt: now() } } } })
      dispatch({ type: 'log', log: { text: 'Requested access to company lookup' } })
    },
  }
}

/** Where an early-access feature would be: what it is, and “Request access”. */
export function EarlyAccessNote({ feature, title, text }: { feature: EarlyFeature; title: string; text: string }) {
  const tr = useT()
  const { requestedAt, request } = useEarlyAccess(feature)
  return (
    <div className="upgrade">
      <Lock size={15} />
      <span className="grow">
        <b>{title}</b>
        <small>{requestedAt ? tr('You asked for access on {date}. We’ll let you know when it’s switched on for your studio.', { date: formatDate(requestedAt) }) : text}</small>
      </span>
      {requestedAt ? (
        <span className="pill"><Check size={13} /> {tr('Access requested')}</span>
      ) : (
        <button className="btn btn-sm btn-primary" onClick={request}>{tr('Request access')}</button>
      )}
    </div>
  )
}

/** When a limit is reached – e.g. the 4th active project on Free. */
export function LimitNote({ what }: { what: 'activeProjects' | 'members' }) {
  const tr = useT()
  const { state } = useStore()
  const plan = planOf(state)
  const next = PLANS.find((p) => p.limits[what] > plan.limits[what])
  const label = what === 'activeProjects' ? tr('{n} active projects', { n: plan.limits[what] }) : tr('{n} team members', { n: plan.limits[what] })
  return (
    <div className="upgrade">
      <Sparkles size={15} />
      <span className="grow">
        <b>{tr('{plan} includes {limit}', { plan: tr(plan.name), limit: label })}</b>
        <small>{what === 'activeProjects' ? tr('Archive or finish a project, or move up a plan for more.') : tr('Remove someone, or move up a plan for a bigger team.')}</small>
      </span>
      {next && <Link className="btn btn-sm btn-primary" to={`/app/settings/plan?highlight=${next.id}`}>{tr('See {plan}', { plan: tr(next.name) })}</Link>}
    </div>
  )
}

/** The plan's name as a small badge, e.g. next to the studio name. */
export function PlanBadge() {
  const tr = useT()
  const { state } = useStore()
  const plan = planOf(state)
  return <Link to="/app/settings/plan" className={'plan-badge plan-' + plan.id} title={tr('Your plan')}>{tr(plan.name)}</Link>
}

export function PlanSettings() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const { confirm, confirmNode } = useConfirm()
  const [params, setParams] = useSearchParams()
  const highlight = params.get('highlight')
  const current = planOf(state)
  const billing = state.studio.billing
  const used = usage(state)
  const currency = currencyOf(state)
  const [buying, setBuying] = useState<PlanId | null>(() => (isPlanId(params.get('checkout')) ? (params.get('checkout') as PlanId) : null))
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [filesGb, setFilesGb] = useState<number | null>(null)
  useEffect(() => {
    // Uploaded files live in the browser's own storage for now; this is an estimate of what they take.
    navigator.storage?.estimate?.().then((e) => setFilesGb((e.usage ?? 0) / 1024 ** 3)).catch(() => undefined)
  }, [])

  // Back from Stripe: confirm the purchase with Stripe before unlocking anything.
  useEffect(() => {
    const result = params.get('checkout')
    const session = params.get('session_id')
    if (result !== 'success' && result !== 'cancelled') return
    setParams({}, { replace: true })
    if (result === 'cancelled') return setNotice({ ok: false, text: tr('Payment cancelled – nothing was charged.') })
    if (!session) return
    const fallback = { company: state.studio.name, email: state.studio.email, address: state.studio.address }
    confirmCheckout(session, billing?.details ?? fallback)
      .then(({ plan, billing: b }) => {
        dispatch({ type: 'updateStudio', patch: { plan, billing: b } })
        setNotice({ ok: true, text: tr('Payment received – you’re on {plan}.', { plan: tr(PLANS.find((p) => p.id === plan)!.name) }) })
      })
      .catch((err: Error) => setNotice({ ok: false, text: err.message }))
  }, [])

  const gb = (n: number) => new Intl.NumberFormat(dateLocale(activeLang()), { maximumFractionDigits: n < 1 ? 2 : 1 }).format(n) + ' GB'
  const space = storageGb(state)
  const ai = aiAllowance(state)
  const meters = [
    { label: tr('Active projects'), used: used.activeProjects, max: current.limits.activeProjects, text: `${used.activeProjects} / ${limit(current.limits.activeProjects, tr)}` },
    { label: tr('Team members'), used: used.members, max: current.limits.members, text: `${used.members} / ${limit(current.limits.members, tr)}` },
    { label: tr('Files'), used: filesGb ?? 0, max: space, text: `${filesGb === null ? '…' : gb(filesGb)} / ${gb(space)}` },
    ...(ai.limit ? [{ label: tr('AI images this month'), used: ai.used, max: ai.limit, text: `${ai.used} / ${ai.limit}` }] : []),
  ]
  const monthly = current.prices[currency] + (current.id === 'free' ? 0 : (billing?.extraStorage ?? 0) * STORAGE_PACK.prices[currency])
  const charged = billing ? priceFor(monthly, billing.period) : 0
  const cancelling = !!billing?.cancelAt && current.id !== 'free'

  /** Down to Free: the paid plan runs to the end of its period, then Free. */
  function cancel() {
    if (!billing) return dispatch({ type: 'updateStudio', patch: { plan: 'free' } })
    confirm(
      tr('Cancel {plan}? It stays on until {date}, then your studio is on Free and the paid features lock.', { plan: tr(current.name), date: formatDateLong(billing.renewsAt) }),
      () => dispatch({ type: 'updateStudio', patch: { billing: { ...billing, cancelAt: billing.renewsAt } } }),
      tr('Cancel plan'),
    )
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {notice && <div className={'banner' + (notice.ok ? '' : ' banner-warn')} role="status">{notice.text}</div>}
      <section className="card panel">
        <div className="section-head" style={{ margin: 0 }}>
          <div>
            <span className="eyebrow">{tr('Your plan')}</span>
            <h3>{tr(current.name)}{charged > 0 && <span className="muted" style={{ fontWeight: 400 }}> · {formatPrice(charged, currency)} {billing?.period === 'yearly' ? tr('a year') : tr('a month')}</span>}</h3>
          </div>
        </div>
        <div className="plan-meters">
          {meters.map((m) => {
            const share = m.max === Infinity ? 0 : Math.min(1, m.used / m.max)
            return (
              <div key={m.label} className="plan-meter">
                <span className="muted">{m.label}</span>
                <b>{m.text}</b>
                <div className="progress"><span style={{ width: `${Math.max(2, share * 100)}%`, background: share >= 1 ? 'var(--danger)' : share > 0.8 ? 'var(--amber)' : undefined }} /></div>
              </div>
            )
          })}
        </div>
      </section>

      {billing && current.id !== 'free' && (
        <section className="card panel">
          <h3>{tr('Your subscription')}</h3>
          <div className="kv billing-kv">
            <div><small>{tr('Billed')}</small>{billing.period === 'yearly' ? tr('Yearly') : tr('Monthly')}</div>
            <div><small>{cancelling ? tr('Ends') : tr('Renews')}</small>{formatDateLong(cancelling ? billing.cancelAt : billing.renewsAt)}</div>
            <div><small>{tr('Extra file space')}</small>{billing.extraStorage ? `${billing.extraStorage * STORAGE_PACK.gb} GB` : '—'}</div>
            <div><small>{tr('Invoice to')}</small>{billing.details.company}{billing.details.vatNumber ? ` · ${billing.details.vatNumber}` : ''}</div>
          </div>
          {billing.provider === 'beta' && <p className="muted" style={{ fontSize: 13 }}>{tr('Started during the beta – no payment is taken. You’ll hear from us well before that changes.')}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={() => setBuying(current.id)}>{tr('Change period or space')}</button>
            <button
              className="btn btn-sm"
              disabled={!billing.customerId}
              title={billing.customerId ? undefined : tr('Available once payments are switched on')}
              onClick={() => billing.customerId && openBillingPortal(billing.customerId).catch((e: Error) => setNotice({ ok: false, text: e.message }))}
            >
              {tr('Payment method & receipts')}
            </button>
            {cancelling ? (
              <button className="btn btn-sm btn-primary" onClick={() => dispatch({ type: 'updateStudio', patch: { billing: { ...billing, cancelAt: undefined } } })}>{tr('Keep {plan}', { plan: tr(current.name) })}</button>
            ) : (
              <button className="btn btn-sm btn-ghost" onClick={cancel}>{tr('Cancel plan')}</button>
            )}
          </div>
        </section>
      )}

      <div className="plan-cards">
        {PLANS.map((p) => {
          const isCurrent = p.id === current.id
          const up = PLANS.indexOf(p) > PLANS.indexOf(current)
          return (
            <section key={p.id} className={'card plan-card' + (isCurrent ? ' current' : '') + (highlight === p.id ? ' highlight' : '')}>
              <div>
                <h3>{tr(p.name)}</h3>
                <p className="muted" style={{ fontSize: 13 }}>{tr(p.tagline)}</p>
              </div>
              <div className="plan-price">
                {p.prices[currency] ? <><b>{formatPrice(p.prices[currency], currency)}</b> <span className="muted">{currency === 'dkk' ? tr('/ month, excl. VAT') : tr('/ month, excl. tax')}</span></> : <b>{tr('Free')}</b>}
              </div>
              <ul className="plan-list">
                <li><Check size={14} /> {p.limits.activeProjects === Infinity ? tr('Unlimited projects') : tr('{n} active projects', { n: p.limits.activeProjects })}</li>
                <li><Check size={14} /> {p.limits.members === Infinity ? tr('Unlimited team') : tr('{n} team members', { n: p.limits.members })}</li>
                <li><Check size={14} /> {tr('{gb} GB for files', { gb: p.limits.storageGb })}{p.id !== 'free' && <small className="muted"> · {tr('more can be added')}</small>}</li>
                <li><Check size={14} /> {tr('Client portal, proposals, contracts, invoices and brand hubs')}</li>
                <li className={p.limits.apps ? undefined : 'off'}>
                  {p.limits.apps ? <Check size={14} /> : <Minus size={14} />} {p.limits.apps === Infinity ? tr('Every app') : p.limits.apps ? tr('{n} apps of your choice', { n: p.limits.apps }) : tr('No apps')}
                  {p.limits.apps > 0 && <small className="muted"> · <Link to="/app/apps">{tr('see the apps')}</Link></small>}
                </li>
                {FEATURES.map((f) => (
                  <li key={f.id} className={p.features.includes(f.id) ? undefined : 'off'}>
                    {p.features.includes(f.id) ? <Check size={14} /> : <Minus size={14} />} {tr(f.name)}
                    {f.id === 'aiImages' && p.limits.aiImages > 0 && <small className="muted"> · {tr('{n} images a month', { n: p.limits.aiImages })}</small>}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="btn" aria-disabled="true" style={{ opacity: 0.7, cursor: 'default' }}>{tr('Your plan')}</span>
              ) : p.id === 'free' ? (
                <button className="btn" onClick={cancel} disabled={!fits(state, p) || cancelling} title={fits(state, p) ? undefined : tr('Your studio uses more than this plan includes')}>
                  {cancelling ? tr('Moving to Free on {date}', { date: formatDateLong(billing?.cancelAt) }) : tr('Switch to {plan}', { plan: tr(p.name) })}
                </button>
              ) : (
                <button className={'btn' + (up ? ' btn-primary' : '')} onClick={() => setBuying(p.id)} disabled={!fits(state, p)} title={fits(state, p) ? undefined : tr('Your studio uses more than this plan includes')}>
                  {up ? tr('Upgrade to {plan}', { plan: tr(p.name) }) : tr('Switch to {plan}', { plan: tr(p.name) })}
                </button>
              )}
            </section>
          )
        })}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        {tr('Prices in {currency} for {country}, excl. VAT.', { currency: currency.toUpperCase(), country: tr(countryOf(state.studio.country).name) })}{' '}
        <Link to="/app/settings">{tr('Change country')}</Link>
      </p>
      {buying && <Checkout planId={buying} onClose={() => { setBuying(null); if (params.get('checkout')) setParams({}, { replace: true }) }} />}
      {confirmNode}
    </div>
  )

  /** A studio can only move down to a plan it fits in. */
  function fits(s: typeof state, p: Plan) {
    const u = usage(s)
    return u.activeProjects <= p.limits.activeProjects && u.members <= p.limits.members
  }
}

/** Aftryk's logo at the foot of client pages – left out on plans without Aftryk branding. */
export function BrandMark({ size = 16 }: { size?: number }) {
  const { state } = useStore()
  if (hasFeature(state, 'whiteLabel')) return null
  return <Link to="/"><Logo size={size} /></Link>
}
