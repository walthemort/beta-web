/**
 * Reading what the studio pays for from the server instead of from this browser.
 *
 * The `subscriptions` row is written only by Stripe's webhook, with the service-role key; the
 * browser may read its own studio's row and never write it. So whatever comes back from here is
 * the truth, and the copy kept in the saved workspace is only a cache.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Billing, Studio } from '../types'

export type CloudSubscription = {
  plan: 'free' | 'pro' | 'studio'
  period: 'monthly' | 'yearly' | null
  status: Billing['status']
  extra_storage: number
  renews_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

const COLUMNS = 'plan,period,status,extra_storage,renews_at,stripe_customer_id,stripe_subscription_id'

/**
 * The studio's subscription, or null when it has never bought anything – and also when the table
 * isn't there yet, so a studio running only migration 0001 keeps working.
 */
export async function fetchSubscription(sb: SupabaseClient, studioId: string): Promise<CloudSubscription | null> {
  const { data, error } = await sb.from('subscriptions').select(COLUMNS).eq('studio_id', studioId).maybeSingle()
  if (error) return null
  return (data as CloudSubscription | null) ?? null
}

/**
 * What to change in the saved studio so it matches the server. Returns null when it already does,
 * so a workspace isn't rewritten on every sign-in.
 *
 * A cancelled subscription drops to Free. While Aftryk is in beta a studio with no row at all is
 * left alone – plans are switched on locally without paying, and taking that away on sign-in would
 * be wrong. When the beta ends, the absence of a row should mean Free, which is one line here.
 */
export function planPatch(studio: Studio, sub: CloudSubscription | null): Partial<Studio> | null {
  if (!sub) return null
  const plan = sub.status === 'canceled' ? 'free' : sub.plan
  const billing: Billing = {
    ...studio.billing,
    provider: 'stripe',
    status: sub.status,
    period: sub.period ?? studio.billing?.period ?? 'monthly',
    extraStorage: sub.extra_storage,
    startedAt: studio.billing?.startedAt ?? new Date().toISOString(),
    renewsAt: sub.renews_at ?? studio.billing?.renewsAt ?? '',
    customerId: sub.stripe_customer_id ?? undefined,
    subscriptionId: sub.stripe_subscription_id ?? undefined,
    details: studio.billing?.details ?? { company: studio.name, email: studio.email, address: studio.address },
  }
  const same =
    studio.plan === plan &&
    studio.billing?.status === billing.status &&
    studio.billing?.period === billing.period &&
    studio.billing?.extraStorage === billing.extraStorage &&
    studio.billing?.renewsAt === billing.renewsAt &&
    studio.billing?.subscriptionId === billing.subscriptionId
  return same ? null : { plan, billing }
}

/**
 * Who is buying, for the checkout: the studio picked in this browser and the session token that
 * proves the person is in it. Null when the cloud isn't set up or nobody is signed in – Aftryk
 * then records the purchase locally, as it did before there was a server.
 *
 * Supabase is imported only if it's configured, so a studio without the cloud never downloads it.
 */
export async function cloudCaller(): Promise<{ studioId: string; token: string } | null> {
  const { cloudConfigured } = await import('./config')
  if (!cloudConfigured()) return null
  let studioId: string | null = null
  try {
    studioId = localStorage.getItem('formlar:studio')
  } catch {
    return null
  }
  if (!studioId) return null
  const { supabase } = await import('./supabase')
  const { data } = await supabase().auth.getSession()
  const token = data.session?.access_token
  return token ? { studioId, token } : null
}
