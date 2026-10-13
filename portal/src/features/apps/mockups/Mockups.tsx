/**
 * Mockups: the work shown where it'll live – on business cards, a poster, a phone, a laptop, a
 * mug, a box, a billboard, or a photo of your own. The picture comes from a Content
 * Machine design, a file in the project or the brand's logo.
 */
import { APP_NAME } from '../../../components/brand'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Coffee, CreditCard, CupSoda, Download, ExternalLink, Frame, Image as ImageIcon, ImagePlus, Laptop, Loader2, Mail, Move3d, Package, PenTool, Plus,
  RectangleHorizontal, RectangleVertical, RotateCcw, Send, ShoppingBag, Smartphone, Sparkles, Tablet, Trash2, type LucideIcon,
} from 'lucide-react'
import { Modal, useConfirm } from '../../../components/ui'
import { putBlob, resolveSrc } from '../../../data/blobs'
import { formatDate, now, uid, useStore } from '../../../data/store'
import type { Artboard, Mockup, Project } from '../../../data/types'
import { useT } from '../../../data/i18n'
import { aiAllowance, hasApp, hasFeature } from '../../../data/plans'
import { AppGate } from '../../../app/Apps'
import { useUpload } from '../../files'
import { ArtboardView, artboardImage, useBrandLogos } from '../../content/render'
import { brandOf } from '../../content/model'
import { monthKey } from '../../content/ai'
import { DEFAULT_CORNERS, SCENES, sceneOf, type Art, type Point } from './scenes'
import { DEFAULT_VIEW, SCENES_3D, render3D, scene3dOf, supports3D, type Arts, type FaceId, type Mood, type View } from './studio3d'
import { PLACEHOLDERS, defaultFace, fitsProduct, productArtboard, productDesign, trimShare, type ProductSource } from './product'
import '../../content/content.css'

const load = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = url
  })

/** The scenes to pick from: in 3D where the browser can, drawn flat where it can't – and your own photo. */
function useScenes() {
  return useMemo(() => {
    const three = supports3D()
    const list = three ? [...SCENES_3D.map((s) => ({ id: s.id, name: s.name })), { id: 'photo', name: 'Your own photo' }] : SCENES.map((s) => ({ id: s.id, name: s.name }))
    return { three, list, nameOf: (id: string) => list.find((s) => s.id === id)?.name ?? sceneOf(id).name }
  }, [])
}

/** An icon for each scene, for the strip under the picture. */
const SCENE_ICONS: Record<string, LucideIcon> = {
  cards: CreditCard, stationery: Mail, poster: Frame, notebook: BookOpen, phone: Smartphone, tablet: Tablet, laptop: Laptop,
  mug: Coffee, can: CupSoda, box: Package, bag: ShoppingBag, rollup: RectangleVertical, billboard: RectangleHorizontal, photo: ImageIcon,
}

const MOODS: { id: Mood; name: string }[] = [
  { id: 'studio', name: 'Studio' },
  { id: 'sun', name: 'Sunlight' },
  { id: 'plant', name: 'Plant shadow' },
]

/** The brand's logo on its colour, in the shape the scene shows best (upright for a phone). */
function logoArtboard(project: Project, scene: string, tr: (s: string) => string): Artboard {
  const product = scene3dOf(scene)?.product
  // Letter paper isn't a logo on a colour – it starts as the letterhead "Design it" would make.
  if (product?.print === 'letter-a4') {
    const words = Object.fromEntries(Object.entries(PLACEHOLDERS).map(([k, v]) => [k, tr(v)])) as typeof PLACEHOLDERS
    return { ...productArtboard(product, project, { kind: 'logo' }, words), id: `logo-${scene}` }
  }
  const b = brandOf(project)
  const aspect = scene3dOf(scene)?.aspect ?? (scene === 'phone' ? 900 / 1940 : 1.5)
  const [W, H] = aspect >= 1 ? [1200, Math.round(1200 / aspect)] : [Math.round(1200 * aspect), 1200]
  const w = W * (aspect < 1 ? 0.72 : 0.62)
  const h = Math.min(H * 0.3, w * 0.45)
  return {
    id: `logo-${scene}`, name: 'Logo', width: W, height: H, background: b.primary,
    layers: [{ id: `logo-${scene}`, type: 'logo', name: 'Logo', fileId: 'auto', centred: true, x: (W - w) / 2, y: (H - h) / 2, w, h }],
  }
}

