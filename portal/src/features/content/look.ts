/**
 * How layers look: gradients, shadows and blur, photo adjustments, masks, shape outlines, the
 * brand's text styles and highlighted words. Pure functions, shared by the canvas and the export.
 */
import type { Gradient, ImageAdjust, ImageMask, Shadow, ShapeKind, TypeScale } from '../../data/types'

/* ---------- Colour ---------- */

export function withAlpha(hex: string, alpha: number) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}

export const gradientCss = (g: Gradient) =>
  g.type === 'radial' ? `radial-gradient(circle at 50% 50%, ${g.stops[0]}, ${g.stops[1]})` : `linear-gradient(${g.angle}deg, ${g.stops[0]}, ${g.stops[1]})`

/** The same gradient for SVG shapes: start and end points in the shape's own box (0–1). */
export function gradientVector(angle: number) {
  const a = (angle * Math.PI) / 180
  const dx = Math.sin(a) / 2
  const dy = -Math.cos(a) / 2
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy }
}

/* ---------- Effects ---------- */

/** Drop shadow and blur for a whole layer, as a CSS filter – it follows the shape of what's drawn. */
export function effectFilter(l: { shadow?: Shadow; blur?: number }) {
  const parts: string[] = []
  if (l.shadow) parts.push(`drop-shadow(${l.shadow.x}px ${l.shadow.y}px ${Math.max(0, l.shadow.blur)}px ${withAlpha(l.shadow.colour, l.shadow.opacity)})`)
  if (l.blur) parts.push(`blur(${Math.max(0, l.blur)}px)`)
  return parts.join(' ') || undefined
}

export const NO_ADJUST: ImageAdjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, blur: 0 }

/** Light and colour as a CSS filter. Warmth leans towards amber or blue. */
export function adjustFilter(a?: ImageAdjust, grey = false) {
  if (!a && !grey) return undefined
  const x = { ...NO_ADJUST, ...a }
  const parts = [
    x.brightness && `brightness(${1 + x.brightness / 100})`,
    x.contrast && `contrast(${1 + x.contrast / 100})`,
    x.saturation && `saturate(${Math.max(0, 1 + x.saturation / 100)})`,
    x.warmth > 0 && `sepia(${(x.warmth / 100) * 0.45})`,
    x.warmth < 0 && `hue-rotate(${x.warmth * 0.25}deg)`,
    x.blur && `blur(${x.blur}px)`,
    grey && 'grayscale(1)',
  ].filter(Boolean)
  return parts.join(' ') || undefined
}

/** One-click looks for photos. */
export const PHOTO_LOOKS: { id: string; name: string; adjust: ImageAdjust }[] = [
  { id: 'none', name: 'Original', adjust: NO_ADJUST },
  { id: 'warm', name: 'Warm', adjust: { brightness: 4, contrast: 6, saturation: 8, warmth: 40, blur: 0 } },
  { id: 'cool', name: 'Cool', adjust: { brightness: 2, contrast: 8, saturation: -6, warmth: -40, blur: 0 } },
  { id: 'punchy', name: 'Punchy', adjust: { brightness: 0, contrast: 28, saturation: 30, warmth: 0, blur: 0 } },
  { id: 'faded', name: 'Faded', adjust: { brightness: 10, contrast: -22, saturation: -24, warmth: 10, blur: 0 } },
  { id: 'mono', name: 'Mono', adjust: { brightness: 0, contrast: 16, saturation: -100, warmth: 0, blur: 0 } },
  { id: 'dreamy', name: 'Soft focus', adjust: { brightness: 8, contrast: -8, saturation: 4, warmth: 12, blur: 2 } },
]

/** The table an SVG filter uses to paint a greyscale photo in two colours (shadows → highlights). */
export function duotoneTables(dark: string, light: string) {
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16) / 255
  return { r: `${c(dark, 1)} ${c(light, 1)}`, g: `${c(dark, 3)} ${c(light, 3)}`, b: `${c(dark, 5)} ${c(light, 5)}` }
}

/* ---------- Masks and shapes ---------- */

const pts = (list: [number, number][]) => list.map(([x, y]) => `${Math.round(x * 100) / 100}% ${Math.round(y * 100) / 100}%`).join(', ')

/** Points of a star or polygon in a 0–100 box, starting at the top. */
export function starPoints(points: number, inner: number): [number, number][] {
  const n = Math.max(3, Math.min(24, Math.round(points)))
  return Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 50 : 50 * inner
    const a = (Math.PI * i) / n - Math.PI / 2
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as [number, number]
  })
}
export function polygonPoints(sides: number): [number, number][] {
  const n = Math.max(3, Math.min(24, Math.round(sides)))
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2
    return [50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)] as [number, number]
  })
}
/** A soft, organic outline. */
function blobPoints(): [number, number][] {
  return Array.from({ length: 36 }, (_, i) => {
    const a = (2 * Math.PI * i) / 36
    const r = 44 + 5 * Math.sin(3 * a + 0.6) + 3 * Math.cos(5 * a)
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as [number, number]
  })
}

