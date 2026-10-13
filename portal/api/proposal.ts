/**
 * Discovery → proposal draft, written by Claude.
 *
 * Runs on the server because it carries the API key. Set it in Vercel → Settings → Environment
 * Variables:
 *
 *   ANTHROPIC_API_KEY   an API key from console.anthropic.com
 *
 * Without it this answers 501 and the app makes a plainer draft from the template instead.
 */
import { refuse } from './_guard'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'
import type { DraftRequest } from '../src/data/proposalDraft'

const Draft = z.object({
  title: z.string(),
  intro: z.string(),
  sections: z.array(z.object({ title: z.string(), body: z.string() })),
  items: z.array(z.object({ description: z.string(), qty: z.number(), price: z.number() })),
})

const SYSTEM = `You write first drafts of proposals for a creative studio (branding, web, motion). The studio will edit the draft before sending it, so give them something specific to react to.

Write to the client in the client's own terms: reflect back what they said in the discovery questionnaire, in plain, warm, confident language. No buzzwords, no promises about results you can't control.

Follow the studio's template: keep its section titles and order, and rewrite each section's body for this client. Keep the intro short.

Line items: start from the template's items and adjust scope to what the client asked for. Prices are per unit in DKK excluding VAT. Stay within the studio's past price range when one is given; if the client's needs are clearly bigger or smaller, move proportionally rather than inventing new rates.

Write everything in the language requested.`

export default async function handler(req: Request): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const stop = refuse(req, 'proposal', 10)
  if (stop) return stop
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'not-configured' }, 501)

  let input: DraftRequest
  try {
    input = (await req.json()) as DraftRequest
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!input.answers?.length) return json({ error: 'The questionnaire has no answers yet' }, 400)

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5',
      // If a safety check declines the request, the API retries on a suitable model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: 'medium', format: betaZodOutputFormat(Draft) },
      messages: [
        {
          role: 'user',
          content: `Language: ${input.lang === 'da' ? 'Danish' : 'English'}

<studio>${JSON.stringify(input.studio)}</studio>
<client>${JSON.stringify(input.client)}</client>
<project>${JSON.stringify(input.project)}</project>
<discovery_answers>${JSON.stringify(input.answers)}</discovery_answers>
<template>${JSON.stringify(input.template ?? null)}</template>
<past_prices_excl_vat>${JSON.stringify(input.pastPrices)}</past_prices_excl_vat>

Write the proposal draft.`,
        },
      ],
    })
    if (response.stop_reason === 'refusal' || !response.parsed_output) return json({ error: 'No draft came back' }, 502)
    return json(response.parsed_output)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Busy – try again in a minute' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'The API key was rejected' }, 500)
    if (err instanceof Anthropic.APIError) return json({ error: `Claude API error ${err.status}` }, 502)
    return json({ error: 'Could not reach Claude' }, 502)
  }
}
