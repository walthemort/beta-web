import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Logo, ProjectCover } from '../components/ui'
import { useSrc } from '../data/blobs'
import { BrandMark } from '../app/Plan'
import { useStore } from '../data/store'
import { orderedColours, pickFonts } from '../features/palette'
import { LangProvider, useT } from '../data/i18n'
import { readableOn } from '../features/color'
import './landing.css'
import './portal.css'

function Img({ src, alt }: { src: string; alt: string }) {
  const url = useSrc(src)
  return url ? <img src={url} alt={alt} /> : <div className="cs-ph" />
}

/** Public portfolio page built from a project's approved work and brand hub. In the studio's language. */
export default function CaseStudy() {
  const { state } = useStore()
  const owner = state.team.find((m) => m.role === 'Owner') ?? state.team[0]
  return (
    <LangProvider lang={owner?.lang ?? 'en'}>
      <CasePage />
    </LangProvider>
  )
}

function CasePage() {
  const { id } = useParams()
  const t = useT()
  const { state } = useStore()
  const project = state.projects.find((p) => p.id === id)
  const client = state.clients.find((c) => c.id === project?.clientId)
  useEffect(() => {
    document.title = project ? `${client?.name ?? project.name} — ${state.studio.name}` : state.studio.name
  }, [project, client, state.studio.name])

  if (!project?.caseStudy?.published)
    return (
      <div className="landing portal">
        <header className="l-header"><Link to="/"><Logo /></Link></header>
        <main className="portal-main"><h1>{t('Not published.')}</h1></main>
      </div>
    )

  const files = project.caseStudy.fileIds.map((fid) => state.files.find((f) => f.id === fid)).filter(Boolean)
  const colours = orderedColours(project.hub.colours)
  const { head } = pickFonts(project)
  const fonts = project.hub.fonts.map((f) => `family=${encodeURIComponent(f.name)}`).join('&')

  return (
    <div className="case">
      {fonts && <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${fonts}&display=swap`} />}
      <header className="l-header case-head">
        <b>{state.studio.name}</b>
        <span className="eyebrow">{t('Case study')}</span>
      </header>
      <ProjectCover project={project} height={420} />
      <section className="case-intro">
        <span className="eyebrow">{client?.name} · {project.service}</span>
        <h1 style={{ fontFamily: head ? `'${head}', var(--sans)` : undefined }}>{project.tagline || project.name}</h1>
        {project.caseStudy.intro && <p>{project.caseStudy.intro}</p>}
      </section>
      <section className="case-grid">
        {files.map((f, i) => (
          <figure key={f!.id} className={i % 3 === 0 ? 'wide' : ''}>
            <Img src={f!.versions.at(-1)!.src} alt={f!.name} />
          </figure>
        ))}
      </section>
      {project.caseStudy.showQuote && project.feedback?.mayQuote && project.feedback.quote && (
        <blockquote className="case-quote">
          <p>“{project.feedback.quote}”</p>
          <footer>{project.feedback.by}, {client?.name}</footer>
        </blockquote>
      )}
      {colours.length > 0 && (
        <section className="case-colours">
          {colours.map((c) => (
            <div key={c.id} style={{ background: c.hex, color: readableOn(c.hex), flexGrow: c.share }}>
              <b>{c.name}</b>
              <code>{c.hex.toUpperCase()}</code>
            </div>
          ))}
        </section>
      )}
      {project.hub.fonts.length > 0 && (
        <section className="case-type">
          {project.hub.fonts.map((f) => (
            <div key={f.id}>
              <span style={{ fontFamily: `'${f.name}', var(--sans)` }}>{t('Aa')}</span>
              <small>{f.name} · {f.usage}</small>
            </div>
          ))}
        </section>
      )}
      <footer className="l-footer" style={{ maxWidth: 1160, margin: '0 auto', padding: '32px' }}>
        <span>{state.studio.name} · {state.studio.email}</span>
        <BrandMark />
      </footer>
    </div>
  )
}
