/**
 * Words for a post in the client's tone of voice (from the brand hub), written by Claude – five
 * options for a headline, a short text or a call to action.
 *
 * Uses the same key as the proposal drafts: ANTHROPIC_API_KEY. Without it this answers 501.
 */
import { refuse } from './_guard'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'
import type { CopyRequest } from '../src/features/content/ai'

const Options = z.object({ options: z.array(z.string()) })

const SYSTEM = `You write short copy for social media posts, banners and slides that a creative studio makes for its clients.

Write in the client's tone of voice exactly as the brand hub describes it – use their "we are" words, avoid their "we are not" words, and learn from their say / don't-say examples.

Give five different options, each a real alternative (a different angle, not the same line reworded). Each must fit in the character limit. No hashtags, no emojis unless the tone clearly uses them, no quotation marks around the text. Write in the language requested.`

const KIND = { headline: 'a headline', body: 'a short supporting text (one or two sentences)', cta: 'a call to action (a few words)' }

export default async function handler(req: Request): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const stop = refuse(req, 'copy', 30)
  if (stop) return stop
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'not-configured' }, 501)

  let input: CopyRequest
  try {
    input = (await req.json()) as CopyRequest
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!input.brief?.trim() && !input.current?.trim()) return json({ error: 'Say what the post is about' }, 400)
  if ((input.brief?.length ?? 0) > 2000) return json({ error: 'Keep the brief under 2,000 characters' }, 400)

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system: SYSTEM,
      output_config: { format: betaZodOutputFormat(Options) },
      messages: [
        {
          role: 'user',
          content: `Language: ${input.lang === 'da' ? 'Danish' : 'English'}
Write: ${KIND[input.kind] ?? KIND.headline}, at most ${Math.max(10, Math.min(400, Number(input.maxChars) || 80))} characters.

<brand>${JSON.stringify(input.brand ?? '')}</brand>
<tone_of_voice>${JSON.stringify(input.tone ?? {})}</tone_of_voice>
<brief>${JSON.stringify(input.brief ?? '')}</brief>
<current_text>${JSON.stringify(input.current ?? '')}</current_text>`,
        },
      ],
    })
    const options = response.parsed_output?.options.map((o) => o.trim()).filter(Boolean).slice(0, 5)
    if (response.stop_reason === 'refusal' || !options?.length) return json({ error: 'Nothing came back – try another brief' }, 502)
    return json({ options })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Busy – try again in a minute' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'The API key was rejected' }, 500)
    if (err instanceof Anthropic.APIError) return json({ error: `Claude API error ${err.status}` }, 502)
    return json({ error: 'Could not reach Claude' }, 502)
  }
}
