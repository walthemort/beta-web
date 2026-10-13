import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Code2, Download, FileDown, Lock, Package, Plus, Printer, X } from 'lucide-react'
import { AutoText, CopyLink } from '../components/kit'
import { download, formatSize, isImage, useSrc } from '../data/blobs'
import { formatDate, now, uid, useStore } from '../data/store'
import { COLOUR_ROLES, type BrandHub, type ColourRole, type Project, type StudioFile, type Theme } from '../data/types'
import { clientUrl } from './proposals'
import { Palette, orderedColours } from './palette'
import { LogoTools } from './logoTools'
import { Mockups } from './mockups'
import { aseFile, cssVariables, designTokens, downloadBrandKit, saveBlob, saveText, tailwindConfig } from './brandExport'
import { HubChangelog, HubVersions, LogoRulesView, MoodboardView, ToneView, TypeScaleView, sha256, typeSteps } from './hubExtras'
import { HostingPanel } from './hosting'
import { useLogoTone } from './logoTone'
import { SignaturesEditor } from './apps/signatures'
import { useT } from '../data/i18n'
import './brand.css'

/** A list of short strings edited one per line. */
function LinesInput({ value, onChange, placeholder, rows = 4, label }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; rows?: number; label: string }) {
  const [text, setText] = useState(value.join('\n'))
  return (
    <textarea
      className="input"
      rows={rows}
      value={text}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split('\n').map((l) => l.trim()).filter(Boolean))}
    />
  )
}

/* ---------- Studio editor ---------- */

