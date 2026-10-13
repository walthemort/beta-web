/**
 * A PDF with one page per artboard – no library needed: each page is a JPEG, which PDF can hold as
 * it is. Page sizes follow the artboard's resolution, so an A4 poster at 300 dpi is an A4 page.
 * Print pages can carry their bleed (with the trim and bleed boxes printers read) and crop marks.
 */

export type PdfPage = {
  jpeg: Uint8Array
  width: number
  height: number
  dpi?: number
  /** How much of the image is bleed, in its pixels, on every side. */
  bleed?: number
  /** Crop marks in a margin around the page. */
  marks?: boolean
}

/** The margin around a page for crop marks: 6 mm. */
const SLUG = 17

export function jpegPdf(pages: PdfPage[]): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const write = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk
    parts.push(bytes)
    length += bytes.length
  }
  const object = (n: number, body: () => void) => {
    offsets[n] = length
    write(`${n} 0 obj\n`)
    body()
    write('\nendobj\n')
  }

  write('%PDF-1.4\n%âãÏÓ\n')
  // 1: catalogue, 2: page tree, then three objects per page: page, contents, image.
  const pageIds = pages.map((_, i) => 3 + i * 3)
  object(1, () => write('<< /Type /Catalog /Pages 2 0 R >>'))
  object(2, () => write(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`))
  pages.forEach((p, i) => {
    const [pageId, contentId, imageId] = [pageIds[i], pageIds[i] + 1, pageIds[i] + 2]
    const pt = 72 / (p.dpi ?? 96)
    const r = (n: number) => Math.round(n * 100) / 100
    const [w, h] = [r(p.width * pt), r(p.height * pt)]
    const slug = p.marks ? SLUG : 0
    const bleed = r((p.bleed ?? 0) * pt)
    const [pw, ph] = [r(w + slug * 2), r(h + slug * 2)]
    const boxes = p.bleed
      ? ` /BleedBox [${slug} ${slug} ${r(slug + w)} ${r(slug + h)}] /TrimBox [${r(slug + bleed)} ${r(slug + bleed)} ${r(slug + w - bleed)} ${r(slug + h - bleed)}]`
      : ''
    object(pageId, () => write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}]${boxes} /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`))
    let draw = `q ${w} 0 0 ${h} ${slug} ${slug} cm /Im${i} Do Q`
    if (p.marks) {
      // A short line at each corner of the cut, in the margin, clear of the bleed.
      const [L, R, B, T] = [slug + bleed, slug + w - bleed, slug + bleed, slug + h - bleed]
      const lines: string[] = []
      for (const x of [L, R])
        for (const y of [B, T]) {
          const left = x === L
          const bottom = y === B
          lines.push(left ? `2 ${r(y)} m ${slug - 3} ${r(y)} l` : `${r(slug + w + 3)} ${r(y)} m ${r(pw - 2)} ${r(y)} l`)
          lines.push(bottom ? `${r(x)} 2 m ${r(x)} ${slug - 3} l` : `${r(x)} ${r(slug + h + 3)} m ${r(x)} ${r(ph - 2)} l`)
        }
      draw += ` q 0.25 w 0 0 0 RG ${lines.join(' ')} S Q`
    }
    object(contentId, () => write(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`))
    object(imageId, () => {
      write(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`)
      write(p.jpeg)
      write('\nendstream')
    })
  })
  const count = 3 + pages.length * 3
  const xref = length
  write(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let n = 1; n < count; n++) write(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  write(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}
