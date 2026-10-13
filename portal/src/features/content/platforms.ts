/**
 * Where a post will be seen, and which parts the app's own buttons, captions or crops cover. Shown
 * over the artboard, snapped to, and checked: text or a logo under the buttons gets a brand check.
 * The areas are close approximations – the apps move their buttons around now and then.
 */
import type { Artboard, Layer } from '../../data/types'
import { intersects, type Box } from './geometry'

/** An area as % of the artboard. */
export type Zone = { x: number; y: number; w: number; h: number; label: string }

export type Platform = { id: string; name: string; zones: (a: { width: number; height: number }) => Zone[]; fits: (ratio: number) => boolean }

const tall = (r: number) => r < 0.7

/** The part a 3:4 profile grid shows of a post; the rest is cropped off. */
function gridCrop(a: { width: number; height: number }): Zone[] {
  const ratio = a.width / a.height
  if (Math.abs(ratio - 0.75) < 0.01) return []
  if (ratio > 0.75) {
    const side = ((1 - 0.75 / ratio) / 2) * 100
    return [{ x: 0, y: 0, w: side, h: 100, label: 'Cropped in the profile grid' }, { x: 100 - side, y: 0, w: side, h: 100, label: 'Cropped in the profile grid' }]
  }
  const band = ((1 - ratio / 0.75) / 2) * 100
  return [{ x: 0, y: 0, w: 100, h: band, label: 'Cropped in the profile grid' }, { x: 0, y: 100 - band, w: 100, h: band, label: 'Cropped in the profile grid' }]
}

export const PLATFORMS: Platform[] = [
  {
    id: 'ig-story', name: 'Instagram story', fits: tall,
    zones: () => [{ x: 0, y: 0, w: 100, h: 13, label: 'Name and close button' }, { x: 0, y: 82, w: 100, h: 18, label: 'Reply field' }],
  },
  {
    id: 'ig-reel', name: 'Instagram reel', fits: tall,
    zones: () => [
      { x: 0, y: 0, w: 100, h: 11, label: 'Top bar' },
      { x: 0, y: 76, w: 100, h: 24, label: 'Caption and name' },
      { x: 86, y: 44, w: 14, h: 32, label: 'Like, comment and share' },
    ],
  },
  {
    id: 'tiktok', name: 'TikTok', fits: tall,
    zones: () => [
      { x: 0, y: 0, w: 100, h: 8, label: 'Top bar' },
      { x: 0, y: 79, w: 100, h: 21, label: 'Caption and sound' },
      { x: 87, y: 38, w: 13, h: 41, label: 'Like, comment and share' },
    ],
  },
  { id: 'ig-grid', name: 'Instagram profile grid', fits: (r) => r >= 0.7 && r <= 1.05, zones: gridCrop },
  { id: 'youtube', name: 'YouTube thumbnail', fits: (r) => r > 1.6 && r < 1.9, zones: () => [{ x: 83, y: 85, w: 14, h: 10, label: 'Video length' }] },
]

export const platformOf = (a: Pick<Artboard, 'platform'>) => PLATFORMS.find((p) => p.id === a.platform)
/** Platforms that make sense for an artboard's shape. */
export const platformsFor = (a: { width: number; height: number }) => PLATFORMS.filter((p) => p.fits(a.width / a.height))

/** The covered areas in artboard pixels. */
export function zonesOf(a: Artboard): (Box & { label: string })[] {
  const p = platformOf(a)
  if (!p) return []
  return p.zones(a).map((z) => ({ x: (z.x / 100) * a.width, y: (z.y / 100) * a.height, w: (z.w / 100) * a.width, h: (z.h / 100) * a.height, label: z.label }))
}

/** Text and logos under the app's buttons, and where to move each so it's clear of them. */
export function hiddenByPlatform(a: Artboard, box: (l: Layer) => Box) {
  const zones = zonesOf(a)
  const out: { layerId: string; zone: string; to: { x: number; y: number } }[] = []
  for (const l of a.layers) {
    if (l.hidden || (l.type !== 'text' && l.type !== 'logo')) continue
    const b = box(l)
    const z = zones.find((z) => intersects(b, z))
    if (!z) continue
    const gap = Math.min(a.width, a.height) * 0.02
    // Out of the way the short way: below a top bar, above a bottom one, left of side buttons.
    const to =
      z.w >= a.width * 0.99
        ? z.y === 0 ? { x: l.x, y: Math.round(l.y + (z.y + z.h + gap - b.y)) } : { x: l.x, y: Math.round(l.y - (b.y + b.h - z.y + gap)) }
        : z.x + z.w >= a.width * 0.99 && z.x > 0 ? { x: Math.round(l.x - (b.x + b.w - z.x + gap)), y: l.y } : { x: Math.round(l.x + (z.x + z.w + gap - b.x)), y: l.y }
    out.push({ layerId: l.id, zone: z.label, to })
  }
  return out
}
