/** A page as visitors see it – on /site/<slug>, and as the preview in the editor. */
import { useEffect, useState, type CSSProperties } from 'react'
import { Mail, MapPin, Phone } from 'lucide-react'
import { useSrc } from '../../../data/blobs'
import type { PageBlock, Project, WebPage } from '../../../data/types'
import { useT } from '../../../data/i18n'
import { brandOf, type Brand } from '../../content/model'
import { BrandFonts, useBrandLogos } from '../../content/render'
import { useLogoMark } from '../../content/logoMark'
import { href, pageColours, timeLeft, validEmail } from './blocks'
import './pages.css'

function Img({ src, alt = '', style }: { src: string; alt?: string; style?: CSSProperties }) {
  const url = useSrc(src || undefined)
  return url ? <img src={url} alt={alt} style={style} /> : <div className="pg-ph" style={style} />
}

function Logo({ project, brand, colour }: { project: Project; brand: Brand; colour: string }) {
  const logos = useBrandLogos(project)
  const v = logos[0]?.file.versions.at(-1)
  const url = useLogoMark(v?.src, v?.mime, colour)
  if (v) return url ? <img className="pg-logo" src={url} alt={brand.wordmark} /> : <div className="pg-logo" />
  return <div className="pg-wordmark" style={{ fontFamily: `'${brand.heading}', sans-serif`, color: colour }}>{brand.wordmark}</div>
}

function Countdown({ block }: { block: Extract<PageBlock, { type: 'countdown' }> }) {
  const tr = useT()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = timeLeft(block.date, now)
  const parts: [number, string][] = [[left.days, tr('days')], [left.hours, tr('hours')], [left.minutes, tr('min.')], [left.seconds, tr('sec.')]]
  return (
    <section className="pg-block pg-countdown">
      {block.label && <h3>{block.label}</h3>}
      {left.done ? <p className="pg-big">{tr('It’s here!')}</p> : (
        <div className="pg-count">
          {parts.map(([n, l]) => <div key={l}><b>{String(n).padStart(2, '0')}</b><span>{l}</span></div>)}
        </div>
      )}
    </section>
  )
}

function Signup({ block, onSignup }: { block: Extract<PageBlock, { type: 'signup' }>; onSignup?: (email: string) => void }) {
  const tr = useT()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)
  return (
    <section className="pg-block pg-signup">
      {block.heading && <h3>{block.heading}</h3>}
      {sent ? <p>{tr('Thanks – you’re on the list.')}</p> : (
        <form onSubmit={(e) => {
          e.preventDefault()
          if (!validEmail(email)) return setError(true)
          onSignup?.(email.trim().toLowerCase())
          setSent(true)
        }}>
          <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(false) }} placeholder={tr('Your email')} aria-label={tr('Your email')} aria-invalid={error} />
          <button className="pg-button">{block.button || tr('Sign me up')}</button>
        </form>
      )}
    </section>
  )
}

export function PageView({ page, project, onSignup }: { page: WebPage; project: Project; onSignup?: (email: string) => void }) {
  const brand = brandOf(project)
  const c = pageColours(brand, page.theme)
  const style = { '--pg-bg': c.bg, '--pg-ink': c.ink, '--pg-accent': c.accent, '--pg-on-accent': c.onAccent, fontFamily: `'${brand.body}', 'Inter Tight', sans-serif` } as CSSProperties
  const heading: CSSProperties = { fontFamily: `'${brand.heading}', 'Inter Tight', sans-serif` }
  return (
    <div className="pg" style={style}>
      <BrandFonts brand={brand} />
      <div className="pg-inner">
        <header className="pg-head"><Logo project={project} brand={brand} colour={c.ink} /></header>
        {page.blocks.map((b) => {
          switch (b.type) {
            case 'hero':
              return (
                <section key={b.id} className="pg-block pg-hero">
                  {b.image && <Img src={b.image} style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 14 }} />}
                  <h1 style={heading}>{b.heading}</h1>
                  {b.text && <p>{b.text}</p>}
                  {b.button?.label && <a className="pg-button" href={href(b.button.url)} target="_blank" rel="noopener noreferrer">{b.button.label}</a>}
                </section>
              )
            case 'links':
              return (
                <section key={b.id} className="pg-block pg-links">
                  {b.items.filter((l) => l.label).map((l) => <a key={l.id} className="pg-link" href={href(l.url)} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
                </section>
              )
            case 'text':
              return (
                <section key={b.id} className="pg-block pg-text">
                  {b.heading && <h2 style={heading}>{b.heading}</h2>}
                  {b.body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                </section>
              )
            case 'image':
              return b.src ? (
                <figure key={b.id} className="pg-block pg-image">
                  <Img src={b.src} alt={b.caption} style={{ width: '100%', borderRadius: 14 }} />
                  {b.caption && <figcaption>{b.caption}</figcaption>}
                </figure>
              ) : null
            case 'gallery':
              return b.images.length ? (
                <section key={b.id} className="pg-block pg-gallery">
                  {b.images.map((src) => <Img key={src} src={src} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }} />)}
                </section>
              ) : null
            case 'countdown':
              return <Countdown key={b.id} block={b} />
            case 'signup':
              return <Signup key={b.id} block={b} onSignup={onSignup} />
            case 'contact':
              return (
                <section key={b.id} className="pg-block pg-contact">
                  {b.email && <a href={`mailto:${b.email}`}><Mail size={16} /> {b.email}</a>}
                  {b.phone && <a href={`tel:${b.phone.replace(/\s/g, '')}`}><Phone size={16} /> {b.phone}</a>}
                  {b.address && <span><MapPin size={16} /> {b.address}</span>}
                </section>
              )
            case 'social':
              return (
                <section key={b.id} className="pg-block pg-social">
                  {b.links.filter((l) => l.url).map((l, i) => <a key={i} href={href(l.url)} target="_blank" rel="noopener noreferrer">{l.network}</a>)}
                </section>
              )
          }
        })}
      </div>
    </div>
  )
}
