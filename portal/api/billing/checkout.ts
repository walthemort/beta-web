/**
 * Starts a Stripe Checkout for a plan: the studio pays on Stripe's page, never in Aftryk. Tax (VAT)
 * is worked out by Stripe Tax from the address and VAT number the studio enters there.
 */
import { CURRENCIES, PERIODS, PLANS, configured, json, priceId, stripe, type Paid, type Period } from './_stripe'
import { callerOf, isMember, store } from './_store'

type Body = { plan?: string; period?: string; extraStorage?: number; currency?: string; country?: string; studioId?: string; details?: { email?: string; company?: string } }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const client = stripe()
  if (!client || !configured()) return json({ error: 'Payments aren’t set up yet' }, 501)

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const plan = PLANS.find((p) => p === body.plan) as Paid | undefined
  const period = PERIODS.find((p) => p === body.period) as Period | undefined
  const currency = CURRENCIES.find((c) => c === body.currency)
  const extra = Math.max(0, Math.min(20, Math.floor(Number(body.extraStorage) || 0)))
  if (!plan || !period || !currency) return json({ error: 'Pick a plan, a period and a currency' }, 400)
  const storage = priceId('storage', period)
  if (extra && !storage) return json({ error: 'Extra space isn’t for sale yet' }, 400)

  /*
   * Which studio is buying. The webhook needs this to know whose plan to set, so it is checked
   * here rather than believed: the caller proves who they are with their Supabase session, and
   * has to be a member of that studio. Without the cloud there are no studios and no one to
   * check, and the purchase is recorded in the browser as before.
   */
  const db = store()
  let studioId = ''
  if (db && body.studioId) {
    const user = await callerOf(db, req)
    if (!user) return json({ error: 'Sign in before buying a plan' }, 401)
    if (!(await isMember(db, body.studioId, user))) return json({ error: 'That studio isn’t yours' }, 403)
    studioId = body.studioId
  }

  const origin = new URL(req.url).origin
  const metadata = { plan, period, extraStorage: String(extra), country: body.country ?? '', studioId }
  try {
    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId(plan, period)!, quantity: 1 }, ...(extra ? [{ price: storage!, quantity: extra }] : [])],
      currency,
      customer_email: body.details?.email || undefined,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/app/settings/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/settings/plan?checkout=cancelled`,
    })
    return json({ url: session.url })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Stripe error' }, 502)
  }
}
