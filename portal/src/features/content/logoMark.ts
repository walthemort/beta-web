/**
 * Logos in the Content Machine are marks, not pictures: the box an SVG was drawn on is removed,
 * empty space around the mark is trimmed off (so lining a logo up lines up the logo, not its
 * padding), and the mark takes one colour – so it sits on any background in the brand's colours.
 */
import { useEffect, useState } from 'react'
import { resolveSrc } from '../../data/blobs'

/** Numbers in an SVG attribute (“100%”, “800”, “800px”) against a size. */
const size = (v: string | null, full: number) => (!v ? 0 : v.trim().endsWith('%') ? (parseFloat(v) / 100) * full : parseFloat(v))

/**
 * Removes the background from an SVG: any rect (or the first path) that covers nearly the whole
 * canvas – how most logo files carry their background colour.
 */
export function stripBackground(svg: SVGSVGElement) {
  const vb = svg.viewBox?.baseVal
  const w = vb && vb.width ? vb.width : size(svg.getAttribute('width'), 0)
  const h = vb && vb.height ? vb.height : size(svg.getAttribute('height'), 0)
  if (!w || !h) return
  for (const rect of [...svg.querySelectorAll('rect')]) {
    const rw = size(rect.getAttribute('width'), w)
    const rh = size(rect.getAttribute('height'), h)
    const x = size(rect.getAttribute('x'), w)
    const y = size(rect.getAttribute('y'), h)
    if (x <= w * 0.02 && y <= h * 0.02 && rw >= w * 0.96 && rh >= h * 0.96) rect.remove()
  }
  svg.style.removeProperty('background')
  svg.style.removeProperty('background-color')
}

const PAINTED = 'path, rect, circle, ellipse, polygon, polyline, line, text, tspan, use, g'

/** Paints every visible part of the mark in one colour (outlines stay outlines). */
export function recolour(svg: SVGSVGElement, colour: string) {
  svg.setAttribute('fill', colour)
  for (const el of svg.querySelectorAll<SVGElement>(PAINTED)) {
    for (const prop of ['fill', 'stroke'] as const) {
      const attr = el.getAttribute(prop)
      if (attr && attr !== 'none' && attr !== 'transparent') el.setAttribute(prop, colour)
      const style = el.style.getPropertyValue(prop)
      if (style && style !== 'none' && style !== 'transparent') el.style.setProperty(prop, colour)
    }
  }
  for (const stop of svg.querySelectorAll<SVGElement>('stop')) stop.setAttribute('stop-color', colour)
  // Classes in an embedded stylesheet win over attributes, so they get the colour too.
  for (const style of svg.querySelectorAll('style')) style.textContent = (style.textContent ?? '').replace(/(fill|stroke)\s*:\s*(?!none)[^;}]+/g, `$1:${colour}`)
}

/**
 * Crops an SVG to what's drawn: its box becomes the box around the painted parts (measured on the
 * page, with a little room for outlines).
 */
export function trimSvg(svg: SVGSVGElement) {
  if (typeof document === 'undefined') return
  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:1000px;height:1000px;visibility:hidden;pointer-events:none'
  const live = document.importNode(svg, true)
  holder.appendChild(live)
  document.body.appendChild(holder)
  try {
    const b = live.getBBox()
    if (!(b.width > 0 && b.height > 0)) return
    const pad = Math.max(b.width, b.height) * 0.02
    const box = [b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2].map((n) => Math.round(n * 1000) / 1000)
    svg.setAttribute('viewBox', box.join(' '))
    svg.setAttribute('width', String(box[2]))
    svg.setAttribute('height', String(box[3]))
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  } catch {
    // Some SVGs can't be measured (nothing drawn yet); they keep their own box.
  } finally {
    holder.remove()
  }
}

/** The SVG as a mark: background removed, trimmed, and one colour unless `colour` is undefined (original colours). */
export function svgMark(text: string, colour?: string): string | null {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement as unknown as SVGSVGElement
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null
  stripBackground(svg)
  if (colour) recolour(svg, colour)
  trimSvg(svg)
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => resolve(null)
    i.src = url
  })

/** A transparent image cropped to what's drawn in it. Images without transparency stay as they are. */
async function trimImage(url: string): Promise<string> {
  const img = await loadImage(url)
  if (!img?.naturalWidth) return url
  const [w, h] = [img.naturalWidth, img.naturalHeight]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d', { willReadFrequently: true })
  if (!g) return url
  g.drawImage(img, 0, 0)
  const data = g.getImageData(0, 0, w, h).data
  if (data[3] > 10) return url
  let [minX, minY, maxX, maxY] = [w, h, -1, -1]
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1)) return url
  const out = document.createElement('canvas')
  out.width = maxX - minX + 1
  out.height = maxY - minY + 1
  out.getContext('2d')!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

/** A transparent PNG/WebP logo in one colour: its shape as a mask, filled with the colour. */
async function tintImage(url: string, colour: string): Promise<string | null> {
  const img = await loadImage(url)
  if (!img || !img.naturalWidth) return null
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const g = canvas.getContext('2d')
  if (!g) return null
  g.drawImage(img, 0, 0)
  // Only logos with transparency can be recoloured this way; a flat JPG stays as it is.
  const corner = g.getImageData(0, 0, 1, 1).data[3]
  if (corner > 10) return null
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = colour
  g.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

const cache = new Map<string, Promise<string | null>>()

/** The logo file ready to place: an SVG without its background (in `colour`), or a tinted PNG. */
export function useLogoMark(src: string | undefined, mime: string | undefined, colour?: string) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (!src) return setUrl(null)
    const key = `${src}|${colour ?? 'original'}`
    if (!cache.has(key)) {
      cache.set(
        key,
        resolveSrc(src).then(async (resolved) => {
          if (!resolved) return null
          if (/svg/i.test(mime ?? '')) return svgMark(await fetch(resolved).then((r) => r.text()), colour) ?? resolved
          return trimImage(colour ? (await tintImage(resolved, colour)) ?? resolved : resolved)
        }),
      )
    }
    cache.get(key)!.then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [src, mime, colour])
  return url
}
