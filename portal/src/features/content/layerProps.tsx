/**
 * The properties of one selected layer: its words and type, colours, photo looks, shape, icon,
 * position, how it follows a new size, and its effects. Every colour starts from the brand.
 */
import { useRef, useState, type ReactNode } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, Copy, Crop, Eraser, Expand, ImagePlus, Italic, Maximize2, PenLine, Search, Shuffle, Sparkles, Trash2, Underline, Wand2,
} from 'lucide-react'
import { useStore } from '../../data/store'
import type { Artboard, BlendMode, ImageLayer, Layer, Pin, Project, ShapeKind, TextLayer } from '../../data/types'
import { useT } from '../../data/i18n'
import { BACKGROUND_STYLES, type BackgroundStyle } from './backgrounds'
import type { Brand } from './model'
import { contrast } from '../color'
import type { BrandLogo } from './render'
import type { AlignHow, Order } from './arrange'
import { MASKS, NO_ADJUST, PHOTO_LOOKS, SHAPES, textStyles, type TextStyleId } from './look'
import { ICONS, ICON_NAMES } from './icons'
import { AlignRow, ArrangeRow, ColourField, GradientField, Num, Section, Slider, Toggle, defaultGradient } from './panels'

export type AiTool = 'cutout' | 'expand' | 'edit' | 'write'

const BLENDS: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'darken', 'lighten', 'color', 'luminosity']
const BLEND_NAMES: Record<BlendMode, string> = {
  normal: 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', 'soft-light': 'Soft light', darken: 'Darken', lighten: 'Lighten', color: 'Colour', luminosity: 'Luminosity',
}

