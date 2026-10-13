/** Invoice numbers, proposal totals and payment plans. */
import { describe, expect, it } from 'vitest'
import { proposalScope, proposalTotals, reducer, type Action } from '../data/store'
import { seed } from '../data/seed'
import type { State } from '../data/types'
import { invoiceVatRate, splitVat, vatNote, withVat } from '../data/vat'
import { normalizeState } from '../data/defaults'
import { projectFinance } from '../features/time'
import { uninvoicedExpenses } from '../features/expenses'
import { applyRetainers, monthsBetween, retainerUsage } from '../data/retainers'

const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s)
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))
const fresh = () => clone(seed)

describe('invoice numbers', () => {
  it('count up and are never reused, even after a delete', () => {
    let s = fresh()
    const inv = { clientId: 'c-ray', projectId: 'p-ray', amount: 1000, status: 'Draft' as const }
    s = run(s, { type: 'addInvoice', invoice: inv })
    const first = s.invoices[0]
    expect(first.number).toBe('INV-004')
    s = run(s, { type: 'deleteInvoice', id: first.id }, { type: 'addInvoice', invoice: inv })
    expect(s.invoices[0].number).toBe('INV-005')
  })

  it('records the issue date when an invoice is issued, and the paid date when paid', () => {
    let s = fresh()
    const id = s.invoices.find((i) => i.status === 'Draft')!.id
    s = run(s, { type: 'setInvoiceStatus', id, status: 'Issued' })
    expect(s.invoices.find((i) => i.id === id)!.issuedAt).toBeTruthy()
    s = run(s, { type: 'setInvoiceStatus', id, status: 'Paid' })
    expect(s.invoices.find((i) => i.id === id)!.paidAt).toBeTruthy()
  })
})

describe('proposal totals', () => {
  const forma = () => fresh().proposals.find((p) => p.id === 'pr-forma')!

  it('use the recommended package when nothing is chosen yet', () => {
    const p = forma()
    const rec = p.packages.find((x) => x.recommended)!
    expect(proposalScope(p).map((i) => i.id)).toEqual(rec.items.map((i) => i.id))
  })

  it('use the chosen package plus the chosen add-ons', () => {
    const p = forma()
    const scope = proposalScope(p, 'pk1', ['ad1'])
    const t = proposalTotals(scope, 0.25)
    // Essential: 12 000 + 18 000, add-on: 14 000
    expect(t.subtotal).toBe(44000)
    expect(t.vat).toBe(11000)
    expect(t.total).toBe(55000)
  })

  it('use the fixed line items when there are no packages', () => {
    const p = fresh().proposals.find((x) => x.id === 'pr-ray')!
    expect(proposalTotals(proposalScope(p), 0.25).subtotal).toBe(58000)
  })
})

