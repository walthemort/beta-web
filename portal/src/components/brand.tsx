/**
 * Aftryk's logo: "af" in a hairline and "tryk" set bold, as one word – the light half first, so
 * the word presses down as it is read, and the weight lands on the half that carries the meaning.
 * Outlines from Inter Tight (src/components/wordmark.ts, made by scripts/wordmark.mts), so it is
 * the same everywhere, font or no font.
 *
 * The mark is the same idea in two letters – a hairline a, a bold t – for the app icon and the
 * favicon. They read "at", Danish for "to", as in "at trykke": to press.
 * Colours and rules: docs/BRAND.md.
 */
import type { CSSProperties } from 'react'
import { MONOGRAM, WORDMARK } from './wordmark'

/**
 * The product's name, in one place. Everything else refers to this: titles, file names, and the
 * copy the studio reads – sentences carry it as the {app} placeholder, filled in when they are
 * translated, so no translation key depends on what the product is called.
 *
 * Renaming is therefore this line, scripts/wordmark.mts for the two-weight logo, and the domain.
 */
export const APP_NAME = 'Aftryk'

/** The palette – Danish names, used in docs/BRAND.md and the app's colour tokens. */
export const BRAND = {
  ink: '#16181B', // Blæk
  paper: '#F4F1EA', // Papir
  cobalt: '#2340D1', // Kobolt – the blue of Danish porcelain
  cobaltSoft: '#E6EAFB',
  rosehip: '#E0623C', // Hyben
  stone: '#8A8880', // Sten
} as const

/** A little room around the letters, so nothing touches the edge. */
const PAD = 2
const [x, y, w, h] = WORDMARK.viewBox
const VIEW = `${x - PAD} ${y - PAD} ${w + PAD * 2} ${h + PAD * 2}`

/** The wordmark, in the colour of the text around it (or `color`). `height` is the whole logo's height in px. */
export function Wordmark({ height = 24, color, title = APP_NAME, style }: { height?: number; color?: string; title?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={VIEW} height={height} role="img" aria-label={title} style={{ display: 'block', color, ...style }}>
      <title>{title}</title>
      <path d={WORDMARK.light} fill="currentColor" />
      <path d={WORDMARK.bold} fill="currentColor" />
    </svg>
  )
}

/** The mark: a hairline a and a bold t. `tile` puts it on a rounded square (the app icon). */
export function Mark({ size = 24, color = BRAND.ink, tile, title = APP_NAME }: { size?: number; color?: string; tile?: string; title?: string }) {
  const [fx, fy, fw, fh] = MONOGRAM.viewBox
  // The letters fill a little over half the tile, in the middle.
  const s = (tile ? 64 : 104) / fh
  const tx = 60 - (fx + fw / 2) * s
  const ty = 60 - (fy + fh / 2) * s
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={title} style={{ display: 'block' }}>
      <title>{title}</title>
      {tile && <rect width="120" height="120" rx="28" fill={tile} />}
      <g fill={color} transform={`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`}>
        <path d={MONOGRAM.light} />
        <path d={MONOGRAM.bold} />
      </g>
    </svg>
  )
}