/** Draws an artboard off screen and hands back the picture. */
function RenderArtboard({ artboard, project, onReady }: { artboard: Artboard; project: Project; onReady: (art: Art) => void }) {
  const logos = useBrandLogos(project)
  const ref = useRef<HTMLDivElement>(null)
  const key = JSON.stringify(artboard) + logos.length
  useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      const node = ref.current?.querySelector<HTMLElement>('.cm-board')
      if (!node) return
      const blob = await artboardImage(node, artboard, 'png')
      // Printed things are shown as they'll be cut – without the bleed.
      const t = trimShare(artboard)
      const bmp = t ? await createImageBitmap(blob, Math.round(t.x * artboard.width), Math.round(t.y * artboard.height), Math.round(t.w * artboard.width), Math.round(t.h * artboard.height)) : await createImageBitmap(blob)
      if (live) onReady(bmp)
    }, 450)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [key])
  return (
    <div ref={ref} className="cm-offscreen" aria-hidden>
      <ArtboardView artboard={artboard} project={project} logos={logos} />
    </div>
  )
}

/* ---------- The list ---------- */

export default function Mockups() {
  const { id } = useParams()
  return <AppGate id="mockups">{id ? <MockupEditor id={id} /> : <MockupList />}</AppGate>
}

function MockupList() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const { confirm, confirmNode } = useConfirm()
  const [creating, setCreating] = useState(false)
  const list = [...state.mockups].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('App')}</span>
          <h1>{tr('Mockups')}</h1>
          <p className="muted">{tr('Show the work in 3D on business cards, posters, phones and mugs')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> {tr('New mockup')}</button>
      </div>
      {!list.length ? (
        <div className="empty">
          <p>{tr('No mockups yet. Pick a client and a scene – the logo or a design goes straight in.')}</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> {tr('New mockup')}</button>
        </div>
      ) : (
        <div className="cm-grid">
          {list.map((m) => <MockupCard key={m.id} mockup={m} onDelete={() => confirm(tr('Delete “{name}”? This can’t be undone.', { name: m.name }), () => dispatch({ type: 'remove', coll: 'mockups', id: m.id }))} />)}
        </div>
      )}
      {creating && (
        <NewMockup
          onClose={() => setCreating(false)}
          onCreate={(m) => {
            dispatch({ type: 'insert', coll: 'mockups', item: m, log: { text: `Mockup started: ${m.name}`, projectId: m.projectId } })
            navigate(`/app/mockups/${m.id}`)
          }}
        />
      )}
      {confirmNode}
    </>
  )
}

function MockupCard({ mockup: m, onDelete }: { mockup: Mockup; onDelete: () => void }) {
  const tr = useT()
  const { state } = useStore()
  const { nameOf } = useScenes()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (m.preview) resolveSrc(m.preview).then(setUrl)
  }, [m.preview])
  const p = state.projects.find((x) => x.id === m.projectId)
  return (
    <div className="card cm-card">
      <Link to={`/app/mockups/${m.id}`} className="cm-card-art mk-card-art">{url ? <img src={url} alt="" /> : <span className="muted">{tr(nameOf(m.scene))}</span>}</Link>
      <div className="cm-card-body" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to={`/app/mockups/${m.id}`} className="grow cell-title">
          <b style={{ fontWeight: 500 }}>{m.name}</b>
          <small>{p?.name} · {tr(nameOf(m.scene))} · {formatDate(m.updatedAt)}</small>
        </Link>
        <button className="btn btn-ghost btn-icon" title={tr('Delete')} onClick={onDelete}><Trash2 size={15} /></button>
      </div>
    </div>
  )
}

