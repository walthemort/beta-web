/**
 * Extra brand hub sections: logo rules (#8), type scale (#10), tone of voice (#11),
 * moodboard (#12), version history (#16) and the password/expiry gate (#13).
 */
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Check, History, Lock, RotateCcw, X } from 'lucide-react'
import { useSrc } from '../data/blobs'
import { formatDateLong, now, timeAgo, uid, useStore } from '../data/store'
import type { BrandHub, Project, StudioFile } from '../data/types'
import { brandRoles, pickFonts } from './palette'
import { mix, readableOn } from './color'
import { useT } from '../data/i18n'

function Wordmark({ project, style }: { project: Project; style?: CSSProperties }) {
  const { head } = pickFonts(project)
  return (
    <span
      className="rule-mark"
      style={{
        fontFamily: head ? `'${head}', var(--sans)` : project.cover.serif ? 'var(--serif)' : undefined,
        fontStyle: project.cover.serif ? 'italic' : undefined,
        fontWeight: project.cover.serif ? 400 : 600,
        ...style,
      }}
    >
      {project.cover.wordmark}
    </span>
  )
}

/* ---------- Logo rules (#8) ---------- */

export function LogoRulesView({ project }: { project: Project }) {
  const tr = useT()
  const r = project.hub.logoRules
  const roles = brandRoles(project.hub.colours)
  const bg = roles.light
  const fg = roles.primary
  // Visual "don'ts", generated from the brand's own wordmark.
  const donts: { label: string; style: CSSProperties; box?: CSSProperties }[] = [
    { label: 'Don’t stretch it', style: { transform: 'scaleX(1.6)' } },
    { label: 'Don’t rotate it', style: { transform: 'rotate(-14deg)' } },
    { label: 'Don’t recolour it', style: { color: '#e0673a' } },
    { label: 'Don’t add effects', style: { textShadow: '3px 3px 0 rgb(0 0 0 / 0.35), 0 0 12px #ff0' } },
    { label: 'Don’t use low contrast', style: { color: mix(fg, '#ffffff', 0.28) }, box: { background: fg } },
    { label: 'Don’t place it on busy images', style: { color: '#fff' }, box: { background: 'repeating-linear-gradient(45deg, #c9a 0 8px, #8a9 8px 16px, #fc6 16px 24px)' } },
  ]
  return (
    <div className="rules">
      <div className="rules-top">
        <figure className="clearspace card" style={{ background: bg }}>
          <div className="cs-outer" style={{ padding: `calc(${r.clearSpace} * 1.1em)`, fontSize: 64, color: fg }}>
            <div className="cs-inner">
              <Wordmark project={project} />
              <span className="cs-x" style={{ height: '1.1em' }}>x</span>
            </div>
          </div>
          {/* The card takes the brand's light colour, so its text can't follow the page theme. */}
          <figcaption style={{ color: readableOn(bg) }}>
            <b>{tr('Clear space')}</b>
            <span style={{ opacity: 0.7 }}>{tr('Keep at least')} {r.clearSpace === 1 ? 'x' : `${r.clearSpace}x`} {tr('free around the logo, where x is the height of the logo.')}</span>
          </figcaption>
        </figure>
        <figure className="minsize card">
          <div className="ms-row">
            {[1, 0.6, 0.36].map((s) => (
              <span key={s} style={{ fontSize: 40 * s, color: fg, opacity: s < 0.4 ? 0.35 : 1 }}>
                <Wordmark project={project} />
              </span>
            ))}
          </div>
          <figcaption>
            <b>{tr('Minimum size')}</b>
            <span className="muted">{r.minWidthPx} {tr('px wide on screen ·')} {r.minWidthMm} {tr('mm in print. Smaller than that, it stops being readable.')}</span>
          </figcaption>
        </figure>
      </div>
      <div className="dos">
        <div className="card panel">
          <h3 style={{ color: 'var(--green)' }}>{tr('Do')}</h3>
          <ul className="rule-list">{r.dos.map((d) => <li key={d}><Check size={14} /> {tr(d)}</li>)}</ul>
        </div>
        <div className="card panel">
          <h3 style={{ color: 'var(--danger)' }}>{tr('Don’t')}</h3>
          <ul className="rule-list bad">{r.donts.map((d) => <li key={d}><X size={14} /> {tr(d)}</li>)}</ul>
        </div>
      </div>
      <div className="dont-grid">
        {donts.map((d) => (
          <figure key={d.label} className="dont">
            <div className="dont-box" style={{ background: bg, ...d.box }}>
              <span style={{ fontSize: 34, color: fg, display: 'inline-block', ...d.style }}><Wordmark project={project} /></span>
              <i className="dont-x"><X size={14} /></i>
            </div>
            <figcaption>{tr(d.label)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

/* ---------- Type scale (#10) ---------- */

const STEPS = [
  { name: 'Display', power: 5, font: 'head' as const, weight: 400, sample: (p: Project) => p.cover.wordmark },
  { name: 'Heading 1', power: 4, font: 'head' as const, weight: 500, sample: (p: Project) => p.tagline || 'A brighter kind of everyday.' },
  { name: 'Heading 2', power: 3, font: 'head' as const, weight: 500, sample: () => 'Made to feel like home' },
  { name: 'Heading 3', power: 2, font: 'head' as const, weight: 500, sample: () => 'Good design is good business' },
  { name: 'Body', power: 0, font: 'body' as const, weight: 400, sample: () => 'The quick brown fox jumps over the lazy dog. Clear, simple and easy to read.' },
  { name: 'Small', power: -1, font: 'body' as const, weight: 400, sample: () => 'Supporting text, captions and footnotes.' },
]

export function typeSteps(hub: BrandHub) {
  const { base, ratio } = hub.typeScale
  return STEPS.map((s) => ({ ...s, px: Math.round(base * ratio ** s.power) }))
}

export function TypeScaleView({ project }: { project: Project }) {
  const tr = useT()
  const fonts = pickFonts(project)
  return (
    <div className="typescale card">
      {typeSteps(project.hub).map((s) => {
        const family = fonts[s.font]
        return (
          <div key={s.name} className="ts-row">
            <span className="ts-meta"><b>{tr(s.name)}</b><small>{s.px} {tr('px ·')} {(s.px / 16).toFixed(2).replace(/\.?0+$/, '')} {tr('rem')}{family ? ` · ${family}` : ''}</small></span>
            <span className="ts-sample" style={{ fontSize: s.px, fontWeight: s.weight, fontFamily: family ? `'${family}', var(--sans)` : undefined, lineHeight: s.power > 1 ? 1.08 : 1.5 }}>
              {tr(s.sample(project))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Tone of voice (#11) ---------- */

export function ToneView({ project }: { project: Project }) {
  const tr = useT()
  const t = project.hub.tone
  if (!t.summary && !t.weAre.length && !t.examples.length) return <p className="muted">{tr('The tone of voice will appear here once the studio adds it.')}</p>
  const { head } = pickFonts(project)
  return (
    <div className="tone">
      {t.summary && <p className="tone-summary" style={{ fontFamily: head ? `'${head}', var(--sans)` : undefined }}>{t.summary}</p>}
      {(t.weAre.length > 0 || t.weAreNot.length > 0) && (
        <div className="tone-words">
          <div><span className="eyebrow">{tr('We are')}</span><div className="chips">{t.weAre.map((w) => <span key={w} className="word yes">{w}</span>)}</div></div>
          <div><span className="eyebrow">{tr('We are not')}</span><div className="chips">{t.weAreNot.map((w) => <span key={w} className="word no">{w}</span>)}</div></div>
        </div>
      )}
      {t.examples.length > 0 && (
        <div className="tone-examples">
          {t.examples.map((e) => (
            <div key={e.id} className="card tone-ex">
              <p className="say"><Check size={14} /> “{e.say}”</p>
              <p className="dont-say"><X size={14} /> “{e.dontSay}”</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Moodboard (#12) ---------- */

function MoodImage({ file }: { file: StudioFile }) {
  const url = useSrc(file.versions.at(-1)?.src)
  return url ? <img src={url} alt={file.name} loading="lazy" /> : null
}

export function MoodboardView({ project }: { project: Project }) {
  const tr = useT()
  const { state } = useStore()
  const images = state.files.filter((f) => f.projectId === project.id && f.category === 'Moodboard' && f.published && f.versions.at(-1)?.mime.startsWith('image/'))
  if (!project.hub.imagery && !images.length) return <p className="muted">{tr('Photo direction will appear here once the studio adds it.')}</p>
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {project.hub.imagery && <p className="imagery">{project.hub.imagery}</p>}
      {images.length > 0 && <div className="mood">{images.map((f) => <figure key={f.id}><MoodImage file={f} /></figure>)}</div>}
    </div>
  )
}

/* ---------- Version history (#16) ---------- */

const snapshotOf = (hub: BrandHub): Omit<BrandHub, 'access'> => {
  const { access: _omit, ...rest } = hub
  return JSON.parse(JSON.stringify(rest))
}

/** What changed between two hub snapshots, in plain words. */
function describeChanges(prev: Omit<BrandHub, 'access'> | undefined, next: Omit<BrandHub, 'access'>) {
  if (!prev) return ['First published version']
  const out: string[] = []
  // Match by id, so a rename reads as a rename rather than “added + removed”.
  const diff = <T extends { id: string; name: string }>(a: T[], b: T[], kind: string, same: (x: T, y: T) => string | null) => {
    b.filter((x) => !a.some((y) => y.id === x.id)).forEach((x) => out.push(`Added ${kind} ${x.name}`))
    a.filter((x) => !b.some((y) => y.id === x.id)).forEach((x) => out.push(`Removed ${kind} ${x.name}`))
    b.forEach((x) => {
      const old = a.find((y) => y.id === x.id)
      if (!old) return
      if (old.name !== x.name) out.push(`${old.name} renamed to ${x.name}`)
      const other = same(old, x)
      if (other) out.push(other)
    })
  }
  diff(prev.colours, next.colours, 'colour', (o, n) => (o.hex.toLowerCase() !== n.hex.toLowerCase() ? `${n.name} changed to ${n.hex.toUpperCase()}` : null))
  diff(prev.fonts, next.fonts, 'font', (o, n) => (o.usage !== n.usage ? `${n.name} now used for ${n.usage || '—'}` : null))
  if (JSON.stringify(prev.logoRules) !== JSON.stringify(next.logoRules)) out.push('Logo rules updated')
  if (JSON.stringify(prev.tone) !== JSON.stringify(next.tone)) out.push('Tone of voice updated')
  if (JSON.stringify(prev.typeScale) !== JSON.stringify(next.typeScale)) out.push('Type scale updated')
  if (prev.imagery !== next.imagery) out.push('Photo direction updated')
  return out.length ? out : ['No visible changes']
}

export function HubVersions({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const versions = state.hubVersions.filter((v) => v.projectId === project.id).sort((a, b) => b.at.localeCompare(a.at))
  const [note, setNote] = useState('')
  const latest = versions[0]
  const pending = latest ? describeChanges(latest.snapshot, snapshotOf(project.hub)) : ['Not published yet']
  const unchanged = latest && pending[0] === 'No visible changes'

  function publish(e: FormEvent) {
    e.preventDefault()
    const label = `Version ${versions.length + 1}`
    dispatch({
      type: 'insert',
      coll: 'hubVersions',
      item: { id: uid(), projectId: project.id, label, note: note.trim() || undefined, snapshot: snapshotOf(project.hub), at: now() },
      log: { text: `Brand hub ${label.toLowerCase()} published${note.trim() ? `: ${note.trim()}` : ''}`, projectId: project.id, notify: true, link: `/p/${project.id}/hub` },
    })
    setNote('')
  }

  return (
    <section className="card panel">
      <h3><History size={15} style={{ verticalAlign: -2 }} /> {tr('Versions')}</h3>
      <p className="muted" style={{ fontSize: 13 }}>{tr('Publish a version to tell the client what changed. Earlier versions can be restored.')}</p>
      {!unchanged && (
        <form onSubmit={publish} style={{ display: 'grid', gap: 8 }}>
          <ul className="changes">{pending.map((c) => <li key={c}>{tr(c)}</li>)}</ul>
          <input className="input input-sm" placeholder={tr('Note for the client (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary btn-sm" type="submit">{tr('Publish version')} {versions.length + 1}</button>
        </form>
      )}
      {unchanged && <p className="muted" style={{ fontSize: 13 }}>{tr('Everything is published.')}</p>}
      <div className="list">
        {versions.map((v) => (
          <div key={v.id} className="list-item">
            <span className="grow"><span>{v.label}{v.note ? ` · ${v.note}` : ''}</span><small>{timeAgo(v.at)}</small></span>
            {v.id !== latest?.id && (
              <button
                className="btn btn-ghost btn-sm"
                title={tr('Restore this version into the editor')}
                onClick={() => dispatch({ type: 'updateProject', id: project.id, patch: { hub: { ...project.hub, ...v.snapshot, updatedAt: now() } }, log: { text: `Brand hub restored to ${v.label}`, projectId: project.id } })}
              >
                <RotateCcw size={13} /> {tr('Restore')}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function HubChangelog({ project }: { project: Project }) {
  const tr = useT()
  const { state } = useStore()
  const versions = state.hubVersions.filter((v) => v.projectId === project.id).sort((a, b) => a.at.localeCompare(b.at))
  if (!versions.length) return null
  return (
    <details className="changelog">
      <summary>{versions.at(-1)!.label} · {formatDateLong(versions.at(-1)!.at)} {tr('— what’s new')}</summary>
      {[...versions].reverse().map((v) => {
        const prev = versions[versions.indexOf(v) - 1]
        return (
          <div key={v.id} className="cl-item">
            <b>{v.label}</b> <small className="muted">{formatDateLong(v.at)}</small>
            {v.note && <p>{v.note}</p>}
            <ul className="changes">{describeChanges(prev?.snapshot, v.snapshot).map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )
      })}
    </details>
  )
}

/* ---------- Password & expiry (#13) ---------- */

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Asks for the hub password and hides expired links. Note: while Aftryk runs without a server this
 * keeps casual visitors out, but it isn’t real security – that arrives with login (Supabase).
 */
export function HubGate({ project, children }: { project: Project; children: ReactNode }) {
  const tr = useT()
  const { state } = useStore()
  const access = project.hub.access
  const key = `forme:hub-unlocked:${project.id}`
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(key) === access.passwordHash
    } catch {
      return false
    }
  })
  const [pw, setPw] = useState('')
  const [wrong, setWrong] = useState(false)
  useEffect(() => setWrong(false), [pw])

  if (access.expiresAt && access.expiresAt < new Date().toISOString().slice(0, 10))
    return (
      <div className="gate card">
        <Lock size={22} />
        <h2>{tr('This link has expired')}</h2>
        <p className="muted">{tr('Ask {studio} for a new one.', { studio: state.studio.name })}</p>
      </div>
    )
  if (!access.passwordHash || unlocked) return <>{children}</>

  return (
    <form
      className="gate card"
      onSubmit={async (e) => {
        e.preventDefault()
        if ((await sha256(pw)) === access.passwordHash) {
          try {
            sessionStorage.setItem(key, access.passwordHash!)
          } catch {
            /* ignore */
          }
          setUnlocked(true)
        } else setWrong(true)
      }}
    >
      <Lock size={22} />
      <h2>{tr('This brand hub is protected')}</h2>
      <p className="muted">{tr('Enter the password you got from')} {state.studio.name}.</p>
      <input className="input" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-label={tr('Password')} style={{ maxWidth: 280 }} />
      {wrong && <p className="error">{tr('That’s not the right password.')}</p>}
      <button className="btn btn-primary" type="submit" disabled={!pw}>{tr('Open')}</button>
    </form>
  )
}