describe('payment plans', () => {
  /** Forma: accepted with the Essential package; plan is 50% on signing, 50% on completion. */
  function accepted() {
    return run(fresh(), {
      type: 'update',
      coll: 'proposals',
      id: 'pr-forma',
      fn: (p) => ({ ...p, status: 'Accepted', chosenPackageId: 'pk1', chosenAddonIds: [], respondedBy: 'Oliver' }),
    })
  }
  const formaInvoices = (s: State) => s.invoices.filter((i) => i.projectId === 'p-forma' && i.description?.includes('%'))

  it('do not invoice “on signing” before a contract is signed', () => {
    expect(formaInvoices(accepted())).toHaveLength(0)
  })

  it('invoice “on signing” the moment the contract is signed, for the right amount', () => {
    let s = accepted()
    // Accepting drafted the contract automatically; the client signs that one.
    const contract = s.contracts.find((c) => c.projectId === 'p-forma')!
    s = run(s, { type: 'update', coll: 'contracts', id: contract.id, fn: (c) => ({ ...c, status: 'Signed', signedBy: 'Oliver' }) })
    const inv = formaInvoices(s)
    expect(inv).toHaveLength(1)
    // 30 000 excl. VAT → 37 500 incl. VAT → 50% = 18 750
    expect(inv[0].amount).toBe(18750)
    expect(inv[0].status).toBe('Draft')
  })

  it('invoice “on completion” when the project reaches the last stage — once', () => {
    let s = accepted()
    const last = s.studio.workflows[0].stages.length - 1
    s = run(s, { type: 'setStage', id: 'p-forma', stage: last })
    expect(formaInvoices(s)).toHaveLength(1)
    s = run(s, { type: 'setStage', id: 'p-forma', stage: last - 1 }, { type: 'setStage', id: 'p-forma', stage: last })
    expect(formaInvoices(s)).toHaveLength(1)
  })

  it('“Invoice now” creates a step’s invoice before its trigger', () => {
    let s = accepted()
    s = run(s, {
      type: 'update',
      coll: 'proposals',
      id: 'pr-forma',
      fn: (p) => ({ ...p, paymentPlan: p.paymentPlan.map((x, i) => (i === 0 ? { ...x, invoiceNow: true } : x)) }),
    })
    expect(formaInvoices(s)).toHaveLength(1)
    expect(s.proposals.find((p) => p.id === 'pr-forma')!.paymentPlan[0].invoiceNow).toBeUndefined()
  })

  it('use the studio’s own “delivery” stage', () => {
    let s = run(
      fresh(),
      { type: 'update', coll: 'proposals', id: 'pr-nord', fn: (p) => ({ ...p, status: 'Accepted', paymentPlan: [{ id: 'x', label: 'All at delivery', percent: 100, trigger: 'At delivery' }] }) },
    )
    const delivery = s.studio.workflows[0].stages.findIndex((x) => x.delivery)
    s = run(s, { type: 'setStage', id: 'p-nord', stage: delivery - 1 })
    expect(s.invoices.filter((i) => i.projectId === 'p-nord' && i.description?.startsWith('All at delivery'))).toHaveLength(0)
    s = run(s, { type: 'setStage', id: 'p-nord', stage: delivery })
    expect(s.invoices.filter((i) => i.projectId === 'p-nord' && i.description?.startsWith('All at delivery'))).toHaveLength(1)
  })
})

describe('VAT', () => {
  const addTo = (s: State, projectId: string) =>
    run(s, { type: 'addInvoice', invoice: { clientId: s.projects.find((p) => p.id === projectId)!.clientId, projectId, amount: 1000, status: 'Draft' } })
  const setClientVat = (s: State, projectId: string, vat: 'dk' | 'eu' | 'export') => {
    const clientId = s.projects.find((p) => p.id === projectId)!.clientId
    return run(s, { type: 'update', coll: 'clients', id: clientId, fn: (c) => ({ ...c, vat }) })
  }

  it('splits totals to the øre, and net + VAT always adds up', () => {
    expect(splitVat(1250, 0.25)).toEqual({ net: 1000, vat: 250, total: 1250 })
    const odd = splitVat(999.99, 0.25)
    expect(odd.net).toBe(799.99)
    expect(Math.round((odd.net + odd.vat) * 100) / 100).toBe(999.99)
    expect(withVat(799.99, 0.25)).toBe(999.99)
  })

  it('each new invoice remembers the VAT rate of its client', () => {
    let s = addTo(fresh(), 'p-ray')
    expect(s.invoices[0].vatRate).toBe(0.25)
    s = addTo(setClientVat(s, 'p-ray', 'eu'), 'p-ray')
    expect(s.invoices[0].vatRate).toBe(0)
  })

  it('changing the studio’s VAT rate never changes existing invoices', () => {
    let s = addTo(fresh(), 'p-ray')
    s = run(s, { type: 'updateStudio', patch: { vatRate: 0.3 } })
    expect(invoiceVatRate(s, s.invoices[0])).toBe(0.25)
  })

  it('old invoices without a rate are given the studio’s rate when loaded', () => {
    const raw = clone(seed) as State
    raw.invoices = raw.invoices.map(({ vatRate: _, ...i }) => i)
    expect(normalizeState(raw as State & Record<string, unknown>, seed).invoices.every((i) => i.vatRate === raw.studio.vatRate)).toBe(true)
  })

  it('payment plans for EU reverse-charge clients are invoiced without Danish VAT', () => {
    let s = setClientVat(fresh(), 'p-forma', 'eu')
    s = run(s, { type: 'update', coll: 'proposals', id: 'pr-forma', fn: (p) => ({ ...p, status: 'Accepted', chosenPackageId: 'pk1', chosenAddonIds: [], paymentPlan: p.paymentPlan.map((x, i) => (i === 0 ? { ...x, invoiceNow: true } : x)) }) })
    const inv = s.invoices.find((i) => i.projectId === 'p-forma' && i.description?.includes('%'))!
    // 30 000 excl. VAT, no VAT → 50% = 15 000
    expect(inv).toMatchObject({ amount: 15000, vatRate: 0 })
  })

  it('reverse-charge and export invoices carry the legally required note', () => {
    expect(vatNote('eu', 'da')).toMatch(/Omvendt betalingspligt/)
    expect(vatNote('export', 'en')).toMatch(/outside the EU/)
    expect(vatNote('dk', 'da')).toBeUndefined()
  })
})

