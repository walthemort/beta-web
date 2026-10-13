/**
 * Backgrounds made from the brand's own palette – soft colour fields, shapes, lines and grain –
 * drawn as SVG. A seed picks the variation, so “Shuffle” gives a new one in the same style.
 */
import type { Brand } from './model'
import { mix } from '../color'

export const BACKGROUND_STYLES = [
  { id: 'gradient', name: 'Gradient' },
  { id: 'glow', name: 'Soft glow' },
  { id: 'shapes', name: 'Shapes' },
  { id: 'arcs', name: 'Arcs' },
  { id: 'lines', name: 'Lines' },
  { id: 'grain', name: 'Grain' },
] as const
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number]['id']

/** A small, repeatable random number generator (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The background as SVG, and roughly its overall colour – what the brand checks compare text
 * against, since we know exactly what we drew (unlike a photo).
 */
export function backgroundSvg(style: BackgroundStyle, brand: Brand, w: number, h: number, seed: number): { svg: string; colour: string } {
  const r = random(seed)
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)]
  // The brand's colours, with the most-used first; the base is the primary, light or dark.
  const palette = [...new Set([brand.primary, brand.accent, brand.light, brand.dark, ...brand.swatches.filter((c) => c !== '#ffffff' && c !== '#000000')])]
  const base = pick([brand.primary, brand.light, brand.dark])
  const others = palette.filter((c) => c !== base)
  const n = (v: number) => Math.round(v * 10) / 10
  let body = ''
  let defs = ''
  let colour = base
  const average = (list: string[]) => list.reduce((acc, c, i) => mix(acc, c, 1 / (i + 1)), list[0] ?? base)

  if (style === 'gradient') {
    const angle = Math.round(r() * 360)
    const [a, b] = [base, pick(others)]
    colour = mix(a, b, 0.5)
    defs = `<linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`
    body = `<rect width="${w}" height="${h}" fill="url(#g)"/>`
  } else if (style === 'glow' || style === 'grain') {
    defs = `<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(Math.min(w, h) * 0.12)}"/></filter>`
    const fills = Array.from({ length: 4 }, () => pick(others))
    const blobs = fills.map((c) => `<circle cx="${n(r() * w)}" cy="${n(r() * h)}" r="${n(Math.min(w, h) * (0.25 + r() * 0.3))}" fill="${c}" opacity="${n(0.55 + r() * 0.4)}"/>`)
    colour = mix(base, average(fills), 0.5)
    body = `<rect width="${w}" height="${h}" fill="${base}"/><g filter="url(#b)">${blobs.join('')}</g>`
    if (style === 'grain') {
      defs += `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed % 1000}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`
      body += `<rect width="${w}" height="${h}" filter="url(#n)" opacity="0.18" style="mix-blend-mode:overlay"/>`
    }
  } else if (style === 'shapes') {
    const s = Math.min(w, h)
    const used: string[] = []
    const shapes = Array.from({ length: 3 + Math.floor(r() * 3) }, () => {
      const c = pick(others)
      used.push(c)
      const size = s * (0.25 + r() * 0.45)
      const x = r() * w - size / 2
      const y = r() * h - size / 2
      return r() < 0.5
        ? `<circle cx="${n(x + size / 2)}" cy="${n(y + size / 2)}" r="${n(size / 2)}" fill="${c}"/>`
        : `<rect x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" rx="${n(r() < 0.5 ? 0 : size * 0.18)}" fill="${c}" transform="rotate(${Math.round(r() * 40 - 20)} ${n(x + size / 2)} ${n(y + size / 2)})"/>`
    })
    body = `<rect width="${w}" height="${h}" fill="${base}"/>${shapes.join('')}`
    colour = mix(base, average(used), 0.35)
  } else if (style === 'arcs') {
    const s = Math.max(w, h)
    const cx = r() < 0.5 ? 0 : w
    const cy = r() < 0.5 ? 0 : h
    const rings = Array.from({ length: 6 }, (_, i) => `<circle cx="${cx}" cy="${cy}" r="${n(s * (1.1 - i * 0.17))}" fill="${i % 2 ? base : others[i % others.length] ?? base}"/>`)
    body = `<rect width="${w}" height="${h}" fill="${base}"/>${rings.join('')}`
    colour = mix(base, others[0] ?? base, 0.5)
  } else {
    const c = pick(others)
    const gap = Math.round(Math.min(w, h) * (0.03 + r() * 0.04))
    const stroke = Math.max(2, Math.round(gap * (0.12 + r() * 0.2)))
    const angle = pick([0, 45, 90, -45])
    defs = `<pattern id="p" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><rect width="${stroke}" height="${gap}" fill="${c}"/></pattern>`
    body = `<rect width="${w}" height="${h}" fill="${base}"/><rect width="${w}" height="${h}" fill="url(#p)" opacity="0.6"/>`
    colour = mix(base, c, 0.2)
  }
  return { colour, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none"><defs>${defs}</defs>${body}</svg>` }
}

export function backgroundImage(style: BackgroundStyle, brand: Brand, w: number, h: number, seed: number) {
  const { svg, colour } = backgroundSvg(style, brand, w, h, seed)
  return { src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), colour }
}

export const newSeed = () => Math.floor(Math.random() * 1e9)
