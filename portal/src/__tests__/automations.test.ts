/** The studio's automations: what happens by itself when a client accepts, approves or signs. */
import { describe, expect, it } from 'vitest'
import { deliveryIndex, reducer, type Action } from '../data/store'
import { seed } from '../data/seed'
import type { State } from '../data/types'

const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s)
const fresh = (): State => JSON.parse(JSON.stringify(seed))
const accept: Action = { type: 'update', coll: 'proposals', id: 'pr-forma', fn: (p) => ({ ...p, status: 'Accepted', respondedBy: 'Oliver' }) }
const approve: Action = { type: 'update', coll: 'files', id: 'f-ray-3', fn: (f) => ({ ...f, status: 'Approved', approvedBy: 'Alex Morgan' }) }

describe('automations', () => {
  it('draft a contract when a proposal is accepted, linked to that proposal', () => {
    expect(fresh().contracts.some((c) => c.projectId === 'p-forma')).toBe(false)
    const contract = run(fresh(), accept).contracts.find((c) => c.projectId === 'p-forma')
    expect(contract).toMatchObject({ status: 'Draft', proposalId: 'pr-forma' })
  })

  it('never draft a second contract, and respect the setting', () => {
    const s = run(fresh(), accept, accept)
    expect(s.contracts.filter((c) => c.projectId === 'p-forma')).toHaveLength(1)
    const off = run(fresh(), { type: 'updateStudio', patch: { automations: { contractFromProposal: false, deliverWhenApproved: true } } }, accept)
    expect(off.contracts.some((c) => c.projectId === 'p-forma')).toBe(false)
  })

  it('move a project to Delivery when its last file in review is approved', () => {
    const s = run(fresh(), approve)
    expect(s.projects.find((p) => p.id === 'p-ray')!.stage).toBe(deliveryIndex(s))
  })

  it('leave the stage alone when the setting is off, or files are still in review', () => {
    const before = fresh().projects.find((p) => p.id === 'p-ray')!.stage
    const off = run(fresh(), { type: 'updateStudio', patch: { automations: { contractFromProposal: true, deliverWhenApproved: false } } }, approve)
    expect(off.projects.find((p) => p.id === 'p-ray')!.stage).toBe(before)
    const comment = run(fresh(), { type: 'update', coll: 'files', id: 'f-ray-3', fn: (f) => ({ ...f, roundsUsed: 1 }) })
    expect(comment.projects.find((p) => p.id === 'p-ray')!.stage).toBe(before)
  })

  it('do nothing when a whole workspace is loaded', () => {
    const s = fresh()
    const loaded = run(fresh(), { type: 'replace', state: { ...s, proposals: s.proposals.map((p) => (p.id === 'pr-forma' ? { ...p, status: 'Accepted' } : p)) } })
    expect(loaded.contracts.some((c) => c.projectId === 'p-forma')).toBe(false)
  })
})

describe('brand hub hosting', () => {
  it('invoices every month it runs, once, and keeps going after the project is archived', async () => {
    const { applyHubHosting, hostingMrr } = await import('../data/retainers')
    const s = fresh()
    s.projects = s.projects.map((p) => (p.id === 'p-ray' ? { ...p, archived: true, hubHosting: { monthlyFee: 300, startMonth: '2026-08', invoicedMonths: [] } } : p))
    const once = applyHubHosting(s, '2026-10')
    const hosting = once.invoices.filter((i) => i.hostingMonth)
    expect(hosting.map((i) => i.hostingMonth).sort()).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(hosting[0].amount).toBe(375) // 300 + 25% VAT
    expect(applyHubHosting(once, '2026-10').invoices).toHaveLength(once.invoices.length)
    expect(hostingMrr(once, '2026-10')).toBe(300)
  })
})
