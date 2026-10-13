import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Layers, Minus } from 'lucide-react'
import { Logo } from '../components/ui'
import { RequestAccess } from './RequestAccess'
import { countryOf, guessCountry } from '../data/countries'
import { FEATURES, PLANS, formatPrice } from '../data/plans'
import './landing.css'

/** Fades content in once 10% is visible. Content is never hidden if IO isn't supported. */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return setShown(true)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={'reveal' + (shown ? ' in' : '')} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

const features = [
  {
    tag: 'Studio / In progress',
    title: 'Keep the work moving.',
    text: 'Briefs, proposals and flexible project boards. Everyone knows what’s next.',
    bullets: ['Project boards & next steps', 'Discovery, proposals & contracts', 'Invoices tracked per project'],
    visual: 'board',
  },
  {
    tag: 'Client / Review',
    title: 'Bring your clients closer.',
    text: 'Present ideas, collect feedback and share approved work in their own space.',
    bullets: ['A private portal for each client', 'Feedback on every version', 'Approve with one click'],
    visual: 'review',
  },
  {
    tag: 'Brand / Ready to go',
    title: 'Make the handover count.',
    text: 'Logos, colours, fonts and final files. Beautifully presented. Easy to download.',
    bullets: ['Logos, colours & fonts in one hub', 'Every format ready to download', 'Print-ready PDFs'],
    visual: 'hub',
  },
] as const

function FeatureVisual({ kind }: { kind: (typeof features)[number]['visual'] }) {
  if (kind === 'board')
    return (
      <div className="fv fv-board">
        {[
          ['Brand identity', 'Design', 'pill-blue'],
          ['Matchday motion', 'Review', 'pill-amber'],
          ['Website launch', 'Delivery', 'pill-green'],
        ].map(([name, stage, cls]) => (
          <div key={name} className="fv-row">
            <span>{name}</span>
            <span className={'pill ' + cls}>{stage}</span>
          </div>
        ))}
      </div>
    )
  if (kind === 'review')
    return (
      <div className="fv fv-review">
        <span className="fv-aa">Aa</span>
        <ArrowUpRight className="fv-arrow" size={40} strokeWidth={1.25} />
        <div className="fv-comment">
          <span className="avatar">AM</span>
          <span>“Love the lighter weight. Approved.”</span>
        </div>
      </div>
    )
  return (
    <div className="fv fv-hub">
      <span className="fv-ray">ray.</span>
      <div className="fv-dots">
        <i style={{ background: '#1a4dff' }} />
        <i style={{ background: '#f2f1ec' }} />
        <i style={{ background: '#111' }} />
      </div>
      <span className="fv-suite">Logo suite <ArrowUpRight size={14} /></span>
    </div>
  )
}

