/**
 * Content Machine – the pieces that aren't the editor: artboard sizes, the brand a design is made
 * on, starting layouts, which logo to show where, and snapping. Pure functions, so they're tested.
 */
import type { Artboard, Design, IconLayer, ImageLayer, Layer, LayoutGrid, LogoLayer, Pin, Project, ShapeKind, ShapeLayer, TextLayer } from '../../data/types'
import { contrast, readableOn } from '../color'
import { backgroundImage, type BackgroundStyle } from './backgrounds'
import { hiddenByPlatform, platformOf } from './platforms'
import { orderedColours } from '../palette'

export const uid = () => Math.random().toString(36).slice(2, 10)

/** Sizes to design for. `social` ones are made by “Make every social size”; print is at 300 dpi. */
export const SIZES: { id: string; name: string; width: number; height: number; social?: boolean; dpi?: number }[] = [
  { id: 'ig-post', name: 'Instagram post', width: 1080, height: 1080, social: true },
  { id: 'ig-portrait', name: 'Instagram portrait', width: 1080, height: 1350, social: true },
  { id: 'story', name: 'Story / Reel / TikTok', width: 1080, height: 1920, social: true },
  { id: 'linkedin', name: 'LinkedIn post', width: 1200, height: 627, social: true },
  { id: 'x-post', name: 'X post', width: 1600, height: 900, social: true },
  { id: 'pinterest', name: 'Pinterest pin', width: 1000, height: 1500, social: true },
  { id: 'fb-cover', name: 'Facebook cover', width: 1640, height: 624 },
  { id: 'linkedin-banner', name: 'LinkedIn banner', width: 1584, height: 396 },
  { id: 'youtube', name: 'YouTube thumbnail', width: 1280, height: 720 },
  { id: 'email', name: 'Email header', width: 1200, height: 400 },
  { id: 'slide', name: 'Presentation slide', width: 1920, height: 1080 },
  { id: 'a4', name: 'A4 poster', width: 2480, height: 3508, dpi: 300 },
  { id: 'card', name: 'Business card', width: 1050, height: 600, dpi: 300 },
]

/** The brand a design is made on: its colours by role, its fonts and its name. */
export function brandOf(project: Project) {
  const colours = orderedColours(project.hub.colours)
  const role = (r: string) => colours.find((c) => c.role === r)?.hex
  const primary = role('Primary') ?? colours[0]?.hex ?? project.cover.bg
  const light = role('Light') ?? colours.find((c) => contrast(c.hex, '#000000') > 12)?.hex ?? '#f5f4f0'
  const dark = role('Dark') ?? colours.find((c) => contrast(c.hex, '#ffffff') > 12)?.hex ?? '#111111'
  const accent = role('Accent') ?? role('Secondary') ?? colours[1]?.hex ?? primary
  const heading = project.hub.fonts[0]?.name ?? 'Inter Tight'
  const body = project.hub.fonts[1]?.name ?? heading
  return {
    primary, light, dark, accent,
    /** Every brand colour, for the colour pickers – brand first, then black and white. */
    swatches: [...new Set([...colours.map((c) => c.hex.toLowerCase()), '#ffffff', '#000000'])],
    heading, body,
    fonts: [...new Set([heading, body, ...project.hub.fonts.map((f) => f.name)])],
    wordmark: project.cover.wordmark || project.name,
  }
}
export type Brand = ReturnType<typeof brandOf>

/* ---------- New things ---------- */

export function newArtboard(size: { name: string; width: number; height: number; dpi?: number }, brand: Brand): Artboard {
  return { id: uid(), name: size.name, width: size.width, height: size.height, background: brand.light, layers: [], ...(size.dpi ? { dpi: size.dpi } : {}) }
}

const u = (a: Artboard) => Math.min(a.width, a.height) / 100 // 1% of the short side

export function newText(a: Artboard, brand: Brand, text = 'Your headline', big = true): TextLayer {
  const size = Math.round(u(a) * (big ? 8 : 3.4))
  const w = Math.round(a.width * 0.8)
  return {
    id: uid(), type: 'text', name: text.slice(0, 24), text,
    x: Math.round((a.width - w) / 2), y: Math.round(a.height / 2 - size), w, h: Math.round(size * 2.4),
    font: big ? brand.heading : brand.body, size, weight: big ? 600 : 400, colour: readableOn(a.background) === '#ffffff' ? '#ffffff' : brand.dark,
    align: 'center', lineHeight: 1.1, letterSpacing: big ? -0.02 : 0,
  }
}