export function LayerProps({ layer: l, board, brand, logos, project, cropping, clientEdits, onChange, onShuffle, onAlign, onOrder, onFlip, onCrop, onFit, onAi, onDuplicate, onDelete, addImage }: {
  layer: Layer; board: Artboard; brand: Brand; logos: BrandLogo[]; project: Project; cropping: boolean
  /** The plan lets clients change the words of a design. */
  clientEdits: boolean
  onChange: (p: Partial<Layer>, record?: boolean) => void; onShuffle: (style: BackgroundStyle) => void; onAlign: (how: AlignHow) => void; onOrder: (how: Order) => void
  onFlip: (axis: 'x' | 'y') => void; onCrop: () => void; onFit: () => void; onAi: (tool: AiTool) => void; onDuplicate: () => void; onDelete: () => void; addImage: (f: File) => Promise<string>
}) {
  const tr = useT()
  const title = l.type === 'text' ? tr('Text') : l.type === 'image' ? (l.generated ? tr('Background') : tr('Image')) : l.type === 'logo' ? tr('Logo') : l.type === 'icon' ? tr('Icon') : tr('Shape')
  const fits = l.type === 'text' || l.type === 'logo' || (l.type === 'image' && !l.generated)
  return (
    <div className="cm-panel">
      <h4>{title}</h4>
      {l.type === 'text' && <TextProps layer={l} board={board} brand={brand} project={project} clientEdits={clientEdits} onChange={onChange} onAi={onAi} />}
      {l.type === 'image' && l.generated && (
        <div className="cm-field">
          <span className="cm-label">{tr('Made from the brand colours')}</span>
          <div className="cm-layouts">
            {BACKGROUND_STYLES.map((b) => <button key={b.id} className={'btn btn-sm' + (l.generated?.style === b.id ? ' on' : '')} onClick={() => onShuffle(b.id)}>{tr(b.name)}</button>)}
          </div>
          <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => onShuffle((l.generated?.style ?? 'glow') as BackgroundStyle)}><Shuffle size={14} /> {tr('Shuffle')}</button>
        </div>
      )}
      {l.type === 'image' && !l.generated && <ImageProps layer={l} board={board} brand={brand} project={project} cropping={cropping} onChange={onChange} onCrop={onCrop} onAi={onAi} addImage={addImage} />}
      {l.type === 'logo' && <LogoProps layer={l} brand={brand} logos={logos} onChange={onChange} />}
      {l.type === 'shape' && <ShapeProps layer={l} brand={brand} onChange={onChange} />}
      {l.type === 'icon' && <IconProps layer={l} brand={brand} onChange={onChange} />}

      <Section id="position" title={tr('Position')}>
        <span className="cm-label">{tr('Align to the artboard')}</span>
        <AlignRow onAlign={onAlign} />
        <div className="cm-grid2">
          <Num label="X" value={l.x} onChange={(x) => onChange({ x })} />
          <Num label="Y" value={l.y} onChange={(y) => onChange({ y })} />
          <Num label="W" value={l.w} min={4} onChange={(w) => onChange({ w })} />
          {l.type !== 'text' && <Num label="H" value={l.h} min={4} onChange={(h) => onChange({ h })} />}
          <Num label={tr('Rotation')} value={l.rotation ?? 0} onChange={(rotation) => onChange({ rotation })} />
        </div>
        {fits && (
          <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={onFit} title={tr('Shrink the box to what it shows, so lining up lines up what you see')}>
            <Maximize2 size={14} /> {tr('Fit box to content')}
          </button>
        )}
        <span className="cm-label">{tr('Arrange')}</span>
        <ArrangeRow onOrder={onOrder} onFlip={onFlip} />
      </Section>

      <Section id="pins" title={tr('In other sizes')} defaultOpen={false}>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('How this follows when the design is made in another size.')}</p>
        <div className="cm-grid2">
          <PinSelect label={tr('Across')} value={l.pin?.x} names={{ start: tr('Left'), end: tr('Right') }} onChange={(x) => onChange({ pin: x || l.pin?.y ? { x: x ?? 'centre', y: l.pin?.y ?? 'centre' } : undefined })} />
          <PinSelect label={tr('Down')} value={l.pin?.y} names={{ start: tr('Top'), end: tr('Bottom') }} onChange={(y) => onChange({ pin: y || l.pin?.x ? { x: l.pin?.x ?? 'centre', y: y ?? 'centre' } : undefined })} />
        </div>
      </Section>

      <Section id="effects" title={tr('Effects')} defaultOpen={!!(l.shadow || l.blur || (l.blend && l.blend !== 'normal') || (l.opacity ?? 1) < 1)}>
        <Slider label={tr('Opacity')} value={Math.round((l.opacity ?? 1) * 100)} min={0} max={100} unit="%" onChange={(o, record) => onChange({ opacity: o / 100 }, record)} />
        <Toggle label={tr('Shadow')} on={!!l.shadow} onChange={(on) => onChange({ shadow: on ? { x: 0, y: Math.round(Math.min(board.width, board.height) * 0.01), blur: Math.round(Math.min(board.width, board.height) * 0.025), colour: '#000000', opacity: 0.35 } : undefined })}>
          {l.shadow && (
            <>
              <Slider label="X" value={l.shadow.x} min={-60} max={60} onChange={(x, r) => onChange({ shadow: { ...l.shadow!, x } }, r)} />
              <Slider label="Y" value={l.shadow.y} min={-60} max={60} onChange={(y, r) => onChange({ shadow: { ...l.shadow!, y } }, r)} />
              <Slider label={tr('Softness')} value={l.shadow.blur} min={0} max={120} onChange={(blur, r) => onChange({ shadow: { ...l.shadow!, blur } }, r)} />
              <Slider label={tr('Strength')} value={Math.round(l.shadow.opacity * 100)} min={0} max={100} unit="%" onChange={(o, r) => onChange({ shadow: { ...l.shadow!, opacity: o / 100 } }, r)} />
              <ColourField label={tr('Colour')} value={l.shadow.colour} brand={brand} onChange={(colour) => onChange({ shadow: { ...l.shadow!, colour } })} />
            </>
          )}
        </Toggle>
        <Slider label={tr('Blur')} value={l.blur ?? 0} min={0} max={40} unit=" px" onChange={(blur, record) => onChange({ blur: blur || undefined }, record)} />
        <label className="cm-field">
          <span className="cm-label">{tr('Blend with what’s below')}</span>
          <select className="input input-sm" value={l.blend ?? 'normal'} onChange={(e) => onChange({ blend: e.target.value === 'normal' ? undefined : (e.target.value as BlendMode) })}>
            {BLENDS.map((b) => <option key={b} value={b}>{tr(BLEND_NAMES[b])}</option>)}
          </select>
        </label>
      </Section>

      <div className="cm-actions">
        <button className="btn btn-sm" onClick={onDuplicate}><Copy size={14} /> {tr('Duplicate')}</button>
        <button className="btn btn-sm btn-ghost" onClick={onDelete}><Trash2 size={14} /> {tr('Delete')}</button>
      </div>
    </div>
  )
}

