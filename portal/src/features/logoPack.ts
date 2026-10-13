/**
 * One logo file in, a whole pack out: PNGs at the sizes people actually ask for, favicons,
 * app icons and a social avatar — named so the client's folder makes sense.
 */
import { resolveSrc } from '../data/blobs'
import { APP_NAME } from '../components/brand'

export type PackItem = { name: string; width: number; height?: number; pad?: number; background?: string }

/** What a studio hands over. Widths are the long edge; square ones are padded. */
export const PACK: PackItem[] = [
  { name: 'logo@1x.png', width: 600 },
  { name: 'logo@2x.png', width: 1200 },
  { name: 'logo@3x.png', width: 1800 },
  { name: 'logo-email-signature.png', width: 320 },
  { name: 'favicon-32.png', width: 32, height: 32, pad: 0.1 },
  { name: 'favicon-180-apple-touch.png', width: 180, height: 180, pad: 0.16 },
  { name: 'icon-512.png', width: 512, height: 512, pad: 0.16 },
  { name: 'social-avatar-1000.png', width: 1000, height: 1000, pad: 0.2 },
]

/**
 * A browser rasterises an SVG at its intrinsic size and then scales that up, which turns a small
 * logo into a blurry one. So an SVG is re-read at a large size first, and every PNG is made by
 * scaling that down – which stays sharp.
 */
const MASTER_WIDTH = 2400

async function svgAtSize(text: string): Promise<HTMLImageElement> {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (svg.nodeName !== 'svg') throw new Error('That file is not an image the browser can draw.')
  const box = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  const ratio = box.length === 4 && box[2] && box[3] ? box[2] / box[3] : 1
  svg.setAttribute('width', String(MASTER_WIDTH))
  svg.setAttribute('height', String(Math.round(MASTER_WIDTH / ratio)))
  const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('That file is not an image the browser can draw.'))
    img.src = url
  })
  return img
}

/** Loads an image from a stored file (SVG data URLs and uploads both work). */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  const url = await resolveSrc(src)
  if (!url) throw new Error('The file could not be read.')
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('That file is not an image the browser can draw.'))
    img.src = url
  })
  return img
}

/** Draws the logo into one size, centred, with optional padding and background. */
export function renderItem(img: HTMLImageElement, item: PackItem, background?: string): Promise<Blob> {
  const w = item.width
  const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1)
  const h = item.height ?? Math.round(w / ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const bg = item.background ?? background
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
  }
  // Fit inside the box, leaving the padding free.
  const pad = item.pad ?? 0
  const boxW = w * (1 - pad * 2)
  const boxH = h * (1 - pad * 2)
  const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight)
  const drawW = img.naturalWidth * scale
  const drawH = img.naturalHeight * scale
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be saved.'))), 'image/png'),
  )
}

/** A tidy folder name: "ray-logo-pack". */
export const packName = (client: string) =>
  (client || 'logo')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') + '-logo-pack'

/**
 * Builds the whole pack as a ZIP. The original file is included as-is, because an SVG stays
 * the master copy – everything else is generated from it.
 */
export async function buildLogoPack(
  file: { name: string; src: string; mime: string },
  opts: { client: string; studio?: string; whiteLabel?: boolean; background?: string; items?: PackItem[] },
): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const folder = zip.folder(packName(opts.client))!

  // The source file, untouched.
  const url = await resolveSrc(file.src)
  if (url) {
    const original: Blob = await (await fetch(url)).blob()
    folder.file(`original/${file.name}`, original)
  }

  const isSvg = /svg/i.test(file.mime) || /\.svg$/i.test(file.name)
  const img = isSvg && url ? await svgAtSize(await fetch(url).then((r) => r.text())) : await loadImage(file.src)
  for (const item of opts.items ?? PACK) {
    const blob = await renderItem(img, item, opts.background)
    const dir = item.name.startsWith('favicon') || item.name.startsWith('icon') ? 'icons' : item.name.includes('social') ? 'social' : 'png'
    folder.file(`${dir}/${item.name}`, blob)
  }
  folder.file(
    'README.txt',
    [
      `${opts.client} — logo pack`,
      '',
      'original/  the master file. Use this whenever you can.',
      'png/       ready-made PNGs. @2x and @3x are for screens; the small one suits email signatures.',
      'icons/     favicon (32), Apple touch icon (180) and app icon (512).',
      'social/    square avatar for social profiles.',
      '',
      // The client opens this file, so it carries the studio's name. A studio paying for no
      // Aftryk branding gets its own line and nothing else.
      opts.studio ? (opts.whiteLabel ? `Made by ${opts.studio}.` : `Made by ${opts.studio} with ${APP_NAME}.`) : `Made with ${APP_NAME}.`,
    ].join('\n'),
  )
  return zip.generateAsync({ type: 'blob' })
}
