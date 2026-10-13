/**
 * Brand Audit: type a web address, get a report in a minute – colours, fonts, the basics, and how
 * it compares with a client's brand hub. Made for a first meeting with a lead.
 */
import { APP_NAME } from '../../../components/brand'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink, Loader2, Printer, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { useConfirm } from '../../../components/ui'
import { formatDate, now, uid, useStore } from '../../../data/store'
import type { Audit, AuditResult } from '../../../data/types'
import { useLang, useT } from '../../../data/i18n'
import { AppGate } from '../../../app/Apps'
import { readableOn } from '../../color'
import { compareWithHub, isGrey } from './extract'

export default function AuditPage() {
  const { id } = useParams()
  return <AppGate id="audit">{id ? <Report id={id} /> : <AuditList />}</AppGate>
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function useRunAudit() {
  const tr = useT()
  const { lang } = useLang()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(url: string): Promise<AuditResult | null> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/audit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, lang }) })
      const data = (await res.json().catch(() => ({}))) as { result?: AuditResult; error?: string }
      if (!res.ok || !data.result) {
        setError(data.error ? tr(data.error) : tr('The website couldn’t be read – try again'))
        return null
      }
      return data.result
    } catch {
      setError(tr('Could not reach {app} – check the connection', { app: APP_NAME }))
      return null
    } finally {
      setBusy(false)
    }
  }
  return { run, busy, error }
}