function PinSelect({ label, value, names, onChange }: { label: string; value?: Pin; names: { start: string; end: string }; onChange: (p: Pin | undefined) => void }) {
  const tr = useT()
  return (
    <label className="cm-num">
      <span>{label}</span>
      <select className="input input-sm" value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as Pin | undefined)}>
        <option value="">{tr('Automatic')}</option>
        <option value="start">{names.start}</option>
        <option value="end">{names.end}</option>
        <option value="centre">{tr('Centre')}</option>
        <option value="stretch">{tr('Stretch')}</option>
        <option value="scale">{tr('Scale')}</option>
      </select>
    </label>
  )
}

/* ---------- Text ---------- */

function TextProps({ layer: l, board, brand, project, clientEdits, onChange, onAi }: {
  layer: TextLayer; board: Artboard; brand: Brand; project: Project; clientEdits: boolean; onChange: (p: Partial<Layer>, record?: boolean) => void; onAi: (tool: AiTool) => void
}) {
  const tr = useT()
  const area = useRef<HTMLTextAreaElement>(null)
  const styles = textStyles(project.hub.typeScale, board, { heading: brand.heading, body: brand.body })
  // Defaults that read: a box in the brand colour furthest from the letters, highlights that differ from the box.
  const ink = l.colour === 'auto' ? brand.dark : l.colour
  const boxColour = [...brand.swatches].sort((a, b) => contrast(b, ink) - contrast(a, ink))[0] ?? brand.accent
  const pop = (bg: string) => [brand.accent, brand.primary, brand.dark, brand.light].find((c) => c.toLowerCase() !== bg.toLowerCase() && contrast(c, bg) >= 3) ?? brand.accent
  const emphasisDefault = pop(l.highlight?.colour ?? brand.light)
  const applyStyle = (id: TextStyleId) => {
    const s = styles.find((x) => x.id === id)!
    onChange({ font: s.font, size: s.size, weight: s.weight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, uppercase: s.uppercase ?? false })
  }
  /** Puts *stars* around what's selected in the text box, so it shows in the highlight colour. */
  const starSelection = () => {
    const el = area.current
    if (!el) return
    const [a, b] = [el.selectionStart, el.selectionEnd]
    if (a === b) return
    const text = l.text.slice(0, a) + '*' + l.text.slice(a, b).replace(/\*/g, '') + '*' + l.text.slice(b)
    onChange({ text, emphasis: l.emphasis ?? emphasisDefault })
  }
  return (
    <>
      <textarea ref={area} className="input" rows={3} value={l.text} onChange={(e) => onChange({ text: e.target.value, name: e.target.value.slice(0, 24) })} aria-label={tr('Text')} />
      <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => onAi('write')}><Sparkles size={14} /> {tr('Write it with AI')}</button>
      <div className="cm-field">
        <span className="cm-label">{tr('Text styles from the brand')}</span>
        <div className="cm-layouts">
          {styles.map((s) => (
            <button key={s.id} className={'btn btn-sm' + (l.size === s.size && l.font === s.font ? ' on' : '')} onClick={() => applyStyle(s.id)} title={`${s.font} · ${s.size} px`}>{tr(s.name)}</button>
          ))}
        </div>
      </div>
      <label className="cm-field">
        <span className="cm-label">{tr('Font')}</span>
        <select className="input input-sm" value={l.font} onChange={(e) => onChange({ font: e.target.value })}>
          {brand.fonts.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <div className="cm-grid2">
        <Num label={tr('Size')} value={l.size} min={4} onChange={(size) => onChange({ size })} />
        <label className="cm-num">
          <span>{tr('Weight')}</span>
          <select className="input input-sm" value={l.weight} onChange={(e) => onChange({ weight: Number(e.target.value) })}>
            {[300, 400, 500, 600, 700, 800].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <Num label={tr('Line height')} value={l.lineHeight} step={0.05} min={0.6} onChange={(lineHeight) => onChange({ lineHeight })} />
        <Num label={tr('Letter spacing')} value={l.letterSpacing} step={0.01} onChange={(letterSpacing) => onChange({ letterSpacing })} />
      </div>
      <div className="seg" role="group" aria-label={tr('Alignment')}>
        {(['left', 'center', 'right'] as const).map((a) => (
          <button key={a} aria-pressed={l.align === a} onClick={() => onChange({ align: a })}>{a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}</button>
        ))}
        <button aria-pressed={!!l.italic} onClick={() => onChange({ italic: !l.italic })} title={tr('Italic')}><Italic size={14} /></button>
        <button aria-pressed={!!l.underline} onClick={() => onChange({ underline: !l.underline })} title={tr('Underline')}><Underline size={14} /></button>
        <button aria-pressed={!!l.uppercase} onClick={() => onChange({ uppercase: !l.uppercase })} title={tr('Capitals')}>AA</button>
      </div>
      {!l.gradient && <ColourField label={tr('Colour')} value={l.colour} brand={brand} onChange={(colour) => onChange({ colour })} auto={tr('Automatic – the brand colour that reads on what’s behind it')} />}
      <Toggle label={tr('Colour *starred* words')} on={!!l.emphasis} onChange={(on) => onChange({ emphasis: on ? emphasisDefault : undefined })}>
        {l.emphasis && (
          <>
            <small className="muted">{tr('Put *stars* around words to show them in this colour.')}</small>
            <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={starSelection}><PenLine size={14} /> {tr('Star the selected words')}</button>
            <ColourField label={tr('Colour')} value={l.emphasis} brand={brand} onChange={(emphasis) => onChange({ emphasis })} />
          </>
        )}
      </Toggle>
      <Toggle label={tr('Box behind the words')} on={!!l.highlight} onChange={(on) => onChange({ highlight: on ? { colour: boxColour, padding: 0.2 } : undefined, ...(on && l.emphasis && contrast(l.emphasis, boxColour) < 3 ? { emphasis: pop(boxColour) } : {}) })}>
        {l.highlight && (
          <>
            <ColourField label={tr('Colour')} value={l.highlight.colour} brand={brand} onChange={(colour) => onChange({ highlight: { ...l.highlight!, colour } })} />
            <Slider label={tr('Room around')} value={l.highlight.padding} min={0} max={1} step={0.05} onChange={(padding, r) => onChange({ highlight: { ...l.highlight!, padding } }, r)} />
          </>
        )}
      </Toggle>
      <Toggle label={tr('Outline')} on={!!l.stroke} onChange={(on) => onChange({ stroke: on ? { colour: brand.dark, width: Math.max(1, Math.round(l.size * 0.03)) } : undefined })}>
        {l.stroke && (
          <>
            <Slider label={tr('Width')} value={l.stroke.width} min={0.5} max={Math.max(4, Math.round(l.size * 0.12))} step={0.5} unit=" px" onChange={(width, r) => onChange({ stroke: { ...l.stroke!, width } }, r)} />
            <ColourField label={tr('Colour')} value={l.stroke.colour} brand={brand} onChange={(colour) => onChange({ stroke: { ...l.stroke!, colour } })} />
          </>
        )}
      </Toggle>
      <Toggle label={tr('Gradient letters')} on={!!l.gradient} onChange={(on) => onChange({ gradient: on ? defaultGradient(brand) : undefined })}>
        {l.gradient && <GradientField value={l.gradient} brand={brand} onChange={(gradient) => onChange({ gradient })} />}
      </Toggle>
      <label className={'cm-toggle-row' + (clientEdits ? '' : ' disabled')} title={clientEdits ? undefined : tr('Part of the Studio plan')}>
        <input type="checkbox" checked={!!l.clientEditable} disabled={!clientEdits} onChange={(e) => onChange({ clientEditable: e.target.checked })} />
        <span>{tr('The client may change these words')}{!clientEdits && <small className="muted"> · {tr('Studio plan')}</small>}</span>
      </label>
    </>
  )
}

/* ---------- Photos ---------- */

function ImageProps({ layer: l, board, brand, project, cropping, onChange, onCrop, onAi, addImage }: {
  layer: ImageLayer; board: Artboard; brand: Brand; project: Project; cropping: boolean; onChange: (p: Partial<Layer>, record?: boolean) => void
  onCrop: () => void; onAi: (tool: AiTool) => void; addImage: (f: File) => Promise<string>
}) {
  const tr = useT()
  const { state } = useStore()
  const replace = useRef<HTMLInputElement>(null)
  const photos = state.files.filter((f) => f.projectId === project.id && f.versions.at(-1)!.mime.startsWith('image/'))
  const adjust = { ...NO_ADJUST, ...l.adjust }
  const setAdjust = (k: keyof typeof adjust, v: number, record: boolean) => onChange({ adjust: { ...adjust, [k]: v } }, record)
  const pairs: [string, string][] = [[brand.dark, brand.light], [brand.dark, brand.primary], [brand.primary, brand.light], [brand.dark, brand.accent]]
  const fillsBoard = l.x <= 0 && l.y <= 0 && l.x + l.w >= board.width && l.y + l.h >= board.height
  const inside = l.x >= -1 && l.y >= -1 && l.x + l.w <= board.width + 1 && l.y + l.h <= board.height + 1
  return (
    <>
      <div className="seg" role="group" aria-label={tr('Fit')}>
        <button aria-pressed={l.fit === 'cover'} onClick={() => onChange({ fit: 'cover' })}>{tr('Fill')}</button>
        <button aria-pressed={l.fit === 'contain'} onClick={() => onChange({ fit: 'contain' })}>{tr('Fit whole image')}</button>
      </div>
      {l.fit === 'cover' && (
        <div className="cm-actions">
          <button className={'btn btn-sm' + (cropping ? ' on' : '')} onClick={onCrop}><Crop size={14} /> {cropping ? tr('Done') : tr('Move photo in frame')}</button>
          {l.focus && <button className="btn btn-sm btn-ghost" onClick={() => onChange({ focus: undefined })}>{tr('Centre it')}</button>}
        </div>
      )}

      <div className="cm-field">
        <span className="cm-label"><Sparkles size={12} style={{ verticalAlign: -1 }} /> {tr('AI photo tools')}</span>
        <div className="cm-layouts">
          <button className="btn btn-sm" onClick={() => onAi('cutout')}><Eraser size={14} /> {tr('Remove background')}</button>
          {!fillsBoard && <button className="btn btn-sm" onClick={() => onAi('expand')} disabled={!inside} title={inside ? undefined : tr('Move the photo inside the artboard first')}><Expand size={14} /> {tr('Extend to fill')}</button>}
          <button className="btn btn-sm" onClick={() => onAi('edit')}><Wand2 size={14} /> {tr('Change with words')}</button>
        </div>
      </div>

      <div className="cm-field">
        <span className="cm-label">{tr('Look')}</span>
        <div className="cm-layouts">
          {PHOTO_LOOKS.map((p) => (
            <button key={p.id} className={'btn btn-sm' + (JSON.stringify(p.adjust) === JSON.stringify(adjust) ? ' on' : '')} onClick={() => onChange({ adjust: p.id === 'none' ? undefined : p.adjust })}>{tr(p.name)}</button>
          ))}
        </div>
      </div>
      <Section id="adjust" title={tr('Light and colour')} defaultOpen={false}>
        <Slider label={tr('Brightness')} value={adjust.brightness} min={-100} max={100} onChange={(v, r) => setAdjust('brightness', v, r)} />
        <Slider label={tr('Contrast')} value={adjust.contrast} min={-100} max={100} onChange={(v, r) => setAdjust('contrast', v, r)} />
        <Slider label={tr('Saturation')} value={adjust.saturation} min={-100} max={100} onChange={(v, r) => setAdjust('saturation', v, r)} />
        <Slider label={tr('Warmth')} value={adjust.warmth} min={-100} max={100} onChange={(v, r) => setAdjust('warmth', v, r)} />
        <Slider label={tr('Blur')} value={adjust.blur} min={0} max={20} unit=" px" onChange={(v, r) => setAdjust('blur', v, r)} />
      </Section>
      <div className="cm-field">
        <span className="cm-label">{tr('In two brand colours')}</span>
        <div className="cm-swatches">
          <button className={'cm-swatch cm-swatch-auto' + (!l.duotone ? ' on' : '')} onClick={() => onChange({ duotone: undefined })} title={tr('Off')}>–</button>
          {pairs.map((p) => (
            <button
              key={p.join()}
              className={'cm-swatch' + (l.duotone?.join() === p.join() ? ' on' : '')}
              style={{ background: `linear-gradient(135deg, ${p[0]} 50%, ${p[1]} 50%)` }}
              title={p.join(' → ')}
              aria-label={p.join(' → ')}
              onClick={() => onChange({ duotone: p })}
            />
          ))}
        </div>
      </div>
      <div className="cm-field">
        <span className="cm-label">{tr('Shape')}</span>
        <div className="cm-layouts">
          <button className={'btn btn-sm' + (!l.mask ? ' on' : '')} onClick={() => onChange({ mask: undefined })}>{tr('None')}</button>
          {MASKS.map((m) => <button key={m.id} className={'btn btn-sm' + (l.mask === m.id ? ' on' : '')} onClick={() => onChange({ mask: m.id })}>{tr(m.name)}</button>)}
        </div>
      </div>
      <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => replace.current?.click()}><ImagePlus size={14} /> {tr('Replace image')}</button>
      <input ref={replace} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange({ src: await addImage(f), focus: undefined }); e.target.value = '' }} />
      {photos.length > 0 && (
        <label className="cm-field">
          <span className="cm-label">{tr('Or use a file from the project')}</span>
          <select className="input input-sm" value="" onChange={(e) => { const f = photos.find((x) => x.id === e.target.value); if (f) onChange({ src: f.versions.at(-1)!.src, focus: undefined }) }}>
            <option value="">{tr('Pick a file…')}</option>
            {photos.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      )}
    </>
  )
}

