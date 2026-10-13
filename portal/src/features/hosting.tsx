import { APP_NAME } from '../components/brand'
import { useState } from 'react'
import { Globe } from 'lucide-react'
import { formatKr, useStore } from '../data/store'
import { monthLabel } from '../data/retainers'
import type { Project } from '../data/types'
import { useT, activeLang } from '../data/i18n'
import { hasFeature } from '../data/plans'
import { UpgradeNote } from '../app/Plan'

const thisMonth = () => new Date().toISOString().slice(0, 7)
const nextMonth = () => {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 7)
}

/**
 * Keep the brand hub online after the project ends, for a monthly fee. The client keeps one
 * living place for their brand; the studio gets recurring income and a reason to stay in touch.
 */
export function HostingPanel({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const h = project.hubHosting
  const [fee, setFee] = useState(h?.monthlyFee ?? 299)
  const [start, setStart] = useState(h?.startMonth ?? nextMonth())
  const running = h && (!h.endMonth || h.endMonth >= thisMonth())
  const set = (hubHosting: Project['hubHosting'], text: string) =>
    dispatch({ type: 'updateProject', id: project.id, patch: { hubHosting }, log: { text, projectId: project.id } })

  return (
    <section className="card panel">
      <h3><Globe size={15} style={{ verticalAlign: -2 }} /> {tr('Keep it live')}</h3>
      {running ? (
        <>
          <p style={{ fontSize: 14 }}>
            {tr('Hosted for {fee} a month since {month}.', { fee: formatKr(h.monthlyFee), month: monthLabel(h.startMonth, activeLang()) })}
          </p>
          <p className="muted" style={{ fontSize: 13 }}>{tr('A draft invoice is created on the 1st of every month.')}</p>
          <button className="btn btn-sm" onClick={() => set({ ...h, endMonth: thisMonth() }, 'Brand hub hosting stopped')}>{tr('Stop after this month')}</button>
        </>
      ) : !hasFeature(state, 'hubHosting') ? (
        <>
          <p className="muted" style={{ fontSize: 13 }}>{tr('Offer to keep the client’s brand hub online after handover, for a monthly fee. {app} invoices it for you every month.', { app: APP_NAME })}</p>
          <UpgradeNote feature="hubHosting" compact />
        </>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13 }}>{tr('Offer to keep the client’s brand hub online after handover, for a monthly fee. {app} invoices it for you every month.', { app: APP_NAME })}</p>
          <div className="form-row">
            <div className="field">
              <label>{tr('Per month, excl. VAT')}</label>
              <input className="input input-sm" type="number" min="0" step="50" value={fee} onChange={(e) => setFee(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>{tr('From')}</label>
              <input className="input input-sm" type="month" value={start} min={thisMonth()} onChange={(e) => setStart(e.target.value)} />
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={!fee || !start}
            onClick={() => set({ monthlyFee: fee, startMonth: start, invoicedMonths: h?.invoicedMonths ?? [] }, `Brand hub hosting started: ${formatKr(fee)} a month`)}
          >
            {tr('Start hosting')}
          </button>
        </>
      )}
    </section>
  )
}
