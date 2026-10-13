/**
 * Find leads: search the company register in plain words ("håndværkere i Aarhus") or with the
 * filters, then put the ones worth calling on a list for the sales team.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, Download, Globe, Mail, Phone, Search, Users, X } from 'lucide-react'
import { Modal } from '../components/ui'
import { now, uid, useStore } from '../data/store'
import { useT } from '../data/i18n'
import { DEFAULT_LOOKUP, type CompanyHit } from '../data/cvr'
import { parseLeadQuery, TRADES, type LeadFilters } from '../data/leadSearch'
import type { Lead } from '../data/types'

const EXAMPLES = ['håndværkere i Aarhus', 'reklamebureauer i København', 'frisører 8000', 'restauranter i Odense med 5-20 ansatte']
const PAGE = 25
const SIZES = [
  { id: '', label: 'Any size', min: undefined, max: undefined },
  { id: 'solo', label: '1–4 people', min: 1, max: 4 },
  { id: 'small', label: '5–19 people', min: 5, max: 19 },
  { id: 'mid', label: '20–99 people', min: 20, max: 99 },
  { id: 'large', label: '100+ people', min: 100, max: undefined },
]

/** What you typed, refined by whatever you set in the filters – the filters win. */
export function mergeFilters(phrase: string, explicit: Partial<LeadFilters>): LeadFilters {
  const parsed = parseLeadQuery(phrase)
  const trade = explicit.trade !== undefined ? TRADES.find((t) => t.id === explicit.trade) : undefined
  return {
    ...parsed,
    ...(explicit.trade !== undefined
      ? { trade: explicit.trade || undefined, codes: trade?.codes, words: trade ? [trade.label.toLowerCase()] : undefined }
      : {}),
    ...(explicit.city !== undefined ? { city: explicit.city || undefined } : {}),
    ...(explicit.postal !== undefined ? { postal: explicit.postal || undefined } : {}),
    ...(explicit.employeesMin !== undefined || explicit.employeesMax !== undefined
      ? { employeesMin: explicit.employeesMin, employeesMax: explicit.employeesMax }
      : {}),
    ...(explicit.activeOnly !== undefined ? { activeOnly: explicit.activeOnly } : {}),
    ...(explicit.codes !== undefined ? { codes: explicit.codes.length ? explicit.codes : undefined, trade: undefined, words: undefined } : {}),
  }
}

/** Asks our own endpoint with the filters spelled out, so the server doesn't have to guess. */
export async function searchCompanies(base: string, filters: LeadFilters, phrase: string, size: number, from = 0): Promise<CompanyHit[]> {
  const url = new URL(base.replace('{q}', encodeURIComponent(phrase)), location.origin)
  url.searchParams.set('q', phrase || filters.city || '')
  url.searchParams.set('size', String(size))
  if (from) url.searchParams.set('from', String(from))
  if (filters.codes?.length) url.searchParams.set('codes', filters.codes.join(','))
  if (filters.words?.length) url.searchParams.set('words', filters.words.join(','))
  if (filters.city) url.searchParams.set('city', filters.city)
  if (filters.postal) url.searchParams.set('postal', filters.postal)
  if (filters.text) url.searchParams.set('text', filters.text)
  if (filters.employeesMin) url.searchParams.set('employeesMin', String(filters.employeesMin))
  if (filters.employeesMax) url.searchParams.set('employeesMax', String(filters.employeesMax))
  if (filters.activeOnly === false) url.searchParams.set('activeOnly', 'false')
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.headers.get('content-type')?.includes('json')) throw new Error('Company lookup needs the server – it works once Aftryk is hosted.')
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `Search failed (${res.status})`)
  return Array.isArray(body) ? (body as CompanyHit[]) : []
}

/** One row per company, with the name, CVR and contact details a caller needs. */
export function leadsCsv(leads: Lead[]) {
  const head = ['Virksomhed', 'CVR', 'Kontakt', 'E-mail', 'Telefon', 'Adresse', 'Branche', 'Ansatte', 'Status', 'Næste skridt', 'Dato']
  const cell = (v?: string | number) => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ', ')}"`
  const rows = leads.map((l) =>
    [l.company, l.cvr, l.contactName, l.email, l.phone, l.address, l.industry, l.employees, l.stage, l.nextStep, l.nextStepDue].map(cell).join(';'),
  )
  return [head.map(cell).join(';'), ...rows].join('\n')
}

export function downloadCsv(name: string, csv: string) {
  const a = document.createElement('a')
  // The BOM makes Danish letters survive Excel.
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `${name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'leads'}.csv`
  a.click()
}

