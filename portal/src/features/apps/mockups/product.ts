/**
 * From a mockup to the real thing: a Content Machine design at the size of what the mockup shows –
 * a business card with bleed, an A3 poster, a phone screen, a mug wrap – with the mockup's picture
 * carried over (the design laid out again for the new size, the logo, or the image).
 */
import type { Artboard, Design, Layer, Project } from '../../../data/types'
import { brandOf, newArtboard, resizeArtboard, uid } from '../../content/model'
import { PRINT_FORMATS, printArtboard, printBack, printBoxes } from '../../content/print'
import type { Face, FaceId, Product } from './studio3d'

/** An empty artboard at the product's size – with bleed and the print spec for printed things. */
function blank(product: Product, project: Project, landscape?: boolean): Artboard {
  const brand = brandOf(project)
  const base = newArtboard({ name: product.name, width: 1000, height: 1000 }, brand)
  const a = product.print
    ? printArtboard(base, product.print, landscape ?? product.landscape)
    : resizeArtboard(base, { name: product.name, width: product.width ?? 1080, height: product.height ?? 1080 })
  return { ...a, id: uid(), name: product.name, background: brand.primary, layers: [] }
}

/** Does this artboard already have the product's size? Then there's nothing to make. */
export function fitsProduct(a: Artboard, product: Product) {
  if (product.print) return a.print?.format === product.print
  return a.width === product.width && a.height === product.height
}

/** Placeholder words for cards, letters and envelopes – English, translated by the caller. */
export const PLACEHOLDERS = { name: 'Your Name', title: 'Title', phone: '+45 12 34 56 78', email: 'name@company.com', web: 'company.com', address: 'Street 1 · 1000 City' }
type Words = typeof PLACEHOLDERS

export type ProductSource = { kind: 'design'; artboard: Artboard } | { kind: 'image'; src: string; ratio: number } | { kind: 'logo' }

export function productArtboard(product: Product, project: Project, source: ProductSource, words: Words = PLACEHOLDERS): Artboard {
  // A poster follows the picture: landscape pictures make a landscape poster.
  const wide = source.kind === 'design' ? source.artboard.width > source.artboard.height : source.kind === 'image' ? source.ratio > 1 : undefined
  const landscape = product.print && !product.landscape && product.print !== 'box-front' ? wide : undefined
  const a = blank(product, project, landscape)
  const area = a.print ? printBoxes(a).safe : { x: a.width * 0.08, y: a.height * 0.08, w: a.width * 0.84, h: a.height * 0.84 }

  if (source.kind === 'design') {
    // The design itself, laid out again for the new size (its layers keep their pins).
    const resized = product.print
      ? printArtboard(source.artboard, product.print, landscape ?? product.landscape)
      : resizeArtboard(source.artboard, { name: product.name, width: a.width, height: a.height })
    const layers = resized.layers.map((l) => ({ ...l, id: uid() }) as Layer)
    return { ...a, background: resized.background, backgroundGradient: resized.backgroundGradient, layers }
  }
  if (source.kind === 'image') {
    return { ...a, layers: [{ id: uid(), type: 'image', name: 'Image', src: source.src, fit: 'cover', x: 0, y: 0, w: a.width, h: a.height }] }
  }
  if (product.print === 'letter-a4') return letterhead(a, project, words)
  // The logo, centred – as big as looks right on the thing.
  const share = product.print === 'mug-wrap' ? 0.3 : a.width > a.height * 1.8 ? 0.4 : 0.55
  const w = Math.min(area.w, a.width * share)
  const h = Math.min(area.h * 0.5, w * 0.4)
  const y = a.height / 2 - h / 2
  return { ...a, layers: [{ id: uid(), type: 'logo', name: 'Logo', fileId: 'auto', centred: true, x: a.width / 2 - w / 2, y, w, h }] }
}

/** A text line on an artboard, in the brand's type. */
function line(project: Project, id: string, text: string, x: number, y: number, w: number, size: number, opts: { heading?: boolean; weight?: number; colour?: string; align?: 'left' | 'center' | 'right' } = {}): Layer {
  const brand = brandOf(project)
  return {
    id: uid(), type: 'text', name: id, text, x, y, w, h: Math.round(size * 1.3), font: opts.heading ? brand.heading : brand.body, size: Math.round(size), weight: opts.weight ?? 400,
    colour: opts.colour ?? brand.dark, align: opts.align ?? 'left', lineHeight: 1.25, letterSpacing: 0, clientEditable: true,
  }
}

/** Letter paper: the logo top left, a line in the brand colour, the contact details at the foot. */
function letterhead(a: Artboard, project: Project, words: Words): Artboard {
  const brand = brandOf(project)
  const safe = printBoxes(a).safe
  const u = a.width / 100
  const logoH = u * 5
  return {
    ...a,
    background: '#ffffff',
    layers: [
      { id: uid(), type: 'logo', name: 'Logo', fileId: 'auto', x: safe.x, y: safe.y, w: logoH * 3.2, h: logoH },
      { id: uid(), type: 'shape', name: 'Line', shape: 'rect', fill: brand.primary, radius: 0, x: safe.x, y: safe.y + logoH + u * 3, w: u * 10, h: Math.max(3, u * 0.35) },
      line(project, 'Contact', [words.address, words.phone, words.email, words.web].join(' · '), safe.x, safe.y + safe.h - u * 2.2, safe.w, u * 1.6, { colour: brand.dark }),
    ],
  }
}


