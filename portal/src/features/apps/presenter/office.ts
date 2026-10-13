/**
 * Presenter: Office files from a brand hub – a PowerPoint (also for Keynote and Google Slides) with
 * slide layouts in the brand's colours, fonts and logo, and a Word letterhead. The layouts are data,
 * so the page's previews and the file are drawn from the same boxes.
 */
import { contrast, readableOn } from '../../color'
import type { Brand } from '../../content/model'
import type { LogoPng } from '../logoPng'

/** A slide is 13.333 × 7.5 inches (16:9, PowerPoint's “widescreen”). */
export const SLIDE = { w: 13.333, h: 7.5 }

export type Tone = 'primary' | 'light' | 'dark' | 'accent'
export type Box = { x: number; y: number; w: number; h: number }
export type TextBox = Box & { size: number; font: 'heading' | 'body'; bold?: boolean; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom'; bullets?: boolean }

export type SlideLayout = {
  id: string
  name: string
  bg: Tone
  /** Where the logo goes – it's fitted inside the box, kept to its side. */
  logo?: Box & { align: 'left' | 'center' | 'right' }
  bar?: Box & { tone: Tone }
  title?: TextBox
  body?: (TextBox & { name: string })[]
  picture?: Box
  number?: boolean
  /** Text for the example slide (English – translated where it's built). */
  example: { title?: string; body?: Record<string, string> }
}

const M = 0.8 // margin
const W = SLIDE.w
const H = SLIDE.h

export const LAYOUTS: SlideLayout[] = [
  {
    id: 'title', name: 'Title', bg: 'primary',
    logo: { x: M, y: 0.7, w: 3, h: 0.6, align: 'left' },
    title: { x: M, y: 2.9, w: 9.8, h: 2.1, size: 48, font: 'heading', bold: true, valign: 'bottom' },
    body: [{ name: 'subtitle', x: M, y: 5.15, w: 9.8, h: 0.9, size: 20, font: 'body' }],
    example: { title: 'The title of the presentation', body: { subtitle: 'A subtitle · the date' } },
  },
  {
    id: 'section', name: 'Section', bg: 'dark',
    bar: { x: M, y: 2.95, w: 0.9, h: 0.08, tone: 'accent' },
    title: { x: M, y: 3.2, w: 10.5, h: 1.5, size: 40, font: 'heading', bold: true, valign: 'top' },
    body: [{ name: 'intro', x: M, y: 4.8, w: 10.5, h: 0.9, size: 18, font: 'body' }],
    logo: { x: W - M - 1.6, y: H - 0.75, w: 1.6, h: 0.32, align: 'right' },
    example: { title: 'A new chapter', body: { intro: 'One line on what this part is about' } },
  },
  {
    id: 'text', name: 'Title and text', bg: 'light',
    bar: { x: 0, y: 0, w: 0.16, h: H, tone: 'primary' },
    title: { x: M, y: 0.6, w: W - M * 2, h: 1, size: 30, font: 'heading', bold: true, valign: 'bottom' },
    body: [{ name: 'text', x: M, y: 1.85, w: W - M * 2, h: 4.6, size: 18, font: 'body', bullets: true }],
    logo: { x: W - M - 1.6, y: H - 0.75, w: 1.6, h: 0.32, align: 'right' },
    number: true,
    example: { title: 'A heading that says the point', body: { text: 'The first thing to know\nThe second, a little shorter\nAnd a third to finish' } },
  },
  {
    id: 'columns', name: 'Two columns', bg: 'light',
    bar: { x: 0, y: 0, w: 0.16, h: H, tone: 'primary' },
    title: { x: M, y: 0.6, w: W - M * 2, h: 1, size: 30, font: 'heading', bold: true, valign: 'bottom' },
    body: [
      { name: 'left', x: M, y: 1.85, w: (W - M * 2 - 0.5) / 2, h: 4.6, size: 18, font: 'body', bullets: true },
      { name: 'right', x: M + (W - M * 2 + 0.5) / 2, y: 1.85, w: (W - M * 2 - 0.5) / 2, h: 4.6, size: 18, font: 'body', bullets: true },
    ],
    logo: { x: W - M - 1.6, y: H - 0.75, w: 1.6, h: 0.32, align: 'right' },
    number: true,
    example: { title: 'Before and after', body: { left: 'What we had\nWhat didn’t work', right: 'What we’re doing\nWhat it changes' } },
  },
  {
    id: 'picture', name: 'Picture and text', bg: 'light',
    picture: { x: 0, y: 0, w: 6.2, h: H },
    title: { x: 6.9, y: 0.9, w: W - 6.9 - M, h: 1.5, size: 30, font: 'heading', bold: true, valign: 'bottom' },
    body: [{ name: 'text', x: 6.9, y: 2.6, w: W - 6.9 - M, h: 3.8, size: 18, font: 'body' }],
    logo: { x: W - M - 1.6, y: H - 0.75, w: 1.6, h: 0.32, align: 'right' },
    number: true,
    example: { title: 'A picture says it', body: { text: 'Click the picture box to add a photo. A few lines about it go here.' } },
  },
  {
    id: 'statement', name: 'Big statement', bg: 'accent',
    body: [
      { name: 'statement', x: 1.2, y: 1.4, w: W - 2.4, h: 3.9, size: 40, font: 'heading', bold: true, valign: 'bottom' },
      { name: 'source', x: 1.2, y: 5.5, w: W - 2.4, h: 0.6, size: 16, font: 'body' },
    ],
    example: { body: { statement: '“One sentence the audience should remember.”', source: '– Who said it' } },
  },
  {
    id: 'closing', name: 'Closing', bg: 'primary',
    logo: { x: (W - 4) / 2, y: 2.3, w: 4, h: 1.1, align: 'center' },
    title: { x: 1.5, y: 3.9, w: W - 3, h: 1, size: 32, font: 'heading', bold: true, align: 'center', valign: 'middle' },
    body: [{ name: 'contact', x: 1.5, y: 4.95, w: W - 3, h: 0.8, size: 16, font: 'body', align: 'center' }],
    example: { title: 'Thank you', body: { contact: 'name@company.com · +45 12 34 56 78' } },
  },
]

/** The colour behind a layout, and the colours that read on it. */
export function palette(brand: Brand, tone: Tone) {
  let bg = brand[tone]
  // An accent that's the same as the primary colour would make two slides alike – use the dark one.
  if (tone === 'accent' && bg.toLowerCase() === brand.primary.toLowerCase()) bg = brand.dark
  const ink = [brand.dark, brand.light].find((c) => contrast(c, bg) >= 4.5) ?? readableOn(bg)
  const heading = contrast(brand.primary, bg) >= 3 && tone === 'light' ? brand.primary : ink
  return { bg, ink, heading, muted: ink }
}

/** A logo of this aspect (width / height), fitted inside a box and kept to one side. */
export function fitLogo(box: Box & { align: 'left' | 'center' | 'right' }, aspect: number): Box {
  let w = box.w
  let h = w / aspect
  if (h > box.h) {
    h = box.h
    w = h * aspect
  }
  const x = box.align === 'left' ? box.x : box.align === 'right' ? box.x + box.w - w : box.x + (box.w - w) / 2
  return { x, y: box.y + (box.h - h) / 2, w, h }
}

const hex = (c: string) => c.replace('#', '').slice(0, 6).toUpperCase()

/** The PowerPoint: a master per layout and, if wanted, one example slide of each. */
export async function buildPptx(opts: { brand: Brand; name: string; logos: Record<string, LogoPng | undefined>; examples: boolean; tr: (s: string) => string }) {
  const { brand, logos, tr } = opts
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = opts.name
  pptx.company = opts.name
  pptx.theme = { headFontFace: brand.heading, bodyFontFace: brand.body }

  for (const l of LAYOUTS) {
    const c = palette(brand, l.bg)
    const objects: NonNullable<Parameters<typeof pptx.defineSlideMaster>[0]['objects']> = []
    if (l.bar) objects.push({ rect: { x: l.bar.x, y: l.bar.y, w: l.bar.w, h: l.bar.h, fill: { color: hex(palette(brand, l.bar.tone).bg) }, line: { type: 'none' } } })
    const logo = logos[c.bg.toLowerCase()]
    if (l.logo && logo) objects.push({ image: { ...fitLogo(l.logo, logo.aspect), data: logo.data.replace(/^data:/, '') } })
    if (l.picture) objects.push({ placeholder: { options: { name: 'picture', type: 'pic', ...l.picture }, text: '' } })
    if (l.title) {
      const t = l.title
      objects.push({ placeholder: { options: { name: 'title', type: 'title', x: t.x, y: t.y, w: t.w, h: t.h, fontFace: brand.heading, fontSize: t.size, bold: t.bold, color: hex(c.heading), align: t.align ?? 'left', valign: t.valign ?? 'top', margin: 0 }, text: '' } })
    }
    for (const b of l.body ?? []) {
      objects.push({ placeholder: { options: { name: b.name, type: 'body', x: b.x, y: b.y, w: b.w, h: b.h, fontFace: b.font === 'heading' ? brand.heading : brand.body, fontSize: b.size, bold: b.bold, color: hex(b.font === 'heading' ? c.heading : c.ink), align: b.align ?? 'left', valign: b.valign ?? 'top', margin: 0 }, text: '' } })
    }
    pptx.defineSlideMaster({
      title: tr(l.name),
      background: { color: hex(c.bg) },
      objects,
      ...(l.number ? { slideNumber: { x: M, y: H - 0.72, w: 1, h: 0.3, fontFace: brand.body, fontSize: 10, color: hex(c.ink) } } : {}),
    })
  }

  if (opts.examples) {
    for (const l of LAYOUTS) {
      const s = pptx.addSlide({ masterName: tr(l.name) })
      if (l.title && l.example.title) s.addText(tr(l.example.title), { placeholder: 'title' })
      for (const b of l.body ?? []) {
        const text = l.example.body?.[b.name]
        if (!text) continue
        const lines = tr(text).split('\n')
        s.addText(lines.map((t) => ({ text: t, options: { bullet: b.bullets ? { indent: 18 } : false, breakLine: true, paraSpaceAfter: 6 } })), { placeholder: b.name })
      }
    }
    // The palette, for everyone making slides.
    const s = pptx.addSlide({ masterName: tr('Title and text') })
    s.addText(tr('The brand’s colours'), { placeholder: 'title' })
    const colours = brand.swatches.filter((x) => x !== '#ffffff' && x !== '#000000').slice(0, 6)
    const sw = (W - M * 2 - (colours.length - 1) * 0.25) / Math.max(1, colours.length)
    colours.forEach((col, i) => {
      const x = M + i * (sw + 0.25)
      s.addShape('rect', { x, y: 2, w: sw, h: 3, fill: { color: hex(col) }, line: { color: 'DDDDDD', width: 0.5 } })
      s.addText(col.toUpperCase(), { x, y: 5.1, w: sw, h: 0.4, fontFace: brand.body, fontSize: 12, color: hex(brand.dark), margin: 0 })
    })
  } else {
    for (const l of LAYOUTS.slice(0, 1)) pptx.addSlide({ masterName: tr(l.name) })
  }

  return (await pptx.write({ outputType: 'blob' })) as Blob
}

export type Letterhead = { company: string; address?: string; phone?: string; email?: string; website?: string; vat?: string }

export const contactLine = (l: Letterhead) => [l.address, l.phone, l.email, l.website, l.vat].map((x) => x?.trim()).filter(Boolean).join('   ·   ')

const base64ToBytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(',')[1]), (ch) => ch.charCodeAt(0))

