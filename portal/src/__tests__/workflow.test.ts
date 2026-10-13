/** Custom stages, first-time setup, revision rounds, notifications. */
import { describe, expect, it } from 'vitest'
import { availableHours, backupReminder, daysOff, reducer, revertChange, type Action } from '../data/store'
import { normalizeState } from '../data/defaults'
import { approvalRecord } from '../data/approvals'
import { feedbackStats } from '../features/feedback'
import { defaultRights, handoverFiles } from '../features/handover'
import { seed } from '../data/seed'
import type { State } from '../data/types'
import { roundsInfo } from '../features/files'

const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s)
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))
const stageOf = (s: State, id: string) => s.studio.workflows[0].stages[s.projects.find((p) => p.id === id)!.stage].name
const main = (s: State) => s.studio.workflows[0]

describe('custom stages', () => {
  it('renaming keeps every project where it was', () => {
    const s0 = clone(seed)
    const s = run(s0, { type: 'setStages', workflowId: main(s0).id, stages: main(s0).stages.map((x) => (x.name === 'Design' ? { ...x, name: 'Creative' } : x)) })
    expect(stageOf(s, 'p-ray')).toBe('Creative')
    expect(stageOf(s, 'p-forma')).toBe('Strategy')
  })

  it('reordering moves projects along with their stage', () => {
    const s0 = clone(seed)
    const [a, b, c, d, ...rest] = main(s0).stages
    const s = run(s0, { type: 'setStages', workflowId: main(s0).id, stages: [a, b, d, c, ...rest] })
    expect(stageOf(s, 'p-ray')).toBe('Design')
    expect(stageOf(s, 'p-forma')).toBe('Strategy')
  })

  it('deleting a stage moves its projects to the stage before', () => {
    const s0 = clone(seed)
    const s = run(s0, { type: 'setStages', workflowId: main(s0).id, stages: main(s0).stages.filter((x) => x.name !== 'Strategy') })
    expect(stageOf(s, 'p-forma')).toBe('Discovery')
    expect(stageOf(s, 'p-ray')).toBe('Design')
  })

  it('moving a project tells the client (notification + email)', () => {
    const s = run(clone(seed), { type: 'setStage', id: 'p-nord', stage: 2 })
    expect(s.notifications[0]).toMatchObject({ audience: 'client', projectId: 'p-nord', text: 'Moved to Strategy' })
    expect(s.outbox[0]).toMatchObject({ to: 'sofie@nord.dk', kind: 'notification' })
  })
})

describe('first-time setup', () => {
  it('an empty workspace has no clients or projects, keeps templates and starts invoices at 1', () => {
    const s = run(clone(seed), { type: 'completeSetup', sample: false, studio: { name: 'New Studio', owner: 'Ann', email: 'a@b.dk' } })
    expect(s.studio).toMatchObject({ name: 'New Studio', owner: 'Ann', setupDone: true })
    expect(s.projects).toHaveLength(0)
    expect(s.clients).toHaveLength(0)
    expect(s.invoices).toHaveLength(0)
    expect(s.nextInvoiceNumber).toBe(1)
    expect(s.projectTemplates.length).toBeGreaterThan(0)
    expect(s.team).toEqual([expect.objectContaining({ name: 'Ann', role: 'Owner' })])
  })

  it('sample projects are only the sample clients (not the demo studio’s own project)', () => {
    const s = run(clone(seed), { type: 'completeSetup', sample: true, studio: { name: 'New Studio', owner: 'Ann' } })
    expect(s.projects.every((p) => p.sample)).toBe(true)
    expect(s.clients.every((c) => c.sample)).toBe(true)
    expect(s.invoices.every((i) => s.projects.some((p) => p.id === i.projectId))).toBe(true)
  })
})

describe('revision rounds', () => {
  const project = { ...clone(seed).projects[0], roundsIncluded: 2 }
  it('count down from the included rounds', () => {
    expect(roundsInfo({ roundsUsed: 0 }, project)).toMatchObject({ left: 2, extra: false })
    expect(roundsInfo({ roundsUsed: 2 }, project)).toMatchObject({ left: 0, extra: false })
  })
  it('mark rounds beyond the included ones as extra', () => {
    expect(roundsInfo({ roundsUsed: 3 }, project)).toMatchObject({ left: 0, extra: true })
  })
})

