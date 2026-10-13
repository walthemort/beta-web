/**
 * Brand Audit: what a website says about a brand, read from its HTML and CSS – colours, fonts,
 * the basics a good site has – and how it compares with a brand hub. Pure functions, shared by
 * api/audit.ts (which fetches the site) and the report page, and tested.
 */
import type { AuditResult, BrandHub } from '../../../data/types'

/* ---------- Addresses the server may fetch ---------- */

/** Private, local and reserved addresses – never fetched, so the audit can't reach inside a network. */
export function isPublicAddress(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false // this network, private, loopback, multicast, reserved
    if (a === 100 && b >= 64 && b <= 127) return false // carrier-grade NAT
    if (a === 169 && b === 254) return false // link-local (and cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && (b === 168 || (b === 0 && [0, 2].includes(Number(v4.split('.')[2]))))) return false
    if (a === 198 && (b === 18 || b === 19)) return false // benchmarking
    return true
  }
  const s = ip.toLowerCase()
  if (!s.includes(':')) return false
  if (s === '::' || s === '::1') return false
  if (/^(fc|fd)/.test(s)) return false // unique local
  if (/^fe[89ab]/.test(s)) return false // link-local
  if (s.startsWith('ff')) return false // multicast
  if (s.startsWith('64:ff9b:') || s.startsWith('2001:db8') || s.startsWith('2002:')) return false // NAT64, documentation, 6to4
  return true
}

/** A web address the audit accepts: http(s), no password in it, the normal ports, not an IP of a private network. */
export function checkUrl(input: string): URL | string {
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`)
  } catch {
    return 'That doesn’t look like a web address'
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'Only http and https addresses'
  if (url.username || url.password) return 'Leave the password out of the address'
  if (url.port && url.port !== '80' && url.port !== '443') return 'Only the normal web ports'
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host.includes('.') && !host.includes(':')) return 'That doesn’t look like a web address'
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) return 'That address isn’t on the public internet'
  if ((/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) && !isPublicAddress(host)) return 'That address isn’t on the public internet'
  url.hash = ''
  return url
}

/* ---------- Colours ---------- */

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')

/** #abc, #aabbcc, #aabbccdd, rgb(), rgba() – as #rrggbb (transparent ones skipped). */
export function normaliseColour(c: string): string | null {
  const s = c.trim().toLowerCase()
  let m = s.match(/^#([0-9a-f]{3,8})$/)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) {
      if (h.length === 4 && h[3] === '0') return null
      h = h.slice(0, 3).split('').map((x) => x + x).join('')
    } else if (h.length === 8) {
      if (h.slice(6) === '00') return null
      h = h.slice(0, 6)
    } else if (h.length !== 6) return null
    return `#${h}`
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/)
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null
    return toHex(+m[1], +m[2], +m[3])
  }
  return null
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
/** How far apart two colours look (a quick perceptual distance, 0–~765). */
export function colourDistance(a: string, b: string) {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const rm = (r1 + r2) / 2
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2)
}
/** Greys (including black and white) – on every site, so they say little about a brand. */
export const isGrey = (hex: string) => {
  const [r, g, b] = rgb(hex)
  return Math.max(r, g, b) - Math.min(r, g, b) < 14
}

