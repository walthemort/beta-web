/**
 * AI images for the Content Machine – what the editor asks for, and how that becomes a call to an
 * image model. Shared by the editor and api/image.ts (which holds the key), and tested.
 *
 * The provider is fal.ai: one key reaches several models, each picked for what it's good at.
 *   photo          FLUX.2 [pro]         – realistic photos, follows the prompt closely
 *   illustration   Recraft V3           – drawn images in the brand's own colours
 *   graphic        Recraft V3 (vector)  – flat, clean shapes (an SVG) in the brand's colours
 *   texture        Recraft V3           – calm backgrounds to put text on, in the brand's colours
 *   edit           FLUX.2 [pro] edit    – change a photo with words
 *   cutout         BiRefNet             – remove a photo's background
 *   expand         Bria Expand          – grow a photo to fill a new shape
 */

export type AiKind = 'photo' | 'illustration' | 'graphic' | 'texture'

export const AI_KINDS: { id: AiKind; name: string; hint: string }[] = [
  { id: 'photo', name: 'Photo', hint: 'Realistic, like a photoshoot' },
  { id: 'illustration', name: 'Illustration', hint: 'Drawn, in the brand’s colours' },
  { id: 'graphic', name: 'Graphic', hint: 'Flat shapes and icons, in the brand’s colours' },
  { id: 'texture', name: 'Background', hint: 'Calm texture or pattern to put text on' },
]

/** What the brand adds to a prompt: its colours, and the hub's photo direction. */
export type AiBrand = { colours: string[]; imagery?: string }

export type ImageRequest =
  | { action: 'create'; prompt: string; kind: AiKind; width: number; height: number; brand?: AiBrand; seed?: number }
  | { action: 'edit'; prompt: string; image: string }
  | { action: 'cutout'; image: string }
  | { action: 'expand'; image: string; canvas: [number, number]; place: { x: number; y: number; w: number; h: number }; prompt?: string }

export type ImageJob = { model: string; input: Record<string, unknown> }

export class AiInputError extends Error {}

/** About a megapixel in the artboard's shape, in multiples of 32 – what the models work best with. */
export function aiSize(width: number, height: number, megapixels = 1): { width: number; height: number } {
  const ratio = Math.max(0.25, Math.min(4, width / Math.max(1, height)))
  const h = Math.sqrt((megapixels * 1_000_000) / ratio)
  const round = (n: number) => Math.max(256, Math.min(2048, Math.round(n / 32) * 32))
  return { width: round(h * ratio), height: round(h) }
}

/** The nearest of the preset shapes, for models that only take those. */
export function nearestPreset(width: number, height: number) {
  const ratio = width / Math.max(1, height)
  const presets = [
    ['square_hd', 1],
    ['portrait_4_3', 3 / 4],
    ['portrait_16_9', 9 / 16],
    ['landscape_4_3', 4 / 3],
    ['landscape_16_9', 16 / 9],
  ] as const
  return [...presets].sort((a, b) => Math.abs(Math.log(a[1] / ratio)) - Math.abs(Math.log(b[1] / ratio)))[0][0]
}

const hex = /^#[0-9a-f]{6}$/i
const rgb = (h: string) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) })

/** The prompt the model gets: what the studio asked for, plus the brand and what never belongs in a post. */
export function brandPrompt(prompt: string, kind: AiKind, brand?: AiBrand) {
  const asked = prompt.trim().replace(/\s+/g, ' ')
  const colours = brand?.colours.filter((c) => hex.test(c)).slice(0, 5) ?? []
  const palette = colours.length ? ` Colour palette: ${colours.join(', ')}.` : ''
  const direction = brand?.imagery?.trim() ? ` Photo direction: ${brand.imagery.trim().replace(/\s+/g, ' ').slice(0, 400)}` : ''
  if (kind === 'photo') return `${asked}.${direction}${palette ? ` Colours that sit well with this palette: ${colours.join(', ')}.` : ''} Professional photograph. No text, no logos, no watermarks.`
  if (kind === 'texture')
    return `Background for a social media post: ${asked || 'soft abstract shapes and gradients'}.${palette} Calm, with plenty of open space for text. No text, no logos, no people.`
  if (kind === 'graphic') return `${asked}. Flat vector graphic, clean shapes, modern and simple.${palette} No text.`
  return `${asked}. Modern editorial illustration.${palette} No text, no logos.`
}

