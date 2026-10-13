/**
 * Presenter: a client's brand as Office files – slide layouts for PowerPoint (Keynote and Google
 * Slides open them too) and a Word letterhead. Built in the browser from the brand hub.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { Download, FileText, Loader2, Presentation } from 'lucide-react'
import { useStore } from '../../../data/store'
import { useLang, useT } from '../../../data/i18n'
import { AppGate } from '../../../app/Apps'
import { brandOf, type Brand } from '../../content/model'
import { LogoPngs, type LogoPng } from '../logoPng'
import { LAYOUTS, SLIDE, buildDocx, buildPptx, contactLine, fitLogo, palette, type Letterhead, type SlideLayout, type TextBox } from './office'
import '../../content/content.css'

const save = (blob: Blob, name: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
const fileName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Brand'

export default function PresenterPage() {
  return <AppGate id="presenter"><Presenter /></AppGate>
}

function Presenter() {
  const tr = useT()
  const { lang } = useLang()
  const { state, dispatch } = useStore()
  const projects = state.projects.filter((p) => !p.archived)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const project = projects.find((p) => p.id === projectId)
  const [view, setView] = useState<'slides' | 'letterhead'>('slides')
  const [examples, setExamples] = useState(true)
  const [logos, setLogos] = useState<{ projectId: string; set: Record<string, LogoPng | undefined> } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const brand = useMemo(() => (project ? brandOf(project) : null), [project])

  if (!project || !brand) {
    return (
      <>
        <Head />
        <div className="empty"><p>{tr('Add a client project with a brand hub first – Presenter builds on its colours, fonts and logo.')}</p></div>
      </>
    )
  }
  const client = state.clients.find((c) => c.id === project.clientId)
  const letterhead: Letterhead = {
    company: project.letterhead?.company ?? client?.name ?? project.name,
    address: project.letterhead?.address ?? project.signatures?.address ?? client?.address,
    phone: project.letterhead?.phone,
    email: project.letterhead?.email ?? client?.contactEmail,
    website: project.letterhead?.website ?? project.signatures?.website,
    vat: project.letterhead?.vat ?? (client?.cvr ? `CVR ${client.cvr}` : undefined),
  }
  const setLetterhead = (patch: Partial<Letterhead>) => dispatch({ type: 'updateProject', id: project.id, patch: { letterhead: { ...project.letterhead, ...letterhead, ...patch } } })
  const bgs = [...new Set([...LAYOUTS.map((l) => palette(brand, l.bg).bg), '#ffffff'])]
  const ready = logos?.projectId === project.id ? logos.set : null

  async function run(kind: 'pptx' | 'docx') {
    if (!project || !brand || !ready) return
    setBusy(kind)
    setError(null)
    try {
      const name = fileName(client?.name ?? project.name)
      if (kind === 'pptx') save(await buildPptx({ brand, name, logos: ready, examples, tr }), `${name} – ${tr('slides')}.pptx`)
      else save(await buildDocx({ brand, letterhead, logo: ready['#ffffff'], tr, lang }), `${name} – ${tr('letterhead')}.docx`)
      dispatch({ type: 'log', log: { text: kind === 'pptx' ? `Slide template made for ${project.name}` : `Letterhead made for ${project.name}`, projectId: project.id } })
    } catch (e) {
      console.error(e)
      setError(tr('The file couldn’t be made – try again'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Head />
      <div className="pr-bar">
        <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={tr('Client')}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="seg" role="group">
          <button aria-pressed={view === 'slides'} onClick={() => setView('slides')}><Presentation size={14} /> {tr('Slides')}</button>
          <button aria-pressed={view === 'letterhead'} onClick={() => setView('letterhead')}><FileText size={14} /> {tr('Letterhead')}</button>
        </div>
        <span style={{ flex: 1 }} />
        {view === 'slides' ? (
          <>
            <label className="cm-toggle-row"><input type="checkbox" checked={examples} onChange={(e) => setExamples(e.target.checked)} /> <span>{tr('With example slides')}</span></label>
            <button className="btn btn-primary" disabled={!ready || !!busy} onClick={() => run('pptx')}>{busy === 'pptx' || !ready ? <Loader2 size={15} className="spin" /> : <Download size={15} />} {tr('Download PowerPoint')}</button>
          </>
        ) : (
          <button className="btn btn-primary" disabled={!ready || !!busy} onClick={() => run('docx')}>{busy === 'docx' || !ready ? <Loader2 size={15} className="spin" /> : <Download size={15} />} {tr('Download Word')}</button>
        )}
      </div>
      {error && <div className="cm-note" role="alert">{error}</div>}

      {view === 'slides' ? (
        <>
          <div className="pr-slides">
            {LAYOUTS.map((l) => (
              <figure key={l.id}>
                <SlidePreview layout={l} brand={brand} logos={ready} />
                <figcaption>{tr(l.name)}</figcaption>
              </figure>
            ))}
          </div>
          <div className="pr-notes muted">
            <p>{tr('Every layout is a slide master, so new slides come out on the brand: in PowerPoint and Keynote pick a layout under New slide.')}</p>
            <p>{tr('Google Slides: upload the file to Google Drive and open it with Google Slides – or File → Import slides in an existing presentation.')}</p>
            <p>{tr('The fonts are {heading} and {body}. Whoever makes slides needs them installed – otherwise PowerPoint uses a stand-in.', { heading: brand.heading, body: brand.body })}</p>
          </div>
        </>
      ) : (
        <div className="pr-letter">
          <LetterPreview brand={brand} letterhead={letterhead} logo={ready?.['#ffffff']} />
          <form className="card form pr-letter-form" onSubmit={(e) => e.preventDefault()}>
            <h3>{tr('On the letterhead')}</h3>
            <label>{tr('Company name')}<input className="input" value={letterhead.company} onChange={(e) => setLetterhead({ company: e.target.value })} /></label>
            <label>{tr('Address')}<input className="input" value={letterhead.address ?? ''} onChange={(e) => setLetterhead({ address: e.target.value })} /></label>
            <div className="form-row">
              <label>{tr('Phone')}<input className="input" value={letterhead.phone ?? ''} onChange={(e) => setLetterhead({ phone: e.target.value })} /></label>
              <label>{tr('Email')}<input className="input" value={letterhead.email ?? ''} onChange={(e) => setLetterhead({ email: e.target.value })} /></label>
            </div>
            <div className="form-row">
              <label>{tr('Website')}<input className="input" value={letterhead.website ?? ''} onChange={(e) => setLetterhead({ website: e.target.value })} /></label>
              <label>{tr('VAT / CVR')}<input className="input" value={letterhead.vat ?? ''} onChange={(e) => setLetterhead({ vat: e.target.value })} /></label>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>{tr('In Word, File → Save as → Word template (.dotx) makes it the starting point for every letter.')}</p>
          </form>
        </div>
      )}
      <LogoPngs key={project.id} project={project} backgrounds={bgs} onReady={(set) => setLogos({ projectId: project.id, set })} />
    </>
  )
}

function Head() {
  const tr = useT()
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{tr('App')}</span>
        <h1>{tr('Presenter')}</h1>
        <p className="muted">{tr('PowerPoint, Google Slides and Word templates from the brand hub')}</p>
      </div>
    </div>
  )
}

/* ---------- Previews, drawn from the same boxes as the files ---------- */

