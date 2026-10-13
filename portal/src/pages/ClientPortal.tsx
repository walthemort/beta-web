import { BrandMark } from '../app/Plan'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, Printer, X } from 'lucide-react'
import { Logo, ProjectCover } from '../components/ui'
import { AutoText, Dropzone, StatusPill } from '../components/kit'
import { SignaturePad } from '../components/SignaturePad'
import { useSrc } from '../data/blobs'
import { LangProvider, LangSwitch, dateLocale, useLang, useT } from '../data/i18n'
import { formatKr, isComplete, isOverdue, now, proposalScope, proposalTotals, stagesOf, uid, useStore } from '../data/store'
import { FeedbackRequest } from '../features/feedback'
import { HandoverPage } from '../features/handover'
import { projectVatRate } from '../data/vat'
import type { Client, Project } from '../data/types'
import { useBranded } from '../data/theme'

export { useBranded }
import { FileReview, Thumb, useUpload } from '../features/files'
import { DeckFrame, DeckReview } from '../features/decks'
import { ClientChoices } from '../features/choices'
import { ProposalDocument } from '../features/proposals'
import { ContractDocument } from '../features/contracts'
import { HubView } from '../features/hub'
import { HubGate } from '../features/hubExtras'
import { ClientDesign, ClientDesignList, hasSharedDesigns } from '../features/content/ClientDesigns'
import { ClientSignatures } from '../features/apps/signatures'
import { ClientContentPlan, clientPosts } from '../features/apps/social'
import { hasApp } from '../data/plans'
import { ClientAssistant, assistantOn } from '../features/apps/assistant/Assistant'
import '../app/app.css'
import './landing.css'
import './portal.css'

/** Localised long date for client pages. */
function useDate() {
  const { lang } = useLang()
  return (iso?: string) => (iso ? new Date(iso).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'long', year: 'numeric' }) : '—')
}

function useAgo() {
  const { lang } = useLang()
  return (iso: string) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    const rtf = new Intl.RelativeTimeFormat(dateLocale(lang), { numeric: 'auto' })
    if (m < 60) return rtf.format(-m, 'minute')
    if (m < 60 * 24) return rtf.format(-Math.round(m / 60), 'hour')
    return new Date(iso).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short' })
  }
}

/** The studio's logo on every client page (#5) – the dark-background version in dark mode, if there is one. */
export function StudioBrand() {
  const { state } = useStore()
  const logo = useSrc(state.studio.brand.logoSrc)
  const dark = useSrc(state.studio.brand.logoDarkSrc)
  if (!logo) return <b>{state.studio.name}</b>
  if (!dark) return <img src={logo} alt={state.studio.name} className="cp-logo" />
  return (
    <>
      <img src={logo} alt={state.studio.name} className="cp-logo only-light" />
      <img src={dark} alt={state.studio.name} className="cp-logo only-dark" />
    </>
  )
}


export default function ClientPortal() {
  const { pid } = useParams()
  const { state } = useStore()
  const project = state.projects.find((p) => p.id === pid)
  const client = state.clients.find((c) => c.id === project?.clientId)
  return (
    <LangProvider initial={client?.language ?? 'en'}>
      <Portal />
    </LangProvider>
  )
}

