/**
 * The approval record: every client decision, kept for good. Entries are written by comparing the
 * state before and after each change, so no button can forget to record one.
 */
import type { ApprovalEntry, State } from './types'

const uid = () => Math.random().toString(36).slice(2, 10)

type Draft = Omit<ApprovalEntry, 'id'>

function changed<T extends { id: string }>(before: T[], after: T[], fn: (old: T, now: T) => Draft | null | undefined) {
  if (before === after) return []
  const old = new Map(before.map((x) => [x.id, x]))
  const out: Draft[] = []
  for (const x of after) {
    const o = old.get(x.id)
    if (o && o !== x) {
      const d = fn(o, x)
      if (d) out.push(d)
    }
  }
  return out
}

export function recordApprovals(prev: State, next: State): State {
  const at = new Date().toISOString()
  const entries: Draft[] = [
    ...changed(prev.files, next.files, (o, f) => {
      if (o.status === f.status) return null
      const version = `Version ${f.versions.length}`
      if (f.status === 'Approved') return { projectId: f.projectId, at: f.approvedAt ?? at, by: f.approvedBy ?? '—', action: 'Approved', kind: 'File', itemId: f.id, item: f.name, detail: version }
      if (f.status === 'Changes requested') return { projectId: f.projectId, at, by: f.changesRequestedBy ?? '—', action: 'Changes requested', kind: 'File', itemId: f.id, item: f.name, detail: `${version} · round ${f.roundsUsed}` }
    }),
    ...changed(prev.decks, next.decks, (o, d) => {
      if (o.status === d.status) return null
      if (d.status === 'Approved') return { projectId: d.projectId, at: d.approvedAt ?? at, by: d.approvedBy ?? '—', action: 'Approved', kind: 'Presentation', itemId: d.id, item: d.title }
      if (d.status === 'Changes requested') return { projectId: d.projectId, at, by: d.changesRequestedBy ?? '—', action: 'Changes requested', kind: 'Presentation', itemId: d.id, item: d.title, detail: `Round ${d.roundsUsed}` }
    }),
    ...changed(prev.choices, next.choices, (o, c) => {
      if (o.status === c.status || c.status !== 'Decided') return null
      const option = c.options.find((x) => x.id === c.chosenId)?.label ?? '—'
      return { projectId: c.projectId, at: c.decidedAt ?? at, by: c.chosenBy ?? '—', action: 'Chose', kind: 'Route', itemId: c.id, item: c.title, detail: c.reason ? `${option} – “${c.reason}”` : option }
    }),
    ...changed(prev.proposals, next.proposals, (o, p) => {
      if (o.status === p.status || (p.status !== 'Accepted' && p.status !== 'Declined')) return null
      const pkg = p.packages.find((x) => x.id === p.chosenPackageId)?.name
      const addons = p.addons.filter((a) => p.chosenAddonIds.includes(a.id)).map((a) => a.description)
      const detail = [pkg, ...addons].filter(Boolean).join(' + ') || undefined
      return { projectId: p.projectId, at: p.respondedAt ?? at, by: p.respondedBy ?? '—', action: p.status, kind: 'Proposal', itemId: p.id, item: p.title, detail }
    }),
    ...changed(prev.contracts, next.contracts, (o, c) => {
      if (o.status === c.status || c.status !== 'Signed') return null
      const m = c.signedMeta
      const detail = m ? ['Signed electronically', m.timezone, m.ip && `IP ${m.ip}`].filter(Boolean).join(' · ') : undefined
      return { projectId: c.projectId, at: c.signedAt ?? at, by: c.signedBy ?? '—', action: 'Signed', kind: 'Contract', itemId: c.id, item: c.title, detail }
    }),
    ...changed(prev.projects, next.projects, (o, p) => {
      if (o.discovery.submittedAt || !p.discovery.submittedAt) return null
      const client = next.clients.find((c) => c.id === p.clientId)
      const answered = p.discovery.questions.filter((q) => q.a.trim()).length
      return { projectId: p.id, at: p.discovery.submittedAt, by: client?.contactName || client?.name || '—', action: 'Submitted', kind: 'Questionnaire', itemId: p.id, item: 'Discovery questionnaire', detail: `${answered} of ${p.discovery.questions.length} answered` }
    }),
  ]
  if (!entries.length) return next
  return { ...next, approvals: [...next.approvals, ...entries.map((e) => ({ ...e, id: uid() }))] }
}

/**
 * Everything decided on a project, oldest first. Decisions from before the log existed are
 * rebuilt from what the items themselves remember.
 */
export function approvalRecord(s: State, projectId: string): ApprovalEntry[] {
  const logged = s.approvals.filter((a) => a.projectId === projectId)
  const has = (itemId: string, action: string) => logged.some((a) => a.itemId === itemId && a.action === action)
  const legacy: ApprovalEntry[] = []
  const add = (e: Omit<ApprovalEntry, 'id'>) => legacy.push({ ...e, id: `legacy-${e.itemId}-${e.action}` })
  for (const f of s.files.filter((x) => x.projectId === projectId))
    if (f.status === 'Approved' && f.approvedAt && !has(f.id, 'Approved')) add({ projectId, at: f.approvedAt, by: f.approvedBy ?? '—', action: 'Approved', kind: 'File', itemId: f.id, item: f.name, detail: `Version ${f.versions.length}` })
  for (const d of s.decks.filter((x) => x.projectId === projectId))
    if (d.status === 'Approved' && d.approvedAt && !has(d.id, 'Approved')) add({ projectId, at: d.approvedAt, by: d.approvedBy ?? '—', action: 'Approved', kind: 'Presentation', itemId: d.id, item: d.title })
  for (const c of s.choices.filter((x) => x.projectId === projectId))
    if (c.status === 'Decided' && c.decidedAt && !has(c.id, 'Chose')) add({ projectId, at: c.decidedAt, by: c.chosenBy ?? '—', action: 'Chose', kind: 'Route', itemId: c.id, item: c.title, detail: c.options.find((x) => x.id === c.chosenId)?.label })
  for (const p of s.proposals.filter((x) => x.projectId === projectId))
    if ((p.status === 'Accepted' || p.status === 'Declined') && p.respondedAt && !has(p.id, p.status)) add({ projectId, at: p.respondedAt, by: p.respondedBy ?? '—', action: p.status, kind: 'Proposal', itemId: p.id, item: p.title, detail: p.packages.find((x) => x.id === p.chosenPackageId)?.name })
  for (const c of s.contracts.filter((x) => x.projectId === projectId))
    if (c.status === 'Signed' && c.signedAt && !has(c.id, 'Signed')) add({ projectId, at: c.signedAt, by: c.signedBy ?? '—', action: 'Signed', kind: 'Contract', itemId: c.id, item: c.title })
  const project = s.projects.find((p) => p.id === projectId)
  if (project?.discovery.submittedAt && !has(project.id, 'Submitted')) {
    const client = s.clients.find((c) => c.id === project.clientId)
    add({ projectId, at: project.discovery.submittedAt, by: client?.contactName || '—', action: 'Submitted', kind: 'Questionnaire', itemId: project.id, item: 'Discovery questionnaire' })
  }
  return [...logged, ...legacy].sort((a, b) => a.at.localeCompare(b.at))
}
