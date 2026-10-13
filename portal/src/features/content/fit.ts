/**
 * “Fit box to content”: a layer's box shrunk to what it actually draws – the logo mark, the
 * words, the whole photo – so lining things up lines up what you see, not empty space.
 */
import type { Layer } from '../../data/types'
import type { Box } from './geometry'

/** The drawn part of a picture inside its box, when it's fitted in (not filling). */
export function containRect(boxW: number, boxH: number, ratio: number): Box {
  if (!(ratio > 0)) return { x: 0, y: 0, w: boxW, h: boxH }
  if (boxW / boxH > ratio) {
    const w = boxH * ratio
    return { x: (boxW - w) / 2, y: 0, w, h: boxH }
  }
  const h = boxW / ratio
  return { x: 0, y: (boxH - h) / 2, w: boxW, h }
}

/** Where the words sit in a text box: the box around every line, measured on a copy off screen. */
function textRect(content: HTMLElement, width: number): Box | null {
  const holder = document.createElement('div')
  holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;visibility:hidden;pointer-events:none`
  const copy = content.cloneNode(true) as HTMLElement
  holder.appendChild(copy)
  document.body.appendChild(holder)
  try {
    const origin = holder.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(copy)
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5)
    if (!rects.length) return null
    const left = Math.min(...rects.map((r) => r.left)) - origin.left
    const right = Math.max(...rects.map((r) => r.right)) - origin.left
    const top = Math.min(...rects.map((r) => r.top)) - origin.top
    const bottom = Math.max(...rects.map((r) => r.bottom)) - origin.top
    // A highlight box reaches past the letters by its padding.
    const pad = parseFloat(getComputedStyle(copy).paddingLeft) || 0
    return { x: left - pad, y: top, w: right - left + pad * 2, h: bottom - top }
  } finally {
    holder.remove()
  }
}

/** What a layer draws, in its own (unrotated) pixels – or null when it already fills its box. */
export function measureContent(el: HTMLElement, l: Layer): Box | null {
  if (l.type === 'text') {
    const content = el.firstElementChild as HTMLElement | null
    return content ? textRect(content, l.w) : null
  }
  if (l.type === 'logo' || l.type === 'image') {
    const img = el.querySelector<HTMLImageElement>('img:not(.cm-ghost)')
    if (img?.naturalWidth) return containRect(l.w, l.h, img.naturalWidth / img.naturalHeight)
    // The wordmark, when the brand hub has no logo file: the width of its letters.
    const word = el.firstElementChild as HTMLElement | null
    if (l.type === 'logo' && word) {
      const r = textRect(word, l.w)
      return r && { x: r.x, y: 0, w: r.w, h: l.h }
    }
  }
  return null
}

/**
 * The new box, keeping the drawn part exactly where it is on the artboard – also for rotated and
 * flipped layers. Text keeps its top (its height follows its words).
 */
export function fitPatch(l: Layer, h: number, r: Box): Partial<Layer> | null {
  const w = Math.max(4, Math.ceil(r.w + 1))
  const nh = l.type === 'text' ? h : Math.max(4, Math.round(r.h))
  if (Math.abs(w - l.w) <= 1 && Math.abs(nh - (l.type === 'text' ? h : l.h)) <= 1) return null
  // How far the drawn part's middle is from the box's middle, turned the way the layer is.
  const vx = (r.x + r.w / 2 - l.w / 2) * (l.flipX ? -1 : 1)
  const vy = (l.type === 'text' ? 0 : r.y + r.h / 2 - h / 2) * (l.flipY ? -1 : 1)
  const a = ((l.rotation ?? 0) * Math.PI) / 180
  const cx = l.x + l.w / 2 + vx * Math.cos(a) - vy * Math.sin(a)
  const cy = l.y + h / 2 + vx * Math.sin(a) + vy * Math.cos(a)
  const patch: Partial<Layer> = { x: Math.round(cx - w / 2), y: Math.round(cy - nh / 2), w }
  if (l.type !== 'text') patch.h = nh
  // A photo fitted to its whole picture shows all of it.
  if (l.type === 'image') Object.assign(patch, { fit: 'cover', focus: undefined })
  return patch
}