describe('expenses', () => {
  const add = (s: State, id: string, amount: number, billable: boolean) =>
    run(s, { type: 'insert', coll: 'expenses', item: { id, projectId: 'p-ray', date: '2026-09-01', description: id, amount, category: 'Other', billable } })

  it('only the studio’s own expenses lower what the project earned', () => {
    let s = fresh()
    const before = projectFinance(s, 'p-ray')
    s = add(s, 'font', 2000, false)
    s = add(s, 'print', 5000, true)
    const f = projectFinance(s, 'p-ray')
    expect(f.expenses).toBe(7000)
    expect(f.ownExpenses).toBe(2000)
    expect(f.earned).toBe(before.quoted - 2000)
  })

  it('billable expenses become one invoice (with VAT) and are then marked as billed', () => {
    let s = add(add(fresh(), 'a', 1000, true), 'b', 600, true)
    expect(uninvoicedExpenses(s, 'p-ray')).toHaveLength(2)
    s = run(s, { type: 'addInvoice', invoice: { clientId: 'c-ray', projectId: 'p-ray', amount: withVat(1600, 0.25), status: 'Draft', expenseIds: ['a', 'b'] } })
    expect(s.invoices[0].amount).toBe(2000)
    expect(uninvoicedExpenses(s, 'p-ray')).toHaveLength(0)
  })

  it('re-billed expense invoices don’t count as quoted work', () => {
    let s = fresh()
    s = run(s, { type: 'update', coll: 'proposals', id: 'pr-ray', fn: (p) => ({ ...p, status: 'Draft' }) })
    const quoted = projectFinance(s, 'p-ray').quoted
    s = run(s, { type: 'addInvoice', invoice: { clientId: 'c-ray', projectId: 'p-ray', amount: 1250, status: 'Issued', expenseIds: ['x'] } })
    expect(projectFinance(s, 'p-ray').quoted).toBe(quoted)
  })
})

describe('retainers', () => {
  const withRetainer = (s: State, startMonth: string, endMonth?: string) => ({
    ...s,
    projects: s.projects.map((p) => (p.id === 'p-nord' ? { ...p, retainer: { monthlyFee: 10000, hoursIncluded: 20, startMonth, endMonth, invoicedMonths: [] } } : p)),
  })
  const nordRetainers = (s: State) => s.invoices.filter((i) => i.projectId === 'p-nord' && i.retainerMonth)

  it('lists the months in between, across new year', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(monthsBetween('2027-01', '2026-12')).toEqual([])
  })

  it('makes one draft per month (with VAT), each month only once', () => {
    let s = applyRetainers(withRetainer(fresh(), '2026-08'), '2026-10')
    expect(nordRetainers(s).map((i) => i.retainerMonth).sort()).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(nordRetainers(s).every((i) => i.amount === 12500 && i.status === 'Draft')).toBe(true)
    s = applyRetainers(s, '2026-10')
    expect(nordRetainers(s)).toHaveLength(3)
    s = applyRetainers(s, '2026-11')
    expect(nordRetainers(s)).toHaveLength(4)
  })

  it('stops after the last month and keeps invoice numbers in sequence', () => {
    const s0 = fresh()
    const s = applyRetainers(withRetainer(s0, '2026-09', '2026-10'), '2027-01')
    expect(nordRetainers(s)).toHaveLength(2)
    expect(s.nextInvoiceNumber).toBe(s0.nextInvoiceNumber + 2)
    expect(new Set(s.invoices.map((i) => i.number)).size).toBe(s.invoices.length)
  })

  it('counts this month’s logged hours against the hours included', () => {
    let s = withRetainer(fresh(), '2026-09')
    s = run(s, { type: 'insert', coll: 'timeEntries', item: { id: 't1', projectId: 'p-nord', memberId: 'm-owner', minutes: 25 * 60, note: '', date: '2026-10-05' } })
    const u = retainerUsage(s, s.projects.find((p) => p.id === 'p-nord')!, '2026-10')
    expect(u).toMatchObject({ used: 25, included: 20, over: 5 })
  })
})
