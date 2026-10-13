/**
 * AI in the Content Machine: images made for the client's brand (photos, illustrations, graphics,
 * backgrounds), photo tools (remove the background, extend to fill, change with words) and copy in
 * the brand's tone of voice. The work happens on the server (api/image.ts, api/copy.ts).
 */
import { APP_NAME } from '../../components/brand'
import { useEffect, useState } from 'react'
import { Eraser, Expand, ImagePlus, Loader2, PenLine, RotateCcw, Sparkles, Wand2 } from 'lucide-react'
import { putBlob, resolveSrc, useSrc } from '../../data/blobs'
import { now, uid, useStore } from '../../data/store'
import type { Artboard, Design, ImageLayer, Layer, Project } from '../../data/types'
import { activeLang, useT } from '../../data/i18n'
import { aiAllowance, hasFeature } from '../../data/plans'
import { UpgradeNote } from '../../app/Plan'
import { AI_KINDS, copyLength, expandPlan, monthKey, type AiKind, type CopyKind, type ImageRequest } from './ai'
import type { Brand } from './model'
import type { AiTool } from './layerProps'

class AiError extends Error {}

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new AiError('Could not reach Aftryk – check the connection')
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (res.status === 501) throw new AiError('not-configured')
  if (!res.ok) throw new AiError(data.error ?? `Error ${res.status}`)
  return data
}

const load = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new AiError('The image could not be read'))
    i.src = url
  })

/**
 * A photo layer as an image to send: the whole picture, or just what shows in its box. Big photos
 * are made smaller first; transparent ones stay PNG, the rest become JPEG.
 */
async function snapshot(l: ImageLayer, part: 'whole' | { w: number; h: number }, max = 1600): Promise<string> {
  const url = await resolveSrc(l.src)
  if (!url) throw new AiError('The image could not be read')
  const img = await load(url)
  const [nw, nh] = [img.naturalWidth || 1, img.naturalHeight || 1]
  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')!
  if (part === 'whole') {
    const s = Math.min(1, max / Math.max(nw, nh))
    canvas.width = Math.round(nw * s)
    canvas.height = Math.round(nh * s)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
  } else {
    canvas.width = part.w
    canvas.height = part.h
    const s = l.fit === 'cover' ? Math.max(part.w / nw, part.h / nh) : Math.min(part.w / nw, part.h / nh)
    const f = l.focus ?? { x: 50, y: 50 }
    const [dw, dh] = [nw * s, nh * s]
    g.drawImage(img, -(dw - part.w) * (f.x / 100), -(dh - part.h) * (f.y / 100), dw, dh)
  }
  const alpha = g.getImageData(0, 0, 1, 1).data[3] < 250
  return alpha && part === 'whole' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9)
}

type Made = { id: string; src?: string; error?: string }

/** A generated image kept in the browser's file store. */
async function keep(dataUri: string) {
  return putBlob(await (await fetch(dataUri)).blob())
}

function Thumb({ src, onClick, title }: { src: string; onClick?: () => void; title?: string }) {
  const url = useSrc(src)
  return (
    <button className="cm-ai-thumb" onClick={onClick} title={title} disabled={!onClick}>
      {url && <img src={url} alt="" draggable={false} />}
    </button>
  )
}

