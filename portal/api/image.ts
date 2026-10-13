/**
 * AI images for the Content Machine, made by fal.ai – one key reaches the models listed in
 * src/features/content/ai.ts (photos, illustrations in the brand's colours, editing, cutting out
 * and extending photos). See docs/AI-IMAGES.md.
 *
 * Runs on the server because it carries the key. Set it in Vercel → Settings → Environment
 * Variables (or in .env.local for `npm run dev`):
 *
 *   FAL_KEY   an API key from fal.ai → Settings → API keys
 *
 * Without it this answers 501 and the editor says AI images aren't switched on yet.
 */
import { refuse } from './_guard'
import { AiInputError, imageJob, type ImageRequest } from '../src/features/content/ai'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

type FalFile = { url: string; content_type?: string; width?: number; height?: number }

/** The image itself, so the browser can keep it – fal's own links don't last forever. */
async function asDataUri(f: FalFile) {
  if (f.url.startsWith('data:')) return f.url
  const res = await fetch(f.url)
  if (!res.ok) throw new Error('The finished image could not be fetched')
  const type = f.content_type ?? res.headers.get('content-type') ?? 'image/png'
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const stop = refuse(req, 'image', 10)
  if (stop) return stop
  if (!process.env.FAL_KEY) return json({ error: 'not-configured' }, 501)
  // Only Aftryk's own pages may spend the studio's image credits from a browser.

  let job
  try {
    job = imageJob((await req.json()) as ImageRequest)
  } catch (err) {
    return json({ error: err instanceof AiInputError ? err.message : 'Invalid request' }, 400)
  }

  let res: Response
  try {
    res = await fetch(`https://fal.run/${job.model}`, {
      method: 'POST',
      headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(job.input),
    })
  } catch {
    return json({ error: 'Could not reach the image service' }, 502)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) return json({ error: 'The image service rejected the key' }, 500)
    if (res.status === 429) return json({ error: 'Busy – try again in a minute' }, 429)
    if (res.status === 422) return json({ error: 'The image service couldn’t use that – try other words or another image' }, 422)
    // Out of credit shows up as a payment error at fal.
    if (res.status === 402 || /balance|credit/i.test(detail)) return json({ error: 'The image service is out of credit' }, 402)
    return json({ error: `Image service error ${res.status}` }, 502)
  }

  const out = (await res.json()) as { images?: FalFile[]; image?: FalFile; has_nsfw_concepts?: boolean[] }
  const files = out.images ?? (out.image ? [out.image] : [])
  if (!files.length) return json({ error: 'No image came back – try other words' }, 502)
  try {
    const images = await Promise.all(files.map(async (f) => ({ src: await asDataUri(f), width: f.width, height: f.height })))
    return json({ images, model: job.model })
  } catch {
    return json({ error: 'The finished image could not be fetched' }, 502)
  }
}
