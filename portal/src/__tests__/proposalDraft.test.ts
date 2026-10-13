/** Discovery → proposal: the request sent to the server, and the draft made without it. */
import { describe, expect, it } from 'vitest'
import { seed } from '../data/seed'
import { draftRequest, offlineDraft, proposalFromDraft } from '../data/proposalDraft'
import type { State } from '../data/types'

const fresh = (): State => JSON.parse(JSON.stringify(seed))

describe('proposal drafts', () => {
  it('send only the answered questions, the template and past prices for the same service', () => {
    const s = fresh()
    const nord = s.projects.find((p) => p.id === 'p-nord')!
    const answered = nord.discovery.questions.filter((q) => q.a.trim())
    const req = draftRequest(s, nord)
    expect(answered.length).toBeLessThan(nord.discovery.questions.length)
    expect(req.answers).toEqual(answered.map(({ q, a }) => ({ q, a })))
    expect(req.template?.sections.length).toBeGreaterThan(0)
    // RAY is an accepted brand identity proposal – the price range for NORD.
    expect(req.pastPrices).toContain(58000)
  })

  it('make an offline draft that quotes the client and becomes an editable proposal', () => {
    const s = fresh()
    const nord = s.projects.find((p) => p.id === 'p-nord')!
    nord.discovery.questions[0].a = 'Calm Scandinavian homes'
    const draft = offlineDraft(draftRequest(s, nord))
    expect(draft.sections[0].body).toContain('“Calm Scandinavian homes”')
    const proposal = proposalFromDraft(s, nord, draft)
    expect(proposal).toMatchObject({ projectId: 'p-nord', status: 'Draft', packages: [] })
    expect(proposal.items.length).toBeGreaterThan(0)
    expect(proposal.paymentPlan.reduce((n, x) => n + x.percent, 0)).toBe(100)
  })
})
