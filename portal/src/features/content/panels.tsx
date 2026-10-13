/**
 * The Content Machine's panels: the layers list, the artboard's and a selection's properties, the
 * right-click menu, the keyboard shortcuts – and the small fields they're built from.
 */
import { useLayoutEffect, useEffect, useRef, useState, type ComponentType, type DragEvent, type ReactNode } from 'react'
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlignVerticalDistributeCenter, BookmarkPlus, BringToFront, ChevronDown, ChevronRight, ChevronUp, Circle, Copy, Eye, EyeOff, FlipHorizontal2, FlipVertical2, Folder,
  Group, ImagePlus, LayoutGrid, Lock, LockOpen, Pipette, Search, SendToBack, Shapes, ShieldCheck, Sparkles, Square, Stamp, Table, Trash2, TriangleAlert, Type, Ungroup, Wand2, X,
} from 'lucide-react'
import { Modal } from '../../components/ui'
import type { Artboard, DesignTemplate, Gradient, Layer, LayoutGrid as Grid } from '../../data/types'
import { useT } from '../../data/i18n'
import { SIZES, TEMPLATES, newGrid, type Brand, type Issue, type TemplateId } from './model'
import { BACKGROUND_STYLES, type BackgroundStyle } from './backgrounds'
import { platformsFor } from './platforms'
import type { AlignHow, Order } from './arrange'
import type { Axis } from './geometry'

/** Keys as this computer writes them: ⌘⌥⇧ on a Mac, Ctrl/Alt/Shift elsewhere. */
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const NAMES: Record<string, string> = { '⌘': 'Ctrl', '⌥': 'Alt', '⇧': 'Shift', '⌃': 'Ctrl' }
export const keys = (k: string) =>
  MAC ? k : k.replace(/[⌘⌥⇧⌃]/g, (m, i: number) => (k[i + 1] && !' /'.includes(k[i + 1]) ? NAMES[m] + '+' : NAMES[m]))

export function LayerIcon({ layer }: { layer: Layer }) {
  const Icon = layer.type === 'text' ? Type : layer.type === 'image' ? ImagePlus : layer.type === 'logo' ? Stamp : layer.type === 'icon' ? Sparkles : layer.shape === 'ellipse' ? Circle : layer.shape === 'rect' ? Square : Shapes
  return <Icon size={13} className="muted" style={{ flex: 'none' }} />
}

/* ---------- Small fields ---------- */

export function Num({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <label className="cm-num">
      <span>{label}</span>
      <input className="input input-sm" type="number" value={Math.round(value * 100) / 100} step={step} min={min} max={max} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
    </label>
  )
}

/** A slider with its number. A whole drag is one step to undo: only its first change is recorded. */
export function Slider({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number, record: boolean) => void }) {
  const drag = useRef({ on: false, first: true })
  return (
    <label className="cm-slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => (drag.current = { on: true, first: true })}
        onPointerUp={() => (drag.current.on = false)}
        onChange={(e) => {
          const record = !drag.current.on || drag.current.first
          drag.current.first = false
          onChange(Number(e.target.value), record)
        }}
      />
      <output>{Math.round(value * 10) / 10}{unit}</output>
    </label>
  )
}

/** A switch that opens more settings under it. */
export function Toggle({ label, on, onChange, children }: { label: string; on: boolean; onChange: (on: boolean) => void; children?: ReactNode }) {
  return (
    <div className="cm-toggle">
      <label className="cm-toggle-row">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      {on && children && <div className="cm-toggle-body">{children}</div>}
    </div>
  )
}