const SHAPE_NAMES: Record<ShapeKind, string> = { rect: 'Rectangle', ellipse: 'Circle', triangle: 'Triangle', star: 'Star', polygon: 'Polygon', line: 'Line', arrow: 'Arrow' }

export function newShape(a: Artboard, brand: Brand, shape: ShapeKind = 'rect'): ShapeLayer {
  const s = Math.round(u(a) * 30)
  const base: ShapeLayer = { id: uid(), type: 'shape', name: SHAPE_NAMES[shape], shape, fill: brand.accent, radius: 0, x: Math.round((a.width - s) / 2), y: Math.round((a.height - s) / 2), w: s, h: s }
  // Lines and arrows are a stroke across a thin box.
  if (shape === 'line' || shape === 'arrow') {
    const h = Math.round(u(a) * 4)
    return { ...base, w: Math.round(u(a) * 40), h, x: Math.round((a.width - u(a) * 40) / 2), y: Math.round((a.height - h) / 2), stroke: { colour: brand.accent, width: Math.max(2, Math.round(u(a) * 0.8)) } }
  }
  return { ...base, sides: shape === 'star' ? 5 : shape === 'polygon' ? 6 : undefined }
}

export function newIcon(a: Artboard, brand: Brand, icon: string): IconLayer {
  const s = Math.round(u(a) * 14)
  return { id: uid(), type: 'icon', name: icon, icon, colour: readableOn(a.background) === '#ffffff' ? brand.light : brand.primary, strokeWidth: 2, x: Math.round((a.width - s) / 2), y: Math.round((a.height - s) / 2), w: s, h: s }
}

export function newImage(a: Artboard, src: string, ratio = 1): ImageLayer {
  const w = Math.round(a.width * 0.6)
  const h = Math.round(w / ratio)
  return { id: uid(), type: 'image', name: 'Image', src, fit: 'cover', x: Math.round((a.width - w) / 2), y: Math.round((a.height - h) / 2), w, h }
}

export function newLogo(a: Artboard): LogoLayer {
  const w = Math.round(a.width * 0.22)
  const h = Math.round(w * 0.4)
  return { id: uid(), type: 'logo', name: 'Logo', fileId: 'auto', x: Math.round((a.width - w) / 2), y: Math.round(a.height - h - u(a) * 7), w, h }
}

export function newDesign(project: Project, sizeId: string = SIZES[0].id, template: TemplateId = 'announcement', image?: { src: string; ratio: number }): Design {
  const brand = brandOf(project)
  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0]
  const a = applyTemplate(newArtboard(size, brand), brand, template, image)
  const at = new Date().toISOString()
  return { id: uid(), projectId: project.id, name: `${project.name} – ${size.name}`, artboards: [a], createdAt: at, updatedAt: at }
}

/* ---------- Starting layouts, made from the brand ---------- */

export const TEMPLATES = [
  { id: 'announcement', name: 'Announcement' },
  { id: 'quote', name: 'Quote' },
  { id: 'photo', name: 'Photo with text' },
  { id: 'blank', name: 'Blank' },
] as const
export type TemplateId = (typeof TEMPLATES)[number]['id']

