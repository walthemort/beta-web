/**
 * Remix: the same post in other layouts and colour schemes from the brand – like asking a designer
 * for a few alternatives. Every version keeps the words, the photo and the logo; only where they
 * sit and which brand colours they use change, and text always stays readable.
 */
import type { Artboard, ImageLayer, Layer, ShapeLayer, TextLayer } from '../../data/types'
import { contrast } from '../color'
import { backgroundAt, estimateHeight, safeMargin, uid, type Brand } from './model'

export type Remix = { name: string; artboard: Artboard }
type V = 'top' | 'middle' | 'bottom'
type H = 'left' | 'centre'
type Scheme = { name: string; bg: string; text: string; accent: string }

const heightOf = (l: Layer) => (l.type === 'text' ? estimateHeight(l) : l.h)

/** Brand colour schemes where the text reads: primary, light, dark and accent backgrounds. */
export function schemes(brand: Brand): Scheme[] {
  const readable = (bg: string, prefer: string[]) => [...prefer, '#ffffff', '#111111'].find((c) => contrast(c, bg) >= 4.5) ?? '#ffffff'
  const pop = (bg: string, text: string, prefer: string[]) => prefer.find((c) => c.toLowerCase() !== bg.toLowerCase() && contrast(c, bg) >= 3) ?? text
  const out: Scheme[] = [
    { name: 'Primary', bg: brand.primary, text: readable(brand.primary, [brand.light, brand.dark]), accent: '' },
    { name: 'Light', bg: brand.light, text: readable(brand.light, [brand.dark, brand.primary]), accent: '' },
    { name: 'Dark', bg: brand.dark, text: readable(brand.dark, [brand.light]), accent: '' },
    { name: 'Accent', bg: brand.accent, text: readable(brand.accent, [brand.dark, brand.light]), accent: '' },
  ].map((s) => ({ ...s, accent: pop(s.bg, s.text, [brand.accent, brand.primary, brand.light, brand.dark]) }))
  return out.filter((s, i) => out.findIndex((o) => o.bg.toLowerCase() === s.bg.toLowerCase()) === i)
}

/** Text in a colour that reads on what's behind it – the scheme's own first. */
function readableText(a: Artboard, l: TextLayer, prefer: string[]) {
  const bg = backgroundAt(a, l, l.x + l.w / 2, l.y + estimateHeight(l) / 2)
  return [...prefer, '#ffffff', '#111111'].find((c) => contrast(c, bg) >= 4.5) ?? '#ffffff'
}

