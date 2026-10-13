import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { BrandColour, Project } from '../data/types'
import { COLOUR_ROLES } from '../data/types'
import { accessibleShade, clashes, contrast, darkVariant, formats, isLight, luminance, mix, printShift, rating, readableOn, simulate, VISION_LABELS, VISION_TYPES, type Vision } from './color'
import { useT } from '../data/i18n'

/** Colours ordered by how much they're used (then by role), with usage normalised to 100%. */
export function orderedColours(colours: BrandColour[]) {
  const order = (c: BrandColour) => (c.role ? COLOUR_ROLES.indexOf(c.role) : 9)
  const sorted = [...colours].sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0) || order(a) - order(b))
  const total = sorted.reduce((s, c) => s + (c.usage ?? 0), 0)
  return sorted.map((c) => ({ ...c, share: total > 0 ? ((c.usage ?? 0) / total) * 100 : 100 / sorted.length }))
}

/** Picks colours by role, falling back sensibly when a role is missing. */
export function brandRoles(colours: BrandColour[]) {
  const list = orderedColours(colours)
  const by = (r: BrandColour['role']) => list.find((c) => c.role === r)
  const byLum = [...list].sort((a, b) => luminance(b.hex) - luminance(a.hex))
  const primary = by('Primary') ?? list[0]
  const light = byLum.find((c) => isLight(c.hex))
  const dark = [...byLum].reverse().find((c) => !isLight(c.hex))
  return {
    primary: primary?.hex ?? '#1a4dff',
    secondary: (by('Secondary') ?? dark ?? primary)?.hex ?? '#111111',
    accent: (by('Accent') ?? list[1] ?? primary)?.hex ?? '#ffd23f',
    light: light?.hex ?? '#f6f5ef',
    dark: dark?.hex ?? '#111111',
  }
}

/** Headline and body fonts, chosen by what the studio wrote they're used for. */
export function pickFonts(project: Project) {
  const fonts = project.hub.fonts
  const find = (re: RegExp) => fonts.find((f) => re.test(f.usage))
  const head = (find(/head|display|title/i) ?? fonts[0])?.name
  const body = (find(/body|text|copy/i) ?? fonts.find((f) => !/label|mono|caption/i.test(f.usage)) ?? fonts[0])?.name
  return { head, body }
}