const pct = (n: number, of: number) => `${(n / of) * 100}%`
const place = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({ position: 'absolute', left: pct(b.x, SLIDE.w), top: pct(b.y, SLIDE.h), width: pct(b.w, SLIDE.w), height: pct(b.h, SLIDE.h) })
/** Points on a 13.333-inch slide, as a share of the preview's width. */
const pt = (size: number) => `${(size / 72 / SLIDE.w) * 100}cqw`

function SlideText({ box, text, brand, colour }: { box: TextBox; text: string; brand: Brand; colour: string }) {
  const lines = text.split('\n')
  return (
    <div style={{
      ...place(box), display: 'flex', flexDirection: 'column', justifyContent: box.valign === 'bottom' ? 'flex-end' : box.valign === 'middle' ? 'center' : 'flex-start',
      fontFamily: `'${box.font === 'heading' ? brand.heading : brand.body}', 'Inter Tight', sans-serif`, fontWeight: box.bold ? 700 : 400, fontSize: pt(box.size), lineHeight: 1.15, color: colour, textAlign: box.align ?? 'left', overflow: 'hidden',
    }}>
      {lines.map((t, i) => <div key={i} style={{ marginBottom: box.bullets ? '0.35em' : 0 }}>{box.bullets ? '•  ' : ''}{t}</div>)}
    </div>
  )
}