/** Fills an artboard with a layout in the brand's colours and fonts. Works for any size. */
export function applyTemplate(a: Artboard, brand: Brand, id: TemplateId, image?: { src: string; ratio: number }): Artboard {
  const m = u(a) * 8 // margin
  const W = a.width - m * 2
  const text = (t: string, big: boolean, y: number, colour: string, align: TextLayer['align'] = 'left'): TextLayer => {
    const l = newText({ ...a }, brand, t, big)
    return { ...l, x: Math.round(m), w: Math.round(W), y: Math.round(y), colour, align }
  }
  const logo = (): LogoLayer => ({ ...newLogo(a), x: Math.round(m), y: Math.round(a.height - m - a.width * 0.088) })

  if (id === 'announcement') {
    const bg = brand.primary
    const ink = readableOn(bg) === '#ffffff' ? '#ffffff' : brand.dark
    const head = text('Something new is here.', true, a.height * 0.3, ink)
    return { ...a, background: bg, layers: [head, text('Tell people what it is and why it matters – in one or two short lines.', false, head.y + head.h + m * 0.4, ink), logo()] }
  }
  if (id === 'quote') {
    const bg = brand.light
    const quote = text('“The best way to explain what we do is to let our clients say it.”', true, a.height * 0.26, brand.dark)
    const bar: ShapeLayer = { ...newShape(a, brand), name: 'Accent bar', x: Math.round(m), y: Math.round(a.height * 0.2), w: Math.round(u(a) * 12), h: Math.round(u(a) * 1.4), fill: brand.primary }
    return { ...a, background: bg, layers: [bar, { ...quote, h: Math.round(quote.size * 4.6) }, text('— Name, Company', false, a.height * 0.26 + quote.size * 5, brand.dark), logo()] }
  }
  if (id === 'photo') {
    const photo: Layer[] = image ? [{ ...newImage(a, image.src, image.ratio), name: 'Photo', x: 0, y: 0, w: a.width, h: a.height }] : []
    const shade: ShapeLayer = { ...newShape(a, brand), name: 'Shade', x: 0, y: Math.round(a.height * 0.55), w: a.width, h: Math.round(a.height * 0.45), fill: '#000000', opacity: 0.45 }
    return { ...a, background: brand.dark, layers: [...photo, shade, text('A headline on the photo', true, a.height * 0.64, '#ffffff'), logo()] }
  }
  return { ...a, layers: [] }
}

/* ---------- Logos that read on their background ---------- */

/** What colour is behind a point: the topmost visible shape under it, else the artboard. Photos count as dark. */
export function backgroundAt(a: Artboard, below: Layer, x: number, y: number): string {
  const i = a.layers.indexOf(below)
  for (let j = (i < 0 ? a.layers.length : i) - 1; j >= 0; j--) {
    const l = a.layers[j]
    if (l.hidden || x < l.x || x > l.x + l.w || y < l.y || y > l.y + l.h) continue
    if (l.type === 'shape' && (l.opacity ?? 1) >= 0.4) return l.fill
    // A background we generated has a known colour; a photo is treated as dark.
    if (l.type === 'image') return l.generated?.colour ?? '#222222'
  }
  return a.background
}

/**
 * Which logo file to show: a light logo on dark backgrounds and the other way round. Logos that
 * work on both ('mixed') are the fallback; with no files at all the editor draws the wordmark.
 */
export function chooseLogo(logos: { id: string; tone: 'light' | 'dark' | 'mixed' }[], bg: string): string | undefined {
  if (!logos.length) return undefined
  const darkBg = readableOn(bg) === '#ffffff'
  const want = darkBg ? 'light' : 'dark'
  return (logos.find((l) => l.tone === want) ?? logos.find((l) => l.tone === 'mixed') ?? logos[0]).id
}

/** The wordmark's colour when there's no logo file: the brand colour if it reads, else black or white. */
export const wordmarkColour = (brand: Brand, bg: string) => (contrast(brand.primary, bg) >= 3 ? brand.primary : readableOn(bg))

/* ---------- Margins, clear space and the layout grid ---------- */

/**
 * The room the brand checks keep free along every edge: 5% of the artboard's short side – or, for
 * print, the bleed plus the safe area.
 */
export const safeMargin = (a: Pick<Artboard, 'width' | 'height'> & Partial<Pick<Artboard, 'print' | 'dpi'>>) =>
  a.print ? Math.round(((a.print.bleed + a.print.safe) / 25.4) * (a.dpi ?? 300)) : Math.round(Math.min(a.width, a.height) * 0.05)

/** The zone around a logo that the brand hub keeps free (its clear space, in logo heights). */
export function clearZone(l: Pick<Layer, 'x' | 'y' | 'w' | 'h'>, clearSpace: number) {
  const pad = clearSpace * l.h
  return { x: l.x - pad, y: l.y - pad, w: l.w + pad * 2, h: l.h + pad * 2 }
}

/** A layout grid to start from: six columns inside the safe margin. */
export const newGrid = (a: Artboard): LayoutGrid => ({ columns: 6, rows: 0, gutter: Math.round(Math.min(a.width, a.height) * 0.02), margin: safeMargin(a) })

