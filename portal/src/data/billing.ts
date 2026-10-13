/**
 * Buying a plan. One entry point for the whole app, whichever way payments are taken:
 *
 * - No provider yet (today): checkout activates the plan straight away, free while Aftryk is in beta.
 * - Stripe (set VITE_PAYMENTS=stripe, see docs/PAYMENTS.md): checkout opens Stripe's own secure
 *   payment page; when the studio comes back, the purchase is confirmed with Stripe before the plan
 *   unlocks. Card details never touch Aftryk.
 */
import type { Currency } from './countries'
import type { Period, PlanId } from './plans'
import type { Billing } from './types'
import { cloudCaller } from './cloud/plan'

export type CheckoutRequest = {
  plan: PlanId
  period: Period
  /** Extra file-space packs. */
  extraStorage: number
  currency: Currency
  country: string
  details: Billing['details']
}

export type CheckoutResult = { kind: 'redirect'; url: string } | { kind: 'activated'; plan: PlanId; billing: Billing }

/** Is a real payment provider switched on for this build? */
export const paymentsLive = () => import.meta.env.VITE_PAYMENTS === 'stripe'

/** The date a period from `from` ends – a month or a year on (31 Jan → 28 Feb, not 3 Mar). */
export function periodEnd(from: Date, period: Period) {
  const d = new Date(from)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  if (period === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d.toISOString()
}

export async function startCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
  if (!paymentsLive()) {
    const now = new Date()
    return {
      kind: 'activated',
      plan: req.plan,
      billing: { provider: 'beta', status: 'active', period: req.period, extraStorage: req.extraStorage, startedAt: now.toISOString(), renewsAt: periodEnd(now, req.period), details: req.details },
    }
  }
  /*
   * Who is buying, so the webhook knows whose plan to set. The studio id alone proves nothing, so
   * the session token goes with it and the server checks the two agree before starting a checkout.
   * Without the cloud there is no studio and no session, and the purchase is recorded here as before.
   */
  const who = await cloudCaller()
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(who?.token ? { authorization: `Bearer ${who.token}` } : {}) },
    body: JSON.stringify({ ...req, studioId: who?.studioId }),
  })
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !body.url) throw new Error(body.error ?? 'Checkout could not be started')
  return { kind: 'redirect', url: body.url }
}

/** After Stripe sends the studio back: what did they buy? Checked with Stripe, not taken from the link. */
export async function confirmCheckout(sessionId: string, details: Billing['details']): Promise<{ plan: PlanId; billing: Billing }> {
  const res = await fetch(`/api/billing/session?id=${encodeURIComponent(sessionId)}`)
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    plan?: PlanId
    period?: Period
    extraStorage?: number
    renewsAt?: string
    customerId?: string
    subscriptionId?: string
  }
  if (!res.ok || !body.plan) throw new Error(body.error ?? 'The payment could not be confirmed')
  return {
    plan: body.plan,
    billing: {
      provider: 'stripe',
      status: 'active',
      period: body.period ?? 'monthly',
      extraStorage: body.extraStorage ?? 0,
      startedAt: new Date().toISOString(),
      renewsAt: body.renewsAt ?? periodEnd(new Date(), body.period ?? 'monthly'),
      customerId: body.customerId,
      subscriptionId: body.subscriptionId,
      details,
    },
  }
}

/** Stripe's own page for changing card, downloading receipts and cancelling. */
export async function openBillingPortal(customerId: string) {
  const res = await fetch('/api/billing/portal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customerId }) })
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !body.url) throw new Error(body.error ?? 'The billing page could not be opened')
  window.location.href = body.url
}