/** A panel section that folds away. Remembers whether it's open while the editor is open. */
const folded = new Set<string>()
export function Section({ id, title, children, defaultOpen = true }: { id: string; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(() => (folded.has(id) ? false : defaultOpen))
  return (
    <section className="cm-section">
      <button className="cm-section-head" onClick={() => { const next = !open; setOpen(next); if (next) folded.delete(id); else folded.add(id) }} aria-expanded={open}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {title}
      </button>
      {open && <div className="cm-section-body">{children}</div>}
    </section>
  )
}

/** Picks a colour from anywhere on screen, where the browser can (Chrome, Edge). */
const eyeDropper = () => (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper

/** Brand colours first, then the eyedropper and anything with the picker. */
export function ColourField({ label, value, brand, onChange, auto }: { label: string; value: string; brand: Brand; onChange: (hex: string) => void; auto?: string }) {
  const tr = useT()
  const Picker = eyeDropper()
  return (
    <div className="cm-field">
      <span className="cm-label">{label}</span>
      <div className="cm-swatches">
        {auto && (
          <button className={'cm-swatch cm-swatch-auto' + (value === 'auto' ? ' on' : '')} title={auto} aria-label={auto} onClick={() => onChange('auto')}>A</button>
        )}
        {brand.swatches.map((c) => (
          <button key={c} className={'cm-swatch' + (c.toLowerCase() === value.toLowerCase() ? ' on' : '')} style={{ background: c }} title={c} aria-label={c} onClick={() => onChange(c)} />
        ))}
        {Picker && (
          <button className="cm-swatch cm-swatch-tool" title={tr('Pick a colour from the screen')} aria-label={tr('Pick a colour from the screen')} onClick={() => new Picker().open().then((r) => onChange(r.sRGBHex)).catch(() => {})}>
            <Pipette size={12} />
          </button>
        )}
        <input type="color" className="cm-swatch cm-swatch-pick" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      </div>
    </div>
  )
}

/** Two brand colours blended – along an angle or from the middle. */
export function GradientField({ value, brand, onChange }: { value: Gradient; brand: Brand; onChange: (g: Gradient) => void }) {
  const tr = useT()
  return (
    <div className="cm-gradient">
      <div className="cm-gradient-bar" style={{ background: value.type === 'radial' ? `radial-gradient(circle, ${value.stops[0]}, ${value.stops[1]})` : `linear-gradient(90deg, ${value.stops[0]}, ${value.stops[1]})` }} />
      <div className="seg" role="group" aria-label={tr('Gradient')}>
        <button aria-pressed={value.type === 'linear'} onClick={() => onChange({ ...value, type: 'linear' })}>{tr('Straight')}</button>
        <button aria-pressed={value.type === 'radial'} onClick={() => onChange({ ...value, type: 'radial' })}>{tr('Round')}</button>
      </div>
      <ColourField label={tr('From')} value={value.stops[0]} brand={brand} onChange={(c) => onChange({ ...value, stops: [c, value.stops[1]] })} />
      <ColourField label={tr('To')} value={value.stops[1]} brand={brand} onChange={(c) => onChange({ ...value, stops: [value.stops[0], c] })} />
      {value.type === 'linear' && <Slider label={tr('Angle')} value={value.angle} min={0} max={360} step={5} unit="°" onChange={(angle) => onChange({ ...value, angle })} />}
    </div>
  )
}
export const defaultGradient = (brand: Brand): Gradient => ({ type: 'linear', angle: 135, stops: [brand.primary, brand.accent === brand.primary ? brand.dark : brand.accent] })

/** What breaks the brand hub's rules, with a one-click fix where there is one. */
export function IssueList({ issues, onFix, onPick }: { issues: Issue[]; onFix: (i: Issue) => void; onPick?: (i: Issue) => void }) {
  const tr = useT()
  if (!issues.length) return null
  // Names inside a message (a platform, a part of the screen) are translated too.
  const vars = (v?: Record<string, string | number>) => v && Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' && !x.startsWith('#') ? tr(x) : x]))
  return (
    <div className="cm-issues">
      {issues.map((i, n) => (
        <div key={n} className="cm-issue">
          <TriangleAlert size={14} />
          <span className="grow">
            {onPick ? <button className="link-btn" onClick={() => onPick(i)}>{tr(i.message, vars(i.vars))}</button> : tr(i.message, vars(i.vars))}
          </span>
          {i.fix && (
            <button className="btn btn-sm" onClick={() => onFix(i)}>
              {typeof i.fix.vars?.colour === 'string' && <span className="cm-swatch" style={{ background: i.fix.vars.colour, width: 12, height: 12 }} />}
              {tr(i.fix.label, vars(i.fix.vars))}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ---------- Tool rows ---------- */

type Tool<T> = { id: T; icon: ComponentType<{ size?: number }>; label: string; keys?: string }

function ToolRow<T extends string>({ tools, onPick, disabled }: { tools: Tool<T>[]; onPick: (id: T) => void; disabled?: (id: T) => boolean }) {
  return (
    <div className="cm-toolrow">
      {tools.map((t) => (
        <button key={t.id} className="cm-tool" onClick={() => onPick(t.id)} disabled={disabled?.(t.id)} title={t.keys ? `${t.label} (${keys(t.keys)})` : t.label} aria-label={t.label}>
          <t.icon size={15} />
        </button>
      ))}
    </div>
  )
}

/** Line things up – with each other, or with the artboard when one layer is selected. */
export function AlignRow({ onAlign, onDistribute }: { onAlign: (how: AlignHow) => void; onDistribute?: (axis: Axis) => void }) {
  const tr = useT()
  const tools: Tool<AlignHow | 'dx' | 'dy'>[] = [
    { id: 'left', icon: AlignStartVertical, label: tr('Align left'), keys: '⌥A' },
    { id: 'hcenter', icon: AlignCenterVertical, label: tr('Align centres'), keys: '⌥H' },
    { id: 'right', icon: AlignEndVertical, label: tr('Align right'), keys: '⌥D' },
    { id: 'top', icon: AlignStartHorizontal, label: tr('Align tops'), keys: '⌥W' },
    { id: 'vcenter', icon: AlignCenterHorizontal, label: tr('Align middles'), keys: '⌥V' },
    { id: 'bottom', icon: AlignEndHorizontal, label: tr('Align bottoms'), keys: '⌥S' },
  ]
  if (onDistribute)
    tools.push(
      { id: 'dx', icon: AlignHorizontalDistributeCenter, label: tr('Space evenly across'), keys: '⌃⌥H' },
      { id: 'dy', icon: AlignVerticalDistributeCenter, label: tr('Space evenly down'), keys: '⌃⌥V' },
    )
  return <ToolRow tools={tools} onPick={(id) => (id === 'dx' ? onDistribute?.('x') : id === 'dy' ? onDistribute?.('y') : onAlign(id))} />
}

/** Stacking order, flipping. */
export function ArrangeRow({ onOrder, onFlip }: { onOrder: (how: Order) => void; onFlip: (axis: 'x' | 'y') => void }) {
  const tr = useT()
  const tools: Tool<Order | 'fx' | 'fy'>[] = [
    { id: 'front', icon: BringToFront, label: tr('Bring to front'), keys: '⌥⌘]' },
    { id: 'forward', icon: ChevronUp, label: tr('Bring forward'), keys: '⌘]' },
    { id: 'backward', icon: ChevronDown, label: tr('Send backward'), keys: '⌘[' },
    { id: 'back', icon: SendToBack, label: tr('Send to back'), keys: '⌥⌘[' },
    { id: 'fx', icon: FlipHorizontal2, label: tr('Flip horizontally'), keys: '⇧H' },
    { id: 'fy', icon: FlipVertical2, label: tr('Flip vertically'), keys: '⇧V' },
  ]
  return <ToolRow tools={tools} onPick={(id) => (id === 'fx' ? onFlip('x') : id === 'fy' ? onFlip('y') : onOrder(id))} />
}

/* ---------- The layers list ---------- */

/**
 * Layers, top first, with groups folded together. Click to select (Shift or ⌘ to add), drag to
 * change the order, double-click a name to rename it, search to find one.
 */
export function LayersPanel({ board, selected, flagged, onSelect, onSelectMany, onToggle, onRename, onRenameGroup, onDrop, onMenu }: {
  board: Artboard
  selected: string[]
  flagged: Set<string>
  onSelect: (id: string, add: boolean) => void
  onSelectMany: (ids: string[]) => void
  onToggle: (ids: string[], key: 'hidden' | 'locked') => void
  onRename: (id: string, name: string) => void
  onRenameGroup: (id: string, name: string) => void
  onDrop: (id: string, targetId: string, above: boolean) => void
  onMenu: (id: string, at: { x: number; y: number }) => void
}) {
  const tr = useT()
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [hint, setHint] = useState<{ id: string; above: boolean } | null>(null)
  const [query, setQuery] = useState('')
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const place = (e: DragEvent<HTMLDivElement>, id: string) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { id, above: e.clientY < r.top + r.height / 2 }
  }
  const label = (l: Layer) => (l.type === 'text' ? l.text.split('\n')[0].slice(0, 28) || tr('Text') : tr(l.name))
  const q = query.trim().toLowerCase()
  const top = [...board.layers].reverse()
  const shown = q ? top.filter((l) => label(l).toLowerCase().includes(q) || l.name.toLowerCase().includes(q)) : top

  const rename = (value: string, save: (v: string) => void) => (
    <input
      className="cm-rename"
      autoFocus
      defaultValue={value}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setRenaming(null)
      }}
      onBlur={(e) => {
        if (e.currentTarget.value.trim()) save(e.currentTarget.value.trim())
        setRenaming(null)
      }}
    />
  )

  const row = (l: Layer, inGroup: boolean) => (
    <div
      key={l.id}
      className={'cm-row' + (inGroup ? ' in-group' : '') + (selected.includes(l.id) ? ' on' : '') + (dragging === l.id ? ' dragging' : '') + (hint?.id === l.id ? (hint.above ? ' drop-above' : ' drop-below') : '')}
      draggable={renaming !== l.id}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-aftryk-layer', l.id)
        e.dataTransfer.effectAllowed = 'move'
        setDragging(l.id)
      }}
      onDragOver={(e) => {
        if (!dragging) return
        e.preventDefault()
        setHint(place(e, l.id))
      }}
      onDragLeave={() => setHint((h) => (h?.id === l.id ? null : h))}
      onDrop={(e) => {
        e.preventDefault()
        if (dragging) onDrop(dragging, l.id, place(e, l.id).above)
        setHint(null)
        setDragging(null)
      }}
      onDragEnd={() => {
        setHint(null)
        setDragging(null)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu(l.id, { x: e.clientX, y: e.clientY })
      }}
    >
      <button className="cm-row-main" onClick={(e) => onSelect(l.id, e.shiftKey || e.metaKey || e.ctrlKey)} onDoubleClick={() => l.type !== 'text' && setRenaming(l.id)}>
        <LayerIcon layer={l} />
        {renaming === l.id ? rename(tr(l.name), (v) => onRename(l.id, v)) : <span className={l.hidden ? 'muted' : undefined}>{label(l)}</span>}
        {flagged.has(l.id) && <TriangleAlert size={12} className="cm-warn-icon" aria-label={tr('Brand check')} />}
      </button>
      <button className="cm-icon" title={l.hidden ? tr('Show') : tr('Hide')} onClick={() => onToggle([l.id], 'hidden')}>{l.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
      <button className={'cm-icon' + (l.locked ? ' pinned' : '')} title={l.locked ? tr('Unlock') : tr('Lock')} onClick={() => onToggle([l.id], 'locked')}>{l.locked ? <Lock size={13} /> : <LockOpen size={13} />}</button>
    </div>
  )

  const rows: ReactNode[] = []
  const done = new Set<string>()
  for (const l of shown) {
    if (!l.groupId || q) {
      rows.push(row(l, false))
      continue
    }
    if (done.has(l.groupId)) continue
    done.add(l.groupId)
    const g = board.groups?.find((x) => x.id === l.groupId)
    const members = top.filter((m) => m.groupId === l.groupId)
    const ids = members.map((m) => m.id)
    const open = !closed.has(l.groupId)
    const all = ids.every((id) => selected.includes(id))
    rows.push(
      <div key={'g' + l.groupId} className={'cm-row cm-group-row' + (all ? ' on' : '')}>
        <button className="cm-icon cm-fold" onClick={() => setClosed((c) => { const n = new Set(c); if (open) n.add(l.groupId!); else n.delete(l.groupId!); return n })} aria-label={open ? tr('Fold') : tr('Unfold')}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button className="cm-row-main" onClick={() => onSelectMany(ids)} onDoubleClick={() => setRenaming('g' + l.groupId)}>
          <Folder size={13} className="muted" style={{ flex: 'none' }} />
          {renaming === 'g' + l.groupId ? rename(g?.name ?? tr('Group'), (v) => onRenameGroup(l.groupId!, v)) : <span>{g?.name ?? tr('Group')}</span>}
        </button>
        <button className="cm-icon" title={tr('Hide')} onClick={() => onToggle(ids, 'hidden')}>{members.every((m) => m.hidden) ? <EyeOff size={13} /> : <Eye size={13} />}</button>
        <button className="cm-icon" title={tr('Lock')} onClick={() => onToggle(ids, 'locked')}>{members.every((m) => m.locked) ? <Lock size={13} /> : <LockOpen size={13} />}</button>
      </div>,
    )
    if (open) for (const m of members) rows.push(row(m, true))
  }

  return (
    <section>
      <h4>{tr('Layers')}</h4>
      {board.layers.length > 5 && (
        <label className="cm-search">
          <Search size={12} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Find a layer')} aria-label={tr('Find a layer')} />
          {query && <button onClick={() => setQuery('')} aria-label={tr('Clear')}><X size={12} /></button>}
        </label>
      )}
      {board.layers.length === 0 && <p className="muted" style={{ fontSize: 12 }}>{tr('Add text, an image or the logo from the bar above.')}</p>}
      {rows}
    </section>
  )
}

/* ---------- The artboard ---------- */

export function BoardProps({ board, brand, issues, templates, onPickIssue, onFix, onFixAll, onBackground, onChange, onResize, onTemplate, onUseTemplate, onSaveTemplate, onDeleteTemplate, onEverySize, onRemix, onBulk }: {
  board: Artboard; brand: Brand; issues: Issue[]; templates: DesignTemplate[]; onPickIssue: (i: Issue) => void; onFix: (i: Issue) => void; onFixAll: () => void; onBackground: (style: BackgroundStyle) => void
  onChange: (p: Partial<Artboard>, record?: boolean) => void; onResize: (sizeId: string) => void; onTemplate: (id: TemplateId) => void
  onUseTemplate: (id: string) => void; onSaveTemplate: (name: string) => void; onDeleteTemplate: (id: string) => void; onEverySize: () => void; onRemix: () => void; onBulk: () => void
}) {
  const tr = useT()
  const [naming, setNaming] = useState(false)
  const generated = board.layers.find((l) => l.type === 'image' && l.generated)
  const grid = board.grid
  const setGrid = (p: Partial<Grid>) => grid && onChange({ grid: { ...grid, ...p } })
  const platforms = platformsFor(board)
  return (
    <div className="cm-panel">
      <Section id="checks" title={tr('Brand check')}>
        {issues.length ? (
          <>
            <IssueList issues={issues} onFix={onFix} onPick={onPickIssue} />
            {issues.filter((i) => i.fix).length > 1 && <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={onFixAll}><Wand2 size={14} /> {tr('Fix all')}</button>}
          </>
        ) : (
          <p className="cm-ok"><ShieldCheck size={14} /> {tr('Follows the brand hub: contrast, margins, logo rules, colours and fonts.')}</p>
        )}
      </Section>

      <div className="cm-actions">
        <button className="btn btn-sm" onClick={onRemix} title={tr('The same post in other layouts and brand colours')}><Wand2 size={14} /> {tr('Remix')}</button>
        <button className="btn btn-sm" onClick={onBulk} title={tr('One post per row of a spreadsheet')}><Table size={14} /> {tr('Many from a sheet')}</button>
      </div>

      <Section id="artboard" title={tr('Artboard')}>
        <label className="cm-field">
          <span className="cm-label">{tr('Name')}</span>
          <input className="input input-sm" value={board.name} onChange={(e) => onChange({ name: e.target.value }, false)} />
        </label>
        <div className="cm-grid2">
          <Num label="W" value={board.width} min={16} onChange={(width) => onChange({ width })} />
          <Num label="H" value={board.height} min={16} onChange={(height) => onChange({ height })} />
        </div>
        <label className="cm-field">
          <span className="cm-label">{tr('Resize everything to')}</span>
          <select className="input input-sm" value="" onChange={(e) => e.target.value && onResize(e.target.value)}>
            <option value="">{tr('Pick a size…')}</option>
            {SIZES.map((s) => <option key={s.id} value={s.id}>{tr(s.name)} · {s.width}×{s.height}</option>)}
          </select>
        </label>
        <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={onEverySize}><Copy size={14} /> {tr('Make every social size')}</button>
        {platforms.length > 0 && (
          <label className="cm-field">
            <span className="cm-label">{tr('Posting to')}</span>
            <select className="input input-sm" value={board.platform ?? ''} onChange={(e) => onChange({ platform: e.target.value || undefined })}>
              <option value="">{tr('Don’t show the app’s buttons')}</option>
              {platforms.map((p) => <option key={p.id} value={p.id}>{tr(p.name)}</option>)}
            </select>
            {board.platform && <small className="muted">{tr('The shaded areas are covered by the app. Keep words and the logo out of them.')}</small>}
          </label>
        )}
      </Section>

      <Section id="background" title={tr('Background')}>
        <div className="seg" role="group" aria-label={tr('Background')}>
          <button aria-pressed={!board.backgroundGradient} onClick={() => onChange({ backgroundGradient: undefined })}>{tr('Colour')}</button>
          <button aria-pressed={!!board.backgroundGradient} onClick={() => onChange({ backgroundGradient: board.backgroundGradient ?? defaultGradient(brand) })}>{tr('Gradient')}</button>
        </div>
        {board.backgroundGradient ? (
          <GradientField value={board.backgroundGradient} brand={brand} onChange={(backgroundGradient) => onChange({ backgroundGradient })} />
        ) : (
          <ColourField label={tr('Colour')} value={board.background} brand={brand} onChange={(background) => onChange({ background })} />
        )}
        <div className="cm-field">
          <span className="cm-label"><Wand2 size={12} style={{ verticalAlign: -1 }} /> {generated ? tr('Background from the brand colours') : tr('Make a background from the brand colours')}</span>
          <div className="cm-layouts">
            {BACKGROUND_STYLES.map((b) => <button key={b.id} className={'btn btn-sm' + (generated?.type === 'image' && generated.generated?.style === b.id ? ' on' : '')} onClick={() => onBackground(b.id)}>{tr(b.name)}</button>)}
          </div>
        </div>
      </Section>

      <Section id="layouts" title={tr('Layouts and templates')}>
        <div className="cm-layouts">
          {TEMPLATES.map((t) => <button key={t.id} className="btn btn-sm" onClick={() => onTemplate(t.id)}>{tr(t.name)}</button>)}
        </div>
        {templates.length > 0 && (
          <div className="cm-field">
            <span className="cm-label">{tr('Your templates – in this brand')}</span>
            <div className="cm-layouts">
              {templates.map((t) => (
                <span key={t.id} className="cm-chip">
                  <button className="btn btn-sm" onClick={() => onUseTemplate(t.id)}>{t.name}</button>
                  <button className="cm-chip-x" onClick={() => onDeleteTemplate(t.id)} aria-label={tr('Delete “{name}”', { name: t.name })}><X size={11} /></button>
                </span>
              ))}
            </div>
          </div>
        )}
        {naming ? (
          <form className="cm-inline" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get('name') as string; if (v.trim()) onSaveTemplate(v.trim()); setNaming(false) }}>
            <input name="name" className="input input-sm" autoFocus defaultValue={board.name} aria-label={tr('Template name')} />
            <button className="btn btn-sm btn-primary">{tr('Save')}</button>
          </form>
        ) : (
          <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => setNaming(true)}><BookmarkPlus size={14} /> {tr('Save as template')}</button>
        )}
      </Section>

      <Section id="grid" title={tr('Layout grid and guides')} defaultOpen={!!grid}>
        {grid ? (
          <>
            <div className="cm-grid2">
              <Num label={tr('Columns')} value={grid.columns} min={0} max={24} onChange={(columns) => setGrid({ columns: Math.max(0, Math.min(24, Math.round(columns))) })} />
              <Num label={tr('Rows')} value={grid.rows} min={0} max={24} onChange={(rows) => setGrid({ rows: Math.max(0, Math.min(24, Math.round(rows))) })} />
              <Num label={tr('Gutter')} value={grid.gutter} min={0} onChange={(gutter) => setGrid({ gutter: Math.max(0, gutter) })} />
              <Num label={tr('Margin')} value={grid.margin} min={0} onChange={(margin) => setGrid({ margin: Math.max(0, margin) })} />
            </div>
            <div className="cm-actions">
              <button className="btn btn-sm" onClick={() => setGrid({ hidden: !grid.hidden })}>{grid.hidden ? <Eye size={14} /> : <EyeOff size={14} />} {grid.hidden ? tr('Show') : tr('Hide')}</button>
              <button className="btn btn-sm btn-ghost" onClick={() => onChange({ grid: undefined })}><Trash2 size={14} /> {tr('Remove')}</button>
            </div>
          </>
        ) : (
          <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => onChange({ grid: newGrid(board) })}><LayoutGrid size={14} /> {tr('Add a layout grid')}</button>
        )}
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          {board.guides?.length ? tr('{n} guides. Drag one off the artboard to remove it.', { n: board.guides.length }) : tr('Drag from the rulers to add a guide. Things snap to guides and the grid.')}
        </p>
        {!!board.guides?.length && <button className="btn btn-sm btn-ghost" style={{ justifySelf: 'start' }} onClick={() => onChange({ guides: [] })}><Trash2 size={14} /> {tr('Remove all guides')}</button>}
      </Section>
    </div>
  )
}

/* ---------- Several layers ---------- */

/** Several layers selected: line them up, space them, order them, group them, change them all. */
export function MultiProps({ layers, brand, grouped, onColour, onFont, onOpacity, onAlign, onDistribute, onOrder, onFlip, onGroup, onUngroup, onDuplicate, onDelete }: {
  layers: Layer[]; brand: Brand; grouped: boolean
  onColour: (hex: string) => void; onFont: (font: string) => void; onOpacity: (o: number, record: boolean) => void
  onAlign: (how: AlignHow) => void; onDistribute: (axis: Axis) => void; onOrder: (how: Order) => void; onFlip: (axis: 'x' | 'y') => void
  onGroup: () => void; onUngroup: () => void; onDuplicate: () => void; onDelete: () => void
}) {
  const tr = useT()
  const count = layers.length
  const texts = layers.filter((l) => l.type === 'text')
  const paintable = layers.filter((l) => l.type === 'text' || l.type === 'shape' || l.type === 'icon')
  const first = paintable[0]
  const colourNow = !first ? '' : first.type === 'text' ? first.colour : first.type === 'shape' ? first.fill : first.type === 'icon' ? first.colour : ''
  const opacity = Math.round((layers.reduce((n, l) => n + (l.opacity ?? 1), 0) / count) * 100)
  return (
    <div className="cm-panel">
      <h4>{tr('{n} layers', { n: count })}</h4>
      <div className="cm-actions">
        {grouped ? (
          <button className="btn btn-sm" onClick={onUngroup} title={keys('⇧⌘G')}><Ungroup size={14} /> {tr('Ungroup')}</button>
        ) : (
          <button className="btn btn-sm" onClick={onGroup} title={keys('⌘G')}><Group size={14} /> {tr('Group')}</button>
        )}
        <button className="btn btn-sm" onClick={onDuplicate}><Copy size={14} /> {tr('Duplicate')}</button>
        <button className="btn btn-sm btn-ghost" onClick={onDelete}><Trash2 size={14} /> {tr('Delete')}</button>
      </div>
      <span className="cm-label">{tr('Align')}</span>
      <AlignRow onAlign={onAlign} onDistribute={count >= 3 ? onDistribute : undefined} />
      {count < 3 && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('Select three or more to space them evenly.')}</p>}
      <span className="cm-label">{tr('Arrange')}</span>
      <ArrangeRow onOrder={onOrder} onFlip={onFlip} />
      <h4 style={{ marginTop: 8 }}>{tr('Change them all')}</h4>
      {paintable.length > 0 && <ColourField label={tr('Colour')} value={colourNow} brand={brand} onChange={onColour} />}
      {texts.length === count && texts[0].type === 'text' && (
        <label className="cm-field">
          <span className="cm-label">{tr('Font')}</span>
          <select className="input input-sm" value={texts.every((t) => t.type === 'text' && texts[0].type === 'text' && t.font === texts[0].font) ? texts[0].font : ''} onChange={(e) => onFont(e.target.value)}>
            <option value="" disabled>{tr('Mixed')}</option>
            {brand.fonts.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      )}
      <Slider label={tr('Opacity')} value={opacity} min={0} max={100} unit="%" onChange={(o, record) => onOpacity(o / 100, record)} />
    </div>
  )
}

/* ---------- Right-click menu ---------- */

export type MenuItem = { label: string; keys?: string; onClick: () => void; disabled?: boolean } | 'sep'

export function ContextMenu({ at, items, onClose }: { at: { x: number; y: number }; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(at)
  // Kept on screen near the pointer.
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos({ x: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)) })
  }, [at])
  useEffect(() => {
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', esc)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])
  return (
    <div ref={ref} className="cm-menu" role="menu" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, i) =>
        it === 'sep' ? (
          <hr key={i} />
        ) : (
          <button key={i} role="menuitem" disabled={it.disabled} onClick={() => { onClose(); it.onClick() }}>
            <span>{it.label}</span>
            {it.keys && <kbd>{keys(it.keys)}</kbd>}
          </button>
        ),
      )}
    </div>
  )
}