describe('client actions', () => {
  it('notify the studio, never the client', () => {
    const s = run(clone(seed), { type: 'log', log: { text: 'Alex approved the logo', projectId: 'p-ray', fromClient: true } })
    expect(s.notifications[0]).toMatchObject({ audience: 'studio', text: 'Alex approved the logo' })
  })
  it('studio actions only notify the client when flagged', () => {
    const s = run(clone(seed), { type: 'log', log: { text: 'Internal note', projectId: 'p-ray' } })
    expect(s.notifications).toHaveLength(0)
    expect(s.activity[0].text).toBe('Internal note')
  })
})

describe('freeing up storage', () => {
  it('keeps unread notifications and unsent emails, trims the rest', () => {
    let s = clone(seed)
    for (let i = 0; i < 60; i++) s = run(s, { type: 'log', log: { text: `Client did ${i}`, projectId: 'p-ray', fromClient: true } })
    s = { ...s, notifications: s.notifications.map((n, i) => ({ ...n, read: i % 2 === 0 })), outbox: s.outbox.map((e, i) => ({ ...e, status: i < 5 ? 'Queued' : 'Sent' })) }
    const unread = s.notifications.filter((n) => !n.read).length
    s = run(s, { type: 'trimHistory' })
    expect(s.activity.length).toBeLessThanOrEqual(30)
    expect(s.notifications.every((n) => !n.read)).toBe(true)
    expect(s.notifications.length).toBe(Math.min(unread, 50))
    expect(s.outbox.every((e) => e.status === 'Queued')).toBe(true)
  })
})

describe('undo', () => {
  const undo = (current: State, before: State, after: State) => run(current, { type: 'revert', before, after })

  it('brings a deleted file back in the same place', () => {
    const before = clone(seed)
    const id = before.files[1].id
    const after = run(before, { type: 'remove', coll: 'files', id })
    expect(after.files.some((f) => f.id === id)).toBe(false)
    expect(undo(after, before, after).files.map((f) => f.id)).toEqual(before.files.map((f) => f.id))
  })

  it('keeps everything that happened after the delete', () => {
    const before = clone(seed)
    const task = before.projects.find((p) => p.id === 'p-ray')!.tasks[0]
    const after = run(before, { type: 'deleteTask', projectId: 'p-ray', taskId: task.id })
    const later = run(after, { type: 'updateProject', id: 'p-nord', patch: { name: 'Renamed later' } }, { type: 'remove', coll: 'files', id: before.files[0].id })
    const s = undo(later, before, after)
    expect(s.projects.find((p) => p.id === 'p-ray')!.tasks[0].id).toBe(task.id)
    expect(s.projects.find((p) => p.id === 'p-nord')!.name).toBe('Renamed later')
    expect(s.files.some((f) => f.id === before.files[0].id)).toBe(false)
  })

  it('never overwrites an item that was edited again since', () => {
    const before = clone(seed)
    const task = before.projects.find((p) => p.id === 'p-ray')!.tasks[0]
    const after = run(before, { type: 'deleteTask', projectId: 'p-ray', taskId: task.id })
    const later = run(after, { type: 'updateProject', id: 'p-ray', patch: { name: 'Edited since' } })
    expect(undo(later, before, after).projects.find((p) => p.id === 'p-ray')!.name).toBe('Edited since')
  })

  it('removes what the delete itself logged, but not later activity', () => {
    const before = clone(seed)
    const after = run(before, { type: 'remove', coll: 'decks', id: before.decks[0]?.id ?? 'x', log: { text: 'Deck removed', projectId: 'p-ray' } })
    const later = run(after, { type: 'log', log: { text: 'Something later', projectId: 'p-ray' } })
    const texts = undo(later, before, after).activity.map((a) => a.text)
    expect(texts).not.toContain('Deck removed')
    expect(texts).toContain('Something later')
  })

  it('restores a whole deleted project with its files, proposal and time', () => {
    const before = clone(seed)
    const after = run(before, { type: 'deleteProject', id: 'p-ray' })
    const s = undo(after, before, after)
    for (const k of ['projects', 'files', 'proposals', 'contracts', 'timeEntries'] as const)
      expect(s[k].map((x) => x.id)).toEqual(before[k].map((x) => x.id))
  })

  it('is a no-op when the item already came back (e.g. undone twice)', () => {
    const before = clone(seed)
    const after = run(before, { type: 'deleteClient', id: before.clients[0].id })
    const once = revertChange(after, before, after)
    expect(revertChange(once, before, after).clients).toEqual(before.clients)
  })
})

