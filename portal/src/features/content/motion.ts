/**
 * Motion: how each layer comes in (fade, rise, slide, zoom, pop, wipe, typewriter…) and whether it
 * keeps moving. Pure: the state of a layer at a moment in time, used for the preview and for each
 * frame of the exported video.
 */
import type { AnimIn, Artboard, Layer, LayerAnim } from '../../data/types'

export const ANIMS: { id: AnimIn; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'fade', name: 'Fade' },
  { id: 'rise', name: 'Rise' },
  { id: 'drop', name: 'Drop' },
  { id: 'slide-left', name: 'Slide in from right' },
  { id: 'slide-right', name: 'Slide in from left' },
  { id: 'zoom', name: 'Zoom' },
  { id: 'pop', name: 'Pop' },
  { id: 'blur', name: 'Focus' },
  { id: 'wipe', name: 'Wipe' },
  { id: 'type', name: 'Typewriter' },
]
export const LOOPS: { id: NonNullable<LayerAnim['loop']>; name: string }[] = [
  { id: 'none', name: 'Stays still' },
  { id: 'pulse', name: 'Pulse' },
  { id: 'float', name: 'Float' },
  { id: 'spin', name: 'Spin' },
]

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
export const easeOut = (t: number) => 1 - (1 - t) ** 3
/** Overshoots a little and settles – for “pop”. */
export const easeBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2

export type Frame = { opacity: number; tx: number; ty: number; scale: number; rotate: number; blur: number; reveal: number; chars: number }
export const STILL: Frame = { opacity: 1, tx: 0, ty: 0, scale: 1, rotate: 0, blur: 0, reveal: 1, chars: 1 }

/**
 * A layer at time `t` (seconds). `dist` is how far things travel – a share of the artboard, so a
 * slide looks the same on a story and a poster.
 */
export function frameAt(anim: LayerAnim | undefined, t: number, dist: number): Frame {
  if (!anim || (anim.in === 'none' && (!anim.loop || anim.loop === 'none'))) return STILL
  const raw = clamp01((t - anim.delay) / Math.max(0.05, anim.duration))
  const p = easeOut(raw)
  const f: Frame = { ...STILL }
  switch (anim.in) {
    case 'fade': f.opacity = p; break
    case 'rise': f.opacity = p; f.ty = (1 - p) * dist; break
    case 'drop': f.opacity = p; f.ty = -(1 - p) * dist; break
    case 'slide-left': f.opacity = p; f.tx = (1 - p) * dist * 1.5; break
    case 'slide-right': f.opacity = p; f.tx = -(1 - p) * dist * 1.5; break
    case 'zoom': f.opacity = p; f.scale = 0.8 + 0.2 * p; break
    case 'pop': f.opacity = clamp01(raw * 3); f.scale = raw >= 1 ? 1 : 0.4 + 0.6 * easeBack(raw); break
    case 'blur': f.opacity = p; f.blur = (1 - p) * 24; break
    case 'wipe': f.reveal = p; break
    case 'type': f.chars = raw; break
  }
  // After it has come in, it can keep moving.
  const after = t - (anim.in === 'none' ? 0 : anim.delay + anim.duration)
  if (after > 0 && anim.loop && anim.loop !== 'none') {
    if (anim.loop === 'pulse') f.scale *= 1 + 0.045 * Math.sin((after / 1.6) * Math.PI * 2)
    if (anim.loop === 'float') f.ty += Math.sin((after / 3) * Math.PI * 2) * dist * 0.18
    if (anim.loop === 'spin') f.rotate += (after * 360) / 8
  }
  return f
}

/** How far things travel on this artboard. */
export const travel = (a: Pick<Artboard, 'width' | 'height'>) => Math.min(a.width, a.height) * 0.08

/** How long the animation runs: as set, or until the last layer has come in plus a moment to read. */
export function durationOf(a: Artboard) {
  if (a.motion?.duration) return a.motion.duration
  const ends = a.layers.map((l) => (l.anim && l.anim.in !== 'none' ? l.anim.delay + l.anim.duration : 0))
  return Math.max(3, Math.round((Math.max(0, ...ends) + 2) * 2) / 2)
}

export const isAnimated = (a: Artboard) => a.layers.some((l) => l.anim && (l.anim.in !== 'none' || (l.anim.loop && l.anim.loop !== 'none')))

/**
 * A good first animation for a whole artboard: backgrounds stay, photos zoom in, words rise one
 * after the other from the top, small shapes pop, and the logo fades in last.
 */
export function autoAnimate(a: Artboard): Artboard {
  const big = (l: Layer) => l.w * l.h >= a.width * a.height * 0.5
  const order = [...a.layers].filter((l) => !l.hidden).sort((x, y) => x.y - y.y)
  let delay = 0.2
  const anims = new Map<string, LayerAnim>()
  for (const l of a.layers.filter((x) => x.type === 'image' && !x.locked && !x.hidden)) anims.set(l.id, { in: 'zoom', delay: 0, duration: 1.2 })
  for (const l of order) {
    if (anims.has(l.id) || l.locked || l.type === 'logo' || (l.type === 'shape' && big(l))) continue
    if (l.type === 'text') anims.set(l.id, { in: 'rise', delay, duration: 0.7 })
    else if (l.type === 'icon' || l.type === 'shape') anims.set(l.id, { in: 'pop', delay, duration: 0.6 })
    else continue
    delay = Math.round((delay + 0.3) * 10) / 10
  }
  for (const l of a.layers.filter((x) => x.type === 'logo')) anims.set(l.id, { in: 'fade', delay: delay + 0.2, duration: 0.8 })
  return { ...a, motion: undefined, layers: a.layers.map((l) => (anims.has(l.id) ? { ...l, anim: anims.get(l.id) } : l.anim ? { ...l, anim: undefined } : l)) }
}