/* ---------- Logos ---------- */

function LogoProps({ layer: l, brand, logos, onChange }: { layer: Extract<Layer, { type: 'logo' }>; brand: Brand; logos: BrandLogo[]; onChange: (p: Partial<Layer>) => void }) {
  const tr = useT()
  return (
    <>
      <label className="cm-field">
        <span className="cm-label">{tr('Version')}</span>
        <select className="input input-sm" value={l.fileId} onChange={(e) => onChange({ fileId: e.target.value })}>
          <option value="auto">{tr('Automatic – the one that reads on the background')}</option>
          {logos.map((x) => <option key={x.id} value={x.id}>{x.file.name}</option>)}
        </select>
      </label>
      <div className="cm-field">
        <span className="cm-label">{tr('Colour')}</span>
        <div className="seg" role="group" aria-label={tr('Colour')} style={{ justifySelf: 'start' }}>
          <button aria-pressed={(l.colour ?? 'auto') === 'auto'} onClick={() => onChange({ colour: 'auto' })} title={tr('A brand colour that reads on the background')}>{tr('Automatic')}</button>
          <button aria-pressed={l.colour === 'original'} onClick={() => onChange({ colour: 'original' })} title={tr('The logo’s own colours, without its background')}>{tr('Original')}</button>
        </div>
        <div className="cm-swatches">
          {brand.swatches.map((c) => (
            <button key={c} className={'cm-swatch' + (c === l.colour?.toLowerCase() ? ' on' : '')} style={{ background: c }} title={c} aria-label={c} onClick={() => onChange({ colour: c })} />
          ))}
        </div>
      </div>
      {!logos.length && <p className="muted" style={{ fontSize: 12 }}>{tr('No logo files in this brand hub yet, so the wordmark is used. Publish logos in the project’s Files to use them here.')}</p>}
    </>
  )
}

