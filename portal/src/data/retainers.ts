/**
 * Retainers: a fixed monthly fee for a number of hours. A draft invoice is created on the 1st of
 * every month the retainer runs, and hours logged on the project that month count against it.
 */
import type { Project, State } from './types'
import { clientVatRate, withVat } from './vat'
import { translateTo } from './i18n'

const uid = () => Math.random().toString(36).slice(2, 10)

/** 'YYYY-MM' months from `from` to `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    if (++m > 12) { m = 1; y++ }
    if (out.length > 120) break
  }
  return out
}

export const monthLabel = (month: string, lang: 'en' | 'da') =>
  new Date(month + '-15T12:00:00Z').toLocaleDateString(lang === 'da' ? 'da-DK' : 'en-GB', { month: 'long', year: 'numeric' })

/** Creates the draft invoices for every month a retainer has reached (and not been invoiced for). */
export function applyRetainers(s: State, month = new Date().toISOString().slice(0, 7)): State {
  return applyHubHosting(applyMonthlyRetainers(s, month), month)
}

function applyMonthlyRetainers(s: State, month: string): State {
  let next = s
  for (const p of s.projects) {
    const r = p.retainer
    if (!r || p.archived) continue
    const last = r.endMonth && r.endMonth < month ? r.endMonth : month
    const due = monthsBetween(r.startMonth, last).filter((m) => !r.invoicedMonths.includes(m))
    if (!due.length) continue
    const client = next.clients.find((c) => c.id === p.clientId)
    const lang = client?.language === 'da' ? 'da' : 'en'
    const vatRate = clientVatRate(next, client)
    let n = next.nextInvoiceNumber
    const created = due.map((m) => ({
      id: uid(),
      number: `INV-${String(n++).padStart(3, '0')}`,
      clientId: p.clientId,
      projectId: p.id,
      amount: withVat(r.monthlyFee, vatRate),
      vatRate,
      description: translateTo(lang, 'Retainer {month} – {project}', { month: monthLabel(m, lang), project: p.name }),
      due: new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, 1) + next.studio.paymentTermsDays * 864e5).toISOString().slice(0, 10),
      remindersSent: [],
      status: 'Draft' as const,
      retainerMonth: m,
    }))
    next = {
      ...next,
      invoices: [...created.reverse(), ...next.invoices],
      nextInvoiceNumber: n,
      projects: next.projects.map((x) => (x.id === p.id ? { ...x, retainer: { ...r, invoicedMonths: [...r.invoicedMonths, ...due] } } : x)),
    }
  }
  return next
}

/** Hours logged on the project in a month, against what the retainer includes. */
export function retainerUsage(s: State, p: Project, month = new Date().toISOString().slice(0, 7)) {
  const used = s.timeEntries.filter((t) => t.projectId === p.id && t.date.startsWith(month)).reduce((n, t) => n + t.minutes, 0) / 60
  const included = p.retainer?.hoursIncluded ?? 0
  return { used, included, over: Math.max(0, used - included), share: included ? used / included : 0 }
}

/**
 * Brand hub hosting: after handover the studio keeps the client's hub online for a monthly fee.
 * Like a retainer, each month it runs gets a draft invoice. It keeps running after the project
 * is archived – that's the point of it.
 */
export function applyHubHosting(s: State, month = new Date().toISOString().slice(0, 7)): State {
  let next = s
  for (const p of s.projects) {
    const h = p.hubHosting
    if (!h || !h.monthlyFee) continue
    const last = h.endMonth && h.endMonth < month ? h.endMonth : month
    const due = monthsBetween(h.startMonth, last).filter((m) => !h.invoicedMonths.includes(m))
    if (!due.length) continue
    const client = next.clients.find((c) => c.id === p.clientId)
    const lang = client?.language === 'da' ? 'da' : 'en'
    const vatRate = clientVatRate(next, client)
    let n = next.nextInvoiceNumber
    const created = due.map((m) => ({
      id: uid(),
      number: `INV-${String(n++).padStart(3, '0')}`,
      clientId: p.clientId,
      projectId: p.id,
      amount: withVat(h.monthlyFee, vatRate),
      vatRate,
      description: translateTo(lang, 'Brand hub hosting {month} – {project}', { month: monthLabel(m, lang), project: p.name }),
      due: new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, 1) + next.studio.paymentTermsDays * 864e5).toISOString().slice(0, 10),
      remindersSent: [],
      status: 'Draft' as const,
      hostingMonth: m,
    }))
    next = {
      ...next,
      invoices: [...created.reverse(), ...next.invoices],
      nextInvoiceNumber: n,
      projects: next.projects.map((x) => (x.id === p.id ? { ...x, hubHosting: { ...h, invoicedMonths: [...h.invoicedMonths, ...due] } } : x)),
    }
  }
  return next
}

/** Monthly recurring revenue from hosted hubs that haven't ended (including ones starting soon). */
export function hostingMrr(s: State, month = new Date().toISOString().slice(0, 7)) {
  return s.projects.reduce((n, p) => {
    const h = p.hubHosting
    return h && (!h.endMonth || h.endMonth >= month) ? n + h.monthlyFee : n
  }, 0)
}
