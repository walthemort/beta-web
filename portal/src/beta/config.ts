/** Optional deployment mode: the original Forme product remains the default. */
export const BETA_MODE = import.meta.env.VITE_BETA_MODE === 'true'
export const BETA_STUDIO_ID = import.meta.env.VITE_BETA_STUDIO_ID as string | undefined
export const BETA_WEBSITE_URL = (import.meta.env.VITE_BETA_WEBSITE_URL as string | undefined) || '/'
