/**
 * Where a subscription is written down. Stripe's webhook is the only thing that writes here, with
 * the service-role key, which skips row-level security – the studio's own browser may only read
 * its row (supabase/migrations/0002_subscriptions.sql).
 *
 * Set these in Vercel → Settings → Environment Variables (no VITE_ prefix – they never reach the
 * browser). Without them the webhook still checks Stripe's signature and answers, it just has
 * nowhere to save, which is where Aftryk was before.
 *
 *   SUPABASE_URL                the same URL as VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   Supabase → Settings → API → service_role. Secret: it can read and
 *                               write everything, ignoring every policy.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SubscriptionRow } from '../../src/data/subscription'

export function store(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** The studio a checkout was started for, kept on the Stripe objects so the webhook can find it. */
export const studioOf = (metadata: Record<string, string> | null | undefined) => metadata?.studioId || null

/** One row per studio: a second purchase replaces the first. */
export async function saveSubscription(db: SupabaseClient, row: SubscriptionRow) {
  const { error } = await db.from('subscriptions').upsert(row, { onConflict: 'studio_id' })
  if (error) throw new Error(error.message)
}

/**
 * Changes that arrive without the studio on them – a renewal, a cancellation from Stripe's own
 * portal – are matched by the subscription id written at checkout.
 */
export async function updateBySubscription(db: SupabaseClient, subscriptionId: string, patch: Partial<SubscriptionRow>) {
  const { error, count } = await db
    .from('subscriptions')
    .update(patch, { count: 'exact' })
    .eq('stripe_subscription_id', subscriptionId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Which studio a Stripe subscription belongs to, when the event itself doesn't say. */
export async function studioForSubscription(db: SupabaseClient, subscriptionId: string) {
  const { data, error } = await db.from('subscriptions').select('studio_id').eq('stripe_subscription_id', subscriptionId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as { studio_id: string } | null)?.studio_id ?? null
}

/** Is this person actually in that studio? Checked before a checkout is started for it. */
export async function isMember(db: SupabaseClient, studioId: string, userId: string) {
  const { data, error } = await db
    .from('studio_members')
    .select('user_id')
    .eq('studio_id', studioId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}

/** The signed-in person behind an `Authorization: Bearer …` header, or null. */
export async function callerOf(db: SupabaseClient, req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  if (error) return null
  return data.user?.id ?? null
}