/* ---------- Shapes ---------- */

function ShapeProps({ layer: l, brand, onChange }: { layer: Extract<Layer, { type: 'shape' }>; brand: Brand; onChange: (p: Partial<Layer>, record?: boolean) => void }) {
  const tr = useT()
  const line = l.shape === 'line' || l.shape === 'arrow'
  return (
    <>
      <label className="cm-field">
        <span className="cm-label">{tr('Shape')}</span>
        <select className="input input-sm" value={l.shape} onChange={(e) => {
          const shape = e.target.value as ShapeKind
          const toLine = shape === 'line' || shape === 'arrow'
          onChange({ shape, sides: shape === 'star' ? l.sides ?? 5 : shape === 'polygon' ? l.sides ?? 6 : l.sides, stroke: toLine && !l.stroke ? { colour: l.fill, width: Math.max(2, Math.round(l.h * 0.2)) } : l.stroke })
        }}>
          {SHAPES.map((s) => <option key={s.id} value={s.id}>{tr(s.name)}</option>)}
        </select>
      </label>
      {(l.shape === 'star' || l.shape === 'polygon') && (
        <Slider label={l.shape === 'star' ? tr('Points') : tr('Corners')} value={l.sides ?? (l.shape === 'star' ? 5 : 6)} min={3} max={16} onChange={(sides, r) => onChange({ sides }, r)} />
      )}
      {!line && (
        <>
          <div className="seg" role="group" aria-label={tr('Fill')}>
            <button aria-pressed={!l.gradient} onClick={() => onChange({ gradient: undefined })}>{tr('Colour')}</button>
            <button aria-pressed={!!l.gradient} onClick={() => onChange({ gradient: l.gradient ?? defaultGradient(brand) })}>{tr('Gradient')}</button>
          </div>
          {l.gradient ? <GradientField value={l.gradient} brand={brand} onChange={(gradient) => onChange({ gradient })} /> : <ColourField label={tr('Fill')} value={l.fill} brand={brand} onChange={(fill) => onChange({ fill })} />}
          {l.shape === 'rect' && <Slider label={tr('Corner radius')} value={l.radius} min={0} max={Math.round(Math.min(l.w, l.h) / 2)} onChange={(radius, r) => onChange({ radius }, r)} />}
        </>
      )}
      <Toggle label={line ? tr('Line') : tr('Outline')} on={!!l.stroke} onChange={(on) => onChange({ stroke: on ? { colour: line ? l.fill : brand.dark, width: 4 } : undefined })}>
        {l.stroke && (
          <>
            <Slider label={tr('Width')} value={l.stroke.width} min={1} max={60} unit=" px" onChange={(width, r) => onChange({ stroke: { ...l.stroke!, width } }, r)} />
            <ColourField label={tr('Colour')} value={l.stroke.colour} brand={brand} onChange={(colour) => onChange({ stroke: { ...l.stroke!, colour } })} />
            <label className="cm-toggle-row"><input type="checkbox" checked={!!l.stroke.dash} onChange={(e) => onChange({ stroke: { ...l.stroke!, dash: e.target.checked } })} /> <span>{tr('Dashed')}</span></label>
          </>
        )}
      </Toggle>
    </>
  )
}

