import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { Download, Shuffle } from 'lucide-react'
import { useStore } from '../data/store'
import type { Project } from '../data/types'
import { contrast, isLight, mix, readableOn } from './color'
import { brandRoles, orderedColours, pickFonts } from './palette'
import { useT } from '../data/i18n'

type Scheme = { bg: string; fg: string; accent: string; light: string; dark: string }

/** Background/text combinations that pass contrast, most "on brand" first. */
function schemes(project: Project): Scheme[] {
  const cols = orderedColours(project.hub.colours)
  const r = brandRoles(project.hub.colours)
  if (!cols.length) {
    const { bg, fg } = project.cover
    return [{ bg, fg, accent: fg, light: '#ffffff', dark: '#111111' }]
  }
  const out: Scheme[] = []
  for (const bg of cols) {
    const fgs = cols.filter((c) => c.id !== bg.id && contrast(bg.hex, c.hex) >= 3).sort((a, b) => contrast(bg.hex, b.hex) - contrast(bg.hex, a.hex))
    const fg = fgs[0]?.hex ?? readableOn(bg.hex)
    // Prefer the colour marked "Accent" for shapes and details.
    const candidates = cols.filter((c) => c.id !== bg.id && c.hex !== fg && contrast(bg.hex, c.hex) >= 1.5)
    const accent = (candidates.find((c) => c.role === 'Accent') ?? candidates[0])?.hex ?? fg
    out.push({ bg: bg.hex, fg, accent, light: r.light, dark: r.dark })
  }
  return out
}

/** Mockups always use the text wordmark: it takes any colour, so it never looks boxed in. */
function Wordmark({ project, style, className }: { project: Project; style?: CSSProperties; className?: string }) {
  const font = pickFonts(project).head
  return (
    <span
      className={'mk-wordmark ' + (className ?? '')}
      style={{
        fontFamily: font ? `'${font}', var(--sans)` : project.cover.serif ? 'var(--serif)' : undefined,
        fontStyle: project.cover.serif ? 'italic' : undefined,
        fontWeight: project.cover.serif ? 400 : 600,
        ...style,
      }}
    >
      {project.cover.wordmark}
    </span>
  )
}