function NewMockup({ onClose, onCreate }: { onClose: () => void; onCreate: (m: Mockup) => void }) {
  const tr = useT()
  const { state } = useStore()
  const projects = state.projects.filter((p) => !p.archived)
  const { list: scenes, nameOf } = useScenes()
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [scene, setScene] = useState(scenes[0].id)
  return (
    <Modal title={tr('New mockup')} onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        const p = projects.find((x) => x.id === projectId)
        if (!p) return
        const design = state.designs.find((d) => d.projectId === p.id)
        const at = now()
        onCreate({
          id: uid(), projectId: p.id, name: `${p.name} – ${tr(nameOf(scene))}`, scene,
          source: design && scene !== 'cards' ? { kind: 'design', designId: design.id, artboardId: design.artboards[0].id } : { kind: 'logo' },
          tint: '#e9e6e0', createdAt: at, updatedAt: at,
        })
      }}>
        <label>{tr('Client')}
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="field">
          <label>{tr('Scene')}</label>
          <div className="seg" role="group" style={{ flexWrap: 'wrap', justifySelf: 'start' }}>
            {scenes.map((s) => <button key={s.id} type="button" aria-pressed={scene === s.id} onClick={() => setScene(s.id)}>{tr(s.name)}</button>)}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button className="btn btn-primary" disabled={!projectId}>{tr('Create mockup')}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- The editor ---------- */