function Portal() {
  const { pid, section = 'home', itemId } = useParams()
  const { state } = useStore()
  const t = useT()
  const project = state.projects.find((p) => p.id === pid)
  const client = state.clients.find((c) => c.id === project?.clientId)
  const branded = useBranded(section === 'hub' ? project?.hub.theme : undefined)

  useEffect(() => {
    // A client's tab shows their studio, not ours – including when the link no longer resolves.
    document.title = project ? `${client?.name ?? project.name} — ${state.studio.name}` : `${t('Client portal')} — ${state.studio.name}`
  }, [project, client, state.studio.name, t])

  if (!project)
    return (
      <div className="landing portal">
        <header className="l-header"><Link to="/"><Logo /></Link></header>
        <main className="portal-main"><h1>{t('Link not found.')}</h1><p className="muted">{t('Ask your studio for a new link.')}</p></main>
      </div>
    )

  if (section === 'welcome') return <Onboarding project={project} />

  const proposal = state.proposals.find((p) => p.projectId === project.id && p.status !== 'Draft')
  const contract = state.contracts.find((c) => c.projectId === project.id && c.status !== 'Draft')
  const decks = state.decks.filter((d) => d.projectId === project.id && d.status !== 'Not shared')
  const choices = state.choices.filter((c) => c.projectId === project.id && c.status !== 'Draft')
  const invoices = state.invoices.filter((i) => i.projectId === project.id && i.status !== 'Draft')
  const base = `/p/${project.id}`
  const nav = [
    { to: base, label: 'Overview', end: true },
    decks.length > 0 && { to: `${base}/presentations`, label: 'Presentations' },
    choices.length > 0 && { to: `${base}/routes`, label: 'Pick a route' },
    { to: `${base}/review`, label: 'Review' },
    hasSharedDesigns(state, project.id) && { to: `${base}/designs`, label: 'Designs' },
    hasApp(state, 'socialPlanner') && clientPosts(state, project.id).length > 0 && { to: `${base}/content`, label: 'Content plan' },
    project.discovery.sentAt && { to: `${base}/discovery`, label: 'Questionnaire' },
    proposal && { to: `${base}/proposal`, label: 'Proposal' },
    contract && { to: `${base}/contract`, label: 'Contract' },
    invoices.length > 0 && { to: `${base}/invoices`, label: 'Invoices' },
    { to: `${base}/hub`, label: 'Brand hub' },
    assistantOn(state, project) && { to: `${base}/assistant`, label: 'Ask the brand' },
    !!project.signatures?.people.length && { to: `${base}/signatures`, label: 'Email signatures' },
    project.handover?.sharedAt && { to: `${base}/handover`, label: 'Final files' },
  ].filter(Boolean) as { to: string; label: string; end?: boolean }[]

  return (
    <div className={'cp ' + branded.className} style={branded.style}>
      <header className="cp-head">
        <span className="cp-brand">
          <StudioBrand /> <span className="muted">×</span> <b>{client?.name}</b>
        </span>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="muted cp-viewer">{t('Viewing as')} {client?.contactName || client?.name}</span>
          <LangSwitch />
        </span>
      </header>
      <nav className="tabs cp-tabs" aria-label={t('Client portal')}>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="tab">{t(n.label)}</NavLink>
        ))}
      </nav>
      <main className="cp-main">
        {section === 'home' && <Home project={project} />}
        {section === 'review' && (itemId ? (
          <>
            <Link to={`${base}/review`} className="link-arrow"><ArrowLeft size={14} /> {t('All files')}</Link>
            <FileReview fileId={itemId} mode="client" />
          </>
        ) : <ReviewList project={project} />)}
        {section === 'presentations' && (itemId ? (
          <>
            <Link to={`${base}/presentations`} className="link-arrow"><ArrowLeft size={14} /> {t('All presentations')}</Link>
            <DeckReview deckId={itemId} mode="client" />
          </>
        ) : <DeckList project={project} />)}
        {section === 'designs' && (itemId ? <ClientDesign project={project} designId={itemId} base={base} /> : <ClientDesignList project={project} base={base} />)}
        {section === 'signatures' && <ClientSignatures project={project} />}
        {section === 'content' && <ClientContentPlan project={project} />}
        {section === 'assistant' && assistantOn(state, project) && <ClientAssistant project={project} />}
        {section === 'routes' && <ClientChoices project={project} />}
        {section === 'invoices' && <ClientInvoices project={project} />}
        {section === 'handover' && <HandoverPage project={project} />}
        {section === 'discovery' && <DiscoveryForm project={project} />}
        {section === 'proposal' && <ProposalPage project={project} />}
        {section === 'contract' && <ContractPage project={project} />}
        {section === 'hub' && (
          <HubGate project={project}>
            <div className="card" style={{ overflow: 'hidden' }}><ProjectCover project={project} height={260} /></div>
            <h1 className="cp-h1">{project.tagline || project.name}</h1>
            <HubView project={project} />
          </HubGate>
        )}
      </main>
      <footer className="l-footer cp-foot">
        <span>{t('Shared by')} {state.studio.name} · {state.studio.email}</span>
        <BrandMark />
      </footer>
    </div>
  )
}