export function Mockups({ project }: { project: Project }) {
  const { state } = useStore()
  const client = state.clients.find((c) => c.id === project.clientId)
  const all = useMemo(() => schemes(project), [project])
  const [i, setI] = useState(0)
  const s = all[i % all.length]

  const t = useT()
  const { head, body } = pickFonts(project)
  const headStyle: CSSProperties = { fontFamily: head ? `'${head}', var(--sans)` : undefined }
  const bodyStyle: CSSProperties = { fontFamily: body ? `'${body}', var(--sans)` : undefined }
  const tagline = project.tagline || 'Good design is good business.'
  const domain = client?.contactEmail.split('@')[1] ?? `${(client?.name ?? 'brand').toLowerCase()}.com`
  const sceneBg = isLight(s.bg) ? mix(s.dark, '#ffffff', 0.86) : mix(s.bg, '#ffffff', 0.82)

  return (
    <div className="mockups-wrap">
      <div className="toolbar no-print" style={{ justifyContent: 'space-between' }}>
        <p className="muted" style={{ fontSize: 13 }}>{t('Generated from the brand’s colours, fonts and tagline. They update when the hub changes.')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {all.length > 1 && (
            <button className="btn btn-sm" onClick={() => setI(i + 1)}><Shuffle size={14} /> {t('Shuffle colours')}</button>
          )}
        </div>
      </div>

      <div className="mockups">
        {/* Business cards */}
        <Mk wide bg={sceneBg} label={t('Business cards')}>
          <div className="mk-cards">
            <div className="mk-card back" style={{ background: s.light, color: contrast(s.light, s.dark) >= 4.5 ? s.dark : readableOn(s.light) }}>
              <div style={{ ...bodyStyle }} className="mk-card-info">
                <b>{client?.contactName || t('Your Name')}</b>
                <span>{t('Founder')}</span>
                <span className="mk-gap" />
                <span>{client?.contactEmail || t('hello@brand.com')}</span>
                <span>{domain}</span>
              </div>
              <i className="mk-bar" style={{ background: s.accent === s.light ? s.bg : s.accent }} />
            </div>
            <div className="mk-card front" style={{ background: s.bg, color: s.fg }}>
              <Wordmark project={project} className="mk-card-mark" />
            </div>
          </div>
        </Mk>

        {/* Instagram post */}
        <Mk bg={sceneBg} label={t('Instagram post')}>
          <div className="mk-post" style={{ background: s.bg, color: s.fg }}>
            <i className="mk-blob" style={{ background: s.accent }} />
            <span className="mk-post-text" style={headStyle}>{tagline}</span>
            <Wordmark project={project} className="mk-post-mark" />
          </div>
        </Mk>

        {/* Website */}
        <Mk wide bg={sceneBg} label={t('Website')}>
          <div className="mk-browser">
            <div className="mk-browser-bar"><i /><i /><i /><span>{domain}</span></div>
            <div className="mk-site" style={{ background: s.light, color: s.dark }}>
              <nav style={bodyStyle}>
                <Wordmark project={project} className="mk-site-mark" style={{ color: s.bg === s.light ? s.dark : s.bg }} />
                <span>{t('Shop')}</span><span>{t('About')}</span><span>{t('Journal')}</span>
              </nav>
              <div className="mk-site-hero">
                <div>
                  <span className="mk-site-h" style={headStyle}>{tagline}</span>
                  <span className="mk-site-p" style={bodyStyle}>{project.description}</span>
                  <span className="mk-site-btn" style={{ background: s.bg === s.light ? s.dark : s.bg, color: s.bg === s.light ? s.light : s.fg, ...bodyStyle }}>{t('Discover more')}</span>
                </div>
                <div className="mk-site-img" style={{ background: `linear-gradient(135deg, ${s.bg}, ${mix(s.bg, s.accent, 0.6)})` }}>
                  <Wordmark project={project} style={{ color: s.fg }} className="mk-site-img-mark" />
                </div>
              </div>
            </div>
          </div>
        </Mk>

        {/* Poster */}
        <Mk bg={sceneBg} label={t('Poster')}>
          <div className="mk-poster" style={{ background: s.bg, color: s.fg }}>
            <span className="mk-poster-top" style={bodyStyle}>{client?.name} · {new Date().getFullYear()}</span>
            <Wordmark project={project} className="mk-poster-mark" />
            <span className="mk-poster-tag" style={headStyle}>{tagline}</span>
            <i className="mk-poster-stripe" style={{ background: s.accent }} />
          </div>
        </Mk>

        {/* Letterhead & envelope */}
        <Mk wide bg={sceneBg} label={t('Letterhead & envelope')}>
          <div className="mk-stationery">
            <div className="mk-letter" style={{ ...bodyStyle, color: s.dark }}>
              <div className="mk-letter-head">
                <Wordmark project={project} className="mk-letter-mark" style={{ color: s.bg === s.light ? s.dark : s.bg }} />
                <span>{client?.name}<br />{domain}</span>
              </div>
              <span className="mk-letter-date">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              {[92, 100, 86, 97, 64, 0, 95, 88, 100, 42].map((w, n) => <i key={n} className="mk-line" style={{ width: w + '%' }} />)}
              <i className="mk-letter-band" style={{ background: s.bg }} />
            </div>
            <div className="mk-envelope" style={{ background: s.bg, color: s.fg }}>
              <Wordmark project={project} className="mk-env-mark" />
              <i style={{ background: s.accent }} />
            </div>
          </div>
        </Mk>

        {/* App icon */}
        <Mk bg={`linear-gradient(160deg, ${mix(s.dark, '#ffffff', 0.25)}, ${s.dark})`} label={t('App icon')} light>
          <div className="mk-home">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) =>
              n === 5 ? (
                <span key={n} className="mk-app main">
                  <span className="mk-icon" style={{ background: s.bg, color: s.fg }}>
                    <Wordmark project={project} className="mk-icon-mark" />
                  </span>
                  <small style={bodyStyle}>{client?.name}</small>
                </span>
              ) : (
                <span key={n} className="mk-app"><span className="mk-icon ghost" /></span>
              ),
            )}
          </div>
        </Mk>

        {/* LinkedIn banner */}
        <Mk wide bg={sceneBg} label={t('LinkedIn banner')}>
          <div className="mk-linkedin">
            <div className="mk-li-banner" style={{ background: s.bg, color: s.fg }}>
              <span className="mk-li-tag" style={headStyle}>{tagline}</span>
              <i className="mk-li-shape" style={{ background: s.accent }} />
            </div>
            <div className="mk-li-body">
              <span className="mk-li-avatar" style={{ background: s.light, color: s.bg === s.light ? s.dark : s.bg, borderColor: '#fff' }}>
                <Wordmark project={project} className="mk-li-mark" />
              </span>
              <b style={bodyStyle}>{client?.name}</b>
              <small style={bodyStyle}>{project.description || tagline}</small>
              <span className="mk-li-btn" style={{ background: s.bg === s.light ? s.dark : s.bg, color: s.bg === s.light ? s.light : s.fg }}>{t('+ Follow')}</span>
            </div>
          </div>
        </Mk>

        {/* Tote bag */}
        <Mk bg={sceneBg} label={t('Tote bag')}>
          <div className="mk-tote">
            <i className="mk-tote-handle" style={{ borderColor: mix(s.light, '#000000', 0.18) }} />
            <div className="mk-tote-bag" style={{ background: s.light, color: s.bg === s.light ? s.dark : s.bg }}>
              <Wordmark project={project} className="mk-tote-mark" />
            </div>
          </div>
        </Mk>

        {/* Shop sign */}
        <Mk wide bg={`linear-gradient(180deg, #d9d6cf 0 62%, #bfbab0 62%)`} label={t('Shop sign')}>
          <div className="mk-shop">
            <div className="mk-shop-sign" style={{ background: s.bg, color: s.fg }}>
              <Wordmark project={project} className="mk-shop-mark" />
            </div>
            <div className="mk-shop-front">
              <i className="mk-shop-window" />
              <i className="mk-shop-door" style={{ background: s.dark }} />
              <i className="mk-shop-window" />
            </div>
            <span className="mk-shop-awning" style={{ background: `repeating-linear-gradient(90deg, ${s.accent} 0 8%, ${s.light} 8% 16%)` }} />
          </div>
        </Mk>

        {/* Packaging */}
        <Mk bg={sceneBg} label={t('Packaging')}>
          <div className="mk-box">
            <div className="mk-box-top" style={{ background: mix(s.bg, '#ffffff', 0.18) }} />
            <div className="mk-box-front" style={{ background: s.bg, color: s.fg }}>
              <Wordmark project={project} className="mk-box-mark" />
              <span style={bodyStyle}>{tagline}</span>
            </div>
            <div className="mk-box-side" style={{ background: mix(s.bg, '#000000', 0.22) }}>
              <i style={{ background: s.accent }} />
            </div>
          </div>
        </Mk>

        {/* Email signature */}
        <Mk wide bg={sceneBg} label={t('Email signature')}>
          <div className="mk-mail">
            <div className="mk-mail-bar"><i /><i /><i /><span>{t('New message')}</span></div>
            <div className="mk-mail-body" style={bodyStyle}>
              <p>Hi there,</p>
              <i className="mk-line" style={{ width: '90%', color: '#111' }} />
              <i className="mk-line" style={{ width: '70%', color: '#111' }} />
              <p>Best,</p>
              <div className="mk-sig">
                <span className="mk-sig-mark" style={{ background: s.bg, color: s.fg }}><Wordmark project={project} className="mk-sig-wm" /></span>
                <span className="mk-sig-text">
                  <b>{client?.contactName || t('Your Name')}</b>
                  <span>{client?.name} · {domain}</span>
                  <span style={{ color: s.bg === s.light ? s.dark : s.bg }}>{tagline}</span>
                </span>
              </div>
            </div>
          </div>
        </Mk>

        {/* Sticker */}
        <Mk bg={sceneBg} label={t('Sticker')}>
          <div className="mk-sticker" style={{ background: s.accent === s.bg ? s.dark : s.accent, color: readableOn(s.accent === s.bg ? s.dark : s.accent) }}>
            <svg viewBox="0 0 200 200" className="mk-sticker-ring" aria-hidden="true">
              <defs><path id={`ring-${project.id}`} d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" /></defs>
              <text style={{ ...bodyStyle, fontSize: 15, letterSpacing: 3, fill: 'currentColor' }}>
                <textPath href={`#ring-${project.id}`}>{`${tagline} · ${tagline} · `.toUpperCase().slice(0, 64)}</textPath>
              </text>
            </svg>
            <Wordmark project={project} className="mk-sticker-mark" />
          </div>
        </Mk>
      </div>
    </div>
  )
}

/** One mockup scene with a download-as-PNG button (#14). */
function Mk({ wide, bg, label, light, children }: { wide?: boolean; bg: string; label: string; light?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!ref.current) return
    setBusy(true)
    try {
      const { toPng } = await import('html-to-image')
      const url = await toPng(ref.current, { pixelRatio: 2, cacheBust: true, filter: (n) => !(n instanceof HTMLElement && n.dataset.noexport !== undefined) })
      const a = document.createElement('a')
      a.href = url
      a.download = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      a.click()
    } catch {
      alert('Sorry — this mockup could not be saved as an image in this browser.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <figure ref={ref} className={'mk' + (wide ? ' mk-wide' : '')} style={{ background: bg }}>
      {children}
      <figcaption style={light ? { color: '#fff' } : undefined}>{label}</figcaption>
      <button className="mk-save no-print" data-noexport onClick={save} disabled={busy} aria-label={`Download ${label} as PNG`}>
        <Download size={13} /> {busy ? 'Saving…' : 'PNG'}
      </button>
    </figure>
  )
}