export const MASKS: { id: ImageMask; name: string; clip: string }[] = [
  { id: 'circle', name: 'Circle', clip: 'ellipse(50% 50% at 50% 50%)' },
  { id: 'rounded', name: 'Rounded', clip: 'inset(0 round 12%)' },
  { id: 'arch', name: 'Arch', clip: 'inset(0 round 50% 50% 0 0 / 34% 34% 0 0)' },
  { id: 'hexagon', name: 'Hexagon', clip: `polygon(${pts(polygonPoints(6))})` },
  { id: 'star', name: 'Star', clip: `polygon(${pts(starPoints(5, 0.5))})` },
  { id: 'blob', name: 'Blob', clip: `polygon(${pts(blobPoints())})` },
]
export const maskClip = (m?: ImageMask) => MASKS.find((x) => x.id === m)?.clip

export const SHAPES: { id: ShapeKind; name: string }[] = [
  { id: 'rect', name: 'Rectangle' },
  { id: 'ellipse', name: 'Circle' },
  { id: 'triangle', name: 'Triangle' },
  { id: 'star', name: 'Star' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'line', name: 'Line' },
  { id: 'arrow', name: 'Arrow' },
]

/** The outline of a filled shape as SVG points in a 0–100 box. */
export function shapePoints(shape: ShapeKind, sides = 5): string | null {
  const list = shape === 'triangle' ? ([[50, 0], [100, 100], [0, 100]] as [number, number][]) : shape === 'star' ? starPoints(sides, 0.45) : shape === 'polygon' ? polygonPoints(sides) : null
  return list && list.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(' ')
}

/* ---------- Text ---------- */

/** Text split into plain and *emphasised* parts. A lone * stays as it is. */
export function emphasisParts(text: string): { text: string; em: boolean }[] {
  const out: { text: string; em: boolean }[] = []
  const re = /\*([^*\n]+)\*/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), em: false })
    out.push({ text: m[1], em: true })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), em: false })
  return out
}

export type TextStyleId = 'display' | 'heading' | 'subheading' | 'body' | 'caption' | 'eyebrow'

/**
 * The brand's type scale as text styles, sized for this artboard: body text reads like body text
 * on a phone, and each step up follows the hub's ratio.
 */
export function textStyles(scale: TypeScale | undefined, board: { width: number; height: number }, fonts: { heading: string; body: string }) {
  const ratio = scale?.ratio && scale.ratio > 1 && scale.ratio < 2 ? scale.ratio : 1.25
  const body = Math.min(board.width, board.height) * 0.034
  const size = (steps: number) => Math.round(body * ratio ** steps)
  const styles: { id: TextStyleId; name: string; font: string; size: number; weight: number; lineHeight: number; letterSpacing: number; uppercase?: boolean }[] = [
    { id: 'display', name: 'Display', font: fonts.heading, size: size(6), weight: 600, lineHeight: 1, letterSpacing: -0.03 },
    { id: 'heading', name: 'Heading', font: fonts.heading, size: size(4), weight: 600, lineHeight: 1.05, letterSpacing: -0.02 },
    { id: 'subheading', name: 'Subheading', font: fonts.heading, size: size(2), weight: 500, lineHeight: 1.15, letterSpacing: -0.01 },
    { id: 'body', name: 'Body', font: fonts.body, size: size(0), weight: 400, lineHeight: 1.4, letterSpacing: 0 },
    { id: 'caption', name: 'Caption', font: fonts.body, size: size(-1), weight: 400, lineHeight: 1.35, letterSpacing: 0 },
    { id: 'eyebrow', name: 'Eyebrow', font: fonts.body, size: size(-1), weight: 600, lineHeight: 1.2, letterSpacing: 0.12, uppercase: true },
  ]
  return styles
}

/* ---------- Seeing it like others do ---------- */

/** Colour matrices for seeing the design as people with colour blindness do (for an SVG filter). */
export const VISION = [
  { id: 'normal', name: 'Normal vision', matrix: null },
  { id: 'protanopia', name: 'Red-blind (protanopia)', matrix: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0' },
  { id: 'deuteranopia', name: 'Green-blind (deuteranopia)', matrix: '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0' },
  { id: 'tritanopia', name: 'Blue-blind (tritanopia)', matrix: '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0' },
  { id: 'mono', name: 'No colour', matrix: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0' },
  { id: 'squint', name: 'Squint (what stands out)', matrix: null },
] as const
export type VisionId = (typeof VISION)[number]['id']
