/**
 * Sales maths: the pipeline, what needs chasing, and what your win rate actually is.
 * Kept free of React so it can be tested on its own.
 */
import type { Lead, LeadStage, Proposal, State } from '../data/types'
import { OPEN_LEAD_STAGES } from '../data/types'
import { proposalScope, proposalTotals } from '../data/store'

const openStages = new Set<LeadStage>(OPEN_LEAD_STAGES)
export const isOpenLead = (l: Lead) => openStages.has(l.stage)

/** A proposal with no answer after this many days is worth a nudge. */
export const NUDGE_AFTER_DAYS = 5

export function leadStats(s: State, year = new Date().getFullYear()) {
  const open = s.leads.filter(isOpenLead)
  const decided = s.leads.filter((l) => l.stage === 'Won' || l.stage === 'Lost')
  const wonThisYear = s.leads.filter((l) => l.stage === 'Won' && l.updatedAt.startsWith(String(year)))
  const won = decided.filter((l) => l.stage === 'Won')
  return {
    open: open.length,
    /** What the open pipeline is worth, excl. VAT. */
    pipeline: open.reduce((n, l) => n + (l.value ?? 0), 0),
    wonThisYear: wonThisYear.length,
    wonValue: wonThisYear.reduce((n, l) => n + (l.value ?? 0), 0),
    winRate: decided.length ? won.length / decided.length : 0,
    decided: decided.length,
  }
}

/** Why leads are lost, most common first. */
export function lostReasons(s: State) {
  const counts = new Map<string, number>()
  for (const l of s.leads) if (l.stage === 'Lost') counts.set(l.lostReason ?? 'Other', (counts.get(l.lostReason ?? 'Other') ?? 0) + 1)
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
}

export type Nudge =
  | { kind: 'lead'; id: string; lead: Lead; what: string; since: string }
  | { kind: 'proposal'; id: string; proposal: Proposal; what: string; since: string; days: number; total: number }

/**
 * What's waiting on you today: next steps that are due, and proposals sent a while ago
 * that nobody has answered.
 */
export function nudges(s: State, today = new Date().toISOString().slice(0, 10)): Nudge[] {
  const out: Nudge[] = []
  for (const lead of s.leads) {
    if (!isOpenLead(lead) || !lead.nextStepDue || lead.nextStepDue > today) continue
    out.push({ kind: 'lead', id: lead.id, lead, what: lead.nextStep || lead.company, since: lead.nextStepDue })
  }
  const cutoff = new Date(new Date(today).getTime() - NUDGE_AFTER_DAYS * 864e5).toISOString()
  for (const proposal of s.proposals) {
    if (proposal.status !== 'Sent' || !proposal.sentAt || proposal.sentAt > cutoff) continue
    const project = s.projects.find((p) => p.id === proposal.projectId)
    if (!project || project.archived) continue
    const days = Math.floor((new Date(today).getTime() - new Date(proposal.sentAt).getTime()) / 864e5)
    out.push({
      kind: 'proposal',
      id: proposal.id,
      proposal,
      what: proposal.title,
      since: proposal.sentAt.slice(0, 10),
      days,
      total: proposalTotals(proposalScope(proposal), 0).subtotal,
    })
  }
  return out.sort((a, b) => a.since.localeCompare(b.since))
}