export function AiPanel({ project, design, board, layer, brand, request, onPlace, onReplace, onExpanded, onText, onRemember }: {
  project: Project
  design: Design
  board: Artboard
  layer: Layer | null
  brand: Brand
  /** A photo tool or the writer, asked for from the layer's properties or the right-click menu. */
  request: { tool: AiTool; n: number } | null
  onPlace: (src: string, as: 'background' | 'image') => void
  onReplace: (layerId: string, src: string) => void
  onExpanded: (layerId: string, src: string) => void
  onText: (text: string) => void
  onRemember: (entry: { src: string; prompt: string; kind: string }) => void
}) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const allowance = aiAllowance(state)
  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState<AiKind>('photo')
  const [follow, setFollow] = useState(true)
  const [use, setUse] = useState<'image' | 'background'>('image')
  const [count, setCount] = useState(2)
  const [made, setMade] = useState<Made[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [off, setOff] = useState(false)
  const [change, setChange] = useState('')
  const [brief, setBrief] = useState('')
  const [copyKind, setCopyKind] = useState<CopyKind>('headline')
  const [options, setOptions] = useState<string[]>([])
  const photo = layer?.type === 'image' && !layer.generated ? layer : null
  const text = layer?.type === 'text' ? layer : null
  const imagery = project.hub.imagery?.trim()

  // Asked for from elsewhere: remove the background or extend right away; for words, go to the box.
  useEffect(() => {
    if (!request || !hasFeature(state, 'aiImages')) return
    const where = request.tool === 'write' ? 'write' : 'photo'
    document.getElementById(`cm-ai-${where}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (request.tool === 'cutout' || request.tool === 'expand') photoTool(request.tool)
    else document.querySelector<HTMLElement>(request.tool === 'edit' ? '#cm-ai-edit input' : '#cm-ai-write textarea')?.focus()
  }, [request?.n])
  useEffect(() => {
    if (kind === 'texture') setUse('background')
  }, [kind])

  if (!hasFeature(state, 'aiImages')) return <div className="cm-panel"><UpgradeNote feature="aiImages" /></div>

  const count1 = (n: number) => dispatch({ type: 'updateStudio', patch: { aiUsage: { month: monthKey(), images: allowance.used + n } } })
  const fail = (err: unknown) => {
    if (err instanceof AiError && err.message === 'not-configured') setOff(true)
    else setError(err instanceof Error ? err.message : String(err))
  }
  const room = (n: number) => {
    if (allowance.left >= n) return true
    setError(tr('That’s all the AI images your plan has this month ({n}). More next month, or move up a plan.', { n: allowance.limit }))
    return false
  }

  async function create() {
    if (!room(count) || busy) return
    setError(null)
    setBusy('create')
    const slots: Made[] = Array.from({ length: count }, () => ({ id: uid() }))
    setMade((m) => [...slots, ...m].slice(0, 12))
    const base = Math.floor(Math.random() * 1e6)
    const request = (i: number): ImageRequest => ({
      action: 'create', prompt, kind, width: board.width, height: board.height, seed: base + i,
      brand: follow ? { colours: [brand.primary, brand.accent, brand.light, brand.dark, ...brand.swatches].filter((c, j, all) => all.indexOf(c) === j && c !== '#ffffff' && c !== '#000000'), imagery } : undefined,
    })
    let ok = 0
    await Promise.all(
      slots.map(async (slot, i) => {
        try {
          const { images } = await post<{ images: { src: string }[] }>('/api/image', request(i))
          const src = await keep(images[0].src)
          ok++
          onRemember({ src, prompt: prompt || tr(AI_KINDS.find((k) => k.id === kind)!.name), kind })
          setMade((m) => m.map((x) => (x.id === slot.id ? { ...x, src } : x)))
        } catch (err) {
          setMade((m) => m.filter((x) => x.id !== slot.id))
          fail(err)
        }
      }),
    )
    if (ok) count1(ok)
    setBusy(null)
  }

  /** A photo tool on the selected photo; the result replaces it (one step to undo). */
  async function photoTool(which: 'cutout' | 'edit' | 'expand') {
    if (!photo || !room(1) || busy) return
    setError(null)
    setBusy(which)
    try {
      let req: ImageRequest
      if (which === 'expand') {
        const plan = expandPlan(board, photo)
        req = { action: 'expand', image: await snapshot(photo, { w: plan.place.w, h: plan.place.h }), canvas: plan.canvas, place: plan.place, prompt: change || undefined }
      } else if (which === 'edit') req = { action: 'edit', prompt: change, image: await snapshot(photo, 'whole') }
      else req = { action: 'cutout', image: await snapshot(photo, 'whole') }
      const { images } = await post<{ images: { src: string }[] }>('/api/image', req)
      const src = await keep(images[0].src)
      count1(1)
      onRemember({ src, prompt: which === 'cutout' ? tr('Background removed') : which === 'expand' ? tr('Extended') : change, kind: which })
      if (which === 'expand') onExpanded(photo.id, src)
      else onReplace(photo.id, src)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  async function write() {
    if (busy) return
    setError(null)
    setBusy('write')
    setOptions([])
    try {
      const client = state.clients.find((c) => c.id === project.clientId)
      const tone = project.hub.tone
      const { options } = await post<{ options: string[] }>('/api/copy', {
        kind: copyKind,
        brief: brief || design.name,
        current: text?.text,
        brand: client?.name ?? project.name,
        tone: { summary: tone.summary, weAre: tone.weAre, weAreNot: tone.weAreNot, examples: tone.examples.map((e) => ({ say: e.say, dontSay: e.dontSay })) },
        lang: activeLang(),
        maxChars: text ? copyLength(copyKind, text) : copyKind === 'body' ? 160 : 60,
      })
      setOptions(options)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const spinner = <Loader2 size={14} className="spin" />
  return (
    <div className="cm-panel cm-ai">
      <div className="cm-ai-meter">
        <Sparkles size={13} />
        <span>{tr('{used} of {limit} AI images this month', { used: allowance.used, limit: allowance.limit })}</span>
      </div>
      {off && <p className="cm-ai-off">{tr('AI isn’t switched on yet. Whoever runs {app} adds the keys – see docs/AI-IMAGES.md.', { app: APP_NAME })}</p>}
      {error && <p className="error" role="alert" style={{ fontSize: 12, margin: 0 }}>{error}</p>}

      <section id="cm-ai-create" className="cm-ai-section">
        <h4>{tr('Make an image')}</h4>
        <textarea className="input" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={tr('What should be in it? e.g. “A barista pouring oat milk, morning light”')} aria-label={tr('What should be in it?')} />
        <div className="cm-layouts">
          {AI_KINDS.map((k) => <button key={k.id} className={'btn btn-sm' + (kind === k.id ? ' on' : '')} onClick={() => setKind(k.id)} title={tr(k.hint)}>{tr(k.name)}</button>)}
        </div>
        <label className="cm-toggle-row">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          <span>{tr('Follow the brand – its colours{direction}', { direction: imagery ? tr(' and photo direction') : '' })}</span>
        </label>
        {follow && imagery && <small className="muted cm-ai-direction">“{imagery.slice(0, 160)}{imagery.length > 160 ? '…' : ''}”</small>}
        <div className="cm-grid2">
          <label className="cm-num">
            <span>{tr('Use as')}</span>
            <select className="input input-sm" value={use} onChange={(e) => setUse(e.target.value as 'image' | 'background')}>
              <option value="image">{tr('An image')}</option>
              <option value="background">{tr('The background')}</option>
            </select>
          </label>
          <label className="cm-num">
            <span>{tr('How many')}</span>
            <select className="input input-sm" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <button className="btn btn-primary btn-sm" onClick={create} disabled={!!busy || (!prompt.trim() && kind !== 'texture')}>
          {busy === 'create' ? spinner : <Sparkles size={14} />} {busy === 'create' ? tr('Making…') : tr('Make {n}', { n: count })}
        </button>
        {made.length > 0 && (
          <div className="cm-ai-grid">
            {made.map((m) => (m.src ? <Thumb key={m.id} src={m.src} onClick={() => onPlace(m.src!, use)} title={tr('Add to the artboard')} /> : <span key={m.id} className="cm-ai-thumb loading">{spinner}</span>))}
          </div>
        )}
        {made.some((m) => m.src) && <small className="muted">{use === 'background' ? tr('Click one to make it the background.') : tr('Click one to add it.')}</small>}
      </section>

      <section id="cm-ai-photo" className="cm-ai-section">
        <h4>{tr('Photo tools')}</h4>
        {photo ? (
          <>
            <div className="cm-layouts">
              <button className="btn btn-sm" onClick={() => photoTool('cutout')} disabled={!!busy}>{busy === 'cutout' ? spinner : <Eraser size={14} />} {tr('Remove background')}</button>
              <button className="btn btn-sm" onClick={() => photoTool('expand')} disabled={!!busy} title={tr('Grows the photo to fill the artboard, making up what’s outside it')}>{busy === 'expand' ? spinner : <Expand size={14} />} {tr('Extend to fill')}</button>
            </div>
            <div id="cm-ai-edit" className="cm-inline">
              <input className="input input-sm" value={change} onChange={(e) => setChange(e.target.value)} placeholder={tr('e.g. “make it evening”, “add snow”')} aria-label={tr('Change with words')} onKeyDown={(e) => e.key === 'Enter' && change.trim() && photoTool('edit')} />
              <button className="btn btn-sm" onClick={() => photoTool('edit')} disabled={!!busy || !change.trim()}>{busy === 'edit' ? spinner : <Wand2 size={14} />} {tr('Change')}</button>
            </div>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('Select a photo to remove its background, extend it or change it with words.')}</p>
        )}
      </section>

      <section id="cm-ai-write" className="cm-ai-section">
        <h4>{tr('Words in the brand’s voice')}</h4>
        <textarea className="input" rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={tr('What’s the post about? e.g. “New autumn menu, from 1 October”')} aria-label={tr('What’s the post about?')} />
        <div className="cm-inline">
          <select className="input input-sm" value={copyKind} onChange={(e) => setCopyKind(e.target.value as CopyKind)} aria-label={tr('What to write')}>
            <option value="headline">{tr('Headline')}</option>
            <option value="body">{tr('Short text')}</option>
            <option value="cta">{tr('Call to action')}</option>
          </select>
          <button className="btn btn-sm" onClick={write} disabled={!!busy}>{busy === 'write' ? spinner : <PenLine size={14} />} {tr('Write 5')}</button>
        </div>
        {options.length > 0 && (
          <div className="cm-ai-options">
            {options.map((o, i) => (
              <button key={i} className="cm-ai-option" onClick={() => onText(o)} title={text ? tr('Use this text') : tr('Add as text')}>{o}</button>
            ))}
            <small className="muted">{text ? tr('Click one to use it in the selected text.') : tr('Click one to add it as text.')}</small>
          </div>
        )}
      </section>

      {!!design.aiImages?.length && (
        <section className="cm-ai-section">
          <h4><RotateCcw size={12} style={{ verticalAlign: -1 }} /> {tr('Made for this design')}</h4>
          <div className="cm-ai-grid small">
            {design.aiImages.slice(0, 16).map((m) => <Thumb key={m.id} src={m.src} title={m.prompt} onClick={() => onPlace(m.src, 'image')} />)}
          </div>
        </section>
      )}
      <small className="muted" style={{ fontSize: 11 }}><ImagePlus size={11} style={{ verticalAlign: -1 }} /> {tr('Images are made by fal.ai and words by Claude. Check them before they go out.')}</small>
    </div>
  )
}

/** A generated image's entry in the design's history. */
export const aiEntry = (e: { src: string; prompt: string; kind: string }) => ({ id: uid(), ...e, at: now() })