function Home({ project }: { project: Project }) {
  const { state } = useStore()
  const t = useT()
  const ago = useAgo()
  const client = state.clients.find((c) => c.id === project.clientId)
  const base = `/p/${project.id}`
  const files = state.files.filter((f) => f.projectId === project.id)
  const proposal = state.proposals.find((p) => p.projectId === project.id)
  const contract = state.contracts.find((c) => c.projectId === project.id)
  const onboarded = !!project.onboarding.completedAt

  const todo = [
    !onboarded && project.onboarding.welcome && { label: t('Finish getting started'), hint: t('About 10 minutes'), to: `${base}/welcome` },
    project.discovery.sentAt && !project.discovery.submittedAt && { label: t('Fill in the discovery questionnaire'), hint: t('About 10 minutes'), to: `${base}/discovery` },
    proposal?.status === 'Sent' && { label: t('Review and accept the proposal'), hint: proposal.title, to: `${base}/proposal` },
    contract?.status === 'Sent' && { label: t('Sign the project agreement'), hint: contract.title, to: `${base}/contract` },
    project.handover?.sharedAt && { label: t('Your final files are ready'), hint: t('Download everything (.zip)'), to: `${base}/handover` },
    ...state.decks
      .filter((d) => d.projectId === project.id && d.status === 'In review' && (d.purpose !== 'Proposal' || proposal?.status !== 'Sent'))
      .map((d) => ({ label: `${t('Look through')} ${d.title}`, hint: t('Presentation'), to: `${base}/presentations/${d.id}` })),
    ...state.choices.filter((c) => c.projectId === project.id && c.status === 'Open').map((c) => ({ label: c.question, hint: c.title, to: `${base}/routes` })),
    ...files.filter((f) => f.status === 'In review' && f.uploadedBy !== 'client').map((f) => ({ label: `${t('Review_file')} ${f.name}`, hint: `${t('Version')} ${f.versions.length}`, to: `${base}/review/${f.id}` })),
  ].filter(Boolean) as { label: string; hint: string; to: string }[]

  // Client-facing updates: what the studio chose to tell them about.
  const updates = state.notifications.filter((n) => n.audience === 'client' && n.projectId === project.id).slice(0, 6)
  const first = (client?.contactName || '').split(' ')[0]

  return (
    <>
      <div>
        <span className="eyebrow">{project.name}</span>
        <h1 className="cp-h1">{t('Hi')}{first ? ` ${first}` : ''}. <span className="serif-accent">{t('Here’s where we are.')}</span></h1>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <ProjectCover project={project} height={200} />
        <div className="phero-body">
          <div className="stepper">
            {stagesOf(state, project).map(({ id, name: s }, i) => (
              <div key={id} className={'step' + (i < project.stage ? ' done' : i === project.stage ? ' current' : '')}>
                <small>{i < project.stage ? <Check size={11} /> : String(i + 1).padStart(2, '0')}</small>
                {t(s)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isComplete(state, project) && <FeedbackRequest project={project} />}

      <div className="split">
        <section className="card panel">
          <h3>{t('Waiting for you')} {todo.length > 0 && <span className="tab-badge">{todo.length}</span>}</h3>
          {todo.length === 0 ? (
            <p className="muted">{t('Nothing right now. We’ll let you know when there’s something to look at.')}</p>
          ) : (
            <div className="list">
              {todo.map((x) => (
                <Link key={x.to + x.label} to={x.to} className="list-item todo">
                  <span className="grow"><span>{x.label}</span><small>{x.hint}</small></span>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="card panel">
          <h3>{t('Latest updates')}</h3>
          <div className="list">
            {updates.length === 0 && <p className="muted">{t('No updates yet.')}</p>}
            {updates.map((u) => (
              <Link key={u.id} to={u.link ?? base} className="list-item">
                <span className="grow"><span>{u.text}</span><small>{ago(u.at)}</small></span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <ClientUploads project={project} />
    </>
  )
}

/** Clients share their own material with the studio (#47). */
function ClientUploads({ project, compact }: { project: Project; compact?: boolean }) {
  const { state } = useStore()
  const t = useT()
  const { upload, error } = useUpload(project.id, 'client')
  const mine = state.files.filter((f) => f.projectId === project.id && f.uploadedBy === 'client')
  return (
    <section className={compact ? '' : 'card panel'}>
      {!compact && (
        <>
          <h3>{t('Share material with the studio')}</h3>
          <p className="muted" style={{ fontSize: 14, marginTop: -6 }}>{t('Old logos, photos, references — anything that helps.')}</p>
        </>
      )}
      <Dropzone onFiles={upload}>
        <span><b>{t('Drop files here')}</b> {t('or click to upload')}</span>
      </Dropzone>
      {error && <p className="error">{error}</p>}
      {mine.length > 0 && (
        <div className="list">
          <small className="muted">{t('You shared')}:</small>
          {mine.map((f) => (
            <div key={f.id} className="list-item">
              <Thumb file={f} size={32} />
              <span className="grow"><span>{f.name}</span></span>
              <Check size={14} style={{ color: 'var(--green)' }} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ---------- Onboarding wizard (#46) ---------- */

function embedVideo(url?: string) {
  if (!url) return null
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  const loom = url.match(/loom\.com\/share\/([\w]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  return null
}

/** The client fills in what our invoices need (saved as they type – nothing to submit). */
function BillingDetails({ client }: { client: Client }) {
  const { dispatch } = useStore()
  const t = useT()
  const save = (patch: Partial<Client>) => dispatch({ type: 'update', coll: 'clients', id: client.id, fn: (c) => ({ ...c, ...patch }) })
  return (
    <div className="ob-billing">
      <h3>{t('Billing details')} <span className="muted">({t('optional')})</span></h3>
      <p className="muted">{t('So our invoices are addressed correctly.')}</p>
      <div className="ob-billing-fields">
        <textarea className="input" rows={2} placeholder={t('Company address')} aria-label={t('Company address')} defaultValue={client.address} onBlur={(e) => save({ address: e.target.value.trim() || undefined })} />
        <input className="input" placeholder={t('CVR / VAT number')} aria-label={t('CVR / VAT number')} defaultValue={client.cvr} onBlur={(e) => save({ cvr: e.target.value.trim() || undefined })} />
      </div>
    </div>
  )
}

function Onboarding({ project }: { project: Project }) {
  const { state, dispatch } = useStore()
  const branded = useBranded()
  const t = useT()
  const navigate = useNavigate()
  const client = state.clients.find((c) => c.id === project.clientId)
  const [step, setStep] = useState(0)
  const [person, setPerson] = useState({ name: '', email: '', role: '' })
  const steps = [t('Welcome'), t('Your team'), t('Questionnaire'), t('Share material'), t('All set')]
  const video = embedVideo(project.onboarding.videoUrl)
  const d = project.discovery
  const first = (client?.contactName || '').split(' ')[0]

  function finish() {
    dispatch({
      type: 'updateProject',
      id: project.id,
      patch: { onboarding: { ...project.onboarding, completedAt: now() }, discovery: d.sentAt && !d.submittedAt && d.questions.some((q) => q.a.trim()) ? { ...d, submittedAt: now() } : d },
      log: { text: `${client?.contactName || client?.name} finished onboarding`, projectId: project.id, fromClient: true },
    })
    setStep(4)
  }

  function addPerson(e: FormEvent) {
    e.preventDefault()
    if (!client || !person.name.trim()) return
    dispatch({ type: 'update', coll: 'clients', id: client.id, fn: (c) => ({ ...c, contacts: [...c.contacts, { id: uid(), ...person }] }) })
    setPerson({ name: '', email: '', role: '' })
  }

  return (
    <div className={'cp onboarding ' + branded.className} style={branded.style}>
      <header className="cp-head">
        <span className="cp-brand"><StudioBrand /> <span className="muted">×</span> <b>{client?.name}</b></span>
        <LangSwitch />
      </header>
      <ol className="ob-steps">
        {steps.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''}>
            <span>{i < step ? <Check size={12} /> : i + 1}</span> {s}
          </li>
        ))}
      </ol>
      <main className="ob-main card">
        {step === 0 && (
          <>
            <h1 className="cp-h1">{t('Welcome')}{first ? `, ${first}` : ''}!</h1>
            {project.onboarding.welcome && <p className="ob-lead">{t(project.onboarding.welcome)}</p>}
            {video && <div className="ob-video"><iframe src={video} title={t('Welcome video')} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>}
          </>
        )}
        {step === 1 && (
          <>
            <h2>{t('Who should we keep in the loop?')}</h2>
            <p className="muted">{t('Add the people who’ll give feedback or approve work.')}</p>
            <div className="list">
              {client && (
                <div className="list-item"><span className="grow"><span>{client.contactName}</span><small>{client.contactEmail}</small></span></div>
              )}
              {client?.contacts.map((c) => (
                <div key={c.id} className="list-item">
                  <span className="grow"><span>{c.name}{c.role ? ` · ${c.role}` : ''}</span><small>{c.email}</small></span>
                  <button className="btn btn-ghost btn-icon" aria-label={`Remove ${c.name}`} onClick={() => dispatch({ type: 'update', coll: 'clients', id: client.id, fn: (x) => ({ ...x, contacts: x.contacts.filter((y) => y.id !== c.id) }) })}><X size={14} /></button>
                </div>
              ))}
            </div>
            <form className="ob-person" onSubmit={addPerson}>
              <input className="input" placeholder={t('Name')} value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} aria-label={t('Name')} />
              <input className="input" type="email" placeholder={t('Email')} value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} aria-label={t('Email')} />
              <input className="input" placeholder={t('Role')} value={person.role} onChange={(e) => setPerson({ ...person, role: e.target.value })} aria-label={t('Role')} />
              <button className="btn" type="submit" disabled={!person.name.trim()}><Plus size={15} /> {t('Add person')}</button>
            </form>
            {client && <BillingDetails client={client} />}
          </>
        )}
        {step === 2 && <QuestionFields project={project} />}
        {step === 3 && (
          <>
            <h2>{t('Share material with the studio')}</h2>
            <p className="muted">{t('Old logos, photos, references — anything that helps.')}</p>
            <ClientUploads project={project} compact />
          </>
        )}
        {step === 4 && (
          <div className="ob-done">
            <span className="ob-check"><Check size={28} /></span>
            <h1 className="cp-h1">{t('Thank you!')}</h1>
            <p className="muted">{t('We’ve got everything we need to get started. We’ll be in touch soon.')}</p>
            <button className="btn btn-primary" onClick={() => navigate(`/p/${project.id}`)}>{t('Go to your project')} <ArrowRight size={16} /></button>
          </div>
        )}
        {step < 4 && (
          <div className="ob-nav">
            {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> {t('Back')}</button> : <span />}
            <span style={{ display: 'flex', gap: 8 }}>
              {step > 0 && step < 3 && <button className="btn btn-ghost" onClick={() => setStep(step + 1)}>{t('Skip')}</button>}
              <button className="btn btn-primary" onClick={() => (step === 3 ? finish() : setStep(step + 1))}>
                {step === 0 ? t('Get started') : t('Next')} <ArrowRight size={15} />
              </button>
            </span>
          </div>
        )}
      </main>
    </div>
  )
}

/* ---------- Questionnaire ---------- */

function QuestionFields({ project }: { project: Project }) {
  const { dispatch } = useStore()
  const t = useT()
  const d = project.discovery
  const set = (id: string, a: string) =>
    dispatch({ type: 'updateProject', id: project.id, patch: { discovery: { ...d, questions: d.questions.map((q) => (q.id === id ? { ...q, a } : q)) } } })
  return (
    <>
      <div>
        <span className="eyebrow">{t('Discovery')}</span>
        <h1 className="cp-h1">{t('Tell us about you.')}</h1>
        <p className="muted">{t('Your answers save automatically, so you can come back later. There are no wrong answers — short is fine.')}</p>
      </div>
      <div className="card panel" style={{ gap: 0 }}>
        {d.questions.map((q, i) => (
          <div key={q.id} className="qa">
            <label htmlFor={q.id}>{i + 1}. {t(q.q)}</label>
            <AutoText id={q.id} value={q.a} onChange={(e) => set(q.id, e.target.value)} />
          </div>
        ))}
      </div>
    </>
  )
}

function DiscoveryForm({ project }: { project: Project }) {
  const { state, dispatch } = useStore()
  const t = useT()
  const date = useDate()
  const d = project.discovery
  const client = state.clients.find((c) => c.id === project.clientId)

  function submit(e: FormEvent) {
    e.preventDefault()
    dispatch({
      type: 'updateProject',
      id: project.id,
      patch: { discovery: { ...d, submittedAt: now() } },
      log: { text: `${client?.contactName || 'The client'} submitted the questionnaire`, projectId: project.id, fromClient: true, link: `/app/projects/${project.id}/discovery` },
    })
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 20, maxWidth: 720 }}>
      <QuestionFields project={project} />
      {d.submittedAt && <p className="pill pill-green" style={{ justifySelf: 'start', height: 'auto', padding: '6px 12px' }}><Check size={13} /> {date(d.submittedAt)}</p>}
      <button className="btn btn-primary" type="submit" style={{ justifySelf: 'start' }}>{d.submittedAt ? t('Send updated answers') : t('Send to the studio')}</button>
    </form>
  )
}

/* ---------- Lists ---------- */

function ReviewList({ project }: { project: Project }) {
  const { state } = useStore()
  const t = useT()
  const files = state.files.filter((f) => f.projectId === project.id && f.status !== 'Not shared' && f.uploadedBy !== 'client')
  if (!files.length) return <div className="empty"><p>{t('Nothing to review yet.')}</p></div>
  const order = { 'In review': 0, 'Changes requested': 1, Approved: 2, 'Not shared': 3 }
  return (
    <>
      <h1 className="cp-h1">{t('Work to review')}</h1>
      <div className="card">
        {[...files].sort((a, b) => order[a.status] - order[b.status]).map((f) => (
          <Link key={f.id} to={`/p/${project.id}/review/${f.id}`} className="file-row">
            <Thumb file={f} />
            <span className="cell-title" style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{f.name}</b><small>{t('Version')} {f.versions.length}</small></span>
            <StatusPill status={f.status} />
          </Link>
        ))}
      </div>
    </>
  )
}

function DeckList({ project }: { project: Project }) {
  const { state } = useStore()
  const t = useT()
  const decks = state.decks.filter((d) => d.projectId === project.id && d.status !== 'Not shared')
  if (!decks.length) return <div className="empty"><p>{t('No presentations yet.')}</p></div>
  return (
    <>
      <h1 className="cp-h1">{t('Presentations')}</h1>
      <div className="card">
        {decks.map((d) => (
          <Link key={d.id} to={`/p/${project.id}/presentations/${d.id}`} className="file-row">
            <span className="deck-thumb">16:9</span>
            <span className="cell-title" style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{d.title}</b><small>{d.purpose}</small></span>
            <StatusPill status={d.status} />
          </Link>
        ))}
      </div>
    </>
  )
}

function ClientInvoices({ project }: { project: Project }) {
  const { state } = useStore()
  const t = useT()
  const date = useDate()
  const invoices = state.invoices.filter((i) => i.projectId === project.id && i.status !== 'Draft').sort((a, b) => b.number.localeCompare(a.number))
  if (!invoices.length) return <div className="empty"><p>{t('No invoices yet.')}</p></div>
  return (
    <>
      <h1 className="cp-h1">{t('Invoices')}</h1>
      <div className="card">
        {invoices.map((i) => (
          <div key={i.id} className="file-row">
            <span className="cell-title" style={{ flex: 1 }}>
              <b style={{ fontWeight: 500 }}>{i.number} · {formatKr(i.amount)}</b>
              <small>{i.description} · {i.status === 'Paid' ? `${t('Paid')} ${date(i.paidAt)}` : `${t('Due')} ${date(i.due)}`}</small>
            </span>
            <StatusPill status={t(isOverdue(i) ? 'Overdue' : i.status === 'Issued' ? 'To pay' : i.status)} />
            <Link className="btn btn-sm" to={`/print/invoice/${i.id}`} target="_blank"><Printer size={14} /> {t('PDF')}</Link>
            {i.status === 'Issued' && i.paymentLink && <a className="btn btn-sm btn-primary" href={i.paymentLink} target="_blank" rel="noreferrer">{t('Pay now')}</a>}
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>{t('Prefer a bank transfer?')} {state.studio.bank}. {t('Please quote the invoice number.')}</p>
    </>
  )
}

/* ---------- Proposal & contract ---------- */

function ProposalPage({ project }: { project: Project }) {
  const { state, dispatch } = useStore()
  const t = useT()
  const date = useDate()
  const client = state.clients.find((c) => c.id === project.clientId)
  const proposal = state.proposals.find((p) => p.projectId === project.id)
  const [name, setName] = useState(client?.contactName ?? '')
  const [sel, setSel] = useState<{ packageId?: string; addonIds: string[] }>(() => ({
    packageId: proposal?.chosenPackageId ?? (proposal?.packages.find((p) => p.recommended) ?? proposal?.packages[0])?.id,
    addonIds: proposal?.chosenAddonIds ?? [],
  }))
  if (!proposal || proposal.status === 'Draft') return <div className="empty"><p>{t('The proposal isn’t ready yet.')}</p></div>
  const total = proposalTotals(proposalScope(proposal, sel.packageId, sel.addonIds), projectVatRate(state, project.id)).total

  const respond = (status: 'Accepted' | 'Declined') =>
    dispatch({
      type: 'update',
      coll: 'proposals',
      id: proposal.id,
      fn: (p) => ({ ...p, status, respondedBy: name.trim(), respondedAt: now(), chosenPackageId: p.packages.length ? sel.packageId : undefined, chosenAddonIds: sel.addonIds }),
      log: { text: `${name.trim()} ${status === 'Accepted' ? 'accepted' : 'declined'} the proposal`, projectId: project.id, fromClient: true, link: `/app/projects/${project.id}/proposal` },
    })

  const deck = state.decks.find((d) => d.projectId === project.id && d.purpose === 'Proposal' && d.status !== 'Not shared')
  return (
    <div className="doc-layout">
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {deck && (
          <>
            <DeckFrame deck={deck} />
            <Link to={`/p/${project.id}/presentations/${deck.id}`} className="link-arrow">{t('Comment on the presentation')} <ArrowRight size={14} /></Link>
          </>
        )}
        <ProposalDocument proposal={proposal} selection={proposal.status === 'Sent' ? sel : undefined} onSelect={proposal.status === 'Sent' ? setSel : undefined} />
      </div>
      <aside className="card panel doc-aside">
        <StatusPill status={proposal.status} />
        {proposal.status === 'Sent' ? (
          <>
            <div className="aside-total"><small>{t('Your total incl. VAT')}</small><b>{formatKr(total)}</b></div>
            <div className="field">
              <label htmlFor="acc-name">{t('Your full name')}</label>
              <input id="acc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={!name.trim()} onClick={() => respond('Accepted')}><Check size={16} /> {t('Accept proposal')}</button>
            <button className="btn btn-ghost" disabled={!name.trim()} onClick={() => respond('Declined')}>{t('Decline')}</button>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>{proposal.respondedBy} · {date(proposal.respondedAt)}</p>
        )}
        <Link className="btn btn-sm" to={`/print/proposal/${proposal.id}`} target="_blank"><Printer size={14} /> {t('Save as PDF')}</Link>
      </aside>
    </div>
  )
}

function ContractPage({ project }: { project: Project }) {
  const { state, dispatch } = useStore()
  const t = useT()
  const date = useDate()
  const client = state.clients.find((c) => c.id === project.clientId)
  const contract = state.contracts.find((c) => c.projectId === project.id)
  const [name, setName] = useState(client?.contactName ?? '')
  const [agree, setAgree] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  if (!contract || contract.status === 'Draft') return <div className="empty"><p>{t('The agreement isn’t ready yet.')}</p></div>

  return (
    <div className="doc-layout">
      <ContractDocument contract={contract} />
      <aside className="card panel doc-aside">
        <StatusPill status={contract.status} />
        {contract.status === 'Sent' ? (
          <>
            <div className="field">
              <label htmlFor="sig-name">{t('Your full name')}</label>
              <input id="sig-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('Your signature')}</label>
              <SignaturePad onChange={setSignature} />
            </div>
            <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--blue)' }} />
              {t('I have read the agreement and sign it on behalf of {client}.', { client: client?.name ?? '' })}
            </label>
            <button
              className="btn btn-primary"
              disabled={!name.trim() || !agree || !signature}
              onClick={() =>
                dispatch({
                  type: 'update',
                  coll: 'contracts',
                  id: contract.id,
                  fn: (c) => ({
                    ...c,
                    status: 'Signed',
                    signedBy: name.trim(),
                    signedAt: now(),
                    signature: signature ?? undefined,
                    signedMeta: { userAgent: navigator.userAgent, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                  }),
                  log: { text: `${name.trim()} signed the agreement`, projectId: project.id, fromClient: true, link: `/app/projects/${project.id}/contract` },
                })
              }
            >
              {t('Sign agreement')}
            </button>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>{contract.signedBy} · {date(contract.signedAt)}</p>
        )}
        <Link className="btn btn-sm" to={`/print/contract/${contract.id}`} target="_blank"><Printer size={14} /> {t('Save as PDF')}</Link>
      </aside>
    </div>
  )
}
