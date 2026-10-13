/**
 * Light and dark. The studio app follows each member's choice (or their device); client pages
 * follow the studio's portal setting, and a brand hub can lock its own look. A studio picks one
 * accent colour; its dark-mode twin is worked out so it stays readable, unless they set one.
 */
import { useEffect, type CSSProperties } from 'react'
import { contrast, darkVariant, readableOn } from '../features/color'
import type { Studio, Theme } from './types'
import { useStore } from './store'

/** The page backgrounds the accent has to work on (see the tokens in styles.css). */
export const SURFACE = { light: '#faf9f6', dark: '#1a1a18' } as const

export function accentColours(brand: Pick<Studio['brand'], 'accent' | 'accentDark'>) {
  const light = brand.accent
  const dark = brand.accentDark || darkVariant(brand.accent, SURFACE.dark)
  return {
    light,
    dark,
    lightInk: readableOn(light),
    darkInk: readableOn(dark),
    /** Contrast against the page – links and highlights need about 3:1 to be seen. */
    lightRatio: contrast(light, SURFACE.light),
    darkRatio: contrast(dark, SURFACE.dark),
    autoDark: !brand.accentDark,
  }
}

/** Inline CSS variables for a `.branded` element (the rules are in styles.css). */
export function brandStyle(brand: Pick<Studio['brand'], 'accent' | 'accentDark'>): CSSProperties {
  const c = accentColours(brand)
  return {
    ['--accent-light' as string]: c.light,
    ['--accent-light-ink' as string]: c.lightInk,
    ['--accent-dark' as string]: c.dark,
    ['--accent-dark-ink' as string]: c.darkInk,
  }
}

/** Locks the whole page to light or dark while mounted; 'auto' leaves it to the device. */
export function useTheme(theme: Theme | undefined, { remember = false } = {}) {
  useEffect(() => {
    const root = document.documentElement
    // The studio app's choice, so index.html can open the app in it next time, loading screen included.
    if (remember) {
      try {
        localStorage.setItem('forme:theme', theme ?? 'auto')
      } catch {
        // Private mode – the loading screen follows the device instead.
      }
    }
    if (!theme || theme === 'auto') {
      root.removeAttribute('data-theme')
      return
    }
    root.setAttribute('data-theme', theme)
    return () => root.removeAttribute('data-theme')
  }, [theme, remember])
}

/** Props for a client page's root: the studio's accent for both themes, and its chosen theme. */
export function useBranded(hubTheme?: Theme) {
  const { state } = useStore()
  const brand = state.studio.brand
  // A brand hub can have its own look; everything else follows the portal setting.
  useTheme(hubTheme && hubTheme !== 'auto' ? hubTheme : brand.portalTheme)
  return { className: 'branded', style: brandStyle(brand) }
}