export function remixes(a: Artboard, brand: Brand): Remix[] {
  const W = a.width
  const Hh = a.height
  const m = Math.round(safeMargin(a) * 1.6)
  const visible = a.layers.filter((l) => !l.hidden)
  const big = (l: Layer) => l.w * heightOf(l) >= W * Hh * 0.2
  const photo = visible.find((l): l is ImageLayer => l.type === 'image' && !l.generated && big(l))
  const block = visible.filter((l) => l.type === 'text' || l.type === 'icon' || (l.type === 'shape' && !big(l)))
  const texts = block.filter((l): l is TextLayer => l.type === 'text')
  if (!texts.length) return []
  const logos = visible.filter((l) => l.type === 'logo')
  const shades = visible.filter((l): l is ShapeLayer => l.type === 'shape' && big(l))
  const hasBackdrop = visible.some((l) => l.type === 'image' && l.generated)

  const top = Math.min(...block.map((l) => l.y))
  const blockH = Math.max(...block.map((l) => l.y + heightOf(l))) - top
  const left = Math.min(...block.map((l) => l.x))

  /** The words (and small shapes with them) placed in a region, keeping their spacing. */
  const placeBlock = (layers: Layer[], v: V, h: H, region: { x: number; y: number; w: number; h: number }) => {
    const start = Math.max(region.y, v === 'top' ? region.y : v === 'bottom' ? region.y + region.h - blockH : region.y + (region.h - blockH) / 2)
    return layers.map((l): Layer => {
      if (!block.includes(l)) return l
      const y = Math.round(start + (l.y - top))
      if (l.type === 'text') {
        const w = Math.min(l.w, region.w)
        return { ...l, y, w: Math.round(w), x: Math.round(h === 'left' ? region.x : region.x + (region.w - w) / 2), align: h === 'left' ? 'left' : 'center' }
      }
      return { ...l, y, x: Math.round(h === 'left' ? region.x + Math.min(l.x - left, region.w - l.w) : region.x + (region.w - l.w) / 2) }
    })
  }
  /** Logos at the other end from the words. */
  const placeLogos = (layers: Layer[], v: V, h: H, region = { x: m, w: W - m * 2 }) =>
    layers.map((l): Layer => (l.type !== 'logo' ? l : { ...l, y: Math.round(v === 'bottom' ? m : Hh - m - l.h), x: Math.round(h === 'left' ? region.x : region.x + (region.w - l.w) / 2) }))
  /** Colours from a scheme, then every text made readable where it now sits. */
  const colour = (b: Artboard, s: Scheme, background: boolean): Artboard => {
    const layers = b.layers.map((l): Layer => {
      if (l.type === 'text') return { ...l, emphasis: l.emphasis ? s.accent : undefined, gradient: undefined }
      if (l.type === 'shape' && block.includes(l)) return { ...l, fill: s.accent, gradient: undefined }
      if (l.type === 'icon') return { ...l, colour: s.accent }
      if (l.type === 'logo') return { ...l, colour: 'auto' }
      return l
    })
    const next = { ...b, background: background ? s.bg : b.background, backgroundGradient: background ? undefined : b.backgroundGradient, layers }
    return { ...next, layers: next.layers.map((l) => (l.type === 'text' ? { ...l, colour: readableText(next, l, [s.text, brand.dark, brand.light]) } : l)) }
  }

  const out: Remix[] = []
  const all = schemes(brand)
  const scheme = (i: number) => all[i % all.length]
  const inner = { x: m, y: m, w: W - m * 2, h: Hh - m * 2 }

  if (!photo) {
    // Plain designs: the words top, middle or bottom, left or centred, across the brand's schemes.
    const logoRoom = Math.max(0, ...logos.map((l) => l.h)) + m * 0.6
    const combos: [V, H, number][] = [['middle', 'left', 0], ['bottom', 'left', 1], ['top', 'left', 2], ['middle', 'centre', 1], ['bottom', 'centre', 2], ['top', 'centre', 3], ['middle', 'centre', 0]]
    for (const [v, h, si] of combos) {
      const region = { ...inner, y: v === 'bottom' ? inner.y + logoRoom : inner.y, h: inner.h - logoRoom }
      const layers = placeLogos(placeBlock(a.layers, v, h, region), v, h)
      const s = scheme(si)
      out.push({ name: `${s.name} · ${v} ${h}`, artboard: colour({ ...a, layers }, s, !hasBackdrop) })
    }
  } else {
    const logoRoom = Math.max(0, ...logos.map((l) => l.h)) + m * 0.6
    const full = { ...photo, x: 0, y: 0, w: W, h: Hh, mask: undefined }
    const shadeOf = (y: number, h: number): ShapeLayer => ({ ...(shades[0] ?? { id: uid(), type: 'shape', name: 'Shade', shape: 'rect', radius: 0, fill: '#000000' }), x: 0, y: Math.round(y), w: W, h: Math.round(h), opacity: 0.45, hidden: false, fill: '#000000' } as ShapeLayer)
    const withShade = (layers: Layer[], shade: ShapeLayer | null) => {
      const rest = layers.filter((l) => !shades.includes(l as ShapeLayer) || l.id !== shade?.id)
      const hidden = rest.map((l) => (shades.some((s) => s.id === l.id) ? { ...l, hidden: true } : l))
      if (!shade) return hidden
      const at = hidden.findIndex((l) => l.id === photo.id) + 1
      return [...hidden.slice(0, at), shade, ...hidden.slice(at)]
    }
    const swapPhoto = (layers: Layer[], p: ImageLayer) => layers.map((l) => (l.id === photo.id ? p : l))

    // 1–2. The photo full-bleed, the words on a shade at the bottom or the top.
    for (const v of ['bottom', 'top'] as V[]) {
      const bandH = Math.min(Hh * 0.6, blockH + logoRoom + m * 2.4)
      const band = v === 'bottom' ? { y: Hh - bandH, h: bandH } : { y: 0, h: bandH }
      let layers = withShade(swapPhoto(a.layers, full), shadeOf(band.y, band.h))
      layers = placeBlock(layers, v === 'bottom' ? 'bottom' : 'top', 'left', { ...inner, y: v === 'top' ? m : inner.y, h: v === 'bottom' ? inner.h - logoRoom : inner.h - logoRoom })
      layers = placeLogos(layers, v === 'bottom' ? 'middle' : 'bottom', 'left')
      if (v === 'top') layers = layers.map((l) => (l.type === 'logo' ? { ...l, y: Math.round(Hh - m - l.h) } : l))
      out.push({ name: v === 'bottom' ? 'Photo · words at the bottom' : 'Photo · words at the top', artboard: colour({ ...a, layers }, scheme(2), false) })
    }
    // 3. Photo above, words below on a brand colour.
    {
      const ph = Math.round(Hh * (W >= Hh ? 0.5 : 0.56))
      let layers = withShade(swapPhoto(a.layers, { ...photo, x: 0, y: 0, w: W, h: ph, mask: undefined }), null)
      layers = placeBlock(layers, 'top', 'left', { x: m, y: ph + m * 0.8, w: W - m * 2, h: Hh - ph - m * 1.8 - logoRoom })
      layers = placeLogos(layers, 'top', 'left')
      out.push({ name: 'Photo above · words below', artboard: colour({ ...a, layers }, scheme(1), true) })
    }
    // 4. Words on the left, photo on the right half.
    if (W >= Hh * 0.9) {
      const pw = Math.round(W / 2)
      let layers = withShade(swapPhoto(a.layers, { ...photo, x: W - pw, y: 0, w: pw, h: Hh, mask: undefined }), null)
      layers = placeBlock(layers, 'middle', 'left', { x: m, y: m, w: W - pw - m * 1.6, h: Hh - m * 2 - logoRoom })
      layers = placeLogos(layers, 'middle', 'left', { x: m, w: W - pw - m * 1.6 })
      out.push({ name: 'Words left · photo right', artboard: colour({ ...a, layers }, scheme(0), true) })
    }
    // 5. A round photo, words above it.
    {
      const d = Math.round(Math.min(W, Hh) * 0.52)
      const round: ImageLayer = { ...photo, w: d, h: d, x: Math.round(W - m - d), y: Math.round(Hh - m - d), mask: 'circle' }
      let layers = withShade(swapPhoto(a.layers, round), null)
      layers = placeBlock(layers, 'top', 'left', { x: m, y: m, w: W - m * 2, h: Hh - d - m * 2.6 })
      layers = layers.map((l) => (l.type === 'logo' ? { ...l, x: m, y: Math.round(Hh - m - l.h) } : l))
      out.push({ name: 'Round photo', artboard: colour({ ...a, layers }, scheme(3), true) })
    }
  }
  return out
}
