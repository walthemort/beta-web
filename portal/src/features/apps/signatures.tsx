/**
 * Email signatures for the client's team, made from the brand: one layout, one entry per person.
 * The studio sets them up in the brand hub; each person copies their own from the client portal.
 * The HTML is email-safe: a table with inline styles, and fonts with safe fallbacks.
 */
import { useState } from 'react'
import { Check, ClipboardCopy, Plus, Table, Trash2, UserPlus } from 'lucide-react'
import { uid, useStore } from '../../data/store'
import type { Project, SignatureSet } from '../../data/types'
import { useT } from '../../data/i18n'
import { brandOf, type Brand } from '../content/model'
import { parseTable } from '../content/merge'
import { contrast } from '../color'

type Person = SignatureSet['people'][number]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const safeUrl = (u?: string) => (u && /^https:\/\//i.test(u.trim()) ? u.trim() : undefined)
const site = (u?: string) => u?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
const href = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

export const SIGNATURE_LAYOUTS: { id: SignatureSet['layout']; name: string }[] = [
  { id: 'simple', name: 'Simple' },
  { id: 'logo', name: 'With logo' },
  { id: 'bar', name: 'Colour bar' },
]

/** One person's signature as email-safe HTML. */
export function signatureHtml(set: SignatureSet, p: Person, brand: Brand) {
  const font = `'${brand.body}', Helvetica, Arial, sans-serif`
  const head = `'${brand.heading}', Helvetica, Arial, sans-serif`
  const ink = brand.dark
  const accent = contrast(brand.primary, '#ffffff') >= 3 ? brand.primary : brand.dark
  const contact = [
    p.phone && `<a href="tel:${esc(p.phone.replace(/\s+/g, ''))}" style="color:${ink};text-decoration:none">${esc(p.phone)}</a>`,
    p.email && `<a href="mailto:${esc(p.email)}" style="color:${ink};text-decoration:none">${esc(p.email)}</a>`,
    set.website && `<a href="${esc(href(set.website))}" style="color:${accent};text-decoration:none">${esc(site(set.website)!)}</a>`,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ')
  const name = `<div style="font-family:${head};font-size:16px;font-weight:700;color:${ink};line-height:1.3">${esc(p.name)}</div>`
  const title = p.title ? `<div style="font-family:${font};font-size:13px;color:#6b6b66;line-height:1.4">${esc(p.title)}${brand.wordmark ? ` · ${esc(brand.wordmark)}` : ''}</div>` : ''
  const lines = `<div style="font-family:${font};font-size:12px;color:${ink};line-height:1.6;margin-top:6px">${contact}</div>${set.address ? `<div style="font-family:${font};font-size:12px;color:#6b6b66;line-height:1.5">${esc(set.address)}</div>` : ''}`
  const logo = safeUrl(set.logoUrl)
  if (set.layout === 'logo')
    return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>${
      logo
        ? `<td style="padding:0 16px 0 0;vertical-align:middle"><img src="${esc(logo)}" alt="${esc(brand.wordmark)}" height="44" style="display:block;height:44px;width:auto;border:0"></td>`
        : `<td style="padding:0 16px 0 0;vertical-align:middle;font-family:${head};font-size:20px;font-weight:700;color:${accent}">${esc(brand.wordmark)}</td>`
    }<td style="border-left:2px solid ${accent};padding:0 0 0 16px;vertical-align:middle">${name}${title}${lines}</td></tr></table>`
  if (set.layout === 'bar')
    return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td style="padding:0 0 10px">${name}${title}${lines}</td></tr><tr><td style="background:${accent};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>${
      logo ? `<tr><td style="padding:10px 0 0"><img src="${esc(logo)}" alt="${esc(brand.wordmark)}" height="28" style="display:block;height:28px;width:auto;border:0"></td></tr>` : ''
    }</table>`
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td>${name}${title}${lines}<div style="width:40px;height:3px;background:${accent};margin-top:10px;font-size:0;line-height:3px">&nbsp;</div></td></tr></table>`
}

/** The same signature as plain text, for email programs without HTML. */
export const signatureText = (set: SignatureSet, p: Person, brand: Brand) =>
  [p.name, [p.title, brand.wordmark].filter(Boolean).join(' · '), [p.phone, p.email, site(set.website)].filter(Boolean).join(' · '), set.address].filter(Boolean).join('\n')

/** Copies the signature so it pastes with its formatting into Gmail, Outlook or Apple Mail. */
async function copySignature(html: string, text: string) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })])
    return true
  } catch {
    // Older browsers: copy a rendered copy of it.
    const el = document.createElement('div')
    el.innerHTML = html
    el.style.cssText = 'position:fixed;left:-99999px'
    document.body.appendChild(el)
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    const ok = document.execCommand('copy')
    sel?.removeAllRanges()
    el.remove()
    return ok
  }
}

export const emptySet = (): SignatureSet => ({ layout: 'logo', people: [] })

function SignatureCard({ set, person, brand, onRemove }: { set: SignatureSet; person: Person; brand: Brand; onRemove?: () => void }) {
  const tr = useT()
  const [copied, setCopied] = useState(false)
  const html = signatureHtml(set, person, brand)
  return (
    <div className="sig-card">
      <div className="sig-preview" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="sig-actions">
        <button className="btn btn-sm btn-primary" onClick={async () => { if (await copySignature(html, signatureText(set, person, brand))) { setCopied(true); setTimeout(() => setCopied(false), 2000) } }}>
          {copied ? <Check size={14} /> : <ClipboardCopy size={14} />} {copied ? tr('Copied') : tr('Copy signature')}
        </button>
        {onRemove && <button className="btn btn-sm btn-ghost btn-icon" onClick={onRemove} aria-label={tr('Remove')}><Trash2 size={14} /></button>}
      </div>
    </div>
  )
}

function HowTo() {
  const tr = useT()
  return (
    <details className="sig-howto">
      <summary>{tr('How to add it to your email')}</summary>
      <ol>
        <li><b>Gmail:</b> {tr('Settings → See all settings → Signature → Create new, then paste.')}</li>
        <li><b>Outlook:</b> {tr('Settings → Mail → Compose and reply → Email signature, then paste.')}</li>
        <li><b>Apple Mail:</b> {tr('Mail → Settings → Signatures → +, untick “Always match my default font”, then paste.')}</li>
      </ol>
    </details>
  )
}

/** The studio's side, in the brand hub: layout, company details and the people. */
export function SignaturesEditor({ project }: { project: Project }) {
  const tr = useT()
  const { dispatch } = useStore()
  const brand = brandOf(project)
  const set = project.signatures ?? emptySet()
  const [bulk, setBulk] = useState(false)
  const [rows, setRows] = useState('')
  const save = (patch: Partial<SignatureSet>) => dispatch({ type: 'updateProject', id: project.id, patch: { signatures: { ...set, ...patch } } })
  const person = (p: Partial<Person>): Person => ({ id: uid(), name: '', title: '', email: '', ...p })
  const addRows = () => {
    const people = parseTable(rows).filter((r) => r[0] && !/^name$/i.test(r[0])).map(([name, title = '', phone = '', email = '']) => person({ name, title, phone: phone || undefined, email }))
    save({ people: [...set.people, ...people] })
    setRows('')
    setBulk(false)
  }
  const edit = (id: string, patch: Partial<Person>) => save({ people: set.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const sample = set.people[0] ?? person({ name: tr('Your Name'), title: tr('Title'), phone: '+45 12 34 56 78', email: 'name@company.com' })

  return (
    <section className="card panel sig-editor">
      <h3>{tr('Email signatures')}</h3>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>{tr('One signature per person on the team, in the brand. Everyone copies their own from the client portal.')}</p>
      <div className="seg" role="group" aria-label={tr('Layout')}>
        {SIGNATURE_LAYOUTS.map((l) => <button key={l.id} aria-pressed={set.layout === l.id} onClick={() => save({ layout: l.id })}>{tr(l.name)}</button>)}
      </div>
      <SignatureCard set={set} person={sample} brand={brand} />
      <div className="form-row">
        <label className="field"><span className="muted" style={{ fontSize: 12 }}>{tr('Website')}</span><input className="input input-sm" value={set.website ?? ''} onChange={(e) => save({ website: e.target.value || undefined })} placeholder="company.com" /></label>
        <label className="field"><span className="muted" style={{ fontSize: 12 }}>{tr('Address')}</span><input className="input input-sm" value={set.address ?? ''} onChange={(e) => save({ address: e.target.value || undefined })} /></label>
      </div>
      <label className="field">
        <span className="muted" style={{ fontSize: 12 }}>{tr('Logo address (https://…)')}</span>
        <input className="input input-sm" value={set.logoUrl ?? ''} onChange={(e) => save({ logoUrl: e.target.value || undefined })} placeholder="https://company.com/logo.png" />
        <small className="muted">{tr('Email programs only show logos that are online. Use the logo from the client’s website, or leave it empty for the name in the brand font.')}</small>
      </label>

      <h4 style={{ margin: '8px 0 0' }}>{tr('People')} <span className="muted">({set.people.length})</span></h4>
      {set.people.map((p) => (
        <div key={p.id} className="sig-person">
          <input className="input input-sm" value={p.name} onChange={(e) => edit(p.id, { name: e.target.value })} placeholder={tr('Name')} aria-label={tr('Name')} />
          <input className="input input-sm" value={p.title} onChange={(e) => edit(p.id, { title: e.target.value })} placeholder={tr('Title')} aria-label={tr('Title')} />
          <input className="input input-sm" value={p.phone ?? ''} onChange={(e) => edit(p.id, { phone: e.target.value || undefined })} placeholder={tr('Phone')} aria-label={tr('Phone')} />
          <input className="input input-sm" value={p.email} onChange={(e) => edit(p.id, { email: e.target.value })} placeholder={tr('Email')} aria-label={tr('Email')} />
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => save({ people: set.people.filter((x) => x.id !== p.id) })} aria-label={tr('Remove')}><Trash2 size={14} /></button>
        </div>
      ))}
      <div className="cm-actions">
        <button className="btn btn-sm" onClick={() => save({ people: [...set.people, person({})] })}><Plus size={14} /> {tr('Add a person')}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setBulk(!bulk)}><Table size={14} /> {tr('Paste from a spreadsheet')}</button>
      </div>
      {bulk && (
        <div className="field">
          <textarea className="input" rows={4} value={rows} onChange={(e) => setRows(e.target.value)} placeholder={'Anna Holm\tCEO\t+45 12 34 56 78\tanna@company.com'} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
          <small className="muted">{tr('One person per row: name, title, phone, email.')}</small>
          <button className="btn btn-sm btn-primary" style={{ justifySelf: 'start' }} onClick={addRows} disabled={!rows.trim()}>{tr('Add them')}</button>
        </div>
      )}
      {set.people.length > 0 && <small className="muted">{tr('The team finds their signatures under “Email signatures” in the client portal.')}</small>}
      <HowTo />
    </section>
  )
}

/** The client's side: everyone copies their own, or adds themselves. */
export function ClientSignatures({ project }: { project: Project }) {
  const t = useT()
  const { dispatch } = useStore()
  const brand = brandOf(project)
  const set = project.signatures ?? emptySet()
  const [me, setMe] = useState<Person>({ id: '', name: '', title: '', email: '' })
  const add = () => {
    dispatch({ type: 'updateProject', id: project.id, patch: { signatures: { ...set, people: [...set.people, { ...me, id: uid() }] } } })
    setMe({ id: '', name: '', title: '', email: '' })
  }
  return (
    <div className="sig-client">
      <h1 className="cp-h1">{t('Email signatures')}</h1>
      <p className="muted">{t('Find your name, copy your signature and paste it into your email settings.')}</p>
      <HowTo />
      <div className="sig-list">
        {set.people.map((p) => <SignatureCard key={p.id} set={set} person={p} brand={brand} />)}
      </div>
      <section className="card panel">
        <h3><UserPlus size={16} style={{ verticalAlign: -2 }} /> {t('Not on the list? Add yourself')}</h3>
        <div className="form-row">
          <input className="input" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} placeholder={t('Name')} aria-label={t('Name')} />
          <input className="input" value={me.title} onChange={(e) => setMe({ ...me, title: e.target.value })} placeholder={t('Title')} aria-label={t('Title')} />
        </div>
        <div className="form-row">
          <input className="input" value={me.phone ?? ''} onChange={(e) => setMe({ ...me, phone: e.target.value || undefined })} placeholder={t('Phone')} aria-label={t('Phone')} />
          <input className="input" type="email" value={me.email} onChange={(e) => setMe({ ...me, email: e.target.value })} placeholder={t('Email')} aria-label={t('Email')} />
        </div>
        <button className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={!me.name.trim() || !me.email.includes('@')} onClick={add}>{t('Make my signature')}</button>
      </section>
    </div>
  )
}