/** The Word letterhead: the logo in the header, the contact line in the footer, the brand's fonts. */
export async function buildDocx(opts: { brand: Brand; letterhead: Letterhead; logo?: LogoPng; tr: (s: string, v?: Record<string, string | number>) => string; lang: string }) {
  const { brand, letterhead: lh, logo, tr } = opts
  const { AlignmentType, Document, Footer, Header, ImageRun, Packer, Paragraph, TextRun } = await import('docx')
  const ink = hex(brand.dark === '#111111' ? '#222222' : brand.dark)
  const accent = hex(contrast(brand.primary, '#ffffff') >= 3 ? brand.primary : brand.dark)
  const logoH = 44 // px in the header
  const header = new Header({
    children: [
      new Paragraph({
        children: logo
          ? [new ImageRun({ type: 'png', data: base64ToBytes(logo.data), transformation: { width: Math.min(220, logoH * logo.aspect), height: Math.min(220, logoH * logo.aspect) / logo.aspect } })]
          : [new TextRun({ text: lh.company, font: brand.heading, bold: true, size: 32, color: accent })],
      }),
    ],
  })
  const footer = new Footer({
    children: [
      new Paragraph({ border: { top: { style: 'single', size: 6, color: accent, space: 8 } }, children: [new TextRun({ text: lh.company, bold: true, size: 16, color: ink, font: brand.body })] }),
      new Paragraph({ children: [new TextRun({ text: contactLine(lh), size: 16, color: ink, font: brand.body })] }),
    ],
  })
  const date = new Date().toLocaleDateString(opts.lang === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const p = (text: string, o: { bold?: boolean; after?: number; colour?: string; size?: number; font?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
    new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 0 }, children: [new TextRun({ text, bold: o.bold, color: o.colour, size: o.size, font: o.font })] })
  const doc = new Document({
    creator: lh.company,
    title: tr('Letterhead – {name}', { name: lh.company }),
    styles: {
      default: {
        document: { run: { font: brand.body, size: 21, color: ink }, paragraph: { spacing: { line: 300 } } },
        heading1: { run: { font: brand.heading, size: 32, bold: true, color: accent }, paragraph: { spacing: { after: 160 } } },
        heading2: { run: { font: brand.heading, size: 26, bold: true, color: accent }, paragraph: { spacing: { before: 200, after: 100 } } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 2100, bottom: 1700, left: 1300, right: 1300, header: 700, footer: 600 } } },
        headers: { default: header },
        footers: { default: footer },
        children: [
          p(tr('[Recipient]')),
          p(tr('[Street and number]')),
          p(tr('[Postcode and town]'), { after: 480 }),
          p(date, { align: AlignmentType.RIGHT, after: 480 }),
          p(tr('[Subject]'), { bold: true, colour: accent, size: 28, font: brand.heading, after: 240 }),
          p(tr('Dear [name],'), { after: 200 }),
          p(tr('[Write the letter here. The logo, the contact line and the brand’s fonts are already in place – use Save as → Word template to keep this as the starting point for every letter.]'), { after: 200 }),
          p(tr('Kind regards,'), { after: 600 }),
          p(tr('[Name]'), { bold: true }),
          p(tr('[Title]')),
        ],
      },
    ],
  })
  return Packer.toBlob(doc)
}