function SlidePreview({ layout: l, brand, logos }: { layout: SlideLayout; brand: Brand; logos: Record<string, LogoPng | undefined> | null }) {
  const tr = useT()
  const c = palette(brand, l.bg)
  const logo = logos?.[c.bg.toLowerCase()]
  return (
    <div className="pr-slide" style={{ background: c.bg }}>
      {l.bar && <div style={{ ...place(l.bar), background: palette(brand, l.bar.tone).bg }} />}
      {l.picture && <div className="pr-picture" style={place(l.picture)}><span>{tr('Picture')}</span></div>}
      {l.logo && logo && <img src={logo.data} alt="" style={place(fitLogo(l.logo, logo.aspect))} />}
      {l.title && l.example.title && <SlideText box={l.title} text={tr(l.example.title)} brand={brand} colour={c.heading} />}
      {(l.body ?? []).map((b) => l.example.body?.[b.name] && <SlideText key={b.name} box={b} text={tr(l.example.body[b.name])} brand={brand} colour={b.font === 'heading' ? c.heading : c.ink} />)}
      {l.number && <span style={{ position: 'absolute', left: pct(0.8, SLIDE.w), bottom: pct(0.45, SLIDE.h), fontSize: pt(10), color: c.ink, fontFamily: `'${brand.body}', sans-serif` }}>3</span>}
    </div>
  )
}

function LetterPreview({ brand, letterhead, logo }: { brand: Brand; letterhead: Letterhead; logo?: LogoPng }) {
  const tr = useT()
  const line = contactLine(letterhead)
  return (
    <div className="pr-page" style={{ fontFamily: `'${brand.body}', sans-serif`, color: brand.dark }}>
      <div className="pr-page-head">{logo ? <img src={logo.data} alt="" style={{ height: '100%', maxWidth: '45%' }} /> : <b style={{ fontFamily: `'${brand.heading}', sans-serif` }}>{letterhead.company}</b>}</div>
      <div className="pr-page-body">
        <p>{tr('[Recipient]')}<br />{tr('[Street and number]')}<br />{tr('[Postcode and town]')}</p>
        <p style={{ textAlign: 'right' }}>{new Date().toLocaleDateString()}</p>
        <p style={{ fontFamily: `'${brand.heading}', sans-serif`, fontWeight: 700, color: palette(brand, 'light').heading === brand.primary ? brand.primary : brand.dark, fontSize: '1.3em' }}>{tr('[Subject]')}</p>
        <p>{tr('Dear [name],')}</p>
        <div className="pr-lines"><span /><span /><span /><span style={{ width: '60%' }} /></div>
        <p>{tr('Kind regards,')}</p>
      </div>
      <div className="pr-page-foot" style={{ borderColor: brand.primary }}>
        <b>{letterhead.company}</b>
        {line && <span>{line}</span>}
      </div>
    </div>
  )
}