function checkImage(image: unknown): string {
  if (typeof image !== 'string' || !/^(data:image\/(png|jpeg|webp);base64,|https:\/\/)/.test(image)) throw new AiInputError('Send the image as a PNG, JPEG or WebP')
  if (image.length > 6_000_000) throw new AiInputError('The image is too big – make it smaller first')
  return image
}
function checkPrompt(prompt: unknown, required = true): string {
  const p = typeof prompt === 'string' ? prompt.trim() : ''
  if (required && !p) throw new AiInputError('Describe what you want')
  if (p.length > 1000) throw new AiInputError('Keep the description under 1,000 characters')
  return p
}

/** Checks a request from the editor and turns it into one call to a model. */
export function imageJob(r: ImageRequest): ImageJob {
  if (r.action === 'create') {
    const kind = AI_KINDS.some((k) => k.id === r.kind) ? r.kind : 'photo'
    const prompt = brandPrompt(checkPrompt(r.prompt, kind !== 'texture'), kind, r.brand)
    const size = aiSize(Number(r.width) || 1080, Number(r.height) || 1080)
    const seed = Number.isInteger(r.seed) ? r.seed : undefined
    if (kind === 'photo') return { model: 'fal-ai/flux-2-pro', input: { prompt, image_size: size, output_format: 'jpeg', sync_mode: true, seed } }
    const colors = (r.brand?.colours ?? []).filter((c) => hex.test(c)).slice(0, 5).map(rgb)
    const style = kind === 'graphic' ? 'vector_illustration' : kind === 'texture' ? 'realistic_image' : 'digital_illustration'
    return { model: 'fal-ai/recraft/v3/text-to-image', input: { prompt, image_size: nearestPreset(size.width, size.height), style, colors } }
  }
  if (r.action === 'edit') return { model: 'fal-ai/flux-2-pro/edit', input: { prompt: checkPrompt(r.prompt), image_urls: [checkImage(r.image)], image_size: 'auto', output_format: 'jpeg', sync_mode: true } }
  if (r.action === 'cutout') return { model: 'fal-ai/birefnet/v2', input: { image_url: checkImage(r.image), output_format: 'png', refine_foreground: true, sync_mode: true } }
  if (r.action === 'expand') {
    const [W, H] = (r.canvas ?? []).map((n) => Math.round(Number(n)))
    const p = r.place ?? { x: 0, y: 0, w: 0, h: 0 }
    const place = [p.x, p.y, p.w, p.h].map((n) => Math.round(Number(n)))
    if (!(W >= 64 && H >= 64 && W <= 5000 && H <= 5000)) throw new AiInputError('The new size should be between 64 and 5,000 pixels')
    if (!(place[2] > 0 && place[3] > 0)) throw new AiInputError('The photo needs a size inside the new shape')
    return {
      model: 'fal-ai/bria/expand',
      input: {
        image_url: checkImage(r.image),
        canvas_size: [W, H],
        original_image_size: [place[2], place[3]],
        original_image_location: [place[0], place[1]],
        prompt: checkPrompt(r.prompt, false) || undefined,
        sync_mode: true,
      },
    }
  }
  throw new AiInputError('Unknown action')
}

/** Where a photo sits in the artboard, scaled down so the whole thing is at most `max` pixels on its long side. */
export function expandPlan(board: { width: number; height: number }, photo: { x: number; y: number; w: number; h: number }, max = 2048) {
  const s = Math.min(1, max / Math.max(board.width, board.height))
  const canvas: [number, number] = [Math.round(board.width * s), Math.round(board.height * s)]
  return { canvas, place: { x: Math.round(photo.x * s), y: Math.round(photo.y * s), w: Math.round(photo.w * s), h: Math.round(photo.h * s) }, scale: s }
}

/** The month AI images are counted in ('2026-09'). */
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7)

/* ---------- Words in the brand's voice (api/copy.ts, written by Claude) ---------- */

export type CopyKind = 'headline' | 'body' | 'cta'

export type CopyRequest = {
  kind: CopyKind
  /** What the post is about. */
  brief: string
  /** The text on the layer now, to improve on. */
  current?: string
  brand: string
  tone: { summary: string; weAre: string[]; weAreNot: string[]; examples: { say: string; dontSay: string }[] }
  lang: 'en' | 'da'
  /** Roughly how many characters fit. */
  maxChars: number
}

/** A sensible length for text that fits on the layer: its width in characters, times a few lines. */
export function copyLength(kind: CopyKind, layer: { w: number; size: number }) {
  const perLine = Math.max(8, Math.floor(layer.w / (layer.size * 0.52)))
  return Math.min(400, perLine * (kind === 'body' ? 4 : kind === 'cta' ? 1 : 2))
}