/* ---------- One design, many sizes ---------- */

/**
 * The same artboard in another size. Everything scales to fit. A layer's pin says how it follows
 * (see Pin in types.ts); without one, layers that span the whole width or height stretch to the new
 * edges, layers near an edge (a logo in a corner) stay that far from it, and the rest stays centred.
 */
export function resizeArtboard(a: Artboard, size: { name: string; width: number; height: number; dpi?: number }): Artboard {
  const s = Math.min(size.width / a.width, size.height / a.height)
  /** Where a layer starts along one axis, and how long it is. */
  const along = (pos: number, len: number, from: number, to: number, pin?: Pin): [number, number] => {
    const end = from - pos - len
    if (pin === 'start') return [pos * s, len * s]
    if (pin === 'end') return [to - end * s - len * s, len * s]
    if (pin === 'centre') return [to / 2 + (pos - from / 2) * s, len * s]
    if (pin === 'stretch') return [pos * s, Math.max(1, to - pos * s - end * s)]
    if (pin === 'scale') return [(pos * to) / from, (len * to) / from]
    if (pos <= 0 && pos + len >= from) return [0, to]
    const centre = pos + len / 2
    if (centre < from * 0.25) return [pos * s, len * s]
    if (centre > from * 0.75) return [to - end * s - len * s, len * s]
    return [to / 2 + (pos - from / 2) * s, len * s]
  }
  const layers = a.layers.map((l): Layer => {
    const [x, w] = along(l.x, l.w, a.width, size.width, l.pin?.x)
    const [y, h] = along(l.y, l.h, a.height, size.height, l.pin?.y)
    const next = { ...l, id: uid(), x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
    return next.type === 'text' ? { ...next, size: Math.max(6, Math.round(next.size * s)) } : next
  })
  // Guides keep their place relative to the edges; the grid's gutter and margin scale.
  const guides = a.guides?.map((g) => ({ ...g, at: Math.round((g.at / (g.axis === 'x' ? a.width : a.height)) * (g.axis === 'x' ? size.width : size.height)) }))
  const grid = a.grid && { ...a.grid, gutter: Math.round(a.grid.gutter * s), margin: Math.round(a.grid.margin * s) }
  return { ...a, id: uid(), name: size.name, width: size.width, height: size.height, dpi: size.dpi, layers, guides, grid }
}

/* ---------- Text colour that reads, and moving a design to another brand ---------- */

/**
 * A text layer's colour: its own, or – set to 'auto' – the brand colour that reads best on what's
 * behind it (the brand's dark or light first).
 */
export function textColour(l: TextLayer, a: Artboard, brand: Brand, h = estimateHeight(l)) {
  if (l.colour !== 'auto') return l.colour
  const bg = l.highlight ? l.highlight.colour : backgroundAt(a, l, l.x + l.w / 2, l.y + h / 2)
  const options = [brand.dark, brand.light, brand.primary, '#ffffff', '#000000']
  return options.find((c) => contrast(c, bg) >= 4.5) ?? options.sort((x, y) => contrast(y, bg) - contrast(x, bg))[0]
}

/**
 * A design moved onto another client's brand: colours swap role for role (primary for primary,
 * light for light…), the heading font for the heading font, the body font for the body font, and
 * backgrounds made from the old palette are drawn again from the new one.
 */
export function rebrand(a: Artboard, from: Brand, to: Brand): Artboard {
  const pairs: [string, string][] = [[from.primary, to.primary], [from.accent, to.accent], [from.light, to.light], [from.dark, to.dark]]
  const plain = (b: Brand) => b.swatches.filter((c) => !['#ffffff', '#000000'].includes(c) && ![b.primary, b.accent, b.light, b.dark].some((r) => r.toLowerCase() === c))
  const restTo = plain(to)
  plain(from).forEach((c, i) => pairs.push([c, restTo[i % Math.max(1, restTo.length)] ?? to.accent]))
  const map = new Map<string, string>()
  for (const [f, t] of pairs) if (!map.has(f.toLowerCase())) map.set(f.toLowerCase(), t)
  const c = (x: string) => map.get(x.toLowerCase()) ?? x
  const g = <T extends { stops: [string, string] } | undefined>(gr: T): T => (gr ? { ...gr, stops: [c(gr.stops[0]), c(gr.stops[1])] } : gr)
  const font = (f: string) => (f === from.heading ? to.heading : f === from.body ? to.body : to.fonts.includes(f) ? f : to.body)
  const layers = a.layers.map((l): Layer => {
    const shadow = l.shadow && { ...l.shadow, colour: c(l.shadow.colour) }
    if (l.type === 'text')
      return {
        ...l, shadow, font: font(l.font), colour: l.colour === 'auto' ? 'auto' : c(l.colour), emphasis: l.emphasis && c(l.emphasis), gradient: g(l.gradient),
        highlight: l.highlight && { ...l.highlight, colour: c(l.highlight.colour) }, stroke: l.stroke && { ...l.stroke, colour: c(l.stroke.colour) },
      }
    if (l.type === 'shape') return { ...l, shadow, fill: c(l.fill), gradient: g(l.gradient), stroke: l.stroke && { ...l.stroke, colour: c(l.stroke.colour) } }
    if (l.type === 'icon') return { ...l, shadow, colour: c(l.colour) }
    if (l.type === 'logo') return { ...l, shadow, colour: l.colour && /^#/.test(l.colour) ? c(l.colour) : l.colour }
    if (l.generated) {
      const { src, colour } = backgroundImage(l.generated.style as BackgroundStyle, to, l.w, l.h, l.generated.seed)
      return { ...l, shadow, src, generated: { ...l.generated, colour } }
    }
    return { ...l, shadow, duotone: l.duotone && [c(l.duotone[0]), c(l.duotone[1])] }
  })
  return { ...a, background: c(a.background), backgroundGradient: g(a.backgroundGradient), layers }
}

export const duplicateLayer = (l: Layer, offset = 24): Layer => ({ ...l, id: uid(), name: l.name + ' copy', x: l.x + offset, y: l.y + offset })

/* ---------- Brand checks: the brand hub's rules, applied to a design ---------- */

export type Issue = {
  layerId: string
  kind: 'contrast' | 'edge' | 'clearspace' | 'logo-size' | 'colour' | 'font' | 'small' | 'platform' | 'print'
  /** English text (translated where it's shown) and its placeholders. */
  message: string
  vars?: Record<string, string | number>
  /** A one-click fix, when there's an obvious one. */
  fix?: { label: string; vars?: Record<string, string | number>; patch: Partial<Layer> }
}

/** Roughly how tall a text layer is, when the real height isn't measured. */
export function estimateHeight(l: TextLayer) {
  const perLine = Math.max(1, Math.floor(l.w / (l.size * 0.52)))
  const lines = l.text.split('\n').reduce((n, p) => n + Math.max(1, Math.ceil(p.length / perLine)), 0)
  return lines * l.size * l.lineHeight
}

const hexDistance = (a: string, b: string) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}
const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s)