/* ---------- Icons ---------- */

function IconProps({ layer: l, brand, onChange }: { layer: Extract<Layer, { type: 'icon' }>; brand: Brand; onChange: (p: Partial<Layer>, record?: boolean) => void }) {
  const tr = useT()
  return (
    <>
      <IconPicker value={l.icon} onPick={(icon) => onChange({ icon, name: icon })} />
      <ColourField label={tr('Colour')} value={l.colour} brand={brand} onChange={(colour) => onChange({ colour })} />
      <Slider label={tr('Line width')} value={l.strokeWidth} min={0.5} max={4} step={0.25} onChange={(strokeWidth, r) => onChange({ strokeWidth }, r)} />
    </>
  )
}

/** Every icon in the set, searchable by name. */
export function IconPicker({ value, onPick, footer }: { value?: string; onPick: (name: string) => void; footer?: ReactNode }) {
  const tr = useT()
  const [q, setQ] = useState('')
  const names = ICON_NAMES.filter((n) => n.includes(q.trim().toLowerCase().replace(/\s+/g, '-')))
  return (
    <div className="cm-icons">
      <label className="cm-search">
        <Search size={12} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Find an icon')} aria-label={tr('Find an icon')} />
      </label>
      <div className="cm-icon-grid">
        {names.map((n) => {
          const I = ICONS[n]
          return (
            <button key={n} className={'cm-icon-pick' + (n === value ? ' on' : '')} onClick={() => onPick(n)} title={n} aria-label={n}>
              <I size={18} />
            </button>
          )
        })}
      </div>
      {footer}
    </div>
  )
}
