/** Opens Stripe's customer portal: change card, see receipts, switch plan or cancel. */
import { json, stripe } from './_stripe'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const client = stripe()
  if (!client) return json({ error: 'Payments aren’t set up yet' }, 501)
  const { customerId } = ((await req.json().catch(() => ({}))) ?? {}) as { customerId?: string }
  if (!customerId) return json({ error: 'No customer yet' }, 400)
  try {
    const session = await client.billingPortal.sessions.create({ customer: customerId, return_url: `${new URL(req.url).origin}/app/settings/plan` })
    return json({ url: session.url })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Stripe error' }, 502)
  }
}