/** The colours in some CSS, most used first – with near-identical shades counted as one. */
export function coloursIn(css: string, max = 10): { hex: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) {
    const hex = normaliseColour(m[0])
    if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  const merged: { hex: string; count: number }[] = []
  for (const [hex, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    const near = merged.find((x) => colourDistance(x.hex, hex) < 18)
    if (near) near.count += count
    else merged.push({ hex, count })
  }
  return merged.sort((a, b) => b.count - a.count).slice(0, max)
}

/* ---------- Fonts ---------- */

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|inherit|initial|unset|revert|emoji|math|fangsong|var\(.*|segoe ui|roboto|helvetica neue|helvetica|arial|noto sans|liberation sans|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|sans|times new roman|times|georgia|verdana|tahoma|trebuchet ms|palatino|palatino linotype|lucida grande|courier new|courier|menlo|monaco|consolas|sfmono-regular|liberation mono)$/i

/** The typefaces a site sets, most used first – without the system fallbacks. */
export function fontsIn(css: string, html = '', max = 6): string[] {
  const counts = new Map<string, number>()
  const add = (name: string, n = 1) => {
    const clean = name.trim().replace(/^['"]|['"]$/g, '').replace(/\+/g, ' ').trim()
    if (!clean || GENERIC.test(clean) || clean.length > 40) return
    const key = clean.toLowerCase()
    const existing = [...counts.keys()].find((k) => k.toLowerCase() === key)
    counts.set(existing ?? clean, (counts.get(existing ?? clean) ?? 0) + n)
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) m[1].split(',').forEach((f, i) => add(f, i === 0 ? 3 : 1))
  // Google Fonts links: family=Name:wght@…
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi))
    for (const f of m[1].replace(/&amp;/g, '&').matchAll(/family=([^&:]+)/g)) add(decodeURIComponent(f[1]), 2)
  return [...counts].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, max)
}

/* ---------- The page ---------- */

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

function meta(html: string, key: string) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    const name = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]
    if (name?.toLowerCase() === key) return decode(tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? '')
  }
  return undefined
}

const abs = (href: string | undefined, base: string) => {
  // “data:,” is the trick for “no icon, and don't ask for one”.
  if (!href || /^data:,?$/i.test(href.trim())) return undefined
  try {
    return new URL(decode(href), base).toString()
  } catch {
    return undefined
  }
}