function MockupEditor({ id }: { id: string }) {
  const tr = useT()
  const navigate = useNavigate()
  const { state, dispatch } = useStore()
  const m = state.mockups.find((x) => x.id === id)
  const project = state.projects.find((p) => p.id === m?.projectId)
  const { upload } = useUpload(project?.id ?? '')
  const canvas = useRef<HTMLCanvasElement>(null)
  const [art, setArt] = useState<Art | null>(null)
  // The product's other sides (a card's back, a box's side and lid), when they have a design.
  const [faceArts, setFaceArts] = useState<Partial<Record<FaceId, Art>>>({})
  const arts = useMemo<Arts | null>(() => (art ? { front: art, ...faceArts } : null), [art, faceArts])
  const [photo, setPhoto] = useState<Art | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const brand = useMemo(() => (project ? brandOf(project) : null), [project])
  const { three, list: scenes } = useScenes()
  const is3d = three && !!m && m.scene !== 'photo' && !!scene3dOf(m.scene)
  // While the camera is being turned, the view lives here; it's saved when the drag ends.
  const [turning, setTurning] = useState<View | null>(null)
  const view = turning ?? m?.view ?? DEFAULT_VIEW

  const update = (patch: Partial<Mockup>) => m && dispatch({ type: 'update', coll: 'mockups', id: m.id, fn: (x) => ({ ...x, ...patch, updatedAt: now() }) })

  // The picture to show: a design's artboard, a project file, or the logo.
  const artboard = useMemo<Artboard | null>(() => {
    if (!m || !project) return null
    if (m.source.kind === 'logo') return logoArtboard(project, m.scene, tr)
    if (m.source.kind === 'design') {
      const src = m.source
      const d = state.designs.find((x) => x.id === src.designId)
      return d?.artboards.find((a) => a.id === src.artboardId) ?? d?.artboards[0] ?? null
    }
    return null
  }, [m?.source, m?.scene, project, state.designs])
  /** Each other side's artboard: the one picked, or one made for that side in the same design. */
  const faceBoards = useMemo(() => {
    const product = m ? scene3dOf(m.scene)?.product : undefined
    if (!m || m.source.kind !== 'design' || !product?.faces) return []
    const src = m.source
    const d = state.designs.find((x) => x.id === src.designId)
    if (!d) return []
    return product.faces.flatMap((face) => {
      const picked = src.faces?.[face.id]
      const board = picked === '' ? undefined : picked ? d.artboards.find((a) => a.id === picked) : defaultFace(face, d.artboards, src.artboardId)
      return board ? [{ face, board }] : []
    })
  }, [m?.source, m?.scene, state.designs])
  // Sides that no longer have a design go back to the brand colour.
  useEffect(() => {
    setFaceArts((prev) => {
      const keep = new Set(faceBoards.map((f) => f.face.id))
      const next = Object.fromEntries(Object.entries(prev).filter(([k]) => keep.has(k as FaceId)))
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
  }, [faceBoards])
  useEffect(() => {
    if (m?.source.kind !== 'file') return
    const f = state.files.find((x) => x.id === (m.source as { fileId: string }).fileId)
    if (!f) return
    resolveSrc(f.versions.at(-1)!.src).then((url) => { if (url) load(url).then(setArt) })
  }, [m?.source])
  useEffect(() => {
    if (m?.photo) resolveSrc(m.photo).then((url) => { if (url) load(url).then(setPhoto) })
    else setPhoto(null)
  }, [m?.photo])

  // Draw the scene whenever anything changes – quickly while the camera turns, finely after.
  useEffect(() => {
    const c = canvas.current
    const g = c?.getContext('2d')
    if (!c || !g || !m || !brand) return
    g.clearRect(0, 0, c.width, c.height)
    if (!art || !arts) return
    if (is3d) {
      try {
        const look = { tint: m.tint ?? '#e9e6e0', primary: brand.primary, accent: brand.accent, light: brand.light, dark: brand.dark, mood: m.mood ?? scene3dOf(m.scene)?.mood ?? 'studio', view }
        // A quick pass first, so there is a picture straight away: the fine one renders at twice the
        // size and costs several times as much, which a browser without a real GPU takes long
        // enough over to feel stuck. It follows a frame later, and is dropped if the scene changes
        // again before then – turning the camera keeps the quick pass all the way through.
        render3D(m.scene, arts, look, c, 1)
        if (turning) return
        const fine = requestAnimationFrame(() => {
          try {
            render3D(m.scene, arts, look, c, 2)
          } catch (err) {
            console.error(err)
          }
        })
        return () => cancelAnimationFrame(fine)
      } catch (err) {
        console.error(err)
      }
    }
    const scene = sceneOf(m.scene)
    scene.draw(g, art, { tint: m.tint ?? '#e9e6e0', accent: brand.primary, dark: brand.dark, light: brand.light, wordmark: brand.wordmark, font: brand.heading, photo: photo ?? undefined, corners: m.corners as Point[] | undefined, blend: m.blend })
  }, [arts, photo, m?.scene, m?.tint, m?.corners, m?.blend, m?.mood, view.az, view.el, view.zoom, !!turning, brand, is3d])

  /** Drag on the picture to turn the camera around the scene. */
  const turn = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!is3d || !m) return
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY, view: m.view ?? DEFAULT_VIEW }
    const box = e.currentTarget.getBoundingClientRect()
    let last = start.view
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const move = (ev: PointerEvent) => {
      last = {
        ...start.view,
        az: Math.round(clamp(start.view.az - ((ev.clientX - start.x) / box.width) * 90, -60, 60)),
        el: Math.round(clamp(start.view.el + ((ev.clientY - start.y) / box.height) * 60, -30, 40)),
      }
      setTurning(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      update({ view: last })
      setTurning(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (!m || !project || !brand) return <p className="muted">{tr('This mockup doesn’t exist any more.')}</p>
  const size = is3d ? { width: 1600, height: 1200 } : sceneOf(m.scene)
  const turned = !!m.view && (m.view.az !== 0 || m.view.el !== 0 || m.view.zoom !== 1)
  const designs = state.designs.filter((d) => d.projectId === project.id)
  const images = state.files.filter((f) => f.projectId === project.id && f.versions.at(-1)!.mime.startsWith('image/'))
  const sourceValue = m.source.kind === 'logo' ? 'logo' : m.source.kind === 'file' ? `file:${m.source.fileId}` : `design:${m.source.designId}:${m.source.artboardId}`
  const tints = ['#e9e6e0', '#f5f4f0', '#d9dde3', '#2b2d31', ...brand.swatches.filter((c) => c !== '#ffffff' && c !== '#000000')]

  const png = () => new Promise<Blob>((resolve, reject) => canvas.current!.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'))
  const savePreview = async () => {
    const c = document.createElement('canvas')
    c.width = 480
    c.height = 360
    c.getContext('2d')!.drawImage(canvas.current!, 0, 0, 480, 360)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.8))
    if (blob) update({ preview: await putBlob(blob) })
  }
  const download = async () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(await png())
    a.download = `${m.name}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    savePreview()
  }
  const toProject = async () => {
    setBusy('save')
    const saved = await upload([new File([await png()], `${m.name}.png`, { type: 'image/png' })])
    setBusy(null)
    setNote(saved ? tr('Saved to the project’s files – share it with the client there.') : tr('Your file space is full. Add more space or move up a plan in Settings → Plan.'))
    savePreview()
  }
  /** The real thing: a Content Machine design at the product's size, shown in this mockup from now on. */
  const product = scene3dOf(m.scene)?.product
  const sourceDesign = m.source.kind === 'design' ? state.designs.find((d) => d.id === (m.source as { designId: string }).designId) : undefined
  const sourceBoard = m.source.kind === 'design' ? sourceDesign?.artboards.find((a) => a.id === (m.source as { artboardId: string }).artboardId) : undefined
  const ready = !!product && !!sourceBoard && fitsProduct(sourceBoard, product)
  const machine = hasApp(state, 'contentMachine')
  function makeIt() {
    if (!m || !project || !product) return
    const f = m.source.kind === 'file' ? state.files.find((x) => x.id === (m.source as { fileId: string }).fileId) : undefined
    const source: ProductSource = sourceBoard ? { kind: 'design', artboard: sourceBoard } : f && art ? { kind: 'image', src: f.versions.at(-1)!.src, ratio: art.width / art.height } : { kind: 'logo' }
    const { design, faces } = productDesign(product, project, source, `${project.name} – ${tr(product.short ?? product.name)}`, tr)
    if (!product.faces?.length) design.artboards[0].name = tr(product.name)
    dispatch({ type: 'insert', coll: 'designs', item: design, log: { text: `Design made from a mockup: ${design.name}`, projectId: project.id } })
    setArt(null)
    update({ source: { kind: 'design', designId: design.id, artboardId: design.artboards[0].id, faces } })
    navigate(`/app/content/${design.id}?mockup=${m.id}`)
  }

  /** A scene photo made with AI – an empty surface to put the work on. */
  async function makePhoto() {
    if (!m) return
    const ai = aiAllowance(state)
    if (!prompt.trim() || ai.left < 1) return setNote(ai.left < 1 ? tr('That’s all the AI images your plan has this month ({n}). More next month, or move up a plan.', { n: ai.limit }) : null)
    setBusy('ai')
    setNote(null)
    try {
      const res = await fetch('/api/image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', kind: 'photo', prompt: `${prompt.trim()}, with an empty blank surface in the middle to place a design on, straight-on view, natural light`, width: 1600, height: 1200 }) })
      const data = (await res.json().catch(() => ({}))) as { images?: { src: string }[]; error?: string }
      if (res.status === 501) return setNote(tr('AI isn’t switched on yet. Whoever runs {app} adds the keys – see docs/AI-IMAGES.md.', { app: APP_NAME }))
      if (!res.ok || !data.images?.[0]) return setNote(data.error ?? tr('Nothing came back – try again'))
      const src = await putBlob(await (await fetch(data.images[0].src)).blob())
      dispatch({ type: 'updateStudio', patch: { aiUsage: { month: monthKey(), images: ai.used + 1 } } })
      update({ photo: src, scene: 'photo', corners: m.corners ?? DEFAULT_CORNERS })
    } catch {
      setNote(tr('Could not reach {app} – check the connection', { app: APP_NAME }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mk">
      <div className="mk-head">
        <Link to="/app/mockups" className="btn btn-ghost btn-icon" aria-label={tr('Back')}><ArrowLeft size={16} /></Link>
        <input className="cm-name" value={m.name} onChange={(e) => update({ name: e.target.value })} aria-label={tr('Name')} />
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm btn-ghost" onClick={download} disabled={!art}><Download size={14} /> {tr('Download PNG')}</button>
        <button className="btn btn-sm btn-primary" onClick={toProject} disabled={!art || !!busy}><Send size={14} /> {busy === 'save' ? tr('Saving…') : tr('Save to the project')}</button>
      </div>
      {note && <div className="cm-note" role="status">{note}</div>}
      <div className="mk-body">
        <div className="mk-stage">
          <div className="mk-canvas-wrap">
            <canvas ref={canvas} width={size.width} height={size.height} className={'mk-canvas' + (is3d ? ' turnable' : '')} onPointerDown={turn} />
            {!art && <span className="mk-loading"><Loader2 size={20} className="spin" /></span>}
            {art && m.scene === 'photo' && !m.photo && (
              <button className="mk-loading mk-photo-empty" onClick={() => file.current?.click()}>
                <ImagePlus size={22} />
                <span>{tr('Upload a photo of a wall, a shop window, a desk – anywhere the design should be. Then drag the corners onto the spot.')}</span>
              </button>
            )}
            {m.scene === 'photo' && photo && <Corners corners={(m.corners ?? DEFAULT_CORNERS) as Point[]} onChange={(corners) => update({ corners })} />}
            {is3d && art && <span className="mk-hint"><Move3d size={13} /> {tr('Drag to turn')}</span>}
          </div>
          <div className="mk-strip" role="group" aria-label={tr('Scene')}>
            {scenes.map((s) => {
              const Icon = SCENE_ICONS[s.id] ?? Frame
              return (
                <button key={s.id} className={'mk-chip' + (s.id === m.scene ? ' on' : '')} aria-pressed={s.id === m.scene} onClick={() => update({ scene: s.id, view: undefined, mood: undefined, corners: s.id === 'photo' ? m.corners ?? DEFAULT_CORNERS : m.corners })}>
                  <Icon size={18} strokeWidth={1.6} />
                  <span>{tr(s.name)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="mk-panel">
          <section>
            <h4>{tr('Shown')}</h4>
            <select className="input input-sm" value={sourceValue} onChange={(e) => {
              const [kind, a, b] = e.target.value.split(':')
              setArt(null)
              update({ source: kind === 'logo' ? { kind: 'logo' } : kind === 'file' ? { kind: 'file', fileId: a } : { kind: 'design', designId: a, artboardId: b } })
            }}>
              <option value="logo">{tr('The logo, on the brand colour')}</option>
              {designs.map((d) => (
                <optgroup key={d.id} label={d.name}>
                  {d.artboards.map((a) => <option key={a.id} value={`design:${d.id}:${a.id}`}>{a.name}</option>)}
                </optgroup>
              ))}
              {images.length > 0 && (
                <optgroup label={tr('Files in the project')}>
                  {images.map((f) => <option key={f.id} value={`file:${f.id}`}>{f.name}</option>)}
                </optgroup>
              )}
            </select>
            {product?.faces && m.source.kind === 'design' && sourceDesign && product.faces.map((face) => {
              const src = m.source as { kind: 'design'; designId: string; artboardId: string; faces?: Partial<Record<FaceId, string>> }
              const shown = faceBoards.find((f) => f.face.id === face.id)?.board.id ?? ''
              return (
                <label key={face.id} className="mk-face">
                  <span>{tr(face.name)}</span>
                  <select className="input input-sm" value={shown} onChange={(e) => update({ source: { ...src, faces: { ...src.faces, [face.id]: e.target.value } } })}>
                    <option value="">{tr('The brand colour')}</option>
                    {sourceDesign.artboards.filter((a) => a.id !== src.artboardId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
              )
            })}
          </section>

          {product && (
            <section className="mk-real">
              <h4>{tr('Make it')}</h4>
              {ready && sourceDesign ? (
                <Link className="btn btn-sm" to={`/app/content/${sourceDesign.id}?mockup=${m.id}`}><ExternalLink size={14} /> {tr('Open in the Content Machine')}</Link>
              ) : machine ? (
                <button className="btn btn-sm btn-primary" onClick={makeIt} disabled={!art}><PenTool size={14} /> {tr('Design it in the right size')}</button>
              ) : (
                <small className="muted">{tr('Turn on the Content Machine to design it in the right size.')} <Link to="/app/apps">{tr('Apps')}</Link></small>
              )}
              <small className="muted">{tr(product.name)}{product.faces?.length ? ` · ${[tr('Front'), ...product.faces.map((f) => tr(f.name))].join(', ')}` : ''}</small>
            </section>
          )}

          {m.scene !== 'photo' && (
            <section>
              <h4>{tr('Look')}</h4>
              {is3d && m.scene !== 'billboard' && (
                <div className="seg" role="group" aria-label={tr('Light§mockup')}>
                  {MOODS.map((x) => <button key={x.id} aria-pressed={(m.mood ?? scene3dOf(m.scene)?.mood ?? 'studio') === x.id} onClick={() => update({ mood: x.id })}>{tr(x.name)}</button>)}
                </div>
              )}
              {m.scene !== 'billboard' && (
                <div className="cm-swatches" aria-label={tr('Colour of the scene')}>
                  {tints.map((c) => <button key={c} className={'cm-swatch' + (c === m.tint ? ' on' : '')} style={{ background: c }} title={c} aria-label={c} onClick={() => update({ tint: c })} />)}
                </div>
              )}
            </section>
          )}

          {is3d && (
            <section>
              <h4>{tr('Camera')}</h4>
              <label className="mk-zoom">
                <span className="muted">{tr('Zoom')}</span>
                <input type="range" min={0.7} max={1.8} step={0.05} value={view.zoom} onChange={(e) => update({ view: { ...view, zoom: Number(e.target.value) } })} />
              </label>
              {turned && <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => update({ view: undefined })}><RotateCcw size={13} /> {tr('Reset the camera')}</button>}
            </section>
          )}

          {m.scene === 'photo' && (
            <section>
              <h4>{tr('Your photo')}</h4>
              <button className="btn btn-sm" onClick={() => file.current?.click()}><ImagePlus size={14} /> {m.photo ? tr('Another photo') : tr('Upload a photo')}</button>
              <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) update({ photo: await putBlob(f), corners: m.corners ?? DEFAULT_CORNERS }); e.target.value = '' }} />
              {hasFeature(state, 'aiImages') && (
                <div className="field">
                  <span className="cm-label"><Sparkles size={12} style={{ verticalAlign: -1 }} /> {tr('Or make one with AI')}</span>
                  <textarea className="input" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={tr('e.g. “a shop window in Copenhagen”, “a poster on a concrete wall”')} />
                  <button className="btn btn-sm" style={{ justifySelf: 'start' }} disabled={busy === 'ai' || !prompt.trim()} onClick={makePhoto}>{busy === 'ai' ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {tr('Make the photo')}</button>
                </div>
              )}
              {photo && <small className="muted">{tr('Drag the four corners onto the surface the design should sit on.')}</small>}
              <label className="cm-toggle-row"><input type="checkbox" checked={m.blend !== false} onChange={(e) => update({ blend: e.target.checked })} /> <span>{tr('Take on the photo’s light and texture')}</span></label>
            </section>
          )}
        </aside>
      </div>
      {artboard && <RenderArtboard artboard={artboard} project={project} onReady={setArt} />}
      {is3d && faceBoards.map(({ face, board }) => <RenderArtboard key={face.id} artboard={board} project={project} onReady={(a) => setFaceArts((prev) => ({ ...prev, [face.id]: a }))} />)}
    </div>
  )
}

/** Four handles over the preview, one per corner of the design. */
function Corners({ corners, onChange }: { corners: Point[]; onChange: (c: Point[]) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const start = (e: ReactPointerEvent, i: number) => {
    e.preventDefault()
    const box = ref.current!.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      const x = Math.max(0, Math.min(1, (ev.clientX - box.left) / box.width))
      const y = Math.max(0, Math.min(1, (ev.clientY - box.top) / box.height))
      onChange(corners.map((c, j) => (j === i ? [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] : c)) as Point[])
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div ref={ref} className="mk-corners">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={corners.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')} /></svg>
      {corners.map(([x, y], i) => <span key={i} className="mk-corner" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} onPointerDown={(e) => start(e, i)} />)}
    </div>
  )
}
