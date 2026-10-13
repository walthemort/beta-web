/**
 * Stripe tells Aftryk here when something changes on its own: a renewal, a failed card, a
 * cancellation made in the customer portal. The signature proves the message is from Stripe.
 *
 * What arrives is written to the `subscriptions` table with the service-role key, which is the
 * only way a plan is ever set. The browser may read that row and never write it, so editing the
 * saved state no longer buys anybody a plan (docs/PAYMENTS.md, step 7).
 *
 * With Supabase not configured this still checks the signature and answers 200 – Stripe would
 * otherwise retry for days – and says in the log that it had nowhere to put the result.
 */
import type Stripe from 'stripe'
import { json, planForPrice, stripe } from './_stripe'
import { saveSubscription, store, studioForSubscription, studioOf, updateBySubscription } from './_store'
import { statusFrom, subscriptionRow } from '../../src/data/subscription'

/** The events Aftryk acts on; set exactly these on the webhook endpoint in Stripe. */
export const EVENTS = ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_failed'] as const

const itemsOf = (sub: Stripe.Subscription) =>
  sub.items.data.map((i) => ({
    priceId: i.price.id,
    quantity: i.quantity,
    // Stripe moved the period onto the item; older API versions keep it on the subscription.
    currentPeriodEnd: i.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null,
  }))

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const client = stripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!client || !secret) return json({ error: 'Payments aren’t set up yet' }, 501)

  let event: Stripe.Event
  try {
    event = await client.webhooks.constructEventAsync(await req.text(), req.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return json({ error: 'Invalid signature' }, 400)
  }
  if (!(EVENTS as readonly string[]).includes(event.type)) return json({ received: true })

  const db = store()
  if (!db) {
    console.log(`Stripe: ${event.type} (${event.id}) – no database configured, nothing saved`)
    return json({ received: true, saved: false })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const studioId = studioOf(session.metadata)
        const id = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        if (!studioId || !id) {
          // A checkout started before studios existed, or by something that isn't Aftryk.
          console.log(`Stripe: ${event.type} (${event.id}) – no studio on the session, nothing saved`)
          break
        }
        const sub = await client.subscriptions.retrieve(id)
        const row = subscriptionRow({
          studioId,
          subscriptionId: sub.id,
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          status: sub.status,
          items: itemsOf(sub),
          kindOf: planForPrice,
        })
        if (!row) {
          console.error(`Stripe: ${event.id} – none of the prices are Aftryk's; check STRIPE_PRICE_*`)
          break
        }
        await saveSubscription(db, row)
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const studioId = studioOf(sub.metadata) ?? (await studioForSubscription(db, sub.id))
        if (!studioId) break
        const row = subscriptionRow({
          studioId,
          subscriptionId: sub.id,
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          status: sub.status,
          items: itemsOf(sub),
          kindOf: planForPrice,
        })
        if (row) await saveSubscription(db, row)
        break
      }
      case 'customer.subscription.deleted':
        await updateBySubscription(db, event.data.object.id, { status: 'canceled' })
        break
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null }
        const id = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        // Stripe's own retries decide when this becomes a cancellation.
        if (id) await updateBySubscription(db, id, { status: statusFrom('past_due') })
        break
      }
    }
  } catch (err) {
    // A 500 makes Stripe deliver it again, which is what we want for a database that was briefly down.
    console.error(`Stripe: ${event.type} (${event.id}) failed`, err)
    return json({ error: 'Could not save that' }, 500)
  }
  return json({ received: true, saved: true })
}
