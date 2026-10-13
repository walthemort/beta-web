import { deliveryIndex, isComplete, isOverdue, today } from '../data/store'
import type { Member, State } from '../data/types'
import { nudges } from '../features/sales'

export type InboxKind = 'feedback' | 'task' | 'invoice' | 'lead' | 'next'

export type InboxItem = {
  id: string
  kind: InboxKind
  title: string
  detail: string
  to: string
  /** Placeholders in the title/detail, filled in after translating. */
  vars?: Record<string, string | number>
  /** Sorts the inbox: lower comes first. */
  rank: number
  projectId?: string
}

/**
 * Everything that needs someone in the studio right now, in one list: client feedback,
 * my overdue tasks, overdue invoices, leads to chase and the obvious next step on each project.
 */
export function inboxItems(s: State, me: Member): InboxItem[] {
  const t = today()
  const live = s.projects.filter((p) => !p.archived)
  const name = (id?: string) => s.projects.find((p) => p.id === id)?.name ?? ''
  const out: InboxItem[] = []

  for (const x of [
    ...s.files.map((f) => ({ id: f.id, title: f.name, projectId: f.projectId, status: f.status, comments: f.comments, to: `/app/projects/${f.projectId}/files/${f.id}` })),
    ...s.decks.map((d) => ({ id: d.id, title: d.title, projectId: d.projectId, status: d.status, comments: d.comments, to: `/app/projects/${d.projectId}/presentations/${d.id}` })),
  ]) {
    const open = x.comments.filter((c) => c.fromClient && !c.resolved)
    if (x.status !== 'Changes requested' && !open.length) continue
    out.push({
      id: 'fb-' + x.id,
      kind: 'feedback',
      title: x.title,
      detail: x.status === 'Changes requested' ? 'Changes requested' : open.length === 1 ? '1 new comment' : '{n} new comments',
      vars: { n: open.length },
      to: x.to,
      rank: 0,
      projectId: x.projectId,
    })
  }

  for (const p of live) {
    for (const task of p.tasks) {
      if (task.done || task.assigneeId !== me.id || !task.due || task.due > t) continue
      out.push({ id: `task-${p.id}-${task.id}`, kind: 'task', title: task.title, detail: task.due < t ? 'Overdue' : 'Due today', to: `/app/projects/${p.id}`, rank: task.due < t ? 1 : 2, projectId: p.id })
    }
  }

  for (const inv of s.invoices.filter(isOverdue)) {
    out.push({ id: 'inv-' + inv.id, kind: 'invoice', title: '{number} is overdue', vars: { number: inv.number }, detail: name(inv.projectId) || 'Invoice', to: '/app/invoices', rank: 1, projectId: inv.projectId })
  }

  for (const n of nudges(s, t)) {
    if (n.kind === 'lead') out.push({ id: 'lead-' + n.id, kind: 'lead', title: n.what, detail: n.lead.company, to: '/app/sales', rank: 3 })
    else out.push({ id: 'nudge-' + n.id, kind: 'lead', title: 'Follow up on the proposal', detail: name(n.proposal.projectId), to: `/app/projects/${n.proposal.projectId}/proposal`, rank: 3, projectId: n.proposal.projectId })
  }

  // The next step the studio owns on each project, so nothing stalls between steps.
  for (const p of live) {
    const proposal = s.proposals.find((x) => x.projectId === p.id)
    const contract = s.contracts.find((x) => x.projectId === p.id)
    const next = (id: string, title: string, to: string) => out.push({ id: `next-${id}-${p.id}`, kind: 'next', title, detail: p.name, to: `/app/projects/${p.id}${to}`, rank: 4, projectId: p.id })
    if (p.discovery.submittedAt && !proposal) next('proposal', 'Discovery is in – write the proposal', '/proposal')
    else if (proposal?.status === 'Accepted' && !contract) next('contract', 'Proposal accepted – send the contract', '/contract')
    else if (contract?.status === 'Draft' && proposal?.status === 'Accepted') next('send-contract', 'Contract is ready to send', '/contract')
    else if (p.stage >= deliveryIndex(s, p) && !p.handover?.sharedAt) next('handover', 'Share the handover with the client', '/handover')
  }

  // Fridays: a nudge to send the weekly update on projects that haven't had one in a week.
  if (new Date().getDay() === 5) {
    const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString()
    for (const p of live) {
      if (isComplete(s, p)) continue
      const sent = s.activity.some((a) => a.projectId === p.id && a.text === 'Weekly update sent to the client' && a.at >= weekAgo)
      if (!sent) out.push({ id: 'update-' + p.id, kind: 'next', title: 'Send this week’s client update', detail: p.name, to: `/app/projects/${p.id}?update=1`, rank: 5, projectId: p.id })
    }
  }

  return out.sort((a, b) => a.rank - b.rank)
}