/**
 * Another side. A business card's back is the contact side – a small logo, the name and title, the
 * phone, email and website – with words the client can change. A box's side and lid are the brand
 * colour with the logo.
 */
export function faceArtboard(face: Face, project: Project, front: Artboard, name: string, words: Words = PLACEHOLDERS): Artboard {
  const brand = brandOf(project)
  if (face.id === 'back' && front.print) {
    const a: Artboard = { ...printBack(front, brand), name, background: brand.light }
    const safe = printBoxes(a).safe
    const u = safe.h / 100
    const ink = brand.dark
    const text = (id: string, t: string, y: number, size: number, heading = false, weight = 400): Layer => ({
      id: uid(), type: 'text', name: id, text: t, x: safe.x, y, w: safe.w, h: Math.round(size * 1.3),
      font: heading ? brand.heading : brand.body, size: Math.round(size), weight, colour: ink, align: 'left', lineHeight: 1.2, letterSpacing: heading ? -0.01 : 0, clientEditable: true,
    })
    const logoH = u * 16
    return {
      ...a,
      layers: [
        { id: uid(), type: 'logo', name: 'Logo', fileId: 'auto', x: safe.x, y: safe.y, w: logoH * 3, h: logoH },
        text('Name', words.name, safe.y + u * 42, u * 13, true, 600),
        text('Title', words.title, safe.y + u * 58, u * 8.5),
        text('Phone', words.phone, safe.y + u * 76, u * 7.5),
        text('Email', words.email, safe.y + u * 86, u * 7.5),
        text('Website', words.web, safe.y + u * 96 - u * 7.5 * 0.3, u * 7.5),
      ],
    }
  }
  const a = { ...blank({ name, print: face.print, landscape: face.landscape }, project, face.landscape), name }
  if (face.id === 'envelope') {
    // An envelope: white, the logo and the return address in the top left.
    const safe = printBoxes(a).safe
    const u = a.height / 100
    return {
      ...a, background: '#ffffff',
      layers: [
        { id: uid(), type: 'logo', name: 'Logo', fileId: 'auto', x: safe.x, y: safe.y, w: u * 30, h: u * 10 },
        line(project, 'Return address', words.address, safe.x, safe.y + u * 14, safe.w * 0.6, u * 4.5),
      ],
    }
  }
  const area = a.print ? printBoxes(a).safe : { x: 0, y: 0, w: a.width, h: a.height }
  const w = Math.min(area.w * 0.7, a.width * 0.5)
  const h = Math.min(area.h * 0.35, w * 0.4)
  return { ...a, layers: [{ id: uid(), type: 'logo', name: 'Logo', fileId: 'auto', centred: true, x: a.width / 2 - w / 2, y: a.height / 2 - h / 2, w, h }] }
}

/** A design with every side of the product – the front first – and which artboard is which side. */
export function productDesign(product: Product, project: Project, source: ProductSource, name: string, tr: (s: string) => string = (s) => s) {
  const at = new Date().toISOString()
  const words = Object.fromEntries(Object.entries(PLACEHOLDERS).map(([k, v]) => [k, tr(v)])) as Words
  const front = productArtboard(product, project, source, words)
  // Things with several sides name each one: "Business card – Front", "Box – Lid".
  const base = tr(product.short ?? product.name)
  if (product.faces?.length) front.name = `${base} – ${tr('Front')}`
  const faces = (product.faces ?? []).map((f) => ({ id: f.id, board: faceArtboard(f, project, front, `${base} – ${tr(f.name)}`, words) }))
  const design: Design = { id: uid(), projectId: project.id, name, artboards: [front, ...faces.map((f) => f.board)], createdAt: at, updatedAt: at }
  return { design, faces: Object.fromEntries(faces.map((f) => [f.id, f.board.id])) as Partial<Record<FaceId, string>> }
}

/**
 * The artboard for a side when none was picked: in the same design, one made for that side (the
 * same print size – for a card's back, the same size as the front).
 */
export function defaultFace(face: Face, boards: Artboard[], frontId: string): Artboard | undefined {
  const others = boards.filter((a) => a.id !== frontId)
  const byName = (a: Artboard) => /\b(back|bagside|side|lid|låg)\b/i.test(a.name)
  const fits = others.filter((a) => (face.print ? a.print?.format === face.print : false))
  return fits.find(byName) ?? fits[0]
}

/** The printed part of a print artboard (without the bleed), as a share of it – for showing it in a mockup. */
export function trimShare(a: Artboard) {
  if (!a.print) return null
  const t = printBoxes(a).trim
  return { x: t.x / a.width, y: t.y / a.height, w: t.w / a.width, h: t.h / a.height }
}

export const printFormatName = (id?: string) => PRINT_FORMATS.find((f) => f.id === id)?.name