describe('backup reminder', () => {
  const day = 864e5
  const own = (s: State) => ({ ...s, projects: s.projects.map((p, i) => (i === 0 ? { ...p, sample: false } : p)) })
  const at = (s: State, lastBackupAt: string, snooze?: string): State => ({ ...s, studio: { ...s.studio, lastBackupAt, backupSnoozeUntil: snooze } })
  const t0 = Date.parse('2026-09-01T12:00:00Z')

  it('stays quiet with only sample projects', () => {
    const s = at({ ...clone(seed), projects: clone(seed).projects.map((p) => ({ ...p, sample: true })) }, '2020-01-01')
    expect(backupReminder(s, t0)).toBeNull()
  })

  it('reminds after 14 days of own work, with the number of days', () => {
    const s = at(own(clone(seed)), new Date(t0 - 13 * day).toISOString())
    expect(backupReminder(s, t0)).toBeNull()
    expect(backupReminder(s, t0 + day)).toBe(14)
  })

  it('“Remind me later” hides it until the snooze runs out', () => {
    const s = at(own(clone(seed)), '2026-01-01', new Date(t0 + 3 * day).toISOString())
    expect(backupReminder(s, t0)).toBeNull()
    expect(backupReminder(s, t0 + 4 * day)).not.toBeNull()
  })

  it('existing saves start counting from the upgrade, not from the beginning of time', () => {
    const raw: Record<string, any> = clone(seed)
    delete raw.studio.lastBackupAt
    const s = normalizeState(raw as State & Record<string, unknown>, seed)
    expect(backupReminder(own(s))).toBeNull()
  })
})

describe('approval record', () => {
  it('logs a client approving a file, with the version', () => {
    const s0 = clone(seed)
    const file = s0.files.find((f) => f.status !== 'Approved')!
    const s = run(s0, { type: 'update', coll: 'files', id: file.id, fn: (f) => ({ ...f, status: 'Approved', approvedBy: 'Alex', approvedAt: '2026-09-01T10:00:00Z' }) })
    expect(s.approvals.at(-1)).toMatchObject({ action: 'Approved', kind: 'File', by: 'Alex', item: file.name, detail: `Version ${file.versions.length}` })
  })

  it('logs change requests with who asked, and route choices with the reason', () => {
    const s0 = clone(seed)
    const file = s0.files[0]
    let s = run(s0, { type: 'update', coll: 'files', id: file.id, fn: (f) => ({ ...f, status: 'Changes requested', changesRequestedBy: 'Sofie', roundsUsed: 1 }) })
    expect(s.approvals.at(-1)).toMatchObject({ action: 'Changes requested', by: 'Sofie' })
    const choice = s.choices[0]
    if (choice) {
      s = run(s, { type: 'update', coll: 'choices', id: choice.id, fn: (c) => ({ ...c, status: 'Decided', chosenId: c.options[0].id, chosenBy: 'Oliver', reason: 'Warmer', decidedAt: '2026-09-02T09:00:00Z' }) })
      expect(s.approvals.at(-1)).toMatchObject({ action: 'Chose', by: 'Oliver', detail: `${choice.options[0].label} – “Warmer”` })
    }
  })

  it('logs nothing for edits that aren’t decisions', () => {
    const s = run(clone(seed), { type: 'updateProject', id: 'p-ray', patch: { name: 'New name' } })
    expect(s.approvals).toHaveLength(0)
  })

  it('survives “free up space” and is removed with its project', () => {
    const s0 = clone(seed)
    const file = s0.files.find((f) => f.status !== 'Approved')!
    let s = run(s0, { type: 'update', coll: 'files', id: file.id, fn: (f) => ({ ...f, status: 'Approved', approvedBy: 'Alex' }) })
    s = run(s, { type: 'trimHistory' })
    expect(s.approvals).toHaveLength(1)
    s = run(s, { type: 'deleteProject', id: file.projectId })
    expect(s.approvals).toHaveLength(0)
  })

  it('rebuilds decisions made before the log existed', () => {
    const s = clone(seed)
    const rec = approvalRecord(s, 'p-ray')
    const approved = s.files.filter((f) => f.projectId === 'p-ray' && f.status === 'Approved' && f.approvedAt)
    expect(rec.filter((r) => r.kind === 'File' && r.action === 'Approved')).toHaveLength(approved.length)
    expect([...rec].sort((a, b) => a.at.localeCompare(b.at))).toEqual(rec)
  })
})

