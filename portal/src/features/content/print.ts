/**
 * Print: a design made print-ready – a paper size with bleed (the colour runs past where the paper
 * is cut) and a safe area (where nothing important goes), checked before it goes to the printer.
 * Sizes are in millimetres; artboards are in pixels at the format's resolution.
 */
import type { Artboard, Layer, PrintSpec } from '../../data/types'
import { resizeArtboard, uid, type Brand, type Issue } from './model'

export const PRINT_FORMATS: { id: string; name: string; w: number; h: number; dpi: number }[] = [
  { id: 'business-card', name: 'Business card', w: 85, h: 55, dpi: 300 },
  { id: 'postcard', name: 'Postcard (A6)', w: 148, h: 105, dpi: 300 },
  { id: 'flyer-a5', name: 'Flyer (A5)', w: 148, h: 210, dpi: 300 },
  { id: 'flyer-a4', name: 'Flyer (A4)', w: 210, h: 297, dpi: 300 },
  { id: 'invitation', name: 'Invitation (5 × 7 in)', w: 127, h: 178, dpi: 300 },
  { id: 'poster-a3', name: 'Poster (A3)', w: 297, h: 420, dpi: 300 },
  { id: 'poster-a2', name: 'Poster (A2)', w: 420, h: 594, dpi: 200 },
  { id: 'poster-a1', name: 'Poster (A1)', w: 594, h: 841, dpi: 150 },
  { id: 'rollup', name: 'Roll-up banner (85 × 200 cm)', w: 850, h: 2000, dpi: 100 },
  { id: 'sticker', name: 'Sticker (5 × 5 cm)', w: 50, h: 50, dpi: 300 },
  { id: 'mug-wrap', name: 'Mug wrap (11 oz)', w: 216, h: 89, dpi: 300 },
  { id: 'box-front', name: 'Box front (16 × 22 cm)', w: 160, h: 220, dpi: 300 },
  { id: 'box-side', name: 'Box side (7 × 22 cm)', w: 70, h: 220, dpi: 300 },
  { id: 'box-top', name: 'Box lid (16 × 7 cm)', w: 160, h: 70, dpi: 300 },
  { id: 'letter-a4', name: 'Letterhead (A4)', w: 210, h: 297, dpi: 300 },
  { id: 'envelope-dl', name: 'Envelope (DL)', w: 220, h: 110, dpi: 300 },
  { id: 'notebook-a5', name: 'Notebook cover (A5)', w: 148, h: 210, dpi: 300 },
  { id: 'bag-front', name: 'Shopping bag (24 × 30 cm)', w: 240, h: 300, dpi: 300 },
  { id: 'can-wrap', name: 'Can label (330 ml)', w: 205, h: 95, dpi: 300 },
]

export const BLEED_MM = 3
export const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi)
export const pxToMm = (px: number, dpi: number) => (px / dpi) * 25.4
export const pxToPt = (px: number, dpi: number) => (px / dpi) * 72

/** The safe area: at least 3 mm, more on big formats. */
export const safeFor = (w: number, h: number) => Math.max(3, Math.round(Math.min(w, h) * 0.04))

/** Where the paper is cut and where the safe area starts, in artboard pixels. */
export function printBoxes(a: Artboard) {
  const p = a.print!
  const dpi = a.dpi ?? 300
  const bleed = mmToPx(p.bleed, dpi)
  const safe = mmToPx(p.bleed + p.safe, dpi)
  return {
    bleed,
    trim: { x: bleed, y: bleed, w: a.width - bleed * 2, h: a.height - bleed * 2 },
    safe: { x: safe, y: safe, w: a.width - safe * 2, h: a.height - safe * 2 },
  }
}

/**
 * A print version of an artboard: the paper size plus bleed, at print resolution. Backgrounds
 * that fill the artboard grow into the bleed; everything else scales to fit inside the paper.
 */
export function printArtboard(a: Artboard, formatId: string, landscape?: boolean): Artboard {
  const f = PRINT_FORMATS.find((x) => x.id === formatId) ?? PRINT_FORMATS[0]
  const [w, h] = landscape === undefined ? [f.w, f.h] : landscape ? [Math.max(f.w, f.h), Math.min(f.w, f.h)] : [Math.min(f.w, f.h), Math.max(f.w, f.h)]
  const spec: PrintSpec = { format: f.id, trimW: w, trimH: h, bleed: BLEED_MM, safe: safeFor(w, h) }
  const size = { name: f.name, width: mmToPx(w + BLEED_MM * 2, f.dpi), height: mmToPx(h + BLEED_MM * 2, f.dpi), dpi: f.dpi }
  return { ...resizeArtboard(a, size), print: spec, platform: undefined }
}

/** The back of a business card or postcard: the brand colour with the logo in the middle. */
export function printBack(front: Artboard, brand: Brand): Artboard {
  const w = front.width * 0.36
  const h = w * 0.4
  const logo: Layer = { id: uid(), type: 'logo', name: 'Logo', fileId: 'auto', x: Math.round((front.width - w) / 2), y: Math.round((front.height - h) / 2), w: Math.round(w), h: Math.round(h) }
  return { ...front, id: uid(), name: `${front.name} – back`, background: brand.primary, backgroundGradient: undefined, layers: [logo], guides: [], groups: [] }
}

/* ---------- Colour for print ---------- */

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

/** A rough CMYK version of a screen colour – a starting point; use the brand's own values if it has them. */
export function toCmyk(hex: string) {
  const [r, g, b] = channels(hex)
  const k = 1 - Math.max(r, g, b)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  const f = (x: number) => Math.round(((1 - x - k) / (1 - k)) * 100)
  return { c: f(r), m: f(g), y: f(b), k: Math.round(k * 100) }
}