/** Older browsers, and any page not served over https, have no clipboard API. */
function copyFallback(value: string) {
  try {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;top:-100px;opacity:0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

type Toast = { id: number; text: string; hex?: string; ok: boolean }

/** Copying, with a word about what happened – it's easy to click a colour and not be sure it worked. */
function useCopy() {
  const t = useT()
  const [copied, setCopied] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  async function copy(value: string, what?: { name: string; hex?: string }) {
    let ok = true
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(value)
      else ok = copyFallback(value)
    } catch {
      ok = copyFallback(value)
    }
    timers.current.forEach(clearTimeout)
    timers.current = []
    setCopied(ok ? value : null)
    setToast({
      id: Date.now(),
      hex: what?.hex,
      ok,
      text: ok
        ? t('{name} was copied to the clipboard', { name: what?.name ?? value })
        : t('Could not copy. Select {value} and press Cmd+C.', { value }),
    })
    timers.current.push(
      window.setTimeout(() => setCopied(null), 1400),
      window.setTimeout(() => setToast(null), ok ? 2600 : 6000),
    )
  }

  const toastNode = toast && (
    <div className={'copy-toast' + (toast.ok ? '' : ' bad')} role="status" key={toast.id}>
      {toast.hex && <i style={{ background: toast.hex }} aria-hidden="true" />}
      {toast.text}
    </div>
  )
  return { copied, copy, toastNode }
}

/** Where each band sits and how wide it is, in percentages. Equal at rest; the hovered one opens. */
export function stripLayout(count: number, hovered = -1, expanded = 55) {
  const even = 100 / Math.max(1, count)
  const rest = hovered < 0 || even >= expanded ? even : (100 - expanded) / Math.max(1, count - 1)
  let x = 0
  return Array.from({ length: count }, (_, i) => {
    const w = hovered < 0 || even >= expanded ? even : i === hovered ? expanded : rest
    const at = x
    x += w
    return { x: at, w }
  })
}

export function Palette({ project }: { project: Project }) {
  const tr = useT()
  const colours = useMemo(() => orderedColours(project.hub.colours), [project.hub.colours])
  const [selId, setSelId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [surface, setSurface] = useState<'light' | 'dark'>('light')
  const [vision, setVision] = useState<Vision>('normal')
  const [showAvoid, setShowAvoid] = useState(false)
  const { copied, copy, toastNode } = useCopy()
  const roles = brandRoles(project.hub.colours)
  const headFont = pickFonts(project).head

  if (!colours.length) return <p className="muted">{tr('Colours will appear here once the studio publishes them.')}</p>
  const sel = colours.find((c) => c.id === selId) ?? colours[0]
  const layout = stripLayout(colours.length, colours.findIndex((c) => c.id === hoverId))
  const surfaceHex = surface === 'light' ? roles.light : roles.dark

  // Colours that stop being distinguishable once simulated.
  const clashing = colours
    .flatMap((a, i) => colours.slice(i + 1).map((b) => [a, b] as const))
    .filter(([a, b]) => vision !== 'normal' && clashes(a.hex, b.hex, vision))
    .map(([a, b]) => [a.name, b.name])

  // Every text-on-background combination, scored for accessibility.
  const pairs = colours
    .flatMap((bg) => colours.filter((fg) => fg.id !== bg.id).map((fg) => ({ bg, fg, ratio: contrast(bg.hex, fg.hex) })))
    .sort((a, b) => b.ratio - a.ratio)
  const good = pairs.filter((p) => rating(p.ratio).ok !== 'no')
  const avoid = pairs.filter((p) => rating(p.ratio).ok === 'no')
  const partners = good.filter((p) => p.bg.id === sel.id)
  const print = printShift(sel.hex)
  const cmyk = formats(sel.hex).find((f) => f.label === 'CMYK')?.value ?? ''
  const dark = darkVariant(sel.hex, roles.dark)

  return (
    <div className="palette-wrap">
      {toastNode}
      {/*
        1. The colours: equal bands that open when you point at one. Only transforms change while it
        animates, so the browser moves layers instead of repainting. A label that runs past its band
        is covered by the next band's fill, which is what keeps it inside its own colour.
      */}
      <div className="strip" role="listbox" aria-label={tr('Brand colours')} onMouseLeave={() => setHoverId(null)}>
        {colours.map((c, i) => {
          const shown = simulate(c.hex, vision)
          const fg = readableOn(shown)
          const { x, w } = layout[i]
          const narrow = w < 12
          return (
            <button
              key={c.id}
              role="option"
              aria-selected={c.id === sel.id}
              className={'band' + (narrow ? ' narrow' : '') + (c.id === sel.id ? ' sel' : '')}
              style={{ color: fg, ['--x' as string]: `${x}%`, ['--w' as string]: `${w}%`, ['--s' as string]: w / 100 }}
              onMouseEnter={() => setHoverId(c.id)}
              onFocus={() => setHoverId(c.id)}
              onBlur={() => setHoverId((h) => (h === c.id ? null : h))}
              onClick={() => {
                setSelId(c.id)
                copy(c.hex.toUpperCase(), { name: c.name, hex: c.hex })
              }}
              title={tr('Copy {x0}', { x0: c.hex.toUpperCase() })}
            >
              <span className="band-fill" style={{ background: shown }} aria-hidden="true" />
              {copied === c.hex.toUpperCase() && (
                <span className="band-copied" role="status" style={{ background: fg, color: c.hex }}><Check size={13} /> {tr('Copied')}</span>
              )}
              <span className="band-label">
                <b>{c.name}</b>
                <span className="band-meta">
                  <code>{c.hex.toUpperCase()}</code>
                  {c.role && <span>{tr(c.role)}</span>}
                  <span>{Math.round(c.share)}%</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="pal-vision">
        <p className="muted" style={{ fontSize: 12 }}>{tr('Point at a colour to open it. Click to copy its HEX and see all the details.')}</p>
        <label className="field">
          <span className="muted" style={{ fontSize: 12 }}>{tr('Seen as')}</span>
          <select className="input input-sm" value={vision} onChange={(e) => setVision(e.target.value as Vision)} aria-label={tr('Colour vision')}>
            {VISION_TYPES.map((v) => <option key={v} value={v}>{tr(VISION_LABELS[v])}</option>)}
          </select>
        </label>
      </div>
      {vision !== 'normal' && clashing.length > 0 && (
        <div className="banner banner-warn" role="status">
          <span>{tr('Hard to tell apart with this kind of colour vision:')} <b>{clashing.map((c) => c.join(' / ')).join(', ')}</b></span>
        </div>
      )}

      {/* 2. How much of each colour to use – the one place where size means something. */}
      <div className="pal-usage">
        <span className="eyebrow">{tr('How much to use')}</span>
        <div className="pal-bar" role="img" aria-label={colours.map((c) => `${c.name} ${Math.round(c.share)}%`).join(', ')}>
          {colours.map((c) => (
            <span key={c.id} style={{ background: c.hex, flexGrow: c.share }} className={c.id === sel.id ? 'on' : undefined}>
              {c.share >= 12 && <small style={{ color: readableOn(c.hex) }}>{Math.round(c.share)}%</small>}
            </span>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12 }}>{tr('A rough guide to the mix: the primary carries most of the work, the accent is used sparingly.')}</p>
      </div>

      {/* 2. Detail for the selected colour. */}
      <div className="colour-detail card">
        <div className="cd-swatch" style={{ background: sel.hex, color: readableOn(sel.hex) }}>
          <span style={{ fontFamily: headFont ? `'${headFont}', var(--sans)` : undefined }}>{tr('Aa')}</span>
          <small>{sel.role ?? tr('Colour')} · {Math.round(sel.share)}%</small>
        </div>
        <div className="cd-body">
          <h3>{sel.name}</h3>
          <div className="cd-formats">
            {formats(sel.hex).map((f) => (
              <button key={f.label} className="cd-format" onClick={() => copy(f.value, { name: `${sel.name} ${f.label}`, hex: sel.hex })} aria-label={tr('Copy {label} {value}', { label: f.label, value: f.value })}>
                <small>{f.label}</small>
                <code>{f.value}</code>
                {copied === f.value ? <Check size={13} /> : <Copy size={13} />}
              </button>
            ))}
          </div>

          <div className="cd-extras">
            <div className="cd-extra">
              <span className="eyebrow">{tr('In print')}</span>
              <div className="cd-print">
                <i style={{ background: sel.hex }} title={sel.hex.toUpperCase()} />
                <i style={{ background: print.printed }} title={print.printed} />
                <span>
                  {print.warn ? tr('Shifts noticeably in CMYK. Ask the printer for a proof.') : tr('Prints close to what you see.')}
                  <br />
                  <button className="link-btn" onClick={() => copy(cmyk, { name: `${sel.name} CMYK`, hex: sel.hex })}>{tr('Copy CMYK')} {cmyk}</button>
                </span>
              </div>
            </div>
            <div className="cd-extra">
              <span className="eyebrow">{tr('On a dark background')}</span>
              <div className="cd-print">
                <i style={{ background: dark, boxShadow: 'inset 0 0 0 1px rgb(128 128 128 / 0.4)' }} title={dark} />
                <span>
                  {tr('Use this instead of the original in dark mode.')}
                  <br />
                  <button className="link-btn" onClick={() => copy(dark, { name: `${sel.name} ${tr('dark')}`, hex: dark })}>{tr('Copy')} {dark}</button>
                </span>
              </div>
            </div>
          </div>

          <div className="cd-row-head">
            <span className="eyebrow">{tr('Tints')}</span>
            <div className="seg" role="group" aria-label={tr('Surface')}>
              <button aria-pressed={surface === 'light'} onClick={() => setSurface('light')}>{tr('Light surface')}</button>
              <button aria-pressed={surface === 'dark'} onClick={() => setSurface('dark')}>{tr('Dark surface')}</button>
            </div>
          </div>
          <div className="tints" style={{ background: surfaceHex }}>
            {[100, 75, 50, 25, 10].map((pct) => {
              const hex = mix(sel.hex, surfaceHex, 1 - pct / 100)
              return (
                <button key={pct} className="tint" style={{ background: hex, color: readableOn(hex) }} onClick={() => copy(hex, { name: `${sel.name} ${pct}%`, hex })} title={tr('Copy {hex}', { hex })}>
                  <small>{pct}%</small>
                  <code>{copied === hex ? tr('Copied') : hex}</code>
                </button>
              )
            })}
          </div>

          <span className="eyebrow">{tr('Text colours that work on')} {sel.name}</span>
          {partners.length ? (
            <div className="partners">
              {partners.map((p) => (
                <span key={p.fg.id} className="partner" style={{ background: sel.hex, color: p.fg.hex }}>
                  {tr('Aa')} {p.fg.name} <small>{p.ratio.toFixed(1)}:1 · {rating(p.ratio).label}</small>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>{tr('No brand colour has enough contrast on {name}. Use {colour} for text.', { name: sel.name, colour: readableOn(sel.hex) === '#ffffff' ? tr('white') : tr('black') })}</p>
          )}
        </div>
      </div>

      {/* 3. Pairings, scored against WCAG. */}
      <div className="section-head" style={{ marginTop: 16, marginBottom: 0 }}>
        <h2>{tr('Colour pairings')}</h2>
        {avoid.length > 0 && (
          <button className="btn btn-sm btn-ghost" onClick={() => setShowAvoid(!showAvoid)}>
            {showAvoid ? tr('Hide') : tr('Show')} {avoid.length} {tr('to avoid')}
          </button>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        {tr('Checked against WCAG contrast rules.')} <b>{tr('AA')}</b> {tr('and')} <b>{tr('AAA')}</b> {tr('are safe for body text;')} <b>{tr('AA Large')}</b> {tr('only for headlines.')}
      </p>
      <div className="pairs">
        {(showAvoid ? [...good, ...avoid] : good).map((p) => {
          const r = rating(p.ratio)
          return (
            <div key={p.bg.id + p.fg.id} className={'pair' + (r.ok === 'no' ? ' bad' : '')} style={{ background: p.bg.hex, color: p.fg.hex }}>
              <span className="pair-aa" style={{ fontFamily: headFont ? `'${headFont}', var(--sans)` : undefined }}>{tr('Aa')}</span>
              <span className="pair-text">{r.ok === 'large' ? tr('Headlines only') : project.tagline || tr('Good design is good business.')}</span>
              <span className="pair-foot">
                <span>{tr('{fg} on {bg}', { fg: p.fg.name, bg: p.bg.name })}</span>
                <span className={'pair-badge ' + r.ok}>{r.label} · {p.ratio.toFixed(1)}</span>
              </span>
              {r.ok === 'no' && (() => {
                const fix = accessibleShade(p.fg.hex, p.bg.hex)
                return fix ? (
                  <button
                    className="pair-fix"
                    style={{ background: fix.hex, color: p.bg.hex }}
                    onClick={() => copy(fix.hex, { name: tr('{name}, readable', { name: p.fg.name }), hex: fix.hex })}
                    title={tr('A shade of {name} that passes AA on {bg}', { name: p.fg.name, bg: p.bg.name })}
                  >
                    {tr('Make it readable')} · {fix.hex} · {fix.ratio.toFixed(1)}
                  </button>
                ) : null
              })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
