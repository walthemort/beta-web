/**
 * The studio's own brand, for light and dark: logo slots, the two-colour accent picker, a colour
 * field with its contrast, and a small portal preview. Used by first-time setup and by
 * Settings → Your brand, so both look and behave the same.
 */
import { useRef, useState } from 'react'
import { Check, Pipette, Upload } from 'lucide-react'
import { putBlob, useSrc } from '../data/blobs'
import { accentColours } from '../data/theme'
import type { Studio } from '../data/types'
import { useT } from '../data/i18n'
import { readableOn } from './color'
import './brandKit.css'

export type BrandLook = Pick<Studio['brand'], 'logoSrc' | 'logoDarkSrc' | 'accent' | 'accentDark'>

/**
 * Ready-made accent pairs: the colour on light pages and the one on dark pages. Without a dark
 * colour, a readable shade of the light one is worked out.
 */
export const ACCENT_PAIRS: { accent: string; accentDark?: string; name: string }[] = [
  { accent: '#1a4dff', name: 'Blue' },
  { accent: '#141414', accentDark: '#f2f1ec', name: 'Black / white' },
  { accent: '#2f7a4a', name: 'Green' },
  { accent: '#e0673a', name: 'Orange' },
  { accent: '#8a4fff', name: 'Purple' },
  { accent: '#c2342b', name: 'Red' },
]

