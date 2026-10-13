/**
 * Shared by the billing endpoints. Files starting with “_” aren't endpoints of their own on Vercel.
 *
 * Set these in Vercel → Settings → Environment Variables (see docs/PAYMENTS.md):
 *   STRIPE_SECRET_KEY              sk_live_… (or sk_test_… while testing)
 *   STRIPE_WEBHOOK_SECRET          whsec_… from the webhook endpoint in Stripe
 *   STRIPE_PRICE_PRO_MONTHLY       price_… – each price has an amount for every currency Aftryk sells in
 *   STRIPE_PRICE_PRO_YEARLY
 *   STRIPE_PRICE_STUDIO_MONTHLY
 *   STRIPE_PRICE_STUDIO_YEARLY
 *   STRIPE_PRICE_STORAGE_MONTHLY   the 100 GB extra-space pack
 *   STRIPE_PRICE_STORAGE_YEARLY
 */
import Stripe from 'stripe'

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key) : null
}

export const PLANS = ['pro', 'studio'] as const
export const PERIODS = ['monthly', 'yearly'] as const
export const CURRENCIES = ['dkk', 'sek', 'nok', 'eur', 'gbp', 'usd'] as const

export type Paid = (typeof PLANS)[number]
export type Period = (typeof PERIODS)[number]

export const priceId = (item: Paid | 'storage', period: Period) => process.env[`STRIPE_PRICE_${item.toUpperCase()}_${period.toUpperCase()}`]

/** Which plan and period a Stripe price is – read back from the configured price ids. */
export function planForPrice(id: string): { plan: Paid | 'storage'; period: Period } | null {
  for (const plan of [...PLANS, 'storage' as const]) for (const period of PERIODS) if (priceId(plan, period) === id) return { plan, period }
  return null
}

export const configured = () => !!process.env.STRIPE_SECRET_KEY && PLANS.every((p) => PERIODS.every((q) => priceId(p, q)))