function AuditList() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { confirm, confirmNode } = useConfirm()
  const [url, setUrl] = useState(params.get('url') ?? '')
  const [projectId, setProjectId] = useState('')
  const [leadId, setLeadId] = useState(params.get('lead') ?? '')
  const { run, busy, error } = useRunAudit()
  const list = [...state.audits].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const leads = state.leads.filter((l) => l.stage !== 'Lost')

  async function start(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    const result = await run(url.trim())
    if (!result) return
    const audit: Audit = { id: uid(), url: result.finalUrl, projectId: projectId || undefined, leadId: leadId || undefined, result, createdAt: now() }
    dispatch({ type: 'insert', coll: 'audits', item: audit, log: { text: `Brand audit: ${host(result.finalUrl)}`, projectId: audit.projectId } })
    navigate(`/app/audit/${audit.id}`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('App')}</span>
          <h1>{tr('Brand Audit')}</h1>
          <p className="muted">{tr('How on-brand is a website? A report in a minute')}</p>
        </div>
      </div>
      <form className="card au-new" onSubmit={start}>
        <div className="au-url">
          <Search size={17} className="muted" />
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={tr('Web address, e.g. bakeriet.dk')} aria-label={tr('Web address')} autoFocus />
          <button className="btn btn-primary" disabled={busy || !url.trim()}>{busy ? <Loader2 size={15} className="spin" /> : null} {busy ? tr('Reading the site…') : tr('Run the audit')}</button>
        </div>
        <div className="au-options">
          <label>{tr('Compare with')}
            <select className="input input-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{tr('No brand hub')}</option>
              {state.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {leads.length > 0 && (
            <label>{tr('For a lead')}
              <select className="input input-sm" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">{tr('None')}</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.company}</option>)}
              </select>
            </label>
          )}
        </div>
        {error && <p className="au-error" role="alert">{error}</p>}
      </form>
      {list.length > 0 && (
        <div className="card list">
          {list.map((a) => (
            <div key={a.id} className="list-item">
              <Score value={a.result.score} small />
              <Link to={`/app/audit/${a.id}`} className="grow cell-title">
                <b style={{ fontWeight: 500 }}>{a.result.title || host(a.url)}</b>
                <small>{host(a.url)} · {formatDate(a.createdAt)}{a.leadId ? ` · ${state.leads.find((l) => l.id === a.leadId)?.company ?? ''}` : ''}</small>
              </Link>
              <button className="btn btn-ghost btn-icon" title={tr('Delete')} onClick={() => confirm(tr('Delete the audit of {name}?', { name: host(a.url) }), () => dispatch({ type: 'remove', coll: 'audits', id: a.id }))}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
      {confirmNode}
    </>
  )
}

function Score({ value, small, label }: { value: number; small?: boolean; label?: string }) {
  const colour = value >= 80 ? '#2f9e5b' : value >= 55 ? '#d99a1e' : '#e5484d'
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <span className={'au-score' + (small ? ' small' : '')} title={label}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={colour} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <b>{value}</b>
    </span>
  )
}

function Report({ id }: { id: string }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const audit = state.audits.find((a) => a.id === id)
  const { run, busy, error } = useRunAudit()
  if (!audit) return <p className="muted">{tr('This audit doesn’t exist any more.')}</p>
  const r = audit.result
  const project = state.projects.find((p) => p.id === audit.projectId)
  const lead = state.leads.find((l) => l.id === audit.leadId)
  const compare = project ? compareWithHub(r, project.hub) : null
  const set = (patch: Partial<Audit>) => dispatch({ type: 'update', coll: 'audits', id: audit.id, fn: (a) => ({ ...a, ...patch }) })
  const failed = r.checks.filter((c) => !c.ok)

  return (
    <div className="au-report">
      <div className="mk-head au-noprint">
        <Link to="/app/audit" className="btn btn-ghost btn-icon" aria-label={tr('Back')}><ArrowLeft size={16} /></Link>
        <span style={{ flex: 1 }} />
        <select className="input input-sm" style={{ width: 'auto' }} value={audit.projectId ?? ''} onChange={(e) => set({ projectId: e.target.value || undefined })} aria-label={tr('Compare with')}>
          <option value="">{tr('Compare with a brand hub…')}</option>
          {state.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn btn-sm" disabled={busy} onClick={async () => { const next = await run(audit.url); if (next) set({ result: next, createdAt: now() }) }}>{busy ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />} {tr('Run again')}</button>
        <button className="btn btn-sm" onClick={() => window.print()}><Printer size={14} /> {tr('Print / PDF')}</button>
      </div>
      {error && <p className="au-error" role="alert">{error}</p>}

      <section className="card au-hero">
        <div className="au-hero-text">
          <span className="eyebrow">{tr('Brand audit')} · {formatDate(audit.createdAt)}</span>
          <h1>{r.title || host(r.finalUrl)}</h1>
          <a href={r.finalUrl} target="_blank" rel="noopener noreferrer" className="muted au-link">{host(r.finalUrl)} <ExternalLink size={12} /></a>
          {lead && <span className="pill">{tr('Lead')}: {lead.company}</span>}
          {r.summary && <p className="au-summary">{r.summary}</p>}
        </div>
        <div className="au-scores">
          <div><Score value={r.score} /><span>{tr('The basics')}</span></div>
          {compare && <div><Score value={compare.onBrand} /><span>{tr('On brand')}</span></div>}
        </div>
      </section>

      {r.advice && r.advice.length > 0 && (
        <section className="card au-section">
          <h2>{tr('Three things to improve')}</h2>
          <ol className="au-advice">{r.advice.map((a) => <li key={a}>{a}</li>)}</ol>
        </section>
      )}

      <div className="au-grid">
        <section className="card au-section">
          <h2>{tr('Colours')}</h2>
          {r.colours.length ? (
            <div className="au-swatches">
              {r.colours.map((c) => {
                const cmp = compare?.colours.find((x) => x.hex === c.hex)
                return (
                  <div key={c.hex} className="au-swatch">
                    <span style={{ background: c.hex, color: readableOn(c.hex) }}>{c.hex.toUpperCase()}</span>
                    {compare && !isGrey(c.hex) && (
                      <small className={cmp?.match ? 'au-ok' : cmp?.close ? 'au-near' : 'au-off'}>
                        {cmp?.match ? tr('Brand: {name}', { name: cmp.match.name }) : cmp?.close ? tr('Near {name}', { name: cmp.close.name }) : tr('Not in the brand')}
                      </small>
                    )}
                  </div>
                )
              })}
            </div>
          ) : <p className="muted">{tr('No colours found in the page’s styles.')}</p>}
          {compare && compare.missing.length > 0 && (
            <p className="muted au-small">{tr('Brand colours not on the site:')} {compare.missing.map((m) => <span key={m.id} className="au-dot" style={{ background: m.hex }} title={m.hex} />)} {compare.missing.map((m) => m.name).join(', ')}</p>
          )}
        </section>

        <section className="card au-section">
          <h2>{tr('Typefaces')}</h2>
          {r.fonts.length ? (
            <ul className="au-fonts">
              {r.fonts.map((f) => {
                const brand = compare?.fonts.find((x) => f.toLowerCase().startsWith(x.name.toLowerCase()))
                return <li key={f}><span>{f}</span>{compare && (brand ? <small className="au-ok"><Check size={12} /> {tr('Brand font')}</small> : <small className="au-off">{tr('Not in the brand')}</small>)}</li>
              })}
            </ul>
          ) : <p className="muted">{tr('Only system fonts (like Arial or Helvetica).')}</p>}
          {compare && compare.fonts.some((f) => !f.used) && <p className="muted au-small">{tr('Brand fonts not on the site:')} {compare.fonts.filter((f) => !f.used).map((f) => f.name).join(', ')}</p>}
        </section>
      </div>

      <section className="card au-section">
        <h2>{tr('The basics')} <small className="muted">{tr('{n} of {total} in order', { n: r.checks.length - failed.length, total: r.checks.length })}</small></h2>
        <ul className="au-checks">
          {[...failed, ...r.checks.filter((c) => c.ok)].map((c) => (
            <li key={c.id} className={c.ok ? 'au-pass' : 'au-fail'}>
              <span className="au-mark">{c.ok ? <Check size={14} /> : <X size={14} />}</span>
              <div>
                <b>{tr(c.label)}</b>
                {c.detail && <small className="muted">{tr(c.detail, c.vars)}</small>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card au-section">
        <h2>{tr('When the link is shared')}</h2>
        <div className="au-share">
          {r.image ? <img src={r.image} alt="" referrerPolicy="no-referrer" /> : <div className="au-share-empty">{tr('No picture')}</div>}
          <div>
            <small className="muted">{host(r.finalUrl)}</small>
            <b>{r.title || host(r.finalUrl)}</b>
            {r.description && <p className="muted">{r.description}</p>}
          </div>
        </div>
      </section>
    </div>
  )
}