/** Everything the audit reads from the HTML itself. */
export function readHtml(html: string, url: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const icon = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((t) => /rel\s*=\s*["'][^"']*icon[^"']*["']/i.test(t))
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])
  const stylesheets = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((t) => /rel\s*=\s*["']?stylesheet/i.test(t))
    .map((t) => abs(t.match(/href\s*=\s*["']([^"']+)["']/i)?.[1], url))
    .filter((x): x is string => !!x && !/fonts\.googleapis\.com/.test(x))
  const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n') + '\n' + [...html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)].map((m) => `x{${m[1]}}`).join('\n')
  return {
    title: title ? decode(title) : undefined,
    description: meta(html, 'description') || meta(html, 'og:description'),
    image: abs(meta(html, 'og:image') || meta(html, 'twitter:image'), url),
    favicon: abs(icon?.match(/href\s*=\s*["']([^"']+)["']/i)?.[1], url),
    themeColour: normaliseColour(meta(html, 'theme-color') ?? '') ?? undefined,
    lang: html.match(/<html\b[^>]*\blang\s*=\s*["']?([\w-]+)/i)?.[1],
    viewport: !!meta(html, 'viewport'),
    images: { count: imgs.length, missingAlt: imgs.filter((t) => !/\balt\s*=/i.test(t)).length },
    headings: { h1: (html.match(/<h1\b/gi) ?? []).length, h2: (html.match(/<h2\b/gi) ?? []).length },
    stylesheets: [...new Set(stylesheets)].slice(0, 4),
    inlineCss,
  }
}

/* ---------- The checks and the score ---------- */

type Check = AuditResult['checks'][number]

export function runChecks(r: Omit<AuditResult, 'checks' | 'score'>): { checks: Check[]; score: number } {
  const brandColours = r.colours.filter((c) => !isGrey(c.hex))
  const checks: (Check & { weight: number })[] = [
    { id: 'https', ok: r.https, label: 'Secure (https)', detail: r.https ? undefined : 'Browsers mark the site “Not secure”.', weight: 3 },
    { id: 'speed', ok: r.loadMs < 2500, label: 'Loads quickly', detail: 'The page arrived in {s} seconds.', vars: { s: (r.loadMs / 1000).toFixed(1) }, weight: 2 },
    r.title
      ? { id: 'title', ok: r.title.length >= 10 && r.title.length <= 70, label: 'A clear page title', detail: '“{title}” – {n} characters (10 to 70 is best).', vars: { title: r.title, n: r.title.length }, weight: 2 }
      : { id: 'title', ok: false, label: 'A clear page title', detail: 'No title – Google and browser tabs show the address instead.', weight: 2 },
    r.description
      ? { id: 'description', ok: r.description.length >= 50 && r.description.length <= 170, label: 'A description for Google', detail: '{n} characters (50 to 160 is best).', vars: { n: r.description.length }, weight: 2 }
      : { id: 'description', ok: false, label: 'A description for Google', detail: 'No description – Google picks some text from the page.', weight: 2 },
    { id: 'share', ok: !!r.image, label: 'A picture when the link is shared', detail: r.image ? undefined : 'Links shared on Facebook, LinkedIn and in messages show no picture.', weight: 2 },
    { id: 'favicon', ok: !!r.favicon, label: 'An icon in the browser tab', weight: 1 },
    { id: 'mobile', ok: !!r.viewport, label: 'Made for phones', detail: r.viewport ? undefined : 'No viewport setting – phones show a shrunken desktop page.', weight: 3 },
    { id: 'lang', ok: !!r.lang, label: 'The language is set', detail: r.lang ? undefined : 'Screen readers and translators have to guess.', weight: 1 },
    { id: 'h1', ok: r.headings.h1 === 1, label: 'One main heading', detail: '{n} main headings (h1) – one is best.', vars: { n: r.headings.h1 }, weight: 1 },
    { id: 'alt', ok: r.images.count === 0 || r.images.missingAlt / r.images.count <= 0.1, label: 'Pictures are described', detail: r.images.count ? '{n} of {total} pictures have no alt text.' : undefined, vars: { n: r.images.missingAlt, total: r.images.count }, weight: 2 },
    r.fonts.length
      ? { id: 'fonts', ok: r.fonts.length <= 3, label: 'A few, consistent typefaces', detail: '{n} typefaces: {names}.', vars: { n: r.fonts.length, names: r.fonts.join(', ') }, weight: 2 }
      : { id: 'fonts', ok: false, label: 'A few, consistent typefaces', detail: 'Only system fonts – nothing that sets the brand apart.', weight: 2 },
    brandColours.length
      ? { id: 'colours', ok: brandColours.length <= 6, label: 'A focused colour palette', detail: '{n} colours besides greys.', vars: { n: brandColours.length }, weight: 2 }
      : { id: 'colours', ok: false, label: 'A focused colour palette', detail: 'Only greys – no brand colour stands out.', weight: 2 },
  ]
  const total = checks.reduce((s, c) => s + c.weight, 0)
  const got = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0)
  return { checks: checks.map(({ weight: _, ...c }) => c), score: Math.round((got / total) * 100) }
}

/* ---------- Compared with a brand hub ---------- */

export function compareWithHub(r: AuditResult, hub: BrandHub) {
  const siteColours = r.colours.filter((c) => !isGrey(c.hex))
  const nearest = (hex: string) => hub.colours.map((b) => ({ b, d: colourDistance(b.hex, hex) })).sort((a, z) => a.d - z.d)[0]
  const colours = siteColours.map((c) => {
    const n = nearest(c.hex)
    return { hex: c.hex, match: n && n.d < 40 ? n.b : undefined, close: n && n.d >= 40 && n.d < 90 ? n.b : undefined }
  })
  const missing = hub.colours.filter((b) => !isGrey(b.hex) && !r.colours.some((c) => colourDistance(c.hex, b.hex) < 40))
  const siteFonts = r.fonts.map((f) => f.toLowerCase())
  const fonts = hub.fonts.map((f) => ({ name: f.name, used: siteFonts.some((s) => s === f.name.toLowerCase() || s.startsWith(f.name.toLowerCase())) }))
  const otherFonts = r.fonts.filter((f) => !hub.fonts.some((h) => f.toLowerCase().startsWith(h.name.toLowerCase())))
  const parts = [
    colours.length ? colours.filter((c) => c.match).length / colours.length : 0,
    hub.colours.length ? 1 - missing.length / Math.max(1, hub.colours.filter((b) => !isGrey(b.hex)).length) : 1,
    fonts.length ? fonts.filter((f) => f.used).length / fonts.length : 1,
  ]
  return { colours, missing, fonts, otherFonts, onBrand: Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) }
}