export function HubEditor({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const hub = project.hub
  const logos = state.files.filter((f) => f.projectId === project.id && f.category === 'Logos')
  const mood = state.files.filter((f) => f.projectId === project.id && f.category === 'Moodboard')
  const setHub = (patch: Partial<BrandHub>) => dispatch({ type: 'updateProject', id: project.id, patch: { hub: { ...hub, ...patch, updatedAt: now() } } })
  const r = hub.logoRules
  const t = hub.tone

  return (
    <div className="split split-aside">
      <div style={{ display: 'grid', gap: 24 }}>
        <section className="card panel">
          <div className="section-head" style={{ margin: 0 }}>
            <h3>{tr('Logos')}</h3>
            <Link to={`/app/projects/${project.id}/files`} className="link-arrow">{tr('Manage in Files')} <ArrowUpRight size={14} /></Link>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>{tr('Files in the “Logos” category that you publish appear in the hub. Approving a logo publishes it automatically.')}</p>
          {logos.length === 0 ? (
            <p className="muted">{tr('No logo files yet.')}</p>
          ) : (
            <div className="list">
              {logos.map((f) => (
                <div key={f.id} className="list-item">
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, cursor: 'pointer', minWidth: 0 }}>
                    <input type="checkbox" checked={f.published} onChange={() => dispatch({ type: 'update', coll: 'files', id: f.id, fn: (x) => ({ ...x, published: !x.published }) })} style={{ accentColor: 'var(--blue)', width: 17, height: 17 }} />
                    <span className="grow"><span>{f.name}</span><small>{f.published ? tr('In the hub') : tr('Hidden')} · {f.status}</small></span>
                  </label>
                  <select
                    className="input input-sm"
                    style={{ width: 'auto' }}
                    value={f.previewBg ?? 'auto'}
                    aria-label={tr('Background behind {name}', { name: f.name })}
                    onChange={(e) => dispatch({ type: 'update', coll: 'files', id: f.id, fn: (x) => ({ ...x, previewBg: e.target.value as StudioFile['previewBg'] }) })}
                  >
                    <option value="auto">{tr('Background: automatic')}</option>
                    <option value="light">{tr('On light')}</option>
                    <option value="dark">{tr('On dark')}</option>
                    <option value="brand">{tr('On brand colour')}</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>

        <LogoTools project={project} />

        <section className="card panel form">
          <h3>{tr('Logo rules')}</h3>
          <div className="form-row">
            <div className="field">
              <label>{tr('Clear space (× logo height)')}</label>
              <input className="input input-sm" type="number" step="0.25" min="0" value={r.clearSpace} onChange={(e) => setHub({ logoRules: { ...r, clearSpace: Number(e.target.value) } })} />
            </div>
            <div className="field">
              <label>{tr('Minimum width')}</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="input input-sm" type="number" min="0" style={{ width: 70 }} value={r.minWidthPx} onChange={(e) => setHub({ logoRules: { ...r, minWidthPx: Number(e.target.value) } })} aria-label={tr('Minimum width in pixels')} /> {tr('px')}
                <input className="input input-sm" type="number" min="0" style={{ width: 60 }} value={r.minWidthMm} onChange={(e) => setHub({ logoRules: { ...r, minWidthMm: Number(e.target.value) } })} aria-label={tr('Minimum width in mm')} /> {tr('mm')}
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label>{tr('Do')} <span className="muted">{tr('(one per line)')}</span></label><LinesInput label={tr('Do')} value={r.dos} onChange={(dos) => setHub({ logoRules: { ...r, dos } })} /></div>
            <div className="field"><label>{tr('Don’t')} <span className="muted">{tr('(one per line)')}</span></label><LinesInput label={tr('Don\'t')} value={r.donts} onChange={(donts) => setHub({ logoRules: { ...r, donts } })} /></div>
          </div>
          <small className="muted">{tr('The hub also shows visual “don’t” examples made from the wordmark automatically.')}</small>
        </section>

        <section className="card panel">
          <h3>{tr('Colours')}</h3>
          {hub.colours.map((c) => (
            <div key={c.id} className="colour-edit">
              <input type="color" value={c.hex} aria-label={tr('{name} colour', { name: c.name })} onChange={(e) => setHub({ colours: hub.colours.map((x) => (x.id === c.id ? { ...x, hex: e.target.value } : x)) })} style={{ width: 44, height: 38, border: '1px solid var(--line)', borderRadius: 8, padding: 2, background: 'var(--surface)' }} />
              <input className="input" style={{ height: 38, flex: '1 1 140px', width: 'auto' }} value={c.name} aria-label={tr('Colour name')} onChange={(e) => setHub({ colours: hub.colours.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) })} />
              <input className="input" style={{ height: 38, width: 100, fontFamily: 'var(--mono)', fontSize: 13 }} value={c.hex} aria-label={tr('Hex value')} onChange={(e) => setHub({ colours: hub.colours.map((x) => (x.id === c.id ? { ...x, hex: e.target.value } : x)) })} />
              <select className="input" style={{ height: 38, width: 120 }} value={c.role ?? ''} aria-label={tr('Role of {name}', { name: c.name })} onChange={(e) => setHub({ colours: hub.colours.map((x) => (x.id === c.id ? { ...x, role: (e.target.value || undefined) as ColourRole | undefined } : x)) })}>
                <option value="">{tr('No role')}</option>
                {COLOUR_ROLES.map((role) => <option key={role} value={role}>{tr(role)}</option>)}
              </select>
              <label className="usage" title={tr('How much this colour is used')}>
                <input type="number" min="0" max="100" className="input" style={{ height: 38, width: 64 }} value={c.usage ?? ''} placeholder="–" aria-label={tr('Usage of {name} in percent', { name: c.name })} onChange={(e) => setHub({ colours: hub.colours.map((x) => (x.id === c.id ? { ...x, usage: e.target.value === '' ? undefined : Number(e.target.value) } : x)) })} />
                %
              </label>
              <button className="btn btn-ghost btn-icon" aria-label={tr('Remove {name}', { name: c.name })} onClick={() => setHub({ colours: hub.colours.filter((x) => x.id !== c.id) })}><X size={15} /></button>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={() => setHub({ colours: [...hub.colours, { id: uid(), name: 'New colour', hex: '#1a4dff' }] })}>
            <Plus size={15} /> {tr('Add colour')}
          </button>
          <p className="muted" style={{ fontSize: 12 }}>
            {tr('Role and usage shape the palette strip, the pairings and the mockups. A classic split is 60% primary, 30% neutral, 10% accent.')}
            {(() => {
              const total = hub.colours.reduce((s, c) => s + (c.usage ?? 0), 0)
              return total > 0 && total !== 100 ? ` Your usage adds up to ${total}% — it will be scaled to 100%.` : ''
            })()}
          </p>
        </section>

        <section className="card panel">
          <h3>{tr('Typography')}</h3>
          {hub.fonts.map((f) => (
            <div key={f.id} style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ height: 38 }} value={f.name} aria-label={tr('Font name')} onChange={(e) => setHub({ fonts: hub.fonts.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)) })} />
              <input className="input" style={{ height: 38 }} value={f.usage} placeholder={tr('Headlines, body, labels…')} aria-label={tr('Font usage')} onChange={(e) => setHub({ fonts: hub.fonts.map((x) => (x.id === f.id ? { ...x, usage: e.target.value } : x)) })} />
              <button className="btn btn-ghost btn-icon" aria-label={tr('Remove {name}', { name: f.name })} onClick={() => setHub({ fonts: hub.fonts.filter((x) => x.id !== f.id) })}><X size={15} /></button>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={() => setHub({ fonts: [...hub.fonts, { id: uid(), name: 'Inter Tight', usage: '' }] })}>
            <Plus size={15} /> {tr('Add font')}
          </button>
          <div className="form-row">
            <div className="field">
              <label>{tr('Base size (px)')}</label>
              <input className="input input-sm" type="number" min="10" max="24" value={hub.typeScale.base} onChange={(e) => setHub({ typeScale: { ...hub.typeScale, base: Number(e.target.value) } })} />
            </div>
            <div className="field">
              <label>{tr('Scale')}</label>
              <select className="input input-sm" value={hub.typeScale.ratio} onChange={(e) => setHub({ typeScale: { ...hub.typeScale, ratio: Number(e.target.value) } })}>
                {[[1.125, 'Major second (1.125)'], [1.2, 'Minor third (1.2)'], [1.25, 'Major third (1.25)'], [1.333, 'Perfect fourth (1.333)'], [1.414, 'Augmented fourth (1.414)'], [1.5, 'Perfect fifth (1.5)']].map(([v, l]) => (
                  <option key={v} value={v}>{tr(String(l))}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>{tr('Sizes:')} {typeSteps(hub).map((s) => `${s.name} ${s.px}px`).join(' · ')}{tr('. Use “Headlines” / “Body” in the font usage to pick which font goes where.')}</p>
        </section>

        <section className="card panel form">
          <h3>{tr('Tone of voice')}</h3>
          <div className="field"><label>{tr('In a sentence or two')}</label><AutoText value={t.summary} placeholder={tr('How the brand speaks…')} onChange={(e) => setHub({ tone: { ...t, summary: e.target.value } })} /></div>
          <div className="form-row">
            <div className="field"><label>{tr('We are')} <span className="muted">{tr('(one per line)')}</span></label><LinesInput label={tr('We are')} rows={3} value={t.weAre} onChange={(weAre) => setHub({ tone: { ...t, weAre } })} /></div>
            <div className="field"><label>{tr('We are not')}</label><LinesInput label={tr('We are not')} rows={3} value={t.weAreNot} onChange={(weAreNot) => setHub({ tone: { ...t, weAreNot } })} /></div>
          </div>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>{tr('Say this / not that')}</label>
          {t.examples.map((ex) => (
            <div key={ex.id} className="colour-edit">
              <input className="input input-sm" style={{ flex: '1 1 180px' }} value={ex.say} placeholder={tr('Say…')} onChange={(e) => setHub({ tone: { ...t, examples: t.examples.map((x) => (x.id === ex.id ? { ...x, say: e.target.value } : x)) } })} aria-label={tr('Say')} />
              <input className="input input-sm" style={{ flex: '1 1 180px' }} value={ex.dontSay} placeholder={tr('Not…')} onChange={(e) => setHub({ tone: { ...t, examples: t.examples.map((x) => (x.id === ex.id ? { ...x, dontSay: e.target.value } : x)) } })} aria-label={tr('Don\'t say')} />
              <button className="btn btn-ghost btn-icon" aria-label={tr('Remove example')} onClick={() => setHub({ tone: { ...t, examples: t.examples.filter((x) => x.id !== ex.id) } })}><X size={14} /></button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => setHub({ tone: { ...t, examples: [...t.examples, { id: uid(), say: '', dontSay: '' }] } })}><Plus size={14} /> {tr('Add example')}</button>
        </section>

        <section className="card panel form">
          <div className="section-head" style={{ margin: 0 }}>
            <h3>{tr('Imagery')}</h3>
            <Link to={`/app/projects/${project.id}/files`} className="link-arrow">{tr('Upload moodboard images')} <ArrowUpRight size={14} /></Link>
          </div>
          <AutoText value={hub.imagery} placeholder={tr('Photo direction: light, subjects, colour, what to avoid…')} onChange={(e) => setHub({ imagery: e.target.value })} aria-label={tr('Photo direction')} />
          <p className="muted" style={{ fontSize: 12 }}>{mood.filter((f) => f.published).length} {tr('published images in the “Moodboard” category.')}</p>
        </section>
        <SignaturesEditor project={project} />
      </div>
      <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 72, alignContent: 'start' }}>
        <section className="card panel">
          <h3>{tr('Share the hub')}</h3>
          <CopyLink url={clientUrl(`/p/${project.id}/hub`)} label={tr('Copy hub link')} />
          <Link className="btn" to={`/p/${project.id}/hub`} target="_blank">{tr('Preview')} <ArrowUpRight size={15} /></Link>
          <EmbedSnippet project={project} />
          <label className="field" style={{ marginTop: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>{tr('Look')}</span>
            <select className="input input-sm" value={hub.theme ?? 'auto'} onChange={(e) => setHub({ theme: e.target.value as Theme })}>
              <option value="auto">{tr('Like the rest of your portal')}</option>
              <option value="light">{tr('Always light')}</option>
              <option value="dark">{tr('Always dark')}</option>
            </select>
          </label>
        </section>
        <HostingPanel project={project} />
        <HubDownloads project={project} />
        <HubAccess project={project} />
        <HubVersions project={project} />
      </aside>
    </div>
  )
}

function EmbedSnippet({ project }: { project: Project }) {
  const tr = useT()
  const [open, setOpen] = useState(false)
  const code = `<iframe src="${clientUrl(`/embed/hub/${project.id}`)}" width="100%" height="900" style="border:0;border-radius:12px" title="Brand hub"></iframe>`
  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(!open)}><Code2 size={15} /> {tr('Embed code')}</button>
      {open && (
        <div className="field">
          <textarea className="input" readOnly rows={4} value={code} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: 'var(--mono)', fontSize: 11 }} />
          <small>{tr('Paste into the client’s intranet, Notion (/embed) or website.')}</small>
        </div>
      )}
    </>
  )
}

/* ---------- Downloads: ZIP (#7), PDF (#6), colour files (#9) ---------- */

export function HubDownloads({ project, compact }: { project: Project; compact?: boolean }) {
  const { state } = useStore()
  const [busy, setBusy] = useState(false)
  const colours = orderedColours(project.hub.colours)
  const name = (state.clients.find((c) => c.id === project.clientId)?.name ?? project.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const t = useT()
  return (
    <section className={compact ? 'hub-dl' : 'card panel'}>
      {!compact && <h3>{t('Downloads')}</h3>}
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await downloadBrandKit(state, project)
          } finally {
            setBusy(false)
          }
        }}
      >
        <Package size={15} /> {busy ? '…' : t('Brand kit (.zip)')}
      </button>
      <Link className="btn" to={`/print/hub/${project.id}`} target="_blank"><Printer size={15} /> {t('Guidelines (PDF)')}</Link>
      {colours.length > 0 && (
        <details className="dl-more">
          <summary><FileDown size={14} /> {t('Colour files')}</summary>
          <button className="link-btn" onClick={() => saveBlob(aseFile(colours, name), `${name}-colours.ase`)}>{t('Adobe swatches (.ase)')}</button>
          <button className="link-btn" onClick={() => saveText(cssVariables(colours), 'colours.css', 'text/css')}>{t('CSS variables')}</button>
          <button className="link-btn" onClick={() => saveText(tailwindConfig(colours), 'tailwind.config.js', 'text/javascript')}>{t('Tailwind config')}</button>
          <button className="link-btn" onClick={() => saveText(designTokens(project), 'design-tokens.json', 'application/json')}>{t('Design tokens (Figma)')}</button>
        </details>
      )}
    </section>
  )
}

/* ---------- Password & expiry (#13) ---------- */

function HubAccess({ project }: { project: Project }) {
  const tr = useT()
  const { dispatch } = useStore()
  const access = project.hub.access
  const [pw, setPw] = useState('')
  const set = (patch: Partial<BrandHub['access']>) => dispatch({ type: 'updateProject', id: project.id, patch: { hub: { ...project.hub, access: { ...access, ...patch } } } })
  return (
    <section className="card panel">
      <h3><Lock size={14} style={{ verticalAlign: -2 }} /> {tr('Protection')}</h3>
      {access.passwordHash ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="pill pill-green">{tr('Password on')}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => set({ passwordHash: undefined })}>{tr('Remove')}</button>
        </div>
      ) : (
        <form
          style={{ display: 'flex', gap: 6 }}
          onSubmit={async (e) => {
            e.preventDefault()
            if (pw.trim()) set({ passwordHash: await sha256(pw.trim()) })
            setPw('')
          }}
        >
          <input className="input input-sm" type="text" placeholder={tr('Set a password')} value={pw} onChange={(e) => setPw(e.target.value)} aria-label={tr('Hub password')} style={{ flex: 1 }} />
          <button className="btn btn-sm" type="submit" disabled={!pw.trim()}>{tr('Set')}</button>
        </form>
      )}
      <label className="muted" style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        {tr('Link expires')}
        <input type="date" className="input input-sm" value={access.expiresAt ?? ''} onChange={(e) => set({ expiresAt: e.target.value || undefined })} />
      </label>
      <p className="muted" style={{ fontSize: 11 }}>{tr('Keeps casual visitors out. Real protection arrives with login and a server.')}</p>
    </section>
  )
}

/* ---------- Client-facing hub ---------- */

/** The tile behind a logo: chosen per logo, or worked out from how light the logo is. */
export function useLogoBackground(file: StudioFile, project: Project, url?: string | null) {
  const tone = useLogoTone(url)
  const brand = orderedColours(project.hub.colours).find((c) => c.role === 'Primary') ?? project.hub.colours[0]
  const pick = file.previewBg ?? 'auto'
  if (pick === 'light') return '#faf9f6'
  if (pick === 'dark') return '#111110'
  if (pick === 'brand' && brand) return brand.hex
  return tone === 'light' ? '#111110' : tone === 'dark' ? '#faf9f6' : undefined
}

/** A logo in the hub. The whole card is the download button – no hunting for a small icon. */
function LogoCard({ file, project }: { file: StudioFile; project: Project }) {
  const tr = useT()
  const v = file.versions.at(-1)!
  const url = useSrc(v.src)
  const bg = useLogoBackground(file, project, isImage(v.mime) ? url : undefined)
  const format = v.mime.split('/')[1]?.toUpperCase().replace('SVG+XML', 'SVG') ?? ''
  return (
    <button type="button" className="card logo-card" onClick={() => download(v.src, file.name)} title={tr('Download {name}', { name: file.name })}>
      <span className="logo-preview" style={bg ? { background: bg } : undefined}>
        {isImage(v.mime) && url ? <img src={url} alt="" /> : <span className="muted">{file.name}</span>}
        <span className="logo-dl-hint" aria-hidden="true"><Download size={14} /> {tr('Download {format}', { format })}</span>
      </span>
      <span className="list-item logo-card-foot">
        <span className="grow"><span style={{ overflowWrap: 'anywhere' }}>{file.name}</span><small>{format} · {formatSize(v.size)}</small></span>
        <Download size={16} aria-hidden="true" />
      </span>
    </button>
  )
}

const HUB_SECTIONS = [
  ['logos', 'Logos'],
  ['rules', 'Logo rules'],
  ['colour', 'Colour'],
  ['type', 'Typography'],
  ['tone', 'Tone of voice'],
  ['imagery', 'Imagery'],
  ['in-use', 'In use'],
] as const

/** Read-only brand hub (client portal, embed). */
export function HubView({ project }: { project: Project }) {
  const { state } = useStore()
  const logos = state.files.filter((f) => f.projectId === project.id && f.category === 'Logos' && f.published)
  const others = state.files.filter((f) => f.projectId === project.id && !['Logos', 'Moodboard', 'From client'].includes(f.category) && f.published)
  const { colours, fonts, updatedAt } = project.hub
  const families = fonts.map((f) => `family=${encodeURIComponent(f.name)}`).join('&')
  const t = useT()

  return (
    <div style={{ display: 'grid', gap: 56 }}>
      {families && <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${families}&display=swap`} />}
      <div className="hub-bar">
        <span className="muted">{t('Updated')} {formatDate(updatedAt)}</span>
        <HubDownloads project={project} compact />
      </div>
      <HubChangelog project={project} />
      <nav className="hub-toc" aria-label={t('Brand hub sections')}>
        {HUB_SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{t(label)}</a>)}
      </nav>

      <section id="logos">
        <div className="section-head"><h2>{t('Logos')}</h2></div>
        {logos.length ? <div className="grid-cards">{logos.map((f) => <LogoCard key={f.id} file={f} project={project} />)}</div> : <p className="muted">{t('Logos will appear here once the studio publishes them.')}</p>}
      </section>

      <section id="rules">
        <div className="section-head"><h2>{t('Logo rules')}</h2></div>
        <LogoRulesView project={project} />
      </section>

      <section id="colour">
        <div className="section-head"><h2>{t('Colour')}</h2></div>
        <Palette project={project} />
      </section>

      <section id="type">
        <div className="section-head"><h2>{t('Typography')}</h2></div>
        {fonts.length ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="grid-cards">
              {fonts.map((f) => (
                <div key={f.id} className="card panel">
                  <span style={{ fontFamily: `'${f.name}', var(--sans)`, fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{t('Aa Bb Cc')}</span>
                  <span className="cell-title"><b style={{ fontWeight: 500 }}>{f.name}</b><small>{f.usage}</small></span>
                </div>
              ))}
            </div>
            <TypeScaleView project={project} />
          </div>
        ) : (
          <p className="muted">{t('Typography will appear here once the studio publishes it.')}</p>
        )}
      </section>

      <section id="tone">
        <div className="section-head"><h2>{t('Tone of voice')}</h2></div>
        <ToneView project={project} />
      </section>

      <section id="imagery">
        <div className="section-head"><h2>{t('Imagery')}</h2></div>
        <MoodboardView project={project} />
      </section>

      {(colours.length > 0 || fonts.length > 0) && (
        <section id="in-use">
          <div className="section-head"><h2>{t('In use')}</h2></div>
          <Mockups project={project} />
        </section>
      )}

      {others.length > 0 && (
        <section>
          <div className="section-head"><h2>{t('Other files')}</h2></div>
          <div className="card">
            {others.map((f) => (
              <div key={f.id} className="file-row">
                <span className="cell-title" style={{ flex: 1 }}><span>{f.name}</span><small>{f.category} · {formatSize(f.versions.at(-1)!.size)}</small></span>
                <button className="btn btn-sm" onClick={() => download(f.versions.at(-1)!.src, f.name)}><Download size={14} /> {t('Download')}</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