function AppPreview() {
  // A faithful miniature of the workspace Overview, so visitors see the real product.
  const cards = [
    { bg: '#d9e4a0', fg: '#2f3a1c', mark: 'kvist.', serif: true, name: 'Kvist', stage: 'Strategy', p: 40 },
    { bg: '#eab8a4', fg: '#2a1a14', mark: 'NORD', name: 'NORD', stage: 'Discovery', p: 20 },
    { bg: '#1a4dff', fg: '#fff', mark: 'ray.', name: 'RAY', stage: 'Design', p: 60 },
  ]
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-bar"><i /><i /><i /><span>aftryk.app/overview</span></div>
      <div className="preview-body">
        <aside className="preview-side">
          <Logo size={16} />
          {['Overview', 'Projects', 'Clients', 'Invoices', 'Brand hubs'].map((n, i) => (
            <span key={n} className={i === 0 ? 'on' : ''}>{n}</span>
          ))}
        </aside>
        <div className="preview-main">
          <span className="eyebrow">Studio overview</span>
          <strong>Good things in progress.</strong>
          <div className="preview-stats">
            {[['Active projects', '04'], ['Clients', '04'], ['Awaiting feedback', '01'], ['Open invoices', '01']].map(([l, v]) => (
              <div key={l}><small>{l}</small><b>{v}</b></div>
            ))}
          </div>
          <div className="preview-cards">
            {cards.map((c) => (
              <div key={c.name} className="preview-card">
                <div className="preview-cover" style={{ background: c.bg, color: c.fg }}>
                  <span className={c.serif ? 'serif' : ''}>{c.mark}</span>
                </div>
                <div className="preview-meta">
                  <b>{c.name}</b>
                  <small>{c.stage}</small>
                </div>
                <div className="progress"><span style={{ width: c.p + '%' }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** What each plan costs and includes, in the visitor's currency. Picking a plan starts setup on it. */
function Pricing() {
  // A best guess from the browser; the studio picks its country in setup, which settles it.
  const [country] = useState(() => countryOf(guessCountry()))
  const currency = country.currency
  return (
    <section className="l-section" id="pricing">
      <Reveal>
        <div className="l-pricing-head">
          <div>
            <span className="eyebrow">Pricing</span>
            <h2 className="l-h2">
              Start free.
              <br />
              <span style={{ color: 'var(--blue)' }}>Grow when you’re ready.</span>
            </h2>
            <p className="l-lead">Every plan includes the client portal, proposals, contracts, invoices and brand hubs. Move up when you need more room or more tools.</p>
          </div>
        </div>
      </Reveal>
      <div className="l-plans">
        {PLANS.map((p, i) => {
          const popular = p.id === 'pro'
          return (
            <Reveal key={p.id} delay={i * 60}>
              <article className={'l-plan' + (popular ? ' popular' : '')}>
                <div className="l-plan-top">
                  <h3>{p.name}</h3>
                  {popular && <span className="l-plan-tag">Most popular</span>}
                </div>
                <p className="muted">{p.tagline}</p>
                <div className="l-plan-price">
                  {p.prices[currency] ? (
                    <>
                      <b>{formatPrice(p.prices[currency], currency)}</b>
                      <span className="muted">/ month</span>
                    </>
                  ) : (
                    <b>Free</b>
                  )}
                </div>
                <Link className={'btn btn-lg' + (popular ? ' btn-primary' : '')} to={p.id === 'free' ? '/setup' : `/setup?plan=${p.id}`}>
                  {p.id === 'free' ? 'Start for free' : `Start with ${p.name}`} <ArrowUpRight size={16} />
                </Link>
                <ul>
                  <li><Check size={14} /> {p.limits.activeProjects === Infinity ? 'Unlimited projects' : `${p.limits.activeProjects} active projects`}</li>
                  <li><Check size={14} /> {p.limits.members === Infinity ? 'Unlimited team' : `Up to ${p.limits.members} people`}</li>
                  <li><Check size={14} /> {p.limits.storageGb} GB for files</li>
                  <li className={p.limits.apps ? undefined : 'off'}>
                    {p.limits.apps ? <Check size={14} /> : <Minus size={14} />} {p.limits.apps === Infinity ? 'Every app' : p.limits.apps ? `${p.limits.apps} apps of your choice` : 'No apps'}
                  </li>
                  {FEATURES.map((f) => (
                    <li key={f.id} className={p.features.includes(f.id) ? undefined : 'off'}>
                      {p.features.includes(f.id) ? <Check size={14} /> : <Minus size={14} />} {f.name}
                      {f.id === 'aiImages' && p.limits.aiImages > 0 && <small> · {p.limits.aiImages} a month</small>}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          )
        })}
      </div>
      <p className="l-plans-note">
        Free to use while Aftryk is in beta – we’ll tell you well before billing starts. Prices are per studio, in {currency.toUpperCase()}
        {country.code !== 'OTHER' && ` for ${country.name}`}, excl. {country.eu ? 'VAT' : 'tax'}. Pay yearly and get two months free.
      </p>
    </section>
  )
}

export default function Landing() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    document.title = 'Aftryk — The creative studio workspace'
  }, [])

  return (
    <div className="landing">
      <header className="l-header">
        <Link to="/" aria-label="Aftryk home"><Logo /></Link>
        <nav className="l-nav">
          <a href="#what-is-aftryk">What is Aftryk?</a>
          <a href="#pricing">Pricing</a>
          <button className="l-badge" onClick={() => setOpen(true)}>Early access</button>
        </nav>
        <Link to="/portal" className="l-portal">Client portal <ArrowUpRight size={15} /></Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">The creative studio workspace</span>
          <h1>
            Good work
            <br />
            leaves <span className="serif-accent">a mark.</span>
          </h1>
          <p className="hero-sub">
            Manage projects. Present ideas.
            <br />
            Deliver beautifully.
          </p>
          <p className="hero-diff">
            Replace the Dropbox folder, the PDF brand guide and the endless feedback email with one link.
          </p>
          <div className="hero-ctas">
            <button className="btn btn-primary btn-lg" onClick={() => setOpen(true)}>
              Request access <ArrowUpRight size={18} />
            </button>
            <Link className="btn btn-lg" to="/app">
              Go to your workspace <ArrowUpRight size={18} />
            </Link>
          </div>
          <span className="hero-tags">Brand / Motion / Web / Design</span>
        </div>

        <div className="hero-visual">
          <span className="eyebrow hero-label">Example brand hub</span>
          <div className="hub-card">
            <div className="hub-head">
              <span>aftryk / brand hub</span>
              <span className="eyebrow">Ray studio</span>
            </div>
            <div className="hub-blue">
              <span className="eyebrow" style={{ color: 'rgb(255 255 255 / 0.8)' }}>01 / Brand identity</span>
              <strong>ray.</strong>
              <span>A brighter kind of everyday.</span>
            </div>
            <div className="hub-grid">
              <div>
                <span className="eyebrow">Colour</span>
                <div className="hub-swatches">
                  {[100, 75, 50, 25, 10].map((o) => (
                    <i key={o} style={{ background: `color-mix(in srgb, #1a4dff ${o}%, #fff)` }}>
                      <small>{o}%</small>
                    </i>
                  ))}
                </div>
              </div>
              <div>
                <span className="eyebrow">Typography</span>
                <div className="hub-type">Aa Bb Cc</div>
                <small className="muted">Every detail, together.</small>
              </div>
            </div>
            <div className="hub-foot">
              <span className="hub-icon"><Layers size={18} /></span>
              <div>
                <b>Logo suite</b>
                <small className="muted">Ready to download.</small>
              </div>
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="hub-steps">
            <span><Check size={14} /> Brief</span>
            <i />
            <span><Check size={14} /> Create</span>
            <i />
            <span className="on"><ArrowUpRight size={14} /> Deliver</span>
          </div>
        </div>
      </section>

      <section className="l-section" id="what-is-aftryk">
        <Reveal>
          <span className="eyebrow">What is Aftryk?</span>
          <h2 className="l-h2">
            Your studio, together.
            <br />
            <span style={{ color: 'var(--blue)' }}>From brief to brand hub.</span>
          </h2>
          <p className="l-lead">
            Aftryk brings your projects, clients and creative work into one shared workspace. A little structure for your
            team. A beautiful handover for your clients.
          </p>
        </Reveal>
        <Reveal delay={60}>
          <AppPreview />
          <p className="preview-caption">Your studio at a glance. Projects, clients, proposals and invoices in one place.</p>
        </Reveal>
      </section>

      <section className="l-section features">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 60}>
            <article className="feature">
              <div className="feature-visual">
                <span className="eyebrow">{f.tag}</span>
                <FeatureVisual kind={f.visual} />
              </div>
              <h3>{f.title}</h3>
              <p className="muted">{f.text}</p>
              <ul>
                {f.bullets.map((b) => (
                  <li key={b}><Check size={14} /> {b}</li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </section>

      <Pricing />

      <section className="l-section l-final">
        <p>Brand, motion, web or a bit of everything.</p>
        <strong>Make room for the way you work.</strong>
        <button className="btn btn-primary btn-lg" onClick={() => setOpen(true)}>
          Request access <ArrowUpRight size={18} />
        </button>
      </section>

      <footer className="l-footer">
        <span>One space. From first idea to final file.</span>
        <span className="eyebrow">aftryk.app</span>
      </footer>

      {open && <RequestAccess onClose={() => setOpen(false)} />}
    </div>
  )
}
