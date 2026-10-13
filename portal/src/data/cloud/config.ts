/**
 * Public browser settings from Supabase's Connect panel.
 * VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY enable the cloud.
 * VITE_SUPABASE_ANON_KEY remains supported for legacy public anon keys.
 * Database row-level security enforces access; never use a service-role key here.
 * Without settings the app stays browser-local. See docs/BACKEND.md.
 */
export const CLOUD = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  key: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined,
}

export const cloudConfigured = () => !!(CLOUD.url && CLOUD.key)
