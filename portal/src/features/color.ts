/** Colour maths for the brand hub: formats, tints and WCAG contrast. */

export type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.padEnd(6, '0').slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = ([r, g, b]: RGB) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)]
}

/** Naive CMYK conversion. Good as a starting point; printers should use a colour-managed profile. */
export function rgbToCmyk([r, g, b]: RGB): [number, number, number, number] {
  const k = 1 - Math.max(r, g, b) / 255
  if (k >= 1) return [0, 0, 0, 100]
  const c = (1 - r / 255 - k) / (1 - k)
  const m = (1 - g / 255 - k) / (1 - k)
  const y = (1 - b / 255 - k) / (1 - k)
  return [c, m, y, k].map((v) => Math.round(v * 100)) as [number, number, number, number]
}

export function formats(hex: string) {
  const rgb = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(rgb)
  const [c, m, y, k] = rgbToCmyk(rgb)
  return [
    { label: 'HEX', value: rgbToHex(rgb) },
    { label: 'RGB', value: rgb.join(' ') },
    { label: 'HSL', value: `${h}° ${s}% ${l}%` },
    { label: 'CMYK', value: `${c} ${m} ${y} ${k}` },
  ]
}

/** Mix a colour towards another (amount 0–1 of `with`). */
export const mix = (hex: string, withHex: string, amount: number) => {
  const a = hexToRgb(hex)
  const b = hexToRgb(withHex)
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * amount) as RGB)
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** WCAG 2 rating for text of `fg` on `bg`. */
export function rating(ratio: number): { label: string; ok: 'text' | 'large' | 'no' } {
  if (ratio >= 7) return { label: 'AAA', ok: 'text' }
  if (ratio >= 4.5) return { label: 'AA', ok: 'text' }
  if (ratio >= 3) return { label: 'AA Large', ok: 'large' }
  return { label: 'Avoid', ok: 'no' }
}

/** Black or white, whichever reads better on `bg`. */
export const readableOn = (bg: string) => (contrast(bg, '#000000') > contrast(bg, '#ffffff') ? '#111111' : '#ffffff')

export const isLight = (hex: string) => luminance(hex) > 0.4

/* ---------- Making a colour pass ---------- */

export function hslToRgb(h: number, s: number, l: number): RGB {
  const S = s / 100
  const L = l / 100
  const c = (1 - Math.abs(2 * L - 1)) * S
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = L - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

/**
 * The nearest shade of `hex` that reads on `bg`: same hue and saturation, lightness moved as
 * little as possible. Returns null when even black or white wouldn't pass.
 */
export function accessibleShade(hex: string, bg: string, target = 4.5): { hex: string; ratio: number; steps: number } | null {
  if (contrast(hex, bg) >= target) return { hex: rgbToHex(hexToRgb(hex)), ratio: contrast(hex, bg), steps: 0 }
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  // Try both directions, nearest first, so a colour only moves as far as it has to.
  for (let step = 1; step <= 100; step++) {
    for (const dir of [-1, 1]) {
      const next = l + dir * step
      if (next < 0 || next > 100) continue
      const candidate = rgbToHex(hslToRgb(h, s, next))
      const ratio = contrast(candidate, bg)
      if (ratio >= target) return { hex: candidate, ratio, steps: dir * step }
    }
  }
  return null
}

/* ---------- Colour blindness ---------- */

export const VISION_TYPES = ['normal', 'protanopia', 'deuteranopia', 'tritanopia', 'grayscale'] as const
export type Vision = (typeof VISION_TYPES)[number]

/** How the kinds of colour vision are named on screen. */
export const VISION_LABELS: Record<Vision, string> = {
  normal: 'Normal vision',
  protanopia: 'Protanopia (red-blind)',
  deuteranopia: 'Deuteranopia (green-blind)',
  tritanopia: 'Tritanopia (blue-blind)',
  grayscale: 'Greyscale',
}

/** Brettel/Viénot-style matrices – close enough to judge whether a palette still reads. */
const MATRIX: Record<Exclude<Vision, 'normal' | 'grayscale'>, number[]> = {
  protanopia: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritanopia: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
}

/** How a colour looks to someone with that kind of colour vision. */
export function simulate(hex: string, vision: Vision): string {
  if (vision === 'normal') return rgbToHex(hexToRgb(hex))
  const [r, g, b] = hexToRgb(hex)
  if (vision === 'grayscale') {
    const v = 0.299 * r + 0.587 * g + 0.114 * b
    return rgbToHex([v, v, v])
  }
  const m = MATRIX[vision]
  return rgbToHex([m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b])
}

/** Two colours a viewer can no longer tell apart (under 12 points of distance). */
export function clashes(a: string, b: string, vision: Vision) {
  const [r1, g1, b1] = hexToRgb(simulate(a, vision))
  const [r2, g2, b2] = hexToRgb(simulate(b, vision))
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) < 12
}

/* ---------- Dark mode ---------- */

/**
 * The same brand colour, adjusted to sit on a dark surface: hue kept, lightness lifted until it
 * reads, saturation eased back so it doesn't glow.
 */
export function darkVariant(hex: string, surface = '#111110', target = 4.5): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  const eased = rgbToHex(hslToRgb(h, Math.max(0, s - 8), l))
  return accessibleShade(eased, surface, target)?.hex ?? readableOn(surface)
}

/* ---------- Print ---------- */

/** CMYK back to RGB, to show what the colour does on paper. */
export function cmykToRgb([c, m, y, k]: [number, number, number, number]): RGB {
  const f = (v: number) => 255 * (1 - v / 100) * (1 - k / 100)
  return [f(c), f(m), f(y)]
}

/**
 * How far a colour shifts when it becomes CMYK. Bright, saturated screen colours are the ones
 * that disappoint in print, and this says so before the invoice from the printer does.
 */
export function printShift(hex: string) {
  const rgb = hexToRgb(hex)
  const printed = rgbToHex(cmykToRgb(rgbToCmyk(rgb)))
  const [pr, pg, pb] = hexToRgb(printed)
  const distance = Math.sqrt((rgb[0] - pr) ** 2 + (rgb[1] - pg) ** 2 + (rgb[2] - pb) ** 2)
  const [, s, l] = rgbToHsl(rgb)
  // Neon-ish colours (very saturated and bright) are outside what four-colour print can hit.
  const outOfGamut = s > 85 && l > 45 && l < 75
  return { printed, distance: Math.round(distance), outOfGamut, warn: outOfGamut || distance > 40 }
}
