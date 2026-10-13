/** What Stripe sends, turned into the one row Aftryk keeps per studio. */
import { describe, expect, it } from 'vitest'
import { statusFrom, subscriptionRow, type PriceKind } from '../data/subscription'
import { planPatch, type CloudSubscription } from '../data/cloud/plan'
import { seed } from '../data/seed'
import type { Studio } from '../data/types'

const STUDIO = '00000000-0000-4000-8000-000000000001'

/** The price ids as they would be configured in the environment. */
const PRICES: Record<string, PriceKind> = {
  price_pro_m: { plan: 'pro', period: 'monthly' },
  price_pro_y: { plan: 'pro', period: 'yearly' },
  price_studio_m: { plan: 'studio', period: 'monthly' },
  price_storage_m: { plan: 'storage', period: 'monthly' },
}
const kindOf = (id: string) => PRICES[id] ?? null

const row = (items: { priceId: string; quantity?: number | null; currentPeriodEnd?: number | null }[], status = 'active') =>
  subscriptionRow({ studioId: STUDIO, subscriptionId: 'sub_1', customerId: 'cus_1', status, items, kindOf })

describe('which Stripe states count as paid', () => {
  it('treats a live or trialling subscription as active', () => {
    expect(statusFrom('active')).toBe('active')
    expect(statusFrom('trialing')).toBe('active')
  })

  it('keeps a studio working while a card is retried', () => {
    expect(statusFrom('past_due')).toBe('past_due')
    expect(statusFrom('unpaid')).toBe('past_due')
  })

  it('counts everything else as not paying', () => {
    for (const s of ['canceled', 'incomplete', 'incomplete_expired', 'paused', 'something_new']) {
      expect(statusFrom(s)).toBe('canceled')
    }
  })
})

describe('the row a purchase becomes', () => {
  it('reads the plan, the period and when it renews', () => {
    const ends = Math.floor(Date.UTC(2027, 0, 15) / 1000)
    expect(row([{ priceId: 'price_pro_y', quantity: 1, currentPeriodEnd: ends }])).toEqual({
      studio_id: STUDIO,
      plan: 'pro',
      period: 'yearly',
      status: 'active',
      extra_storage: 0,
      renews_at: '2027-01-15T00:00:00.000Z',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
    })
  })

  it('adds up the storage packs bought alongside the plan', () => {
    const r = row([{ priceId: 'price_studio_m', quantity: 1 }, { priceId: 'price_storage_m', quantity: 3 }])
    expect(r).toMatchObject({ plan: 'studio', extra_storage: 3 })
  })

  it('will not be talked into more storage than the column allows', () => {
    expect(row([{ priceId: 'price_pro_m', quantity: 1 }, { priceId: 'price_storage_m', quantity: 999 }])?.extra_storage).toBe(20)
    expect(row([{ priceId: 'price_pro_m', quantity: 1 }, { priceId: 'price_storage_m', quantity: -5 }])?.extra_storage).toBe(0)
  })

  it('refuses a subscription that is only storage – there is no plan to set', () => {
    expect(row([{ priceId: 'price_storage_m', quantity: 2 }])).toBeNull()
  })

  it('refuses prices it doesn’t recognise, rather than guessing a plan', () => {
    expect(row([{ priceId: 'price_from_another_account', quantity: 1 }])).toBeNull()
  })

  it('carries the Stripe status through', () => {
    expect(row([{ priceId: 'price_pro_m', quantity: 1 }], 'past_due')).toMatchObject({ status: 'past_due' })
    expect(row([{ priceId: 'price_pro_m', quantity: 1 }], 'canceled')).toMatchObject({ status: 'canceled' })
  })

  it('copes with a subscription that has no period end yet', () => {
    expect(row([{ priceId: 'price_pro_m', quantity: 1 }])?.renews_at).toBeNull()
  })

  it('records no customer rather than an empty one', () => {
    const r = subscriptionRow({ studioId: STUDIO, subscriptionId: 'sub_2', status: 'active', items: [{ priceId: 'price_pro_m' }], kindOf })
    expect(r?.stripe_customer_id).toBeNull()
  })
})

describe('what the browser does with the server’s answer', () => {
  const studio = { ...seed.studio, plan: undefined, billing: undefined } as Studio
  const sub = (over: Partial<CloudSubscription> = {}): CloudSubscription => ({
    plan: 'pro', period: 'monthly', status: 'active', extra_storage: 0,
    renews_at: '2026-11-01T00:00:00.000Z', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', ...over,
  })

  it('takes the plan from the server', () => {
    const patch = planPatch(studio, sub({ plan: 'studio', period: 'yearly', extra_storage: 2 }))
    expect(patch?.plan).toBe('studio')
    expect(patch?.billing).toMatchObject({ provider: 'stripe', period: 'yearly', extraStorage: 2, subscriptionId: 'sub_1' })
  })

  it('drops to free when the subscription was cancelled, and keeps the record of it', () => {
    const patch = planPatch({ ...studio, plan: 'studio' }, sub({ plan: 'studio', status: 'canceled' }))
    expect(patch?.plan).toBe('free')
    expect(patch?.billing?.status).toBe('canceled')
  })

  it('keeps the studio working while a card is retried', () => {
    expect(planPatch(studio, sub({ plan: 'pro', status: 'past_due' }))?.plan).toBe('pro')
  })

  it('leaves a studio that has never bought anything alone – plans are free during the beta', () => {
    expect(planPatch({ ...studio, plan: 'studio' }, null)).toBeNull()
  })

  it('does not rewrite the workspace when nothing has changed', () => {
    const first = planPatch(studio, sub())!
    const settled = { ...studio, ...first } as Studio
    expect(planPatch(settled, sub())).toBeNull()
  })

  it('overrules a plan someone set in this browser', () => {
    // The whole point: editing the saved state no longer buys a plan once the server has an answer.
    const patch = planPatch({ ...studio, plan: 'studio' }, sub({ plan: 'pro' }))
    expect(patch?.plan).toBe('pro')
  })

  it('keeps who to invoice when the server doesn’t carry it', () => {
    const withDetails = { ...studio, billing: { ...sub(), provider: 'beta', details: { company: 'BETA_01', email: 'a@b.dk', address: 'Gade 1' } } } as unknown as Studio
    expect(planPatch(withDetails, sub())?.billing?.details.address).toBe('Gade 1')
  })
})