/** Very bright screen colours (vivid blues, greens, purples) that print a little duller. */
export function printsDuller(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false
  const [r, g, b] = channels(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const sat = max ? (max - min) / max : 0
  if (sat < 0.75 || max < 0.6) return false
  let hue = 0
  if (max === r) hue = ((g - b) / (max - min)) * 60
  else if (max === g) hue = (2 + (b - r) / (max - min)) * 60
  else hue = (4 + (r - g) / (max - min)) * 60
  if (hue < 0) hue += 360
  return (hue >= 90 && hue <= 170) || (hue >= 190 && hue <= 300)
}

/* ---------- Preflight: what a printer would send back ---------- */

export type PreflightInfo = {
  heightOf: (l: Layer) => number
  /** The pixel size of each image, when known. */
  natural: Record<string, { w: number; h: number }>
}

export function preflight(a: Artboard, info: PreflightInfo): Issue[] {
  if (!a.print) return []
  const dpi = a.dpi ?? 300
  const { trim, safe } = printBoxes(a)
  const near = mmToPx(1, dpi)
  const issues: Issue[] = []
  const seen = new Set<string>()

  for (const l of a.layers) {
    if (l.hidden) continue
    const h = info.heightOf(l)
    const box = { x: l.x, y: l.y, w: l.w, h }

    // Backgrounds and photos that reach the cut but not the bleed show a white hairline.
    if ((l.type === 'image' || l.type === 'shape') && !l.rotation) {
      const touches = (edge: number, cut: number) => Math.abs(edge - cut) <= near
      const shortOf = {
        left: touches(box.x, trim.x) && box.x > 0.5,
        top: touches(box.y, trim.y) && box.y > 0.5,
        right: touches(box.x + box.w, trim.x + trim.w) && box.x + box.w < a.width - 0.5,
        bottom: touches(box.y + box.h, trim.y + trim.h) && box.y + box.h < a.height - 0.5,
      }
      if (Object.values(shortOf).some(Boolean)) {
        const x = shortOf.left ? 0 : box.x
        const y = shortOf.top ? 0 : box.y
        const w = (shortOf.right ? a.width : box.x + box.w) - x
        const hh = (shortOf.bottom ? a.height : box.y + box.h) - y
        issues.push({ layerId: l.id, kind: 'print', message: 'Stops at the cut, not in the bleed – a white edge may show', fix: { label: 'Extend into the bleed', patch: { x, y, w, h: hh } } })
      }
    }

    // Words and logos inside the safe area, so the cut can't touch them.
    if (l.type === 'text' || l.type === 'logo' || l.type === 'icon') {
      const out = box.x < safe.x || box.y < safe.y || box.x + box.w > safe.x + safe.w || box.y + box.h > safe.y + safe.h
      if (out) {
        const x = Math.min(Math.max(box.x, safe.x), safe.x + safe.w - box.w)
        const y = Math.min(Math.max(box.y, safe.y), safe.y + safe.h - box.h)
        issues.push({
          layerId: l.id, kind: 'print', message: 'Too close to the cut – keep it {mm} mm inside the edge', vars: { mm: a.print.safe },
          fix: { label: 'Move it in', patch: { x: Math.round(x), y: Math.round(y) } },
        })
      }
    }

    // Photos need about 300 pixels per printed inch to look sharp.
    if (l.type === 'image' && !l.generated && info.natural[l.id]) {
      const n = info.natural[l.id]
      const scale = l.fit === 'contain' ? Math.min(l.w / n.w, l.h / n.h) : Math.max(l.w / n.w, l.h / n.h)
      const effective = Math.round(dpi / scale)
      if (effective < 150) issues.push({ layerId: l.id, kind: 'print', message: 'Low resolution: {dpi} dpi – it will look blurry in print (aim for 300)', vars: { dpi: effective } })
      else if (effective < 240) issues.push({ layerId: l.id, kind: 'print', message: 'A little soft: {dpi} dpi – fine for posters seen from a distance, aim for 300', vars: { dpi: effective } })
    }

    if (l.type === 'text' && pxToPt(l.size, dpi) < 6) issues.push({ layerId: l.id, kind: 'print', message: 'Under 6 pt – too small to read in print', fix: { label: 'Make it 7 pt', patch: { size: Math.round((7 / 72) * dpi) } } })
    if (l.type === 'shape' && l.stroke && pxToPt(l.stroke.width, dpi) < 0.25) issues.push({ layerId: l.id, kind: 'print', message: 'Line thinner than 0.25 pt – it may not print', fix: { label: 'Make it 0.5 pt', patch: { stroke: { ...l.stroke, width: Math.max(1, Math.round((0.5 / 72) * dpi)) } } } })

    // Colours that look vivid on screen but print duller – worth knowing, not an error.
    const colours = l.type === 'text' ? [l.colour] : l.type === 'shape' ? [l.fill] : l.type === 'icon' ? [l.colour] : []
    for (const c of colours)
      if (printsDuller(c) && !seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase())
        issues.push({ layerId: l.id, kind: 'print', message: '{colour} is very bright on screen and prints a little duller', vars: { colour: c } })
      }
  }
  if (printsDuller(a.background) && !seen.has(a.background.toLowerCase()) && a.layers[0]?.id)
    issues.push({ layerId: a.layers[0].id, kind: 'print', message: '{colour} is very bright on screen and prints a little duller', vars: { colour: a.background } })
  return issues
}
