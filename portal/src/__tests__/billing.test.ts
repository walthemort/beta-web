/** Countries, VAT on Aftryk's invoices, subscriptions ending, file space and the beta checkout. */
import { describe, expect, it } from 'vitest'
import { seed } from '../data/seed'
import { countryOf, formatMoney, guessCountry, taxFor } from '../data/countries'
import { PLANS, STORAGE_PACK, currencyOf, planOf, priceFor, storageGb } from '../data/plans'
import { paymentsLive, periodEnd, startCheckout } from '../data/billing'
import type { Billing, State } from '../data/types'

const fresh = (): State => JSON.parse(JSON.stringify(seed))
const billing = (patch: Partial<Billing> = {}): Billing => ({
  provider: 'beta', status: 'active', period: 'monthly', extraStorage: 0, startedAt: '2026-09-01T00:00:00Z', renewsAt: '2026-10-01T00:00:00Z',
  details: { company: 'Studio', email: 'a@b.dk', address: '' }, ...patch,
})

describe('countries', () => {
  it('guess the country from the browser, and fall back to the US', () => {
    expect(guessCountry(['da-DK'])).toBe('DK')
    expect(guessCountry(['da'])).toBe('DK')
    expect(guessCountry(['en-GB', 'en'])).toBe('GB')
    expect(guessCountry(['nb'])).toBe('NO')
    expect(guessCountry(['xx'])).toBe('US')
  })

  it('show prices in the studio’s currency', () => {
    const s = fresh()
    s.studio.country = 'DK'
    expect(currencyOf(s)).toBe('dkk')
    s.studio.country = 'DE'
    expect(currencyOf(s)).toBe('eur')
    expect(countryOf('XX').code).toBe('OTHER')
    expect(formatMoney(249, 'dkk')).toBe('249 kr.')
    expect(formatMoney(39, 'usd')).toBe('$39')
    expect(PLANS.every((p) => Object.values(p.prices).length === 6)).toBe(true)
  })

  it('charge the right VAT: Danish, reverse charge, the customer’s own EU rate, or none', () => {
    expect(taxFor('DK', true)).toEqual({ rate: 0.25, note: 'dk' })
    expect(taxFor('DE', true)).toEqual({ rate: 0, note: 'reverse' })
    expect(taxFor('DE', false)).toEqual({ rate: 0.19, note: 'oss' })
    expect(taxFor('US', false)).toEqual({ rate: 0, note: 'export' })
    expect(taxFor('NO', false).rate).toBe(0)
  })
})

describe('subscriptions', () => {
  it('make yearly ten months, and end a cancelled plan when its paid period is over', () => {
    expect(priceFor(249, 'yearly')).toBe(2490)
    const s = fresh()
    s.studio.plan = 'pro'
    s.studio.billing = billing({ cancelAt: '2026-10-01T00:00:00Z' })
    expect(planOf(s, '2026-09-20T00:00:00Z').id).toBe('pro')
    expect(planOf(s, '2026-10-02T00:00:00Z').id).toBe('free')
  })

  it('add extra space packs to paid plans only', () => {
    const s = fresh()
    s.studio.plan = 'pro'
    s.studio.billing = billing({ extraStorage: 2 })
    expect(storageGb(s)).toBe(50 + 2 * STORAGE_PACK.gb)
    s.studio.plan = 'free'
    expect(storageGb(s)).toBe(1)
  })

  it('start a plan straight away while payments are off (the beta)', async () => {
    expect(paymentsLive()).toBe(false)
    const r = await startCheckout({ plan: 'studio', period: 'yearly', extraStorage: 1, currency: 'dkk', country: 'DK', details: billing().details })
    expect(r.kind).toBe('activated')
    if (r.kind !== 'activated') return
    expect(r.plan).toBe('studio')
    expect(r.billing).toMatchObject({ provider: 'beta', status: 'active', period: 'yearly', extraStorage: 1 })
    expect(new Date(r.billing.renewsAt).getFullYear()).toBe(new Date().getFullYear() + 1)
    expect(periodEnd(new Date('2026-01-31T12:00:00Z'), 'monthly').slice(0, 10)).toBe('2026-02-28')
    expect(periodEnd(new Date('2028-02-29T12:00:00Z'), 'yearly').slice(0, 10)).toBe('2029-02-28')
  })
})
