/**
 * Turning what Stripe sends into the one row Aftryk keeps per studio.
 *
 * Kept here, away from the webhook, because this is the part worth testing: which of Stripe's nine
 * subscription states count as paid, which plan a price belongs to, and how many extra storage
 * packs were bought alongside it.
 */
import type { Period, PlanId } from './plans'

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled'

/** What a Stripe price turns out to be, once looked up against the configured price ids. */
export type PriceKind = { plan: Exclude<PlanId, 'free'> | 'storage'; period: Period }

export type SubscriptionRow = {
  studio_id: string
  plan: PlanId
  period: Period | null
  status: SubscriptionStatus
  extra_storage: number
  renews_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string
}

/**
 * Stripe's status, as Aftryk sees it. A card being retried (`past_due`) keeps the studio working:
 * cutting someone off mid-project over a card that expired is the wrong way round, and Stripe
 * cancels the subscription itself once its retries run out.
 */
export function statusFrom(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    default:
      // canceled, incomplete, incomplete_expired, paused – nothing is being paid.
      return 'canceled'
  }
}

export type StripeItem = { priceId: string; quantity?: number | null; currentPeriodEnd?: number | null }

/**
 * The row for one Stripe subscription, or null when none of its prices are Aftryk's – which
 * happens if the price ids in the environment don't match the ones the checkout used.
 */
export function subscriptionRow(input: {
  studioId: string
  subscriptionId: string
  customerId?: string | null
  status: string
  items: StripeItem[]
  kindOf: (priceId: string) => PriceKind | null
}): SubscriptionRow | null {
  const seen = input.items.map((item) => ({ item, kind: input.kindOf(item.priceId) }))
  const plan = seen.find((s) => s.kind && s.kind.plan !== 'storage')
  // Storage packs are sold alongside a plan, never on their own: without one there is nothing to set.
  if (!plan?.kind || plan.kind.plan === 'storage') return null
  const planId: Exclude<PlanId, 'free'> = plan.kind.plan
  const extra = seen
    .filter((s) => s.kind?.plan === 'storage')
    .reduce((n, s) => n + Math.max(0, s.item.quantity ?? 0), 0)
  const ends = plan.item.currentPeriodEnd
  return {
    studio_id: input.studioId,
    plan: planId,
    period: plan.kind.period,
    status: statusFrom(input.status),
    // The column allows twenty packs; more than that is a mistake, not a purchase.
    extra_storage: Math.min(20, extra),
    renews_at: ends ? new Date(ends * 1000).toISOString() : null,
    stripe_customer_id: input.customerId ?? null,
    stripe_subscription_id: input.subscriptionId,
  }
}