/* ---------- Keyboard shortcuts ---------- */

export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const tr = useT()
  const groups: [string, [string, string][]][] = [
    [tr('Moving and sizing'), [
      [tr('Drag'), tr('Move – snaps to the artboard, margins, other layers, guides and the grid')],
      ['⌘', tr('Hold while dragging to skip snapping')],
      ['⇧', tr('Hold while dragging to move in a straight line or keep proportions')],
      ['⌥', tr('Hold while dragging to drag a copy – or while resizing to resize from the centre')],
      ['⌥', tr('Hold with something selected to measure the distance to what’s under the pointer')],
      [tr('Arrow keys'), tr('Nudge 1 px (with ⇧: 10 px)')],
      ['⇧H / ⇧V', tr('Flip horizontally / vertically')],
    ]],
    [tr('Selecting'), [
      [tr('Drag on the artboard'), tr('Select everything inside the box')],
      [`⇧ + ${tr('click')}`, tr('Add to or remove from the selection')],
      [`⌘ + ${tr('click')}`, tr('Pick one layer inside a group')],
      ['⌘A', tr('Select everything on the artboard')],
      ['Tab / ⇧Tab', tr('Next / previous layer')],
      ['Esc', tr('Deselect')],
      ['Enter', tr('Edit text – or move a photo inside its frame')],
    ]],
    [tr('Arranging'), [
      ['⌘G / ⇧⌘G', tr('Group / ungroup')],
      ['⌥A ⌥H ⌥D', tr('Align left, centre, right')],
      ['⌥W ⌥V ⌥S', tr('Align top, middle, bottom')],
      ['⌃⌥H / ⌃⌥V', tr('Space evenly across / down')],
      ['⌘] / ⌘[', tr('Bring forward / send backward')],
      ['⌥⌘] / ⌥⌘[', tr('Bring to front / send to back')],
      ['⇧⌘H / ⇧⌘L', tr('Hide / lock')],
    ]],
    [tr('Adding and editing'), [
      ['T R O L', tr('Add text, a rectangle, a circle, a line')],
      ['C', tr('Place a comment')],
      ['⌘C ⌘X ⌘V', tr('Copy, cut, paste – also between artboards and designs')],
      ['⇧⌘V', tr('Paste in the exact same place')],
      ['⌘D', tr('Duplicate')],
      ['⌘Z / ⇧⌘Z', tr('Undo / redo')],
      ['⌘E', tr('Export')],
      [tr('Paste an image'), tr('Adds it to the artboard')],
    ]],
    [tr('View'), [
      [tr('Space + drag'), tr('Pan around')],
      [`⌘ + ${tr('scroll')}`, tr('Zoom in and out where the pointer is')],
      ['+ / −', tr('Zoom in / out')],
      ['⇧0 / ⇧1 / ⇧2', tr('Zoom to 100% / fit the artboard / fit the selection')],
      ['⇧R', tr('Rulers and guides')],
      ['⌃G', tr('Layout grid')],
      ['⌘Y', tr('Outlines only')],
    ]],
  ]
  return (
    <Modal title={tr('Keyboard shortcuts')} onClose={onClose}>
      <div className="cm-keys">
        {groups.map(([title, rows]) => (
          <section key={title}>
            <h4>{title}</h4>
            {rows.map(([k, what], i) => (
              <div key={i} className="cm-keys-row">
                <kbd>{keys(k)}</kbd>
                <span>{what}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  )
}