describe('client feedback', () => {
  const withFeedback = (s: State, id: string, score: number, quote?: string, mayQuote = true) =>
    run(s, { type: 'updateProject', id, patch: { feedback: { score, quote, mayQuote, by: 'Client', at: '2026-09-01T10:00:00Z' } } })

  it('averages scores and calculates NPS (promoters 9–10 minus detractors 0–6)', () => {
    let s = clone(seed)
    s = withFeedback(s, 'p-ray', 10, 'Lovely')
    s = withFeedback(s, 'p-nord', 9)
    s = withFeedback(s, 'p-forma', 5, 'Slow', false)
    const f = feedbackStats(s)
    expect(f.count).toBe(3)
    expect(f.average).toBeCloseTo(8, 5)
    expect(f.nps).toBe(33) // (2 − 1) / 3
  })

  it('only lists quotes the client allowed', () => {
    let s = withFeedback(clone(seed), 'p-ray', 10, 'Lovely')
    s = withFeedback(s, 'p-forma', 8, 'Private', false)
    expect(feedbackStats(s).quotes.map((q) => q.fb.quote)).toEqual(['Lovely'])
  })
})

describe('time off', () => {
  const off = (from: string, to: string) => ({ timeOff: [{ id: 'o1', memberId: 'm1', from, to, kind: 'Holiday' as const }] })
  const member = { ...clone(seed).team[0], id: 'm1', capacity: 30 }

  it('counts only weekdays inside the week', () => {
    // Week of Monday 5 Oct 2026; off Thu 8 → Tue 13 (over the weekend).
    expect(daysOff(off('2026-10-08', '2026-10-13'), 'm1', '2026-10-05')).toBe(2)
    expect(daysOff(off('2026-10-08', '2026-10-13'), 'm1', '2026-10-12')).toBe(2)
    expect(daysOff(off('2026-10-08', '2026-10-13'), 'm2', '2026-10-05')).toBe(0)
  })

  it('lowers the hours available that week', () => {
    expect(availableHours(off('2026-10-05', '2026-10-06'), member, '2026-10-05')).toBe(18)
    expect(availableHours(off('2026-10-05', '2026-10-11'), member, '2026-10-05')).toBe(0)
    expect(availableHours({ timeOff: [] }, member, '2026-10-05')).toBe(30)
  })
})

describe('handover', () => {
  it('includes approved or published studio files by default, never client uploads', () => {
    const s = clone(seed)
    const p = s.projects.find((x) => x.id === 'p-ray')!
    const files = handoverFiles(s, p)
    expect(files.length).toBeGreaterThan(0)
    expect(files.every((f) => (f.status === 'Approved' || f.published) && f.uploadedBy !== 'client')).toBe(true)
  })

  it('uses exactly the files the studio picked', () => {
    const s = clone(seed)
    const p = s.projects.find((x) => x.id === 'p-ray')!
    const one = s.files.find((f) => f.projectId === 'p-ray')!
    expect(handoverFiles(s, { ...p, handover: { rights: '', fileIds: [one.id] } }).map((f) => f.id)).toEqual([one.id])
  })

  it('writes the usage rights in the client’s language', () => {
    const s = clone(seed)
    const p = s.projects.find((x) => x.id === 'p-ray')!
    expect(defaultRights(s, p)).toMatch(/transfers the full rights/)
    const da = { ...s, clients: s.clients.map((c) => (c.id === p.clientId ? { ...c, language: 'da' as const } : c)) }
    expect(defaultRights(da, p)).toMatch(/overdrager den fulde brugsret/)
  })
})
