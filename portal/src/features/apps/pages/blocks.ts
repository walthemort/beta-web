/**
 * Pages: small web pages on a client's brand – link-in-bio, coming soon, a campaign. A page is a
 * list of blocks; its colours come from the brand hub, so it's always on brand.
 */
import { contrast, readableOn } from '../../color'
import type { Brand } from '../../content/model'
import type { PageBlock, WebPage } from '../../../data/types'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const BLOCKS: { type: PageBlock['type']; name: string }[] = [
  { type: 'hero', name: 'Headline' },
  { type: 'links', name: 'Links' },
  { type: 'text', name: 'Text' },
  { type: 'image', name: 'Picture' },
  { type: 'gallery', name: 'Gallery' },
  { type: 'countdown', name: 'Countdown' },
  { type: 'signup', name: 'Sign-up' },
  { type: 'contact', name: 'Contact' },
  { type: 'social', name: 'Social media' },
]

export const NETWORKS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube', 'Pinterest']

/** A new block of a kind, with example text (English – the editor translates it when it's added). */
export function newBlock(type: PageBlock['type'], tr: (s: string) => string = (s) => s): PageBlock {
  const id = uid()
  switch (type) {
    case 'hero': return { id, type, heading: tr('A headline that says it'), text: tr('One or two lines about what’s going on.') }
    case 'links': return { id, type, items: [{ id: uid(), label: tr('Our website'), url: 'https://' }] }
    case 'text': return { id, type, heading: tr('A little more'), body: tr('Write a few lines here.') }
    case 'image': return { id, type, src: '' }
    case 'gallery': return { id, type, images: [] }
    case 'countdown': {
      const d = new Date(Date.now() + 14 * 86400000)
      d.setHours(10, 0, 0, 0)
      return { id, type, label: tr('Opening in'), date: d.toISOString() }
    }
    case 'signup': return { id, type, heading: tr('Be the first to know'), button: tr('Sign me up') }
    case 'contact': return { id, type, email: '', phone: '', address: '' }
    case 'social': return { id, type, links: [{ network: 'Instagram', url: 'https://instagram.com/' }] }
  }
}

export type PageTemplate = { id: string; name: string; about: string; theme: WebPage['theme']; blocks: PageBlock['type'][] }

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: 'bio', name: 'Link in bio', about: 'The one link on Instagram and TikTok', theme: 'brand', blocks: ['hero', 'links', 'social'] },
  { id: 'soon', name: 'Coming soon', about: 'A countdown and sign-ups before the launch', theme: 'dark', blocks: ['hero', 'countdown', 'signup', 'social'] },
  { id: 'campaign', name: 'Campaign', about: 'A headline, pictures and a button', theme: 'light', blocks: ['hero', 'text', 'gallery', 'links', 'contact'] },
  { id: 'blank', name: 'Blank', about: 'Start with just a headline', theme: 'light', blocks: ['hero'] },
]

/** Lowercase, dashes, no odd letters – æ, ø and å spelled out. */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'page'
}

/** A slug nobody else has: “forma”, then “forma-2”, “forma-3” … */
export function freeSlug(wanted: string, taken: string[], own?: string) {
  const base = slugify(wanted)
  const used = new Set(taken.filter((s) => s !== own))
  if (!used.has(base)) return base
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`
}

/** The page's colours: background, text, the accent for buttons and the text on those buttons. */
export function pageColours(brand: Brand, theme: WebPage['theme']) {
  const bg = theme === 'dark' ? brand.dark : theme === 'brand' ? brand.primary : brand.light
  const ink = [brand.dark, brand.light].find((c) => contrast(c, bg) >= 4.5) ?? readableOn(bg)
  const accent = [brand.accent, brand.primary, ink].find((c) => contrast(c, bg) >= 3) ?? ink
  return { bg, ink, accent, onAccent: [bg, brand.light, brand.dark].find((c) => contrast(c, accent) >= 4.5) ?? readableOn(accent) }
}

/** Days, hours, minutes and seconds left until a moment (all zero once it's passed). */
export function timeLeft(to: string, now = Date.now()) {
  const ms = Math.max(0, new Date(to).getTime() - now)
  const s = Math.floor(ms / 1000)
  return { done: ms === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}

export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())

/** Links people add without https:// still work. */
export const href = (url: string) => (/^(https?:|mailto:|tel:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`)

/** The sign-ups as a spreadsheet (CSV). */
export const signupsCsv = (page: WebPage) => ['email,date', ...(page.signups ?? []).map((s) => `${s.email},${s.at.slice(0, 10)}`)].join('\n')
