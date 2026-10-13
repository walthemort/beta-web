/**
 * Confirms a finished checkout with Stripe and says what was bought. The app unlocks the plan from
 * this answer – never from the link Stripe sent the studio back with, which anyone could edit.
 */
import { configured, json, planForPrice, stripe } from './_stripe'

export default async function handler(req: Request): Promise<Response> {
  const client = stripe()
  if (!client || !configured()) return json({ error: 'Payments aren’t set up yet' }, 501)
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return json({ error: 'Missing session id' }, 400)
  try {
    const session = await client.checkout.sessions.retrieve(id, { expand: ['subscription'] })
    if (session.status !== 'complete' || typeof session.subscription !== 'object' || !session.subscription) return json({ error: 'The payment isn’t complete' }, 402)
    const sub = session.subscription
    const items = sub.items.data.map((i) => ({ item: i, is: planForPrice(i.price.id) }))
    const plan = items.find((x) => x.is && x.is.plan !== 'storage')
    if (!plan?.is) return json({ error: 'Unknown plan' }, 400)
    const extra = items.filter((x) => x.is?.plan === 'storage').reduce((n, x) => n + (x.item.quantity ?? 0), 0)
    return json({
      plan: plan.is.plan,
      period: plan.is.period,
      extraStorage: extra,
      renewsAt: new Date(plan.item.current_period_end * 1000).toISOString(),
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      subscriptionId: sub.id,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Stripe error' }, 502)
  }
}
