/** Costs on a project: fonts, stock photos, print, freelancers… Billable ones can be invoiced in one go. */
import { useState, type FormEvent } from 'react'
import { Plus, Receipt, Trash2 } from 'lucide-react'
import { formatDate, formatKr, today, uid, useStore } from '../data/store'
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type Project, type State } from '../data/types'
import { projectVatRate, withVat } from '../data/vat'
import { useUndo } from '../components/Undo'
import { useT } from '../data/i18n'

/** Billable expenses that haven't been put on an invoice yet. */
export const uninvoicedExpenses = (s: State, projectId: string) =>
  s.expenses.filter((e) => e.projectId === projectId && e.billable && !s.invoices.some((i) => i.expenseIds?.includes(e.id)))

export function ProjectExpenses({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const [adding, setAdding] = useState(false)
  const [billable, setBillable] = useState(true)
  const expenses = state.expenses.filter((e) => e.projectId === project.id).sort((a, b) => b.date.localeCompare(a.date))
  const open = uninvoicedExpenses(state, project.id)
  const openTotal = open.reduce((n, e) => n + e.amount, 0)
  const invoiceOf = (e: Expense) => state.invoices.find((i) => i.expenseIds?.includes(e.id))

  function add(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const d = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>
    const amount = Number(d.amount.replace(',', '.'))
    if (!d.description.trim() || !(amount > 0)) return
    dispatch({
      type: 'insert',
      coll: 'expenses',
      item: { id: uid(), projectId: project.id, date: d.date || today(), description: d.description.trim(), amount, category: d.category as ExpenseCategory, billable },
    })
    ev.currentTarget.reset()
    setAdding(false)
  }

  function invoiceThem() {
    const rate = projectVatRate(state, project.id)
    dispatch({
      type: 'addInvoice',
      invoice: {
        clientId: project.clientId,
        projectId: project.id,
        amount: withVat(openTotal, rate),
        vatRate: rate,
        description: `${tr('Expenses')} – ${open.map((e) => e.description).join(', ')}`.slice(0, 140),
        due: new Date(Date.now() + state.studio.paymentTermsDays * 864e5).toISOString().slice(0, 10),
        status: 'Draft',
        expenseIds: open.map((e) => e.id),
      },
    })
  }

  return (
    <section className="card panel">
      <div className="section-head" style={{ margin: 0 }}>
        <h3 style={{ margin: 0 }}>{tr('Expenses')}</h3>
        <button className="btn btn-sm" onClick={() => setAdding(!adding)}><Plus size={14} /> {tr('Add expense')}</button>
      </div>
      {adding && (
        <form className="expense-form" onSubmit={add}>
          <input name="description" className="input input-sm" placeholder={tr('What was it? e.g. Font licence')} aria-label={tr('Description')} required autoFocus />
          <input name="amount" className="input input-sm" inputMode="decimal" placeholder={tr('kr. excl. VAT')} aria-label={tr('Amount excl. VAT')} required />
          <select name="category" className="input input-sm" aria-label={tr('Category')} defaultValue="Fonts & licences">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{tr(c)}</option>)}
          </select>
          <input name="date" type="date" className="input input-sm" defaultValue={today()} aria-label={tr('Date')} />
          <label className="check-row" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> {tr('Billable to the client')}
          </label>
          <button type="submit" className="btn btn-primary btn-sm">{tr('Add')}</button>
        </form>
      )}
      {expenses.length === 0 ? (
        !adding && <p className="muted" style={{ fontSize: 13 }}>{tr('No expenses yet. Log fonts, stock photos, print and freelancers to see what the project really earned.')}</p>
      ) : (
        <div className="list">
          {expenses.map((e) => {
            const inv = invoiceOf(e)
            return (
              <div key={e.id} className="list-item">
                <span className="grow">
                  <span>{e.description}</span>
                  <small>
                    {tr(e.category)} · {formatDate(e.date)} · {e.billable ? (inv ? tr('Billed on {number}', { number: inv.number }) : tr('Billable')) : tr('Studio cost')}
                  </small>
                </span>
                <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatKr(e.amount)}</span>
                <button
                  className="btn btn-ghost btn-icon"
                  aria-label={tr('Delete {name}', { name: e.description })}
                  onClick={() => undoable(tr('{name} deleted', { name: e.description }), () => dispatch({ type: 'remove', coll: 'expenses', id: e.id }))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
      {open.length > 0 && (
        <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={invoiceThem}>
          <Receipt size={14} /> {open.length === 1 ? tr('Invoice the billable expense ({amount})', { amount: formatKr(openTotal) }) : tr('Invoice {n} billable expenses ({amount})', { n: open.length, amount: formatKr(openTotal) })}
        </button>
      )}
    </section>
  )
}
