/**
 * Danish VAT (moms). Invoices store amounts incl. VAT plus the rate that applied when they were
 * created, so changing the studio's rate later never rewrites old invoices.
 */
import type { Client, Invoice, State, VatTreatment } from './types'
import { translate, translateTo } from './i18n'

export const VAT_TREATMENTS: { id: VatTreatment; label: string; hint: string }[] = [
  { id: 'dk', label: 'Danish VAT', hint: 'Danish companies and private clients' },
  { id: 'eu', label: 'EU reverse charge', hint: 'VAT-registered companies elsewhere in the EU – no Danish VAT, the client pays VAT in their own country' },
  { id: 'export', label: 'Outside the EU', hint: 'Companies outside the EU – no Danish VAT' },
]

/** Rounded to øre. */
export const round2 = (n: number) => Math.round(n * 100) / 100

/** The VAT rate that applies to a client (0 for reverse charge and export). */
export const clientVatRate = (s: State, client?: Pick<Client, 'vat'>) => ((client?.vat ?? 'dk') === 'dk' ? s.studio.vatRate : 0)

/** The rate for a project, via its client. */
export const projectVatRate = (s: State, projectId?: string) => {
  const project = s.projects.find((p) => p.id === projectId)
  return clientVatRate(s, s.clients.find((c) => c.id === project?.clientId))
}

export const invoiceVatRate = (s: State, i: Pick<Invoice, 'vatRate'>) => i.vatRate ?? s.studio.vatRate

/** Splits an amount incl. VAT into net + VAT, to the øre (net + vat always equals the total). */
export function splitVat(total: number, rate: number) {
  const net = round2(total / (1 + rate))
  return { net, vat: round2(total - net), total }
}

export const withVat = (net: number, rate: number) => round2(net * (1 + rate))

/** The line the law requires on reverse-charge / export invoices. */
export function vatNote(treatment: VatTreatment | undefined, lang: 'en' | 'da') {
  if (treatment === 'eu') return translateTo(lang, 'Reverse charge – VAT to be accounted for by the recipient.')
  if (treatment === 'export') return translateTo(lang, 'No Danish VAT – services supplied outside the EU.')
  return undefined
}

/** “VAT 25%”, or why there is none. */
export function vatLabel(s: State, projectId?: string) {
  const project = s.projects.find((p) => p.id === projectId)
  const vat = s.clients.find((c) => c.id === project?.clientId)?.vat ?? 'dk'
  if (vat === 'eu') return translate('VAT (reverse charge)')
  if (vat === 'export') return translate('VAT (outside the EU)')
  return translate('VAT {pct}%', { pct: Math.round(s.studio.vatRate * 100) })
}