/** One circle, two colours: top-left is the colour on light pages, bottom-right the one on dark. */
function SplitDot({ light, dark }: { light: string; dark: string }) {
  // Sized inline too, so the circle never depends on a stylesheet having loaded.
  return <span className="split-dot" style={{ display: 'block', width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${light} 50%, ${dark} 50%)` }} />
}

/** Pick an accent pair – or your own two colours. */
export function AccentPairPicker({ value, onChange }: { value: BrandLook; onChange: (v: Pick<BrandLook, 'accent' | 'accentDark'>) => void }) {
  const tr = useT()
  const c = accentColours(value)
  const isPreset = ACCENT_PAIRS.some((p) => p.accent === value.accent && (p.accentDark ?? '') === (value.accentDark ?? ''))
  const [custom, setCustom] = useState(!isPreset)
  return (
    <div className="pair-picker">
      <div className="pair-row" role="group" aria-label={tr('Accent colour')}>
        {ACCENT_PAIRS.map((p) => {
          const pc = accentColours(p)
          const on = !custom && p.accent === value.accent && (p.accentDark ?? '') === (value.accentDark ?? '')
          return (
            <button key={p.name} type="button" className={'accent-pick' + (on ? ' on' : '')} aria-pressed={on} title={tr(p.name)} onClick={() => { setCustom(false); onChange({ accent: p.accent, accentDark: p.accentDark }) }}>
              <SplitDot light={pc.light} dark={pc.dark} />
              {on && <Check size={12} className="pair-check" />}
            </button>
          )
        })}
        <button type="button" className={'accent-pick pair-own' + (custom ? ' on' : '')} aria-pressed={custom} title={tr('Your own two colours')} onClick={() => setCustom(true)}>
          {custom ? <SplitDot light={c.light} dark={c.dark} /> : <Pipette size={15} />}
        </button>
        <small className="muted">{custom ? tr('Your own two colours') : tr(ACCENT_PAIRS.find((p) => p.accent === value.accent)?.name ?? '')}</small>
      </div>
      {custom && (
        <div className="pair-own-fields">
          <label>
            <input type="color" className="colour-input" value={c.light} onChange={(e) => onChange({ accent: e.target.value, accentDark: value.accentDark })} />
            <span>{tr('On light pages')}</span>
          </label>
          <label>
            <input type="color" className="colour-input" value={c.dark} onChange={(e) => onChange({ accent: value.accent, accentDark: e.target.value })} />
            <span>{tr('On dark pages')}</span>
          </label>
          {value.accentDark ? (
            <button type="button" className="link-btn" onClick={() => onChange({ accent: value.accent, accentDark: undefined })}>{tr('Work it out for me')}</button>
          ) : (
            <small className="muted">{tr('Worked out for you')}</small>
          )}
        </div>
      )}
    </div>
  )
}

/** One logo slot: upload, replace or remove, shown on the background it's meant for. */
export function LogoSlot({ src, onChange, tone, label, hint, fallback }: { src?: string; onChange: (src?: string) => void; tone: 'light' | 'dark'; label: string; hint: string; fallback?: string }) {
  const tr = useT()
  const url = useSrc(src)
  const fallbackUrl = useSrc(src ? undefined : fallback)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="brand-slot">
      <button type="button" className={'brand-swatch-bg ' + tone} onClick={() => input.current?.click()} aria-label={tr('Upload {label}', { label })}>
        {url ? <img src={url} alt="" /> : fallbackUrl ? <img src={fallbackUrl} alt="" style={{ opacity: 0.5 }} /> : <span><Upload size={16} /> {tr('Upload')}</span>}
      </button>
      <div className="brand-slot-foot">
        <span className="cell-title"><b style={{ fontWeight: 500 }}>{label}</b><small>{hint}</small></span>
        {src && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(undefined)}>{tr('Remove')}</button>}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await putBlob(f)); e.target.value = '' }} />
    </div>
  )
}

/** A colour with its contrast on the background it's used on. */
export function AccentField({ tone, value, auto, ratio, onChange, onAuto }: { tone: 'light' | 'dark'; value: string; auto?: boolean; ratio: number; onChange: (hex: string) => void; onAuto?: () => void }) {
  const tr = useT()
  const ok = ratio >= 3
  return (
    <div className="brand-slot">
      <div className={'brand-swatch-bg ' + tone} style={{ gap: 12, cursor: 'default' }}>
        <span className="brand-chip" style={{ background: value, color: readableOn(value) }}>{tr('Approve')}</span>
        <span style={{ color: value, fontWeight: 500 }}>{tr('A link')}</span>
      </div>
      <div className="brand-slot-foot">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={tone === 'light' ? tr('Accent on light') : tr('Accent on dark')} className="colour-input" />
        <input className="input input-sm" style={{ width: 96, fontFamily: 'var(--mono)' }} value={value} onChange={(e) => onChange(e.target.value)} aria-label={tr('Hex value')} />
        <span className={'pill ' + (ok ? 'pill-green' : 'pill-red')} title={tr('Contrast against the page background')}>{ratio.toFixed(1)}:1</span>
        {tone === 'dark' && (auto ? <small className="muted">{tr('Worked out for you')}</small> : <button type="button" className="link-btn" onClick={onAuto}>{tr('Work it out for me')}</button>)}
      </div>
      {!ok && <small className="error">{tr('Hard to see on this background. Pick a lighter or darker shade.')}</small>}
    </div>
  )
}

/** A small portal header + button, drawn on a fixed light or dark background whatever theme the app is in. */
export function PortalPreview({ tone, look, name }: { tone: 'light' | 'dark'; look: BrandLook; name: string }) {
  const tr = useT()
  const c = accentColours(look)
  const logo = useSrc(tone === 'dark' ? look.logoDarkSrc ?? look.logoSrc : look.logoSrc)
  const accent = tone === 'dark' ? c.dark : c.light
  return (
    <div className={'portal-preview ' + tone} style={{ ['--accent' as string]: accent }}>
      <div className="pp-head">{logo ? <img src={logo} alt="" /> : <b>{name}</b>} <span className="pp-muted">{tr('× Client')}</span></div>
      <span className="pp-h">{tr('Hi Alex.')} <i>{tr('Here’s where we are.')}</i></span>
      <span className="pp-btn" style={{ background: accent, color: tone === 'dark' ? c.darkInk : c.lightInk }}>{tr('Approve')}</span>
    </div>
  )
}
