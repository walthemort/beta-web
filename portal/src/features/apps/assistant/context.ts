/**
 * The Brand Assistant's knowledge: a brand hub written out as a short guide – the colours and
 * which ones can carry text, the fonts, the logo rules, the tone of voice. Shared by the portal chat
 * and api/assistant.ts (which checks the sizes), and tested.
 */
import { contrast } from '../../color'
import type { Project, State } from '../../../data/types'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type AssistantRequest = { context: string; messages: ChatMessage[]; lang: 'en' | 'da' }

export const LIMITS = { context: 40_000, message: 2_000, messages: 20 }

const list = (items: string[]) => items.filter((s) => s.trim()).map((s) => `- ${s.trim()}`).join('\n')

/** Which colours can go on which as text – WCAG AA for normal text (4.5) and large text (3). */
export function textPairs(colours: { name: string; hex: string; extra?: boolean }[]) {
  const out: string[] = []
  for (const bg of colours)
    for (const fg of colours) {
      // White on black says nothing about the brand.
      if (fg === bg || (fg.extra && bg.extra)) continue
      const r = contrast(fg.hex, bg.hex)
      if (r >= 3) out.push(`${fg.name} text on ${bg.name}: ${r.toFixed(1)}:1 – ${r >= 4.5 ? 'fine for all text' : 'large text and headings only'}`)
    }
  return out
}

export function brandGuide(state: State, project: Project) {
  const hub = project.hub
  const client = state.clients.find((c) => c.id === project.clientId)
  const name = client?.name ?? project.name
  const colours = [...hub.colours, { name: 'White', hex: '#ffffff', extra: true }, { name: 'Black', hex: '#000000', extra: true }]
  const logos = state.files.filter((f) => f.projectId === project.id && f.category === 'Logos' && f.published).map((f) => f.name)
  const sections = [
    `# ${name}${project.tagline ? ` – ${project.tagline}` : ''}`,
    project.description && `## About the brand\n${project.description}`,
    hub.colours.length && `## Colours\n${list(hub.colours.map((c) => `${c.name}: ${c.hex.toUpperCase()}${c.role ? ` (${c.role})` : ''}${c.usage ? `, about ${c.usage}% of the brand` : ''}`))}`,
    hub.colours.length && `## Text on colour (worked out from contrast)\n${list(textPairs(colours))}`,
    hub.fonts.length && `## Fonts\n${list(hub.fonts.map((f) => `${f.name}${f.usage ? `: ${f.usage}` : ''}`))}\nType scale: ${hub.typeScale.base}px base, each step ×${hub.typeScale.ratio}.`,
    `## Logo\nClear space: ${Math.round(hub.logoRules.clearSpace * 100)}% of the logo's height on every side. Smallest size: ${hub.logoRules.minWidthPx}px on screen, ${hub.logoRules.minWidthMm}mm in print.` +
      (hub.logoRules.dos.length ? `\nDo:\n${list(hub.logoRules.dos)}` : '') +
      (hub.logoRules.donts.length ? `\nDon't:\n${list(hub.logoRules.donts)}` : '') +
      (logos.length ? `\nLogo files in the portal: ${logos.join(', ')}` : ''),
    (hub.tone.summary || hub.tone.weAre.length) &&
      `## Tone of voice\n${hub.tone.summary}` +
        (hub.tone.weAre.length ? `\nWe are: ${hub.tone.weAre.join(', ')}` : '') +
        (hub.tone.weAreNot.length ? `\nWe are not: ${hub.tone.weAreNot.join(', ')}` : '') +
        (hub.tone.examples.length ? `\nExamples:\n${list(hub.tone.examples.map((e) => `Say “${e.say}” – not “${e.dontSay}”`))}` : ''),
    hub.imagery && `## Photos and imagery\n${hub.imagery}`,
    `## Who made it\n${state.studio.name} made this brand. For anything the guide doesn't cover, the client can write to the studio in the portal.`,
  ]
  return sections.filter(Boolean).join('\n\n').slice(0, LIMITS.context)
}

/** Questions to start with – English; the chat translates them. */
export const STARTERS = [
  'Can I put the logo on a photo?',
  'Which colours can I use for text?',
  'Which font do I use for headings?',
  'Write an Instagram caption about our new opening hours',
]

/** A request the server accepts: sizes within limits, turns alternating, a question last. */
export function checkRequest(r: Partial<AssistantRequest>): string | null {
  if (typeof r.context !== 'string' || !r.context.trim()) return 'The brand guide is missing'
  if (r.context.length > LIMITS.context) return 'The brand guide is too long'
  if (!Array.isArray(r.messages) || !r.messages.length) return 'Ask a question'
  if (r.messages.length > LIMITS.messages) return 'The conversation is too long – start a new one'
  for (const m of r.messages) {
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) return 'Invalid message'
    if (m.content.length > LIMITS.message * 2) return 'A message is too long'
  }
  if (r.messages.at(-1)!.role !== 'user') return 'Ask a question'
  if (r.messages.at(-1)!.content.length > LIMITS.message) return `Keep the question under ${LIMITS.message.toLocaleString('en')} characters`
  return null
}