const key = (h: CompanyHit) => h.cvr ?? h.company
const town = (address?: string) => address?.split('\n')[1]?.replace(/^\d+\s*/, '') ?? ''

type Sort = { by: 'company' | 'industry' | 'employees' | 'town'; dir: 1 | -1 }

/* ---------- The page ---------- */

export function LeadFinderPage() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const [phrase, setPhrase] = useState('')
  const [explicit, setExplicit] = useState<Partial<LeadFilters>>({})
  const [codesText, setCodesText] = useState('')
  const [hits, setHits] = useState<CompanyHit[] | null>(null)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>({ by: 'company', dir: 1 })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ count: number; listId?: string } | null>(null)

  const endpoint = state.studio.cvrLookupUrl?.trim() || DEFAULT_LOOKUP
  const filters = mergeFilters(phrase, explicit)
  const trade = TRADES.find((t) => t.id === filters.trade)
  const knownLeads = new Set(state.leads.map((l) => (l.cvr ?? l.company).toLowerCase()))
  const knownClients = new Set(state.clients.map((c) => (c.cvr ?? c.name).toLowerCase()))

  const rows = useMemo(() => {
    const list = [...(hits ?? [])]
    const val = (h: CompanyHit) =>
      sort.by === 'company' ? h.company : sort.by === 'industry' ? h.industry ?? '' : sort.by === 'town' ? town(h.address) : h.employees ?? ''
    return list.sort((a, b) => val(a).localeCompare(val(b), 'da') * sort.dir)
  }, [hits, sort])
  const chosen = rows.filter((h) => picked[key(h)])

  async function run(from = 0) {
    setBusy(true)
    setError(null)
    setDone(null)
    if (!from) setHits(null)
    try {
      const found = await searchCompanies(endpoint, filters, phrase.trim(), PAGE, from)
      setMore(found.length === PAGE)
      setHits((prev) => (from ? [...(prev ?? []), ...found] : found))
      if (!from)
        setPicked(Object.fromEntries(found.filter((h) => !knownLeads.has(key(h).toLowerCase())).map((h) => [key(h), true])))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function add(listId?: string, listName?: string, assigneeId?: string) {
    if (listId === 'new' && listName) {
      listId = uid()
      dispatch({ type: 'insert', coll: 'leadLists', item: { id: listId, name: listName, query: phrase.trim() || undefined, assigneeId, createdAt: now() } })
    }
    for (const h of chosen)
      dispatch({
        type: 'insert',
        coll: 'leads',
        item: {
          id: uid(), company: h.company, cvr: h.cvr, address: h.address, email: h.email, phone: h.phone, website: h.website,
          industry: h.industry, employees: h.employees, source: 'Company register', stage: 'New',
          listIds: listId ? [listId] : undefined, assigneeId, createdAt: now(), updatedAt: now(),
        },
      })
    setDone({ count: chosen.length, listId })
    setPicked({})
    setSaving(false)
  }

  const sortBy = (by: Sort['by']) => setSort((s) => ({ by, dir: s.by === by && s.dir === 1 ? -1 : 1 }))
  const Arrow = ({ col }: { col: Sort['by'] }) =>
    sort.by === col ? (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null

  return (
    <div className="finder">
      <form
        className="finder-search"
        onSubmit={(e) => {
          e.preventDefault()
          run(0)
        }}
      >
        <div className="finder-input">
          <Search size={18} className="muted" />
          <input
            className="input"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={tr('Who are you looking for? e.g. håndværkere i Aarhus')}
            aria-label={tr('Who are you looking for?')}
            autoFocus
          />
          {phrase && (
            <button type="button" className="btn btn-ghost btn-icon" aria-label={tr('Clear')} onClick={() => setPhrase('')}><X size={16} /></button>
          )}
        </div>
        <button type="submit" className="btn btn-primary finder-go" disabled={busy}>{busy ? tr('Searching…') : tr('Search')}</button>
      </form>

      <div className="finder-filters">
        <label className="field">
          <span>{tr('Trade')}</span>
          <select className="input input-sm" value={explicit.trade ?? filters.trade ?? ''} onChange={(e) => { setExplicit({ ...explicit, trade: e.target.value, codes: undefined }); setCodesText('') }}>
            <option value="">{tr('Any trade')}</option>
            {TRADES.map((t) => <option key={t.id} value={t.id}>{tr(t.label)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{tr('Industry codes')}</span>
          <input
            className="input input-sm"
            value={codesText || (explicit.codes ?? filters.codes ?? []).join(', ')}
            onChange={(e) => {
              setCodesText(e.target.value)
              setExplicit({ ...explicit, codes: [...e.target.value.matchAll(/\d[\d.]*/g)].map((m) => m[0].replace(/\D/g, '')).filter(Boolean), trade: '' })
            }}
            placeholder="4332, 4321"
            title={tr('DB07 codes. A prefix works too: 43 covers all building trades.')}
          />
        </label>
        <label className="field">
          <span>{tr('Town')}</span>
          <input className="input input-sm" value={explicit.city ?? filters.city ?? ''} onChange={(e) => setExplicit({ ...explicit, city: e.target.value })} placeholder={tr('Aarhus')} />
        </label>
        <label className="field">
          <span>{tr('Postcode')}</span>
          <input className="input input-sm" inputMode="numeric" value={explicit.postal ?? filters.postal ?? ''} onChange={(e) => setExplicit({ ...explicit, postal: e.target.value })} placeholder="8000" />
        </label>
        <label className="field">
          <span>{tr('Size')}</span>
          <select
            className="input input-sm"
            value={SIZES.find((s) => s.min === filters.employeesMin && s.max === filters.employeesMax)?.id ?? ''}
            onChange={(e) => {
              const s = SIZES.find((x) => x.id === e.target.value)
              setExplicit({ ...explicit, employeesMin: s?.min, employeesMax: s?.max })
            }}
          >
            {SIZES.map((s) => <option key={s.id} value={s.id}>{tr(s.label)}</option>)}
          </select>
        </label>
        <label className="check-row" style={{ alignSelf: 'end', paddingBottom: 6 }}>
          <input type="checkbox" checked={filters.activeOnly !== false} onChange={(e) => setExplicit({ ...explicit, activeOnly: e.target.checked })} />
          {tr('Only active companies')}
        </label>
        {(explicit.trade || explicit.city || explicit.postal || explicit.employeesMin || explicit.employeesMax || explicit.codes?.length) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setExplicit({}); setCodesText('') }}>{tr('Clear filters')}</button>
        )}
      </div>

      {(phrase.trim() || filters.codes?.length) && !busy && (
        <p className="muted" style={{ fontSize: 13 }}>
          {tr('Looking for')}{' '}
          <b>{trade ? tr(trade.label) : filters.codes?.length ? `${tr('industry')} ${filters.codes.join(', ')}` : filters.text || tr('everything')}</b>
          {filters.city && <> {tr('in')} <b>{filters.city}</b></>}
          {filters.postal && <> · <b>{filters.postal}</b></>}
          {(filters.employeesMin || filters.employeesMax) && <> · {tr('{min}–{max} employees', { min: filters.employeesMin ?? 1, max: filters.employeesMax ?? '∞' })}</>}
        </p>
      )}

      {error && <div className="banner banner-danger" role="alert">{error}</div>}
      {done && (
        <div className="banner" role="status">
          <Check size={16} />
          <span>{done.count === 1 ? tr('1 lead added') : tr('{n} leads added', { n: done.count })}</span>
          <Link className="btn btn-sm" to="/app/sales">{tr('Go to the pipeline')}</Link>
        </div>
      )}

      {!hits && !busy && (
        <div className="finder-empty">
          <h2>{tr('Find the companies you’d like to work with')}</h2>
          <p className="muted">{tr('Search the Danish company register by trade, town and size. Pick the good ones and they become leads – with CVR, address and phone already filled in.')}</p>
          <div className="lf-examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => { setPhrase(ex); setExplicit({}); setCodesText('') }}>{ex}</button>
            ))}
          </div>
        </div>
      )}

      {hits && hits.length === 0 && !busy && (
        <div className="empty"><p>{tr('Nothing found. Try a broader word, or a different town.')}</p></div>
      )}

      {rows.length > 0 && (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table finder-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label={tr('Select all')}
                      checked={chosen.length === rows.length && rows.length > 0}
                      onChange={(e) => setPicked(e.target.checked ? Object.fromEntries(rows.map((h) => [key(h), true])) : {})}
                    />
                  </th>
                  <th><button className="link-btn" onClick={() => sortBy('company')}>{tr('Company')} <Arrow col="company" /></button></th>
                  <th><button className="link-btn" onClick={() => sortBy('industry')}>{tr('Industry')} <Arrow col="industry" /></button></th>
                  <th><button className="link-btn" onClick={() => sortBy('employees')}>{tr('Size')} <Arrow col="employees" /></button></th>
                  <th><button className="link-btn" onClick={() => sortBy('town')}>{tr('Town')} <Arrow col="town" /></button></th>
                  <th>{tr('Contact')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const k = key(h)
                  const isLead = knownLeads.has(k.toLowerCase())
                  const isClient = knownClients.has(k.toLowerCase())
                  return (
                    <tr key={k} className={isLead || isClient ? 'known' : undefined} onClick={() => setPicked({ ...picked, [k]: !picked[k] })}>
                      <td><input type="checkbox" checked={!!picked[k]} onChange={(e) => setPicked({ ...picked, [k]: e.target.checked })} aria-label={h.company} onClick={(e) => e.stopPropagation()} /></td>
                      <td className="wide">
                        <span className="cell-title">
                          <b style={{ fontWeight: 500 }}>{h.company}</b>
                          <small>
                            {h.cvr ? `CVR ${h.cvr}` : ''}
                            {isClient && ` · ${tr('already a client')}`}
                            {!isClient && isLead && ` · ${tr('already a lead')}`}
                            {h.active === false && ` · ${tr('closed')}`}
                          </small>
                        </span>
                      </td>
                      <td data-label={tr('Industry')}>
                        <span className="cell-title"><span>{h.industry ?? '—'}</span>{h.industryCode && <small>{h.industryCode}</small>}</span>
                      </td>
                      <td data-label={tr('Size')}>{h.employees ?? '—'}</td>
                      <td data-label={tr('Town')}>{town(h.address) || '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <span className="finder-contact">
                          {h.phone && <a href={`tel:${h.phone.replace(/\s/g, '')}`} title={h.phone}><Phone size={14} /></a>}
                          {h.email && <a href={`mailto:${h.email}`} title={h.email}><Mail size={14} /></a>}
                          {h.website && <a href={h.website.startsWith('http') ? h.website : `https://${h.website}`} target="_blank" rel="noreferrer" title={h.website}><Globe size={14} /></a>}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {more && (
            <button className="btn" style={{ justifySelf: 'center' }} disabled={busy} onClick={() => run(rows.length)}>
              {busy ? tr('Searching…') : tr('Show more')}
            </button>
          )}
        </>
      )}

      {chosen.length > 0 && (
        <div className="finder-bar">
          <span>{tr('{n} selected', { n: chosen.length })}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setPicked({})}>{tr('Clear')}</button>
          <span className="grow" />
          <button className="btn btn-sm" onClick={() => downloadCsv(phrase || 'leads', leadsCsv(chosen.map((h) => ({ ...h, id: '', source: 'Company register', stage: 'New', createdAt: '', updatedAt: '' }) as Lead)))}>
            <Download size={15} /> {tr('Download CSV')}
          </button>
          <button className="btn btn-sm" onClick={() => add()}>{tr('Add as leads')}</button>
          <button className="btn btn-sm btn-primary" onClick={() => setSaving(true)}><Users size={15} /> {tr('Add to list')}</button>
        </div>
      )}

      {saving && <SaveToList count={chosen.length} phrase={phrase} onClose={() => setSaving(false)} onSave={add} />}
    </div>
  )
}

/* ---------- Choosing which list they go on ---------- */

function SaveToList({ count, phrase, onClose, onSave }: { count: number; phrase: string; onClose: () => void; onSave: (listId?: string, name?: string, assigneeId?: string) => void }) {
  const tr = useT()
  const { state } = useStore()
  const [listId, setListId] = useState(state.leadLists.length ? state.leadLists[0].id : 'new')
  const [name, setName] = useState(phrase.trim())
  const [assignee, setAssignee] = useState('')

  return (
    <Modal title={count === 1 ? tr('Add 1 lead to a list') : tr('Add {n} leads to a list', { n: count })} onClose={onClose}>
      <div className="form">
        <div className="field">
          <label htmlFor="sl-list">{tr('List')}</label>
          <select id="sl-list" className="input" value={listId} onChange={(e) => setListId(e.target.value)}>
            {state.leadLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            <option value="new">{tr('New list…')}</option>
          </select>
        </div>
        {listId === 'new' && (
          <div className="field">
            <label htmlFor="sl-name">{tr('List name')}</label>
            <input id="sl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('e.g. Craftsmen in Aarhus')} autoFocus />
          </div>
        )}
        <div className="field">
          <label htmlFor="sl-who">{tr('Who calls them?')}</label>
          <select id="sl-who" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{tr('Nobody yet')}</option>
            {state.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={listId === 'new' && !name.trim()}
            onClick={() => onSave(listId, name.trim(), assignee || undefined)}
          >
            {tr('Add to list')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
