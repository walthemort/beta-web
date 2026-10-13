/**
 * Discovery → proposal. The client's questionnaire answers, the studio's template for the service
 * and what similar projects were priced at go to /api/proposal, which asks Claude for a first draft.
 * Without the server (no API key yet) the same inputs make a plainer draft right here in the browser.
 */
import { proposalFromTemplate } from './templates'
import { translateTo } from './i18n'
import { proposalScope, proposalTotals, uid } from './store'
import type { Project, Proposal, ProposalTemplate, State } from './types'

/** What the server gets. Nothing but the text needed to write the draft. */
export type DraftRequest = {
  lang: 'en' | 'da'
  studio: { name: string; hourlyRate: number }
  client: { name: string; industry?: string }
  project: { name: string; service: string; description: string; due?: string; budgetHours?: number }
  answers: { q: string; a: string }[]
  template?: { intro: string; sections: { title: string; body: string }[]; items: { description: string; qty: number; price: number }[] }
  /** Accepted proposals for the same service, excl. VAT – the studio's own price range. */
  pastPrices: number[]
}

/** What the server sends back (and what the offline draft produces). */
export type DraftResult = {
  title: string
  intro: string
  sections: { title: string; body: string }[]
  items: { description: string; qty: number; price: number }[]
}

export function templateFor(s: State, project: Project): ProposalTemplate | undefined {
  const byProject = s.projectTemplates.find((t) => t.service === project.service && t.proposalTemplateId)
  return s.proposalTemplates.find((t) => t.id === byProject?.proposalTemplateId) ?? s.proposalTemplates[0]
}

export function draftRequest(s: State, project: Project): DraftRequest {
  const client = s.clients.find((c) => c.id === project.clientId)
  const tpl = templateFor(s, project)
  const pastPrices = s.proposals
    .filter((p) => p.status === 'Accepted' && p.projectId !== project.id && s.projects.find((x) => x.id === p.projectId)?.service === project.service)
    .map((p) => proposalTotals(proposalScope(p), 0).subtotal)
  const items = tpl ? (tpl.items.length ? tpl.items : tpl.packages.find((k) => k.recommended)?.items ?? tpl.packages[0]?.items ?? []) : []
  return {
    lang: client?.language === 'da' ? 'da' : 'en',
    studio: { name: s.studio.name, hourlyRate: s.studio.hourlyRate },
    client: { name: client?.name ?? project.name },
    project: { name: project.name, service: project.service, description: project.description, due: project.due, budgetHours: project.budgetHours },
    answers: project.discovery.questions.filter((q) => q.a.trim()).map(({ q, a }) => ({ q, a })),
    template: tpl && { intro: tpl.intro, sections: tpl.sections, items },
    pastPrices,
  }
}

/** A plain draft without AI: the template, with the client's own words in “The challenge”. */
export function offlineDraft(req: DraftRequest): DraftResult {
  const t = (k: string, vars?: Record<string, string>) => translateTo(req.lang, k, vars)
  const quotes = req.answers.map((x) => `${x.q}\n“${x.a.trim()}”`).join('\n\n')
  const sections = req.template?.sections.length ? [...req.template.sections] : [
    { title: t('The challenge'), body: '' },
    { title: t('Our approach'), body: '' },
    { title: t('Timeline§proposal section'), body: '' },
  ]
  sections[0] = { ...sections[0], body: [sections[0].body, t('What you told us:') + '\n\n' + quotes].filter(Boolean).join('\n\n') }
  return {
    title: t('A new chapter for {client}', { client: req.client.name }),
    intro: req.template?.intro ?? '',
    sections,
    items: req.template?.items.length ? req.template.items : [{ description: req.project.service, qty: req.project.budgetHours ?? 40, price: req.studio.hourlyRate }],
  }
}

/** Turns a draft into a real proposal, keeping the template's payment plan, packages and add-ons. */
export function proposalFromDraft(s: State, project: Project, d: DraftResult): Proposal {
  const client = s.clients.find((c) => c.id === project.clientId)
  const base = proposalFromTemplate(templateFor(s, project), project.id, client?.name ?? project.name)
  return {
    ...base,
    title: d.title || base.title,
    intro: d.intro,
    sections: d.sections.map((x) => ({ ...x, id: uid() })),
    items: d.items.map((x) => ({ ...x, id: uid() })),
    // The draft prices one scope; packages from the template would contradict it.
    packages: [],
  }
}

/** Asks the server for an AI draft; falls back to the offline draft when it isn't set up. */
export async function fetchDraft(req: DraftRequest, useAi = true): Promise<{ draft: DraftResult; ai: boolean }> {
  if (!useAi) return { draft: offlineDraft(req), ai: false }
  try {
    const res = await fetch('/api/proposal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) })
    if (res.ok) return { draft: (await res.json()) as DraftResult, ai: true }
  } catch {
    // No server (local dev with `vite`) – use the offline draft.
  }
  return { draft: offlineDraft(req), ai: false }
}