/**
 * Everything on an artboard that breaks the brand hub's rules: text that can't be read on what's
 * behind it, things too close to the edge, the logo's clear space and minimum size, and colours or
 * fonts that aren't the brand's. `heightOf` gives a layer's real height when the editor has it.
 */
export function checkArtboard(a: Artboard, brand: Brand, rules: { clearSpace: number; minWidthPx: number }, heightOf: (l: Layer) => number = (l) => (l.type === 'text' ? estimateHeight(l) : l.h)): Issue[] {
  const issues: Issue[] = []
  const short = Math.min(a.width, a.height)
  const margin = safeMargin(a)
  const brandHexes = brand.swatches.map((c) => c.toLowerCase())
  const box = (l: Layer) => ({ x: l.x, y: l.y, w: l.w, h: heightOf(l) })

  for (const l of a.layers) {
    if (l.hidden) continue
    const b = box(l)
    // Words in a box sit on the box's colour.
    const bg = l.type === 'text' && l.highlight ? l.highlight.colour : backgroundAt(a, l, b.x + b.w / 2, b.y + b.h / 2)

    if (l.type === 'text') {
      const large = l.size >= short * 0.045 || (l.size >= short * 0.035 && l.weight >= 600)
      const need = large ? 3 : 4.5
      const ratio = contrast(l.gradient ? l.gradient.stops[0] : textColour(l, a, brand, b.h), bg)
      if (ratio < need) {
        // The brand colour that reads best – the brand's own first, black or white last.
        const best = [...brandHexes].sort((x, y) => contrast(y, bg) - contrast(x, bg))[0]
        issues.push({
          layerId: l.id, kind: 'contrast',
          message: 'Hard to read here: {ratio}:1 against the background (needs {need}:1)', vars: { ratio: ratio.toFixed(1), need },
          fix: { label: 'Use {colour}', vars: { colour: best }, patch: { colour: best } },
        })
      }
      if (l.size < short * 0.018) issues.push({ layerId: l.id, kind: 'small', message: 'Very small text – hard to read on a phone' })
      if (isHex(l.colour) && !brandHexes.includes(l.colour.toLowerCase())) {
        const nearest = [...brandHexes].sort((x, y) => hexDistance(x, l.colour) - hexDistance(y, l.colour))[0]
        issues.push({ layerId: l.id, kind: 'colour', message: 'Not one of the brand’s colours', fix: { label: 'Use {colour}', vars: { colour: nearest }, patch: { colour: nearest } } })
      }
      if (!brand.fonts.includes(l.font)) issues.push({ layerId: l.id, kind: 'font', message: '{font} isn’t one of the brand’s fonts', vars: { font: l.font }, fix: { label: 'Use {font}', vars: { font: brand.body }, patch: { font: brand.body } } })
    }

    if (l.type === 'shape' && isHex(l.fill) && !brandHexes.includes(l.fill.toLowerCase())) {
      const nearest = [...brandHexes].sort((x, y) => hexDistance(x, l.fill) - hexDistance(y, l.fill))[0]
      issues.push({ layerId: l.id, kind: 'colour', message: 'Not one of the brand’s colours', fix: { label: 'Use {colour}', vars: { colour: nearest }, patch: { fill: nearest } } })
    }

    if (l.type === 'text' || l.type === 'logo') {
      const tooClose = b.x < margin || b.y < margin || b.x + b.w > a.width - margin || b.y + b.h > a.height - margin
      if (tooClose) {
        const x = Math.min(Math.max(b.x, margin), a.width - margin - b.w)
        const y = Math.min(Math.max(b.y, margin), a.height - margin - b.h)
        issues.push({ layerId: l.id, kind: 'edge', message: 'Too close to the edge – keep {px} px free', vars: { px: margin }, fix: { label: 'Move it in', patch: { x: Math.round(x), y: Math.round(y) } } })
      }
    }

    if (l.type === 'logo') {
      if (l.colour && isHex(l.colour) && contrast(l.colour, bg) < 3) {
        issues.push({ layerId: l.id, kind: 'contrast', message: 'The logo doesn’t stand out from the background', fix: { label: 'Pick the colour for me', patch: { colour: 'auto' } } })
      }
      if (l.w < rules.minWidthPx) {
        const w = rules.minWidthPx
        issues.push({ layerId: l.id, kind: 'logo-size', message: 'Smaller than the brand hub allows ({px} px wide)', vars: { px: w }, fix: { label: 'Make it {px} px', vars: { px: w }, patch: { w, h: Math.round((l.h * w) / l.w) } } })
      }
      // Clear space: nothing else readable inside the logo's protected zone.
      const zone = clearZone(l, rules.clearSpace)
      const crowding = a.layers.find((o) => {
        if (o.id === l.id || o.hidden || (o.type !== 'text' && o.type !== 'logo')) return false
        const ob = box(o)
        return ob.x < zone.x + zone.w && ob.x + ob.w > zone.x && ob.y < zone.y + zone.h && ob.y + ob.h > zone.y
      })
      if (crowding) {
        issues.push({ layerId: l.id, kind: 'clearspace', message: 'Needs more room: keep {x}× its height free around the logo (brand hub rule)', vars: { x: rules.clearSpace } })
      }
    }
  }
  // Where it'll be posted: nothing important under the app's own buttons.
  const platform = platformOf(a)
  for (const h of platform ? hiddenByPlatform(a, box) : [])
    issues.push({ layerId: h.layerId, kind: 'platform', message: 'Covered on {platform}: {zone}', vars: { platform: platform!.name, zone: h.zone }, fix: { label: 'Move it clear', patch: h.to } })
  return issues
}
