/**
 * The Content Machine editor: artboards side by side on a canvas, like Figma. What you move snaps
 * to the artboard, the brand's safe margin, other layers (and equal spacing between them), a logo's
 * clear space, guides from the rulers and the layout grid. Select several, group them, line them
 * up, size and turn them together; make images and words with AI; comment, remix, preview on a
 * phone, make many posts from a sheet – and every colour, font and logo comes from the brand hub.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ChevronDown, Circle, Shirt as MockupIcon, Copy, Download, Eye, History, ImagePlus, Keyboard, LayoutGrid, Magnet, MessageSquarePlus, Minus, Plus, Redo2, Ruler as RulerIcon, Send, Share2,
  ShieldCheck, Smartphone, Smile, Sparkles, Square, Stamp, Trash2, TriangleAlert, Type, Undo2, Wand2,
} from 'lucide-react'
import { putBlob, resolveSrc } from '../../data/blobs'
import { now, useCurrentMember, useStore } from '../../data/store'
import type { Artboard, Comment, Design, DesignTemplate, ImageLayer, Layer, Project, ShapeKind, TextLayer } from '../../data/types'
import { useT } from '../../data/i18n'
import { hasFeature } from '../../data/plans'
import { useConfirm } from '../../components/ui'
import { useUpload } from '../files'
import {
  SIZES, applyTemplate, brandOf, checkArtboard, clearZone, estimateHeight, newArtboard, newIcon, newImage, newLogo, newShape, newText, rebrand, resizeArtboard, safeMargin, uid, type Issue,
} from './model'
import { backgroundImage, newSeed, type BackgroundStyle } from './backgrounds'
import { ArtboardView, BrandFonts, artboardImage, layerBox, textStyle, useBrandLogos, type ExportFormat } from './render'
import {
  alignedLines, boundsOf, boxFrom, intersects, measure, resizeBox, snapAngle, snapBox, snapEdge, snapTargets, toLocal, union, type Axis, type Box, type Gap, type Handle, type SnapContext, type SnapLine,
} from './geometry'
import { align, cloneLayers, distribute, dropNextTo, groupLayers, placePasted, reorder, rotateLayers, scaleLayers, tidyGroups, ungroup, withGroups, type AlignHow, type Moves, type Order } from './arrange'
import { clipText, readClip, writeClip } from './clipboard'
import { Badge, CropGhost, DraftGuide, Distance, GridView, GroupFrame, Guides, Marquee, PlatformZones, PrintGuides, Ruler, SafeArea, Selection, SnapLines, VisionFilters, Zones } from './overlays'
import { BoardProps, ContextMenu, LayersPanel, MultiProps, ShortcutSheet, IssueList, keys, type MenuItem } from './panels'
import { IconPicker, LayerProps, type AiTool } from './layerProps'
import { AiPanel, aiEntry } from './AiPanel'
import { CommentPins, CommentsPanel, threads, type Draft } from './comments'
import { BulkCreate } from './BulkCreate'
import { FeedPreview } from './FeedPreview'
import { RemixPanel } from './RemixPanel'
import { SHAPES, VISION, type VisionId } from './look'
import { zonesOf } from './platforms'
import { fitPatch, measureContent } from './fit'
import { jpegPdf } from './pdf'
import { PRINT_FORMATS, mmToPx, preflight, printArtboard, printBack, printBoxes } from './print'
import { autoAnimate, durationOf, isAnimated } from './motion'
import { makeVideo } from './video'
import { PrintPanel } from './PrintPanel'
import { MotionPanel, Timeline } from './MotionPanel'
import type { Frame } from './motion'
import './content.css'

type Sel = { board: string; layers: string[] }
type Guide = NonNullable<Artboard['guides']>[number]
/** What's drawn while something is being dragged. */
type Live = {
  board: string
  lines?: SnapLine[]
  gaps?: Gap[]
  badge?: { text: string; box: Box }
  safe?: boolean
  zones?: Box[]
  marquee?: Box
  guide?: { id: string; axis: Axis; at: number }
}
/** How the canvas looks – remembered in this browser. */
type View = { rulers: boolean; grid: boolean; snap: boolean }
const VIEW_KEY = 'forme:cm-view'
function loadView(): View {
  try {
    return { rulers: true, grid: true, snap: true, ...JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') }
  } catch {
    return { rulers: true, grid: true, snap: true }
  }
}
type Tab = 'design' | 'ai' | 'comments'
type Popup = 'shapes' | 'icons' | 'export' | 'view' | 'share' | null

/** Is the user typing somewhere, so keys aren't shortcuts? */
const typingIn = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')

/** Loads an image file into the asset store and tells us its shape. */
async function addImageFile(file: File) {
  const src = await putBlob(file)
  const ratio = await new Promise<number>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1)
    img.onerror = () => resolve(1)
    img.src = URL.createObjectURL(file)
  })
  return { src, ratio }
}
/** The shape of an image already in the store. */
async function ratioOf(src: string) {
  const url = await resolveSrc(src)
  return new Promise<number>((resolve) => {
    if (!url) return resolve(1)
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1)
    img.onerror = () => resolve(1)
    img.src = url
  })
}

const saveBlob = (blob: Blob, name: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
const fileName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim()
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
/** After the next paint – or a moment later when the tab isn't painting (in the background). */
const nextFrame = () => new Promise<void>((r) => {
  requestAnimationFrame(() => r())
  setTimeout(r, 60)
})

export function DesignEditor({ design: initial, project }: { design: Design; project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  // Opened from a mockup: the way back to it.
  const fromMockup = state.mockups.find((m) => m.id === useSearchParams()[0].get('mockup'))
  const me = useCurrentMember()
  const { confirm, confirmNode } = useConfirm()
  const { upload } = useUpload(project.id)
  const brand = useMemo(() => brandOf(project), [project])
  const logos = useBrandLogos(project)
  const rules = project.hub.logoRules

  const [design, setDesign] = useState(initial)
  const latest = useRef(design)
  // Undo history lives in a ref, so several quick undos in a row each step back one.
  const history = useRef<{ past: Design[]; future: Design[] }>({ past: [], future: [] })
  const [sel, setSel] = useState<Sel>({ board: initial.artboards[0]?.id ?? '', layers: [] })
  const [editing, setEditing] = useState<string | null>(null)
  const [cropping, setCropping] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.4)
  const [live, setLive] = useState<Live | null>(null)
  const [alt, setAlt] = useState(false)
  const [space, setSpace] = useState(false)
  const [panning, setPanning] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [help, setHelp] = useState(false)
  const [view, setViewState] = useState<View>(loadView)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<ReactNode>(null)
  const [tab, setTab] = useState<Tab>('design')
  /** Design, print or motion – what the editor is set up for. */
  const [mode, setMode] = useState<'design' | 'print' | 'motion'>('design')
  const [softProof, setSoftProof] = useState(false)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [video, setVideo] = useState<number | null>(null)
  const [renderAt, setRenderAt] = useState<number | null>(null)
  const offscreen = useRef<HTMLDivElement>(null)
  const [aiRequest, setAiRequest] = useState<{ tool: AiTool; n: number } | null>(null)
  const [popup, setPopup] = useState<Popup>(null)
  const [modal, setModal] = useState<'bulk' | 'remix' | 'preview' | null>(null)
  const [commenting, setCommenting] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [focusComment, setFocusComment] = useState<string | null>(null)
  const [vision, setVision] = useState<VisionId>('normal')
  const [outline, setOutline] = useState(false)
  const [exportOpts, setExportOpts] = useState<{ format: ExportFormat; scale: number; all: boolean }>({ format: 'png', scale: 1, all: false })
  const canvas = useRef<HTMLDivElement>(null)
  const boardEls = useRef<Record<string, HTMLDivElement | null>>({})
  const imageInput = useRef<HTMLInputElement>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const pasteInPlace = useRef(false)

  const setView = (p: Partial<View>) => setViewState((v) => ({ ...v, ...p }))
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view))
    } catch {
      // Not remembered – the defaults come back next time.
    }
  }, [view])

  /* ---------- Changes, undo and saving ---------- */

  // Changes land here first (smooth dragging) and in the store a moment later.
  const dirty = useRef(false)
  const change = (fn: (d: Design) => Design, record = true) => {
    const before = latest.current
    const next = fn(before)
    if (next === before) return
    if (record) history.current = { past: [...history.current.past.slice(-80), before], future: [] }
    latest.current = next
    dirty.current = true
    setDesign(next)
  }
  const save = () => {
    if (!dirty.current) return
    dirty.current = false
    const d = latest.current
    dispatch({ type: 'update', coll: 'designs', id: d.id, fn: () => ({ ...d, updatedAt: now() }) })
  }
  useEffect(() => {
    const t = window.setTimeout(save, 500)
    return () => window.clearTimeout(t)
  })
  useEffect(() => () => save(), [])
  // Comments and word changes the client makes in the portal come in while the editor is open.
  const stored = state.designs.find((d) => d.id === design.id)
  useEffect(() => {
    if (!stored || dirty.current) return
    const cur = latest.current
    if (stored.comments !== cur.comments || stored.shared !== cur.shared) {
      const next = { ...cur, comments: stored.comments, shared: stored.shared }
      latest.current = next
      setDesign(next)
    }
  }, [stored?.comments, stored?.shared])
  const undo = () => {
    const { past, future } = history.current
    const prev = past.at(-1)
    if (!prev) return
    history.current = { past: past.slice(0, -1), future: [latest.current, ...future] }
    latest.current = prev
    dirty.current = true
    setDesign(prev)
  }
  const redo = () => {
    const { past, future } = history.current
    const next = future[0]
    if (!next) return
    history.current = { past: [...past, latest.current], future: future.slice(1) }
    latest.current = next
    dirty.current = true
    setDesign(next)
  }

  const board = design.artboards.find((a) => a.id === sel.board) ?? design.artboards[0]
  const selected = board ? board.layers.filter((l) => sel.layers.includes(l.id)) : []
  const layer = selected.length === 1 ? selected[0] : null
  const select = (boardId: string, layers: string[] = []) => setSel({ board: boardId, layers })
  /** A selection on the canvas takes whole groups, unless picking inside one. */
  const pick = (a: Artboard, ids: string[], deep = false) => select(a.id, deep ? ids : withGroups(a.layers, ids))
  const groupOf = (l: Layer) => (l.groupId ? board?.layers.filter((x) => x.groupId === l.groupId).map((x) => x.id) ?? [] : [])
  const selectedGroups = [...new Set(selected.map((l) => l.groupId).filter(Boolean))] as string[]
  const wholeGroup = selectedGroups.length === 1 && selected.every((l) => l.groupId === selectedGroups[0]) && selected.length === groupOf(selected[0]).length

  // Leaving a photo's frame when something else is selected.
  useEffect(() => {
    if (cropping && !sel.layers.includes(cropping)) setCropping(null)
  }, [sel, cropping])

  /* ---------- Where things are ---------- */

  const layerEl = (boardId: string, id: string) => boardEls.current[boardId]?.querySelector<HTMLElement>(`[data-layer="${id}"]`) ?? null
  /** Text grows with its words, so its real height comes from the page. */
  const heightOf = (boardId: string, l: Layer) => (l.type === 'text' ? layerEl(boardId, l.id)?.offsetHeight ?? estimateHeight(l) : l.h)
  const boxOf = (boardId: string, l: Layer) => boundsOf(l, heightOf(boardId, l))
  const scaleEl = (id: string) => boardEls.current[id]?.querySelector<HTMLElement>('.cm-scale') ?? null
  const toBoard = (e: { clientX: number; clientY: number }, boardId: string) => {
    const r = scaleEl(boardId)?.getBoundingClientRect()
    return r ? { x: (e.clientX - r.left) / zoomRef.current, y: (e.clientY - r.top) / zoomRef.current } : { x: 0, y: 0 }
  }

  // Brand checks for the artboard in front: the hub's rules, applied as you work.
  const issues = board ? checkArtboard(board, brand, rules, (l) => heightOf(board.id, l)) : []
  const flagged = new Set(issues.map((i) => i.layerId))
  // Print: what a printer would send back, with the photos' real sizes read from the page.
  const printIssues = board?.print
    ? preflight(board, {
        heightOf: (l) => heightOf(board.id, l),
        natural: Object.fromEntries(
          board.layers.flatMap((l) => {
            const img = l.type === 'image' ? layerEl(board.id, l.id)?.querySelector('img') : null
            return img?.naturalWidth && !/svg/.test(img.src.slice(0, 30)) ? [[l.id, { w: img.naturalWidth, h: img.naturalHeight }]] : []
          }),
        ),
      })
    : []

  /* ---------- Changing things ---------- */

  const updateBoard = (id: string, fn: (a: Artboard) => Artboard, record = true) =>
    change((d) => ({ ...d, artboards: d.artboards.map((a) => (a.id === id ? fn(a) : a)) }), record)
  const updateLayer = (boardId: string, layerId: string, fn: (l: Layer) => Layer, record = true) =>
    updateBoard(boardId, (a) => ({ ...a, layers: a.layers.map((l) => (l.id === layerId ? fn(l) : l)) }), record)
  const updateLayers = (boardId: string, ids: string[], fn: (l: Layer) => Layer, record = true) =>
    updateBoard(boardId, (a) => ({ ...a, layers: a.layers.map((l) => (ids.includes(l.id) ? fn(l) : l)) }), record)
  const patch = (p: Partial<Layer>, record = true) => layer && board && updateLayer(board.id, layer.id, (l) => ({ ...l, ...p }) as Layer, record)
  const addLayers = (ls: Layer[], target = board, groups: { id: string; name: string }[] = []) => {
    if (!target || !ls.length) return
    updateBoard(target.id, (a) => ({ ...a, layers: [...a.layers, ...ls], groups: groups.length ? [...(a.groups ?? []), ...groups] : a.groups }))
    select(target.id, ls.map((l) => l.id))
  }
  const addLayer = (l: Layer) => addLayers([l])
  const removeSelected = () => {
    if (!board || !selected.length) return
    const ids = selected.map((l) => l.id)
    updateBoard(board.id, (a) => tidyGroups({ ...a, layers: a.layers.filter((l) => !ids.includes(l.id)) }))
    select(board.id)
  }
  const duplicateSelected = () => {
    if (!board || !selected.length) return
    const { layers, groups } = cloneLayers(selected.map((l) => ({ ...l, x: l.x + 24, y: l.y + 24, name: l.name })), board.groups, uid)
    addLayers(layers, board, groups)
  }
  const order = (how: Order) => board && updateBoard(board.id, (a) => ({ ...a, layers: reorder(a.layers, sel.layers, how) }))
  const moveBy = (moves: Moves) =>
    board && updateBoard(board.id, (a) => ({ ...a, layers: a.layers.map((l) => (moves[l.id] ? { ...l, x: Math.round(l.x + moves[l.id].dx), y: Math.round(l.y + moves[l.id].dy) } : l)) }))
  const movable = () => (board ? selected.filter((l) => !l.locked).map((l) => ({ id: l.id, box: boxOf(board.id, l) })) : [])
  /** Several layers line up with each other; one lines up with the artboard. */
  const alignTo = (how: AlignHow) => {
    const items = movable()
    if (board && items.length) moveBy(align(items, how, items.length === 1 ? { x: 0, y: 0, w: board.width, h: board.height } : undefined))
  }
  const distributeAlong = (axis: Axis) => moveBy(distribute(movable(), axis))
  const flip = (axis: 'x' | 'y') => board && updateLayers(board.id, sel.layers, (l) => (axis === 'x' ? { ...l, flipX: !l.flipX } : { ...l, flipY: !l.flipY }))
  const toggle = (key: 'hidden' | 'locked', ids = sel.layers) => {
    if (!board) return
    const on = !board.layers.filter((l) => ids.includes(l.id)).every((l) => l[key])
    updateLayers(board.id, ids, (l) => ({ ...l, [key]: on }))
  }
  const group = () => {
    if (!board || selected.length < 2) return
    const id = uid()
    updateBoard(board.id, (a) => groupLayers(a, sel.layers, { id, name: tr('Group {n}', { n: (a.groups?.length ?? 0) + 1 }) }))
  }
  const ungroupSelected = () => board && selectedGroups.length && updateBoard(board.id, (a) => ungroup(a, selectedGroups))
  /** Boxes shrunk to what they show – the logo mark, the words, the whole photo. */
  const fitToContent = (ids = sel.layers, record = true, boardId = board?.id) => {
    // The design as it is now – this can run a moment after a layer was added.
    const b = latest.current.artboards.find((a) => a.id === boardId)
    if (!b) return
    const patches: Record<string, Partial<Layer>> = {}
    for (const l of b.layers.filter((x) => ids.includes(x.id))) {
      const el = layerEl(b.id, l.id)
      const r = el && measureContent(el, l)
      const p = r && fitPatch(l, heightOf(b.id, l), r)
      if (p) patches[l.id] = p
    }
    if (Object.keys(patches).length) updateBoard(b.id, (a) => ({ ...a, layers: a.layers.map((l) => (patches[l.id] ? ({ ...l, ...patches[l.id] } as Layer) : l)) }), record)
  }
  /** Picks every layer that shares a colour, font or kind with the selected one. */
  const selectSame = (how: 'colour' | 'font' | 'type') => {
    if (!board || !layer) return
    const paint = (l: Layer) => (l.type === 'text' ? l.colour : l.type === 'shape' ? l.fill : l.type === 'icon' ? l.colour : null)
    const same = board.layers.filter((l) => !l.hidden && !l.locked && (how === 'type' ? l.type === layer.type : how === 'font' ? l.type === 'text' && layer.type === 'text' && l.font === layer.font : paint(l) && paint(l)?.toLowerCase() === paint(layer)?.toLowerCase()))
    select(board.id, same.map((l) => l.id))
  }

  /* ---------- Copy and paste ---------- */

  const copy = () => {
    if (!board || !selected.length) return null
    const clip = { layers: selected, board: { width: board.width, height: board.height }, text: clipText(selected), groups: board.groups?.filter((g) => selectedGroups.includes(g.id)) }
    writeClip(clip)
    // The system clipboard gets the text too, so pasting elsewhere works – and a paste here knows it's ours.
    navigator.clipboard?.writeText(clip.text).catch(() => {})
    return clip
  }
  const paste = (inPlace = false) => {
    const clip = readClip()
    if (!clip || !board) return
    const to = { width: board.width, height: board.height }
    const { layers, groups } = cloneLayers(placePasted(clip.layers, inPlace ? to : clip.board, to, uid), clip.groups, uid)
    addLayers(layers, board, groups)
  }

  /* ---------- Zoom and panning ---------- */

  // After zooming, the point that was under the pointer (or in the middle) stays there.
  const anchor = useRef<{ board: string; bx: number; by: number; cx: number; cy: number } | null>(null)
  const applyAnchor = (z: number) => {
    const a = anchor.current
    anchor.current = null
    const sc = a && scaleEl(a.board)
    const el = canvas.current
    if (!a || !sc || !el) return
    const r = sc.getBoundingClientRect()
    el.scrollLeft += r.left + a.bx * z - a.cx
    el.scrollTop += r.top + a.by * z - a.cy
  }
  const zoomTo = (next: number, at?: { clientX: number; clientY: number }, focus?: { board: string; x: number; y: number }) => {
    const z = clamp(next, 0.05, 4)
    const el = canvas.current
    if (el) {
      const cr = el.getBoundingClientRect()
      const cx = at?.clientX ?? cr.left + cr.width / 2
      const cy = at?.clientY ?? cr.top + cr.height / 2
      if (focus) anchor.current = { board: focus.board, bx: focus.x, by: focus.y, cx, cy }
      else {
        const under = design.artboards.find((a) => {
          const r = scaleEl(a.id)?.getBoundingClientRect()
          return r && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom
        })
        const id = under?.id ?? board?.id
        if (id) {
          const p = toBoard({ clientX: cx, clientY: cy }, id)
          anchor.current = { board: id, bx: p.x, by: p.y, cx, cy }
        }
      }
    }
    if (z === zoomRef.current) applyAnchor(z)
    else setZoom(z)
  }
  useLayoutEffect(() => applyAnchor(zoom), [zoom])
  const zoomToBox = (boardId: string, b: Box, max = 2) => {
    const r = canvas.current?.getBoundingClientRect()
    if (!r) return
    zoomTo(Math.min(max, (r.width - 160) / Math.max(1, b.w), (r.height - 140) / Math.max(1, b.h)), undefined, { board: boardId, x: b.x + b.w / 2, y: b.y + b.h / 2 })
  }
  const fit = (a = board) => a && zoomToBox(a.id, { x: 0, y: 0, w: a.width, h: a.height })
  const zoomToSelection = () => (board && selected.length ? zoomToBox(board.id, union(selected.map((l) => boxOf(board.id, l))), 4) : fit())

  /**
   * The zoom a design opens at. Fitting a whole A4 poster on screen is about 16 % – arithmetically
   * right, and far too small to start working in. When the whole board would land that small, its
   * width is fitted instead and the canvas scrolls: the design fills the screen and the type can be
   * read. ⇧1 still fits the whole board, for when that's what you want.
   */
  const OPENS_TOO_SMALL = 0.25
  const fitOnOpen = (a = board) => {
    const r = canvas.current?.getBoundingClientRect()
    if (!a || !r) return
    const whole = Math.min(2, (r.width - 160) / Math.max(1, a.width), (r.height - 140) / Math.max(1, a.height))
    if (whole >= OPENS_TOO_SMALL) return fit(a)
    // With both panels open the canvas is about 650px wide, so a fixed 160px margin would eat a
    // quarter of it. Breathing room scales with the space there actually is.
    const margin = Math.min(160, r.width * 0.1)
    const z = clamp(Math.min(2, (r.width - margin) / Math.max(1, a.width)), 0.05, 4)
    // Centred across, and starting at the top of the board rather than its middle.
    zoomTo(z, undefined, { board: a.id, x: a.width / 2, y: (r.height - 140) / 2 / z })
  }
  useLayoutEffect(() => fitOnOpen(), [])

  // Pinch, or ⌘/Ctrl + scroll, zooms where the pointer is.
  const zoomToRef = useRef(zoomTo)
  zoomToRef.current = zoomTo
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomToRef.current(zoomRef.current * Math.exp(-e.deltaY * 0.01), e)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Space + drag (or the middle button) pans.
  const startPan = (e: ReactPointerEvent) => {
    const el = canvas.current
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    const s = { x: el.scrollLeft, y: el.scrollTop, cx: e.clientX, cy: e.clientY }
    setPanning(true)
    const move = (ev: PointerEvent) => {
      el.scrollLeft = s.x - (ev.clientX - s.cx)
      el.scrollTop = s.y - (ev.clientY - s.cy)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setPanning(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* ---------- Keyboard ---------- */

  // Alt shows distances; Space pans.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAlt(true)
      if (e.code === 'Space' && !typingIn(e.target) && !document.querySelector('.modal')) {
        e.preventDefault()
        setSpace(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAlt(false)
      if (e.code === 'Space') setSpace(false)
    }
    const reset = () => {
      setAlt(false)
      setSpace(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingIn(e.target) || document.querySelector('.modal')) return
      const mod = e.metaKey || e.ctrlKey
      const code = e.code
      const key = e.key.toLowerCase()
      const run = (fn: () => void) => {
        e.preventDefault()
        fn()
      }
      if (mod && key === 'z') return run(() => (e.shiftKey ? redo() : undo()))
      if (e.key === '?') return run(() => setHelp(true))
      if (e.key === 'Escape') {
        if (menu) return setMenu(null)
        if (popup) return setPopup(null)
        if (commenting || draft) return (setCommenting(false), setDraft(null))
        if (cropping) return setCropping(null)
        return board && select(board.id)
      }
      // View
      if (e.shiftKey && !mod && !e.altKey && code === 'KeyR') return run(() => setView({ rulers: !view.rulers }))
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && code === 'KeyG') return run(() => setView({ grid: !view.grid }))
      if (mod && !e.shiftKey && code === 'KeyY') return run(() => setOutline((o) => !o))
      if (mod && !e.shiftKey && code === 'KeyE') return run(() => setPopup('export'))
      if (e.shiftKey && !mod && code === 'Digit0') return run(() => zoomTo(1))
      if (e.shiftKey && !mod && code === 'Digit1') return run(() => fit())
      if (e.shiftKey && !mod && code === 'Digit2') return run(zoomToSelection)
      if (!mod && (e.key === '+' || e.key === '=')) return run(() => zoomTo(zoomRef.current * 1.25))
      if (!mod && (e.key === '-' || e.key === '_')) return run(() => zoomTo(zoomRef.current / 1.25))
      if (!board) return
      if (mod && key === 'a') return run(() => select(board.id, board.layers.filter((l) => !l.locked && !l.hidden).map((l) => l.id)))
      if (mod && key === 'c' && selected.length) return run(() => copy())
      if (mod && key === 'x' && selected.length) return run(() => copy() && removeSelected())
      // Pasting waits for the browser's paste event, which carries images and text from elsewhere.
      if (mod && key === 'v') return void (pasteInPlace.current = e.shiftKey)
      if (mod && key === 'd') return run(duplicateSelected)
      if (mod && e.shiftKey && code === 'KeyG') return run(ungroupSelected)
      if (mod && !e.shiftKey && code === 'KeyG') return run(group)
      if (mod && (code === 'BracketRight' || code === 'BracketLeft')) return run(() => order(code === 'BracketRight' ? (e.altKey ? 'front' : 'forward') : e.altKey ? 'back' : 'backward'))
      if (mod && e.shiftKey && code === 'KeyH') return run(() => toggle('hidden'))
      if (mod && e.shiftKey && code === 'KeyL') return run(() => toggle('locked'))
      if (e.ctrlKey && e.altKey && code === 'KeyH') return run(() => distributeAlong('x'))
      if (e.ctrlKey && e.altKey && code === 'KeyV') return run(() => distributeAlong('y'))
      if (e.altKey && e.shiftKey && !mod && code === 'KeyF') return run(() => fitToContent())
      if (e.altKey && !mod && !e.shiftKey) {
        const how = ({ KeyA: 'left', KeyH: 'hcenter', KeyD: 'right', KeyW: 'top', KeyV: 'vcenter', KeyS: 'bottom' } as Record<string, AlignHow>)[code]
        if (how) return run(() => alignTo(how))
      }
      if (e.shiftKey && !mod && !e.altKey && code === 'KeyH') return run(() => flip('x'))
      if (e.shiftKey && !mod && !e.altKey && code === 'KeyV') return run(() => flip('y'))
      if (!mod && !e.altKey && !e.shiftKey) {
        if (key === 't') return run(() => addLayer(newText(board, brand)))
        if (key === 'r') return run(() => addLayer(newShape(board, brand, 'rect')))
        if (key === 'o') return run(() => addLayer(newShape(board, brand, 'ellipse')))
        if (key === 'l') return run(() => addLayer(newShape(board, brand, 'line')))
        if (key === 'c') return run(() => setCommenting((c) => !c))
      }
      if (e.key === 'Tab') {
        const list = [...board.layers].reverse().filter((l) => !l.hidden)
        const i = list.findIndex((l) => l.id === layer?.id)
        const next = list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length]
        return run(() => next && select(board.id, [next.id]))
      }
      if (!selected.length) return
      if (e.key === 'Delete' || e.key === 'Backspace') return run(removeSelected)
      if (e.key.startsWith('Arrow')) {
        const step = e.shiftKey ? 10 : 1
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0]
        return run(() => updateLayers(board.id, selected.filter((l) => !l.locked).map((l) => l.id), (l) => ({ ...l, x: l.x + dx, y: l.y + dy })))
      }
      if (e.key === 'Enter' && layer && !layer.locked) {
        if (layer.type === 'text') return run(() => setEditing(layer.id))
        if (layer.type === 'image' && !layer.generated && layer.fit === 'cover') return run(() => setCropping(cropping ? null : layer.id))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Paste: our own layers, an image from anywhere, or text as a new text layer.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (typingIn(e.target) || document.querySelector('.modal') || !board) return
      const inPlace = pasteInPlace.current
      pasteInPlace.current = false
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (files.length) {
        e.preventDefault()
        addImages(files)
        return
      }
      const text = e.clipboardData?.getData('text/plain') ?? ''
      const clip = readClip()
      if (clip && (!text || text === clip.text)) {
        e.preventDefault()
        paste(inPlace)
      } else if (text.trim()) {
        e.preventDefault()
        const t = text.trim().slice(0, 2000)
        addLayer({ ...newText(board, brand, t, t.length < 60), name: t.slice(0, 24) })
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  /* ---------- Dragging ---------- */

  /** Follows the pointer from a press; `first` is the first real move (a click doesn't count). */
  const drag = (e: ReactPointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent, first: boolean) => void, onEnd?: (moved: boolean) => void) => {
    const start = { x: e.clientX, y: e.clientY }
    const z = zoomRef.current
    let first = true
    let moved = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return // a click, not a drag
      moved = true
      onMove((ev.clientX - start.x) / z, (ev.clientY - start.y) / z, ev, first)
      first = false
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setLive(null)
      onEnd?.(moved)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /** Everything on an artboard a moving layer can snap to, leaving out what's moving. */
  const snapFor = (a: Artboard, exclude: string[], withZones: boolean) => {
    const others = a.layers.filter((l) => !exclude.includes(l.id) && !l.hidden)
    const zones = withZones ? others.filter((l) => l.type === 'logo').map((l) => clearZone(l, rules.clearSpace)) : []
    // The edges of where the app's buttons sit are worth lining up with too.
    const platform = zonesOf(a).flatMap((z) => [{ axis: 'x' as const, at: z.x }, { axis: 'x' as const, at: z.x + z.w }, { axis: 'y' as const, at: z.y }, { axis: 'y' as const, at: z.y + z.h }])
    const ctx: SnapContext = {
      board: { width: a.width, height: a.height },
      others: view.snap ? others.map((l) => boxOf(a.id, l)) : [],
      guides: [...(view.rulers ? a.guides ?? [] : []), ...platform, ...printEdges(a)],
      grid: view.grid ? a.grid : undefined,
      margin: safeMargin(a),
      zones,
    }
    return { ctx, zones, targets: view.snap ? snapTargets(ctx) : [] }
  }
  const noSnap = (ev: PointerEvent) => ev.metaKey || ev.ctrlKey
  /** A print artboard's cut line and safe area are worth lining up with. */
  const printEdges = (a: Artboard) => {
    if (!a.print) return []
    const { trim, safe } = printBoxes(a)
    return [trim, safe].flatMap((b) => [{ axis: 'x' as const, at: b.x }, { axis: 'x' as const, at: b.x + b.w }, { axis: 'y' as const, at: b.y }, { axis: 'y' as const, at: b.y + b.h }])
  }

  const startMove = (e: ReactPointerEvent<HTMLDivElement>, a: Artboard, l: Layer) => {
    if (e.button !== 0) return
    // Locked layers (like a generated background) can't be picked on the canvas – you drag a selection instead.
    if (l.locked) return startMarquee(e, a)
    e.stopPropagation()
    setMenu(null)
    setPopup(null)
    const here = sel.board === a.id ? sel.layers : []
    const had = here.includes(l.id)
    // ⌘-click picks one layer inside a group; a plain click picks the whole group.
    const deep = e.metaKey || e.ctrlKey
    const own = deep ? [l.id] : withGroups(a.layers, [l.id])
    let ids: string[]
    if (e.shiftKey) {
      ids = had ? here.filter((id) => !own.includes(id)) : [...here, ...own]
      select(a.id, ids)
      if (had) return
    } else if (deep) {
      ids = [l.id]
      select(a.id, ids)
    } else {
      ids = had ? here : own
      if (!had) select(a.id, ids)
    }
    if (editing === l.id) return
    const movers = a.layers.filter((x) => ids.includes(x.id) && !x.locked)
    if (!movers.length) return
    const origin: Record<string, { x: number; y: number }> = Object.fromEntries(movers.map((m) => [m.id, { x: m.x, y: m.y }]))
    const startBox = union(movers.map((m) => boxOf(a.id, m)))
    const branded = movers.some((m) => m.type === 'text' || m.type === 'logo')
    const { ctx, zones, targets } = snapFor(a, ids, branded)
    // A logo keeps its clear space: its zone's edges snap to other things too.
    const logo = movers.length === 1 && movers[0].type === 'logo' ? movers[0] : null
    const pad = logo ? rules.clearSpace * logo.h : 0
    const extra = pad ? { x: [-pad, startBox.w + pad], y: [-pad, startBox.h + pad] } : {}
    let moving = movers.map((m) => m.id)
    drag(
      e,
      (rdx, rdy, ev, first) => {
        let copies: Layer[] = []
        let newGroups: { id: string; name: string }[] = []
        // Alt + drag leaves the original and drags a copy.
        if (first && ev.altKey) {
          const cloned = cloneLayers(movers, a.groups, uid)
          copies = cloned.layers
          newGroups = cloned.groups
          copies.forEach((c, i) => (origin[c.id] = origin[movers[i].id]))
          moving = copies.map((c) => c.id)
          select(a.id, moving)
        }
        // Shift keeps it in a straight line.
        const straight = ev.shiftKey ? (Math.abs(rdx) >= Math.abs(rdy) ? 'x' : 'y') : null
        const dx = straight === 'y' ? 0 : rdx
        const dy = straight === 'x' ? 0 : rdy
        const box = { ...startBox, x: startBox.x + dx, y: startBox.y + dy }
        const s = noSnap(ev) ? { x: box.x, y: box.y, lines: [], gaps: [] } : snapBox(box, targets, ctx, 6 / zoomRef.current, extra)
        const x = straight === 'y' ? startBox.x : s.x
        const y = straight === 'x' ? startBox.y : s.y
        const ddx = Math.round(x - startBox.x)
        const ddy = Math.round(y - startBox.y)
        updateBoard(
          a.id,
          (b) => ({
            ...b,
            groups: newGroups.length ? [...(b.groups ?? []), ...newGroups] : b.groups,
            layers: [...b.layers, ...copies].map((o) => (moving.includes(o.id) ? { ...o, x: origin[o.id].x + ddx, y: origin[o.id].y + ddy } : o)),
          }),
          first,
        )
        const placed = { ...startBox, x: startBox.x + ddx, y: startBox.y + ddy }
        const lines = noSnap(ev) ? [] : straight ? alignedLines(placed, targets, a) : s.lines
        setLive({
          board: a.id,
          lines,
          gaps: straight ? s.gaps.filter((g) => g.axis === straight) : s.gaps,
          safe: true,
          zones: branded ? [...zones, ...(logo ? [clearZone({ ...logo, x: origin[moving[0]].x + ddx, y: origin[moving[0]].y + ddy }, rules.clearSpace)] : [])] : undefined,
          badge: { text: `X ${Math.round(placed.x)}  Y ${Math.round(placed.y)}`, box: placed },
        })
      },
      (moved) => {
        // A click on one of several selected layers selects just it (or its group).
        if (!moved && had && ids.length > own.length && !e.shiftKey) select(a.id, own)
      },
    )
  }

  const startResize = (e: ReactPointerEvent, a: Artboard, l: Layer, dir: Handle) => {
    e.stopPropagation()
    e.preventDefault()
    const s0 = { x: l.x, y: l.y, w: l.w, h: heightOf(a.id, l), rotation: l.rotation, flipX: l.flipX, flipY: l.flipY }
    const upright = !l.rotation
    const { ctx, targets } = snapFor(a, [l.id], false)
    // Which side is moving on screen – a flipped layer's handles swap sides.
    const side = (d: string, flipped: boolean | undefined, a1: string, a2: string) => (flipped ? (d.includes(a1) ? a2 : d.includes(a2) ? a1 : '') : d.includes(a1) ? a1 : d.includes(a2) ? a2 : '')
    const sx = side(dir, l.flipX, 'e', 'w')
    const sy = side(dir, l.flipY, 's', 'n')
    drag(e, (dx, dy, ev, first) => {
      // Logos and icons keep their shape (stretching them is a “don't”); anything else does with Shift.
      const keepRatio = dir.length === 2 && (l.type === 'logo' || l.type === 'icon') !== ev.shiftKey
      let ddx = dx
      let ddy = dy
      if (upright && !noSnap(ev)) {
        const t = 6 / zoomRef.current
        const edgeX = sx === 'e' ? s0.x + s0.w + dx : sx === 'w' ? s0.x + dx : null
        const edgeY = sy === 's' ? s0.y + s0.h + dy : sy === 'n' ? s0.y + dy : null
        if (edgeX !== null) ddx += snapEdge(edgeX, 'x', targets, t) - edgeX
        if (edgeY !== null) ddy += snapEdge(edgeY, 'y', targets, t) - edgeY
      }
      const b = resizeBox(s0, dir, ddx, ddy, { keepRatio, fromCentre: ev.altKey })
      updateLayer(a.id, l.id, (o) => ({ ...o, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), ...(o.type === 'text' ? {} : { h: Math.round(b.h) }) }), first)
      const shown = boundsOf({ ...l, ...b }, b.h)
      setLive({
        board: a.id,
        lines: upright && !noSnap(ev) ? alignedLines(b, targets, ctx.board) : [],
        badge: { text: l.type === 'text' ? `W ${Math.round(b.w)}` : `${Math.round(b.w)} × ${Math.round(b.h)}`, box: shown },
      })
    })
  }

  /** Several layers sized together from their shared frame. Corners keep proportions (Shift frees them). */
  const startGroupResize = (e: ReactPointerEvent, a: Artboard, dir: Handle) => {
    e.stopPropagation()
    e.preventDefault()
    const items = selected.filter((l) => !l.locked).map((l) => ({ layer: l, h: heightOf(a.id, l) }))
    if (!items.length) return
    const from = union(items.map((i) => boundsOf(i.layer, i.h)))
    drag(e, (dx, dy, ev, first) => {
      const to = resizeBox(from, dir, dx, dy, { keepRatio: dir.length === 2 && !ev.shiftKey, fromCentre: ev.altKey, min: 8 })
      const scaled = scaleLayers(items, from, to)
      updateBoard(a.id, (b) => ({ ...b, layers: b.layers.map((l) => scaled.find((s) => s.id === l.id) ?? l) }), first)
      setLive({ board: a.id, badge: { text: `${Math.round(to.w)} × ${Math.round(to.h)}`, box: to } })
    })
  }
  const startGroupRotate = (e: ReactPointerEvent, a: Artboard) => {
    e.stopPropagation()
    e.preventDefault()
    const items = selected.filter((l) => !l.locked).map((l) => ({ layer: l, h: heightOf(a.id, l) }))
    if (!items.length) return
    const box = union(items.map((i) => boundsOf(i.layer, i.h)))
    const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    const r = scaleEl(a.id)?.getBoundingClientRect()
    if (!r) return
    const c = { x: r.left + centre.x * zoomRef.current, y: r.top + centre.y * zoomRef.current }
    const angle = (p: { clientX: number; clientY: number }) => (Math.atan2(p.clientY - c.y, p.clientX - c.x) * 180) / Math.PI
    const a0 = angle(e)
    drag(e, (_dx, _dy, ev, first) => {
      const deg = snapAngle(angle(ev) - a0, ev.shiftKey ? 15 : undefined)
      const turned = rotateLayers(items, centre, deg)
      updateBoard(a.id, (b) => ({ ...b, layers: b.layers.map((l) => turned.find((t) => t.id === l.id) ?? l) }), first)
      setLive({ board: a.id, badge: { text: `${deg}°`, box } })
    })
  }

  const startRotate = (e: ReactPointerEvent, a: Artboard, l: Layer) => {
    e.stopPropagation()
    e.preventDefault()
    const r = layerEl(a.id, l.id)?.getBoundingClientRect()
    if (!r) return
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    const angle = (p: { clientX: number; clientY: number }) => (Math.atan2(p.clientY - c.y, p.clientX - c.x) * 180) / Math.PI
    const a0 = angle(e)
    const r0 = l.rotation ?? 0
    const h = heightOf(a.id, l)
    drag(e, (_dx, _dy, ev, first) => {
      // Shift turns in steps of 15°; otherwise it settles on right angles when close.
      const deg = snapAngle(r0 + angle(ev) - a0, ev.shiftKey ? 15 : undefined)
      updateLayer(a.id, l.id, (o) => ({ ...o, rotation: deg }), first)
      setLive({ board: a.id, badge: { text: `${deg}°`, box: boundsOf({ ...l, rotation: deg }, h) } })
    })
  }

  /** Dragging a photo inside its frame changes which part shows. */
  const startCrop = (e: ReactPointerEvent, a: Artboard, l: ImageLayer) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const img = layerEl(a.id, l.id)?.querySelector('img')
    if (!img?.naturalWidth) return
    const scale = Math.max(l.w / img.naturalWidth, l.h / img.naturalHeight)
    const over = { x: img.naturalWidth * scale - l.w, y: img.naturalHeight * scale - l.h }
    const f0 = l.focus ?? { x: 50, y: 50 }
    drag(e, (dx, dy, _ev, first) => {
      const d = toLocal(dx, dy, l)
      const focus = {
        x: over.x > 0.5 ? Math.round(clamp(f0.x - (d.x / over.x) * 100, 0, 100) * 10) / 10 : f0.x,
        y: over.y > 0.5 ? Math.round(clamp(f0.y - (d.y / over.y) * 100, 0, 100) * 10) / 10 : f0.y,
      }
      updateLayer(a.id, l.id, (o) => ({ ...o, focus }) as Layer, first)
    })
  }

  /** Drag on an empty part of the artboard to select everything the box touches. */
  const startMarquee = (e: ReactPointerEvent, a: Artboard) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setMenu(null)
    setPopup(null)
    const p0 = toBoard(e, a.id)
    const base = (e.shiftKey || e.metaKey) && sel.board === a.id ? sel.layers : []
    select(a.id, base)
    const boxes = a.layers.filter((l) => !l.hidden && !l.locked).map((l) => ({ id: l.id, box: boxOf(a.id, l) }))
    drag(e, (dx, dy) => {
      const m = boxFrom(p0, { x: p0.x + dx, y: p0.y + dy })
      pick(a, [...new Set([...base, ...boxes.filter((b) => intersects(b.box, m)).map((b) => b.id)])])
      setLive({ board: a.id, marquee: m })
    })
  }

  /** In comment mode, a click on an artboard pins a new comment there. */
  const placeComment = (e: ReactPointerEvent, a: Artboard) => {
    e.stopPropagation()
    e.preventDefault()
    const p = toBoard(e, a.id)
    setDraft({ artboardId: a.id, x: Math.round(clamp((p.x / a.width) * 1000, 0, 1000)) / 10, y: Math.round(clamp((p.y / a.height) * 1000, 0, 1000)) / 10 })
    select(a.id)
    setCommenting(false)
    setTab('comments')
  }

  /** Pulls a guide out of a ruler, or moves one; off the artboard removes it. */
  const startGuide = (e: ReactPointerEvent, a: Artboard, axis: Axis, existing?: Guide) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    if (!view.rulers) setView({ rulers: true })
    const id = existing?.id ?? uid()
    const { targets } = snapFor(a, [], false)
    const own = targets.filter((t) => t.kind !== 'guide')
    const pos = (ev: { clientX: number; clientY: number }) => {
      const p = toBoard(ev, a.id)
      return axis === 'x' ? p.x : p.y
    }
    let at = existing?.at ?? pos(e)
    const move = (ev: PointerEvent) => {
      const raw = pos(ev)
      at = noSnap(ev) ? raw : snapEdge(raw, axis, own, 6 / zoomRef.current)
      setLive({ board: a.id, guide: { id, axis, at } })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setLive(null)
      const inside = at >= 0 && at <= (axis === 'x' ? a.width : a.height)
      if (existing && inside && Math.round(at) === existing.at) return
      if (!existing && !inside) return
      updateBoard(a.id, (b) => {
        const rest = (b.guides ?? []).filter((g) => g.id !== id)
        return { ...b, guides: inside ? [...rest, { id, axis, at: Math.round(at) }] : rest }
      })
    }
    if (existing) setLive({ board: a.id, guide: { id, axis, at } })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* ---------- Export, review and sharing ---------- */

  /** An artboard as an image, drawn without selection frames or pins. */
  const image = async (a: Artboard, format: 'png' | 'jpg' = 'png', scale = 1) => {
    const el = boardEls.current[a.id]?.querySelector<HTMLElement>('.cm-board')
    if (!el) throw new Error('Artboard not on screen')
    setSel((x) => ({ ...x, layers: [] }))
    setEditing(null)
    setCropping(null)
    await nextFrame()
    return artboardImage(el, a, format, scale)
  }
  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label)
    setNote(null)
    try {
      await job()
    } catch (err) {
      console.error('Content Machine export failed', err)
      setNote(<span className="error">{tr('Sorry – this couldn’t be saved as an image in this browser.')}</span>)
    } finally {
      setBusy(null)
    }
  }
  const exportNow = () => {
    setPopup(null)
    const { format, scale, all } = exportOpts
    const boards = all ? design.artboards : board ? [board] : []
    run('export', async () => {
      if (format === 'pdf') {
        const pages = []
        for (const a of boards) pages.push({ jpeg: new Uint8Array(await (await image(a, 'jpg', 1)).arrayBuffer()), width: a.width, height: a.height, dpi: a.dpi })
        return saveBlob(jpegPdf(pages), fileName(`${design.name}${boards.length === 1 ? ` – ${boards[0].name}` : ''}.pdf`))
      }
      const ext = format === 'jpg' ? 'jpg' : 'png'
      const suffix = scale > 1 ? `@${scale}x` : ''
      if (boards.length === 1) return saveBlob(await image(boards[0], format, scale), fileName(`${design.name} – ${boards[0].name}${suffix}.${ext}`))
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (const a of boards) zip.file(fileName(`${a.name} ${a.width}x${a.height}${suffix}.${ext}`), await image(a, format, scale))
      saveBlob(await zip.generateAsync({ type: 'blob' }), fileName(`${design.name}.zip`))
    })
  }
  /** A named copy of every artboard to go back to. */
  const saveVersion = (name: string) =>
    change((d) => ({ ...d, versions: [{ id: uid(), name, artboards: d.artboards, at: now() }, ...(d.versions ?? [])].slice(0, 30) }), false)
  const sendToProject = () =>
    run('send', async () => {
      const files: File[] = []
      for (const a of design.artboards) files.push(new File([await image(a)], fileName(`${design.name} – ${a.name}.png`), { type: 'image/png' }))
      // Nothing saved means the plan's file space is full.
      if (!(await upload(files))) {
        setNote(<span className="error">{tr('Your file space is full. Add more space or move up a plan in Settings → Plan.')}</span>)
        return
      }
      saveVersion(tr('Sent for review'))
      setNote(
        <span>
          {tr('Saved to the project’s files.')} <Link to={`/app/projects/${project.id}/files`}>{tr('Share it for review there')}</Link>
        </span>,
      )
    })
  const portalLink = `${location.origin}/p/${project.id}/designs/${design.id}`
  const share = () => {
    setPopup(null)
    change((d) => ({ ...d, shared: { at: now(), status: 'In review' } }), false)
    saveVersion(tr('Shared with the client'))
    navigator.clipboard?.writeText(portalLink).catch(() => {})
    setNote(<span>{tr('Shared in the client portal – the link is copied.')} <a href={portalLink} target="_blank" rel="noreferrer">{tr('Open it')}</a></span>)
  }
  const unshare = () => {
    setPopup(null)
    change((d) => ({ ...d, shared: undefined }), false)
    setNote(tr('The client can’t see this design any more.'))
  }

  /* ---------- Print and motion ---------- */

  /** A print version of this artboard (and a back with the logo for cards), next to it. */
  const makePrintVersion = (formatId: string, landscape: boolean, back: boolean) => {
    if (!board) return
    const front = printArtboard(board, formatId, PRINT_FORMATS.find((f) => f.id === formatId)!.w === PRINT_FORMATS.find((f) => f.id === formatId)!.h ? undefined : landscape)
    addArtboards(back ? [front, printBack(front, brand)] : [front])
    setNote(tr('Print version made. Check the list on the right before it goes to the printer.'))
  }
  const printPdf = (marks: boolean) =>
    board?.print &&
    run('print', async () => {
      const jpeg = new Uint8Array(await (await image(board, 'jpg', 1)).arrayBuffer())
      const dpi = board.dpi ?? 300
      saveBlob(jpegPdf([{ jpeg, width: board.width, height: board.height, dpi, bleed: mmToPx(board.print!.bleed, dpi), marks }]), fileName(`${design.name} – ${board.name} – print.pdf`))
    })

  // Playing: the clock runs from wherever it is to the end, then starts over.
  useEffect(() => {
    if (!playing || mode !== 'motion' || !board) return
    let raf = 0
    let last = performance.now()
    const total = durationOf(board)
    const tick = (now: number) => {
      setTime((t) => (t + (now - last) / 1000) % total)
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, mode, board?.id])
  // Out of motion mode, everything shows as it ends up.
  useEffect(() => {
    if (mode !== 'motion') setPlaying(false)
    else if (board && isAnimated(board)) setTime(0)
  }, [mode])

  /** The artboard, frame by frame, drawn off screen and put together as an MP4. */
  const exportVideo = async () => {
    if (!board || video !== null) return
    setPlaying(false)
    setVideo(0)
    setNote(null)
    try {
      const blob = await makeVideo({
        width: board.width,
        height: board.height,
        duration: durationOf(board),
        frame: async (t) => {
          flushSync(() => setRenderAt(t))
          await nextFrame()
          return offscreen.current!.querySelector<HTMLElement>('.cm-board')!
        },
        onProgress: setVideo,
      })
      saveBlob(blob, fileName(`${design.name} – ${board.name}.mp4`))
    } catch (err) {
      console.error('Content Machine video failed', err)
      setNote(<span className="error">{err instanceof Error && err.message === 'unsupported' ? tr('This browser can’t make videos. Use Chrome, Edge or Safari.') : tr('Sorry – the video couldn’t be made in this browser.')}</span>)
    } finally {
      setVideo(null)
      setRenderAt(null)
    }
  }

  /* ---------- Adding ---------- */

  const addImages = async (files: FileList | File[], target = board) => {
    for (const f of [...files].filter((x) => x.type.startsWith('image/'))) {
      const { src, ratio } = await addImageFile(f)
      if (target) addLayers([newImage(target, src, ratio)], target)
    }
  }
  const addArtboards = (boards: Artboard[]) => {
    if (!boards.length) return
    change((d) => ({ ...d, artboards: [...d.artboards, ...boards] }))
    select(boards[0].id)
    requestAnimationFrame(() => boardEls.current[boards[0].id]?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }))
  }
  const addArtboard = (value: string) => {
    if (!board) return
    const [how, id] = value.split(':')
    const size = SIZES.find((s) => s.id === id)
    if (size) addArtboards([how === 'copy' ? resizeArtboard(board, size) : newArtboard(size, brand)])
  }
  /** This design in every social size it isn't in yet. */
  const everySize = () => {
    if (!board) return
    const have = new Set(design.artboards.map((a) => `${a.width}x${a.height}`))
    const missing = SIZES.filter((s) => s.social && !have.has(`${s.width}x${s.height}`))
    if (!missing.length) return setNote(tr('This design is already in every social size.'))
    addArtboards(missing.map((s) => resizeArtboard(board, s)))
    setNote(tr('{n} sizes added. Check each one – words may need a nudge.', { n: missing.length }))
  }
  /** A layer that shows a new image: as an image in the middle, or as the whole background. */
  const placeImage = async (src: string, as: 'background' | 'image') => {
    if (!board) return
    const ratio = await ratioOf(src)
    if (as === 'background') {
      const bg: Layer = { ...newImage(board, src, ratio), name: 'AI background', x: 0, y: 0, w: board.width, h: board.height, locked: true }
      updateBoard(board.id, (a) => ({ ...a, layers: [bg, ...a.layers] }))
      setNote(tr('Added as the background – it’s locked, so pick it in the layers list to change it.'))
    } else addLayer(newImage(board, src, ratio))
  }

  /** A background from the brand's palette: replaces the generated one, or goes in at the bottom. */
  const generateBackground = (style: BackgroundStyle, seed = newSeed()) => {
    if (!board) return
    const { src, colour } = backgroundImage(style, brand, board.width, board.height, seed)
    const existing = board.layers.find((l) => l.type === 'image' && l.generated)
    if (existing) return updateLayer(board.id, existing.id, (l) => ({ ...l, src, generated: { style, seed, colour } }) as Layer)
    const bg: Layer = { ...newImage(board, src), name: 'Background', x: 0, y: 0, w: board.width, h: board.height, locked: true, generated: { style, seed, colour } }
    updateBoard(board.id, (a) => ({ ...a, layers: [bg, ...a.layers] }))
  }
  const applyFix = (i: Issue) => i.fix && updateLayer(board!.id, i.layerId, (l) => ({ ...l, ...i.fix!.patch }) as Layer)
  /** Every fix at once, as one step you can undo. */
  const fixAll = () =>
    board &&
    updateBoard(board.id, (a) => ({
      ...a,
      layers: a.layers.map((l) => issues.filter((i) => i.layerId === l.id && i.fix).reduce((acc, i) => ({ ...acc, ...i.fix!.patch }) as Layer, l)),
    }))

  /* ---------- Templates ---------- */

  const templates = state.studio.designTemplates ?? []
  const setTemplates = (list: DesignTemplate[]) => dispatch({ type: 'updateStudio', patch: { designTemplates: list } })
  /** A saved template on this artboard – in this client's colours and fonts, at this size. */
  const useTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id)
    if (!board || !t) return
    const from = state.projects.find((p) => p.id === t.projectId)
    const onBrand = from && from.id !== project.id ? rebrand(t.artboard, brandOf(from), brand) : t.artboard
    const apply = () => updateBoard(board.id, (a) => ({ ...resizeArtboard(onBrand, a), id: a.id, name: a.name }))
    board.layers.length ? confirm(tr('Replace what’s on this artboard with the template?'), apply, tr('Replace')) : apply()
  }

  if (!board) return null

  /* ---------- The right-click menu ---------- */

  const clip = menu ? readClip() : null
  const canFit = selected.some((l) => l.type === 'text' || l.type === 'logo' || (l.type === 'image' && !l.generated))
  const menuItems: MenuItem[] = selected.length
    ? [
        { label: tr('Copy'), keys: '⌘C', onClick: copy },
        { label: tr('Cut'), keys: '⌘X', onClick: () => copy() && removeSelected() },
        { label: tr('Paste'), keys: '⌘V', onClick: () => paste(), disabled: !clip },
        { label: tr('Duplicate'), keys: '⌘D', onClick: duplicateSelected },
        'sep',
        ...(selected.length > 1 && !wholeGroup ? [{ label: tr('Group'), keys: '⌘G', onClick: group } as MenuItem] : []),
        ...(selectedGroups.length ? [{ label: tr('Ungroup'), keys: '⇧⌘G', onClick: ungroupSelected } as MenuItem] : []),
        ...(canFit ? [{ label: tr('Fit box to content'), keys: '⌥⇧F', onClick: () => fitToContent() } as MenuItem] : []),
        { label: tr('Bring to front'), keys: '⌥⌘]', onClick: () => order('front') },
        { label: tr('Bring forward'), keys: '⌘]', onClick: () => order('forward') },
        { label: tr('Send backward'), keys: '⌘[', onClick: () => order('backward') },
        { label: tr('Send to back'), keys: '⌥⌘[', onClick: () => order('back') },
        'sep',
        ...(selected.length > 1
          ? ([
              { label: tr('Align left'), keys: '⌥A', onClick: () => alignTo('left') },
              { label: tr('Align centres'), keys: '⌥H', onClick: () => alignTo('hcenter') },
              { label: tr('Align tops'), keys: '⌥W', onClick: () => alignTo('top') },
              { label: tr('Align middles'), keys: '⌥V', onClick: () => alignTo('vcenter') },
              { label: tr('Space evenly across'), keys: '⌃⌥H', onClick: () => distributeAlong('x'), disabled: selected.length < 3 },
              'sep',
            ] as MenuItem[])
          : ([
              { label: tr('Centre on the artboard'), onClick: () => (alignTo('hcenter'), alignTo('vcenter')) },
              { label: tr('Select everything in this colour'), onClick: () => selectSame('colour'), disabled: !(layer && ['text', 'shape', 'icon'].includes(layer.type)) },
              ...(layer?.type === 'text' ? [{ label: tr('Select everything in this font'), onClick: () => selectSame('font') }] : []),
              { label: tr('Select everything like this'), onClick: () => selectSame('type') },
              'sep',
            ] as MenuItem[])),
        ...(layer?.type === 'image' && !layer.generated
          ? ([{ label: tr('Remove background (AI)'), onClick: () => openAi('cutout') }, { label: tr('Change with words (AI)'), onClick: () => openAi('edit') }, 'sep'] as MenuItem[])
          : []),
        { label: tr('Flip horizontally'), keys: '⇧H', onClick: () => flip('x') },
        { label: tr('Flip vertically'), keys: '⇧V', onClick: () => flip('y') },
        { label: selected.every((l) => l.locked) ? tr('Unlock') : tr('Lock'), keys: '⇧⌘L', onClick: () => toggle('locked') },
        { label: selected.every((l) => l.hidden) ? tr('Show') : tr('Hide'), keys: '⇧⌘H', onClick: () => toggle('hidden') },
        'sep',
        { label: tr('Delete'), keys: '⌫', onClick: removeSelected },
      ]
    : [
        { label: tr('Paste'), keys: '⌘V', onClick: () => paste(), disabled: !clip },
        { label: tr('Paste in the same place'), keys: '⇧⌘V', onClick: () => paste(true), disabled: !clip },
        { label: tr('Select all'), keys: '⌘A', onClick: () => select(board.id, board.layers.filter((l) => !l.locked && !l.hidden).map((l) => l.id)) },
        'sep',
        { label: tr('Add text'), keys: 'T', onClick: () => addLayer(newText(board, brand)) },
        { label: tr('Add the logo'), onClick: () => addLogo() },
        { label: tr('Comment here'), keys: 'C', onClick: () => setCommenting(true) },
        'sep',
        { label: tr('Remix this artboard'), onClick: () => setModal('remix') },
        { label: tr('Preview on a phone'), onClick: () => setModal('preview') },
        'sep',
        { label: view.rulers ? tr('Hide rulers and guides') : tr('Show rulers and guides'), keys: '⇧R', onClick: () => setView({ rulers: !view.rulers }) },
        { label: view.grid ? tr('Hide the layout grid') : tr('Show the layout grid'), keys: '⌃G', onClick: () => setView({ grid: !view.grid }) },
        { label: tr('Zoom to fit'), keys: '⇧1', onClick: () => fit() },
      ]
  // The layer the (layers list) right-click was on becomes the selection first.
  const menuOnLayer = (id: string, at: { x: number; y: number }) => {
    if (!sel.layers.includes(id)) select(board.id, [id])
    setMenu(at)
  }
  function openAi(tool: AiTool) {
    setTab('ai')
    setAiRequest((r) => ({ tool, n: (r?.n ?? 0) + 1 }))
  }
  /** A logo, then its box fitted to the mark once it's drawn. */
  function addLogo() {
    if (!board) return
    const l = newLogo(board)
    addLayer(l)
    let tries = 0
    const wait = () => {
      const img = layerEl(board.id, l.id)?.querySelector('img')
      if (img?.naturalWidth || (tries > 20 && layerEl(board.id, l.id))) return fitToContent([l.id], false, board.id)
      if (tries++ < 40) setTimeout(wait, 50)
    }
    setTimeout(wait, 50)
  }

  /* ---------- Drawing ---------- */

  const croppingLayer = board.layers.find((l) => l.id === cropping && l.type === 'image') as ImageLayer | undefined
  const renderLayer = (a: Artboard, l: Layer, content: ReactNode, frame?: Frame) => {
    const current = a.id === board.id
    const isSel = current && sel.layers.includes(l.id)
    return (
      <div
        key={l.id}
        data-layer={l.id}
        className={'cm-layer' + (l.locked ? ' locked' : '') + (cropping === l.id ? ' cropping' : '') + (alt && hover === l.id && current && selected.length && !isSel ? ' measured' : '')}
        style={layerBox(l, frame)}
        onPointerDown={(e) => (cropping === l.id && l.type === 'image' ? startCrop(e, a, l) : startMove(e, a, l))}
        onPointerEnter={() => setHover(l.id)}
        onPointerLeave={() => setHover((h) => (h === l.id ? null : h))}
        onDoubleClick={() => {
          if (l.locked) return
          // Inside a group, a double-click picks just this layer.
          if (l.groupId && sel.layers.length > 1 && sel.layers.includes(l.id)) return select(a.id, [l.id])
          if (l.type === 'text') setEditing(l.id)
          else if (l.type === 'image' && !l.generated && l.fit === 'cover') setCropping(l.id)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (l.locked) select(a.id)
          else if (!isSel) pick(a, [l.id])
          setMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {l.type === 'text' && editing === l.id ? (
          <TextEditor layer={l} onDone={(text) => { updateLayer(a.id, l.id, (x) => ({ ...x, text, name: text.slice(0, 24) || x.name }) as Layer); setEditing(null) }} />
        ) : (
          content
        )}
        {current && flagged.has(l.id) && !isSel && <span data-noexport className="cm-flag" style={{ outlineWidth: 2 / zoom }} />}
        {isSel && editing !== l.id && (
          <Selection layer={l} zoom={zoom} handles={selected.length === 1 && cropping !== l.id} onResize={(e, dir) => startResize(e, a, l, dir)} onRotate={(e) => startRotate(e, a, l)} />
        )}
      </div>
    )
  }

  const tool = (label: string, k?: string) => (k ? `${label} (${keys(k)})` : label)
  const openThreads = threads(design).filter((c) => !c.resolved).length
  const shareStatus = design.shared?.status
  const setComments = (comments: Comment[]) => change((d) => ({ ...d, comments }), false)
  const visionFilter = [vision === 'squint' ? 'blur(6px)' : vision !== 'normal' ? `url(#cm-vision-${vision})` : '', softProof && mode === 'print' ? 'saturate(0.86) contrast(0.95) brightness(0.98)' : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className="cm-editor" data-shortcuts-off>
      <BrandFonts brand={brand} />
      <VisionFilters list={VISION} />
      <header className="cm-top">
        <Link to="/app/content" className="btn btn-ghost btn-icon" aria-label={tr('Back to all designs')}><ArrowLeft size={16} /></Link>
        {fromMockup && <Link to={`/app/mockups/${fromMockup.id}`} className="btn btn-sm cm-to-mockup"><MockupIcon size={14} /> {tr('See it in the mockup')}</Link>}
        <span className="cm-title">
          <input className="cm-name" value={design.name} onChange={(e) => change((d) => ({ ...d, name: e.target.value }), false)} aria-label={tr('Design name')} />
          <small className="muted">{project.name}</small>
        </span>
        <div className="seg cm-mode" role="group" aria-label={tr('Mode')}>
          <button aria-pressed={mode === 'design'} onClick={() => setMode('design')}>{tr('Design')}</button>
          <button aria-pressed={mode === 'print'} onClick={() => setMode('print')}>{tr('Print')}</button>
          <button aria-pressed={mode === 'motion'} onClick={() => setMode('motion')}>{tr('Motion§mode')}</button>
        </div>
        <div className="cm-tools" role="toolbar" aria-label={tr('Add')}>
          <button className="btn btn-sm" onClick={() => addLayer(newText(board, brand))} title={tool(tr('Text'), 'T')}><Type size={15} /> <span>{tr('Text')}</span></button>
          <button className="btn btn-sm" onClick={() => imageInput.current?.click()} title={tr('Image')}><ImagePlus size={15} /> <span>{tr('Image')}</span></button>
          <button className="btn btn-sm" onClick={addLogo} title={tr('Logo')}><Stamp size={15} /> <span>{tr('Logo')}</span></button>
          <span className="cm-pop-wrap">
            <button className="btn btn-sm" aria-expanded={popup === 'shapes'} onClick={() => setPopup(popup === 'shapes' ? null : 'shapes')} title={tool(tr('Shapes'), 'R')}><Square size={15} /><ChevronDown size={12} /></button>
            {popup === 'shapes' && (
              <div className="cm-pop">
                {SHAPES.map((s) => (
                  <button key={s.id} className="cm-pop-item" onClick={() => { addLayer(newShape(board, brand, s.id as ShapeKind)); setPopup(null) }}>
                    {s.id === 'ellipse' ? <Circle size={14} /> : <Square size={14} />} {tr(s.name)}
                  </button>
                ))}
              </div>
            )}
          </span>
          <span className="cm-pop-wrap">
            <button className="btn btn-sm btn-icon" aria-expanded={popup === 'icons'} onClick={() => setPopup(popup === 'icons' ? null : 'icons')} title={tr('Icons')}><Smile size={15} /></button>
            {popup === 'icons' && (
              <div className="cm-pop wide">
                <IconPicker onPick={(name) => { addLayer(newIcon(board, brand, name)); setPopup(null) }} />
              </div>
            )}
          </span>
          <button className={'btn btn-sm btn-icon' + (commenting ? ' on' : '')} aria-pressed={commenting} onClick={() => setCommenting((c) => !c)} title={tool(tr('Comment'), 'C')}><MessageSquarePlus size={15} /></button>
          <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addImages(e.target.files); e.target.value = '' }} />
        </div>
        <div className="cm-tools">
          <button className="btn btn-sm btn-icon btn-ghost" onClick={undo} disabled={!history.current.past.length} title={tool(tr('Undo'), '⌘Z')}><Undo2 size={15} /></button>
          <button className="btn btn-sm btn-icon btn-ghost" onClick={redo} disabled={!history.current.future.length} title={tool(tr('Redo'), '⇧⌘Z')}><Redo2 size={15} /></button>
          <span className="cm-zoom">
            <button className="btn btn-sm btn-icon btn-ghost" onClick={() => zoomTo(zoom / 1.25)} aria-label={tr('Zoom out')}><Minus size={14} /></button>
            <button className="btn btn-sm btn-ghost" onClick={() => fit()} title={tool(tr('Fit to screen'), '⇧1')}>{Math.round(zoom * 100)}%</button>
            <button className="btn btn-sm btn-icon btn-ghost" onClick={() => zoomTo(zoom * 1.25)} aria-label={tr('Zoom in')}><Plus size={14} /></button>
          </span>
          <span className="cm-view" role="group" aria-label={tr('View')}>
            <button className="btn btn-sm btn-icon btn-ghost" aria-pressed={view.rulers} onClick={() => setView({ rulers: !view.rulers })} title={tool(tr('Rulers and guides'), '⇧R')}><RulerIcon size={15} /></button>
            <button className="btn btn-sm btn-icon btn-ghost" aria-pressed={view.grid} onClick={() => setView({ grid: !view.grid })} title={tool(tr('Layout grid'), '⌃G')}><LayoutGrid size={15} /></button>
            <button className="btn btn-sm btn-icon btn-ghost" aria-pressed={view.snap} onClick={() => setView({ snap: !view.snap })} title={tr('Smart guides: snap to other layers and equal spacing')}><Magnet size={15} /></button>
            <span className="cm-pop-wrap">
              <button className="btn btn-sm btn-icon btn-ghost" aria-pressed={vision !== 'normal' || outline} aria-expanded={popup === 'view'} onClick={() => setPopup(popup === 'view' ? null : 'view')} title={tr('See it as others do')}><Eye size={15} /></button>
              {popup === 'view' && (
                <div className="cm-pop">
                  {VISION.map((v) => (
                    <button key={v.id} className={'cm-pop-item' + (vision === v.id ? ' on' : '')} onClick={() => setVision(v.id)}>{tr(v.name)}</button>
                  ))}
                  <hr />
                  <button className={'cm-pop-item' + (outline ? ' on' : '')} onClick={() => setOutline((o) => !o)}>{tr('Outlines only')} <kbd>{keys('⌘Y')}</kbd></button>
                </div>
              )}
            </span>
            <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setHelp(true)} title={tool(tr('Keyboard shortcuts'), '?')}><Keyboard size={15} /></button>
          </span>
        </div>
        <div className="cm-tools" style={{ marginLeft: 'auto' }}>
          <button
            className={'cm-check' + (issues.length ? ' warn' : '')}
            onClick={() => issues[0] && select(board.id, [issues[0].layerId])}
            title={issues.length ? tr('Show the first thing to fix') : tr('Follows the brand hub: contrast, margins, logo rules, colours and fonts')}
          >
            {issues.length ? <TriangleAlert size={14} /> : <ShieldCheck size={14} />}
            {issues.length ? (issues.length === 1 ? tr('1 brand check') : tr('{n} brand checks', { n: issues.length })) : tr('On brand')}
          </button>
          <button className="btn btn-sm btn-icon" onClick={() => setModal('preview')} title={tr('Preview on a phone')}><Smartphone size={15} /></button>
          <span className="cm-pop-wrap">
            <button className="btn btn-sm" aria-expanded={popup === 'export'} onClick={() => setPopup(popup === 'export' ? null : 'export')} disabled={!!busy} title={tool(tr('Export'), '⌘E')}>
              <Download size={14} /> {busy === 'export' ? tr('Saving…') : tr('Export')}
            </button>
            {popup === 'export' && (
              <div className="cm-pop right cm-export">
                <div className="seg" role="group" aria-label={tr('Format')}>
                  {(['png', 'jpg', 'pdf'] as const).map((f) => <button key={f} aria-pressed={exportOpts.format === f} onClick={() => setExportOpts((o) => ({ ...o, format: f }))}>{f.toUpperCase()}</button>)}
                </div>
                {exportOpts.format !== 'pdf' ? (
                  <div className="seg" role="group" aria-label={tr('Size')}>
                    {[1, 2, 3].map((s) => <button key={s} aria-pressed={exportOpts.scale === s} onClick={() => setExportOpts((o) => ({ ...o, scale: s }))}>{s}×</button>)}
                  </div>
                ) : (
                  <small className="muted">{tr('One page per artboard. Print sizes come out at their real size.')}</small>
                )}
                {design.artboards.length > 1 && (
                  <label className="cm-toggle-row"><input type="checkbox" checked={exportOpts.all} onChange={(e) => setExportOpts((o) => ({ ...o, all: e.target.checked }))} /> <span>{tr('All {n} artboards', { n: design.artboards.length })}</span></label>
                )}
                <button className="btn btn-sm btn-primary" onClick={exportNow}><Download size={14} /> {tr('Export')}</button>
              </div>
            )}
          </span>
          <span className="cm-pop-wrap">
            <button className={'btn btn-sm' + (shareStatus ? ' on' : '')} aria-expanded={popup === 'share'} onClick={() => (shareStatus ? setPopup(popup === 'share' ? null : 'share') : share())} title={tr('Show it to the client in their portal – they can comment, and change words you allow')}>
              <Share2 size={14} /> {shareStatus ? tr(shareStatus) : tr('Share with client')}
            </button>
            {popup === 'share' && (
              <div className="cm-pop right">
                <button className="cm-pop-item" onClick={() => { navigator.clipboard?.writeText(portalLink).catch(() => {}); setPopup(null); setNote(tr('Link copied.')) }}><Copy size={14} /> {tr('Copy the client’s link')}</button>
                <a className="cm-pop-item" href={portalLink} target="_blank" rel="noreferrer"><Eye size={14} /> {tr('See it as the client')}</a>
                <button className="cm-pop-item" onClick={unshare}><Trash2 size={14} /> {tr('Stop sharing')}</button>
              </div>
            )}
          </span>
          <button className="btn btn-sm btn-primary" onClick={sendToProject} disabled={!!busy} title={tr('Save every artboard as a PNG in the project’s files, ready to share for review')}>
            <Send size={14} /> {busy === 'send' ? tr('Saving…') : tr('Send for review')}
          </button>
        </div>
      </header>
      {note && <div className="cm-note" role="status">{note} <button className="link-btn" onClick={() => setNote(null)}>{tr('Close')}</button></div>}
      {croppingLayer && <div className="cm-note" role="status">{tr('Drag to move the photo inside its frame. Press Enter or Esc when it’s right.')}</div>}
      {commenting && <div className="cm-note" role="status">{tr('Click where the comment should go. Esc to stop.')}</div>}

      <div className="cm-body">
        <aside className="cm-side">
          <section>
            <h4>{tr('Artboards')}</h4>
            {design.artboards.map((a) => (
              <div key={a.id} className={'cm-row' + (a.id === board.id && !selected.length ? ' on' : a.id === board.id ? ' in' : '')}>
                <button className="cm-row-main" onClick={() => { select(a.id); boardEls.current[a.id]?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }) }}>
                  <span>{a.name}</span>
                  <small>{a.width} × {a.height}</small>
                </button>
                <button className="cm-icon" title={tr('Duplicate')} onClick={() => { const c = resizeArtboard(a, a); change((d) => ({ ...d, artboards: [...d.artboards, { ...c, name: a.name + ' 2' }] })) }}><Copy size={13} /></button>
                {design.artboards.length > 1 && (
                  <button className="cm-icon" title={tr('Delete')} onClick={() => confirm(tr('Delete the artboard “{name}”?', { name: a.name }), () => { change((d) => ({ ...d, artboards: d.artboards.filter((x) => x.id !== a.id) })); select(design.artboards.find((x) => x.id !== a.id)!.id) })}><Trash2 size={13} /></button>
                )}
              </div>
            ))}
            <select className="input input-sm" value="" onChange={(e) => addArtboard(e.target.value)} aria-label={tr('Add an artboard')}>
              <option value="">{tr('+ Add a size…')}</option>
              <optgroup label={tr('This design in another size')}>
                {SIZES.map((s) => <option key={s.id} value={`copy:${s.id}`}>{tr(s.name)} · {s.width}×{s.height}</option>)}
              </optgroup>
              <optgroup label={tr('Blank')}>
                {SIZES.map((s) => <option key={s.id} value={`blank:${s.id}`}>{tr(s.name)} · {s.width}×{s.height}</option>)}
              </optgroup>
            </select>
          </section>
          <LayersPanel
            board={board}
            selected={sel.layers}
            flagged={flagged}
            onSelect={(id, add) => select(board.id, add ? (sel.layers.includes(id) ? sel.layers.filter((x) => x !== id) : [...sel.layers, id]) : [id])}
            onSelectMany={(ids) => select(board.id, ids)}
            onToggle={(ids, key) => toggle(key, ids)}
            onRename={(id, name) => updateLayer(board.id, id, (l) => ({ ...l, name }))}
            onRenameGroup={(id, name) => updateBoard(board.id, (a) => ({ ...a, groups: a.groups?.map((g) => (g.id === id ? { ...g, name } : g)) }))}
            onDrop={(id, target, above) =>
              updateBoard(board.id, (a) => {
                // Dropped among a group's layers, it joins the group; dropped elsewhere, it leaves its own.
                const joins = a.layers.find((l) => l.id === target)?.groupId
                const layers = dropNextTo(a.layers, id, target, above).map((l) => (l.id === id ? { ...l, groupId: joins } : l))
                return tidyGroups({ ...a, layers })
              })
            }
            onMenu={menuOnLayer}
          />
          <Versions design={design} onSave={saveVersion} onRestore={(v) => confirm(tr('Go back to “{name}”? You can undo it.', { name: v.name }), () => { change((d) => ({ ...d, artboards: v.artboards })); select(v.artboards[0].id) }, tr('Go back'))} onDelete={(id) => change((d) => ({ ...d, versions: d.versions?.filter((x) => x.id !== id) }), false)} />
        </aside>

        <div
          className={'cm-canvas' + (space ? ' space' : '') + (panning ? ' panning' : '') + (outline ? ' outline' : '') + (commenting ? ' commenting' : '')}
          ref={canvas}
          onPointerDownCapture={(e) => (space || e.button === 1) && startPan(e)}
          onPointerDown={(e) => e.target === e.currentTarget && (select(board.id), setMenu(null), setPopup(null))}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (!e.dataTransfer.files.length) return
            const target = design.artboards.find((a) => boardEls.current[a.id]?.contains(e.target as Node)) ?? board
            addImages(e.dataTransfer.files, target)
          }}
        >
          <div className="cm-stage" style={{ filter: visionFilter }} onPointerDown={(e) => e.target === e.currentTarget && (select(board.id), setMenu(null), setPopup(null))}>
            {design.artboards.map((a) => {
              const current = a.id === board.id
              const selBox = current && selected.length ? union(selected.map((l) => boxOf(a.id, l))) : null
              // Alt: the distances from the selection to what's under the pointer, or to the artboard.
              const hovered = current && hover ? a.layers.find((l) => l.id === hover && !sel.layers.includes(l.id)) : undefined
              const measuring = current && alt && selBox && !live ? measure(selBox, hovered ? boxOf(a.id, hovered) : { x: 0, y: 0, w: a.width, h: a.height }) : []
              return (
                <div key={a.id} className={'cm-frame' + (current ? ' current' : '')} ref={(el) => { boardEls.current[a.id] = el }}>
                  <button className="cm-frame-label" onClick={() => select(a.id)}>{a.name} <span>{a.width} × {a.height}</span></button>
                  {view.rulers && (
                    <>
                      <span className="cm-ruler-corner" />
                      <Ruler axis="x" length={a.width} zoom={zoom} mark={selBox ? [selBox.x, selBox.x + selBox.w] : undefined} title={tr('Drag down to add a guide')} onPointerDown={(e) => startGuide(e, a, 'y')} />
                      <Ruler axis="y" length={a.height} zoom={zoom} mark={selBox ? [selBox.y, selBox.y + selBox.h] : undefined} title={tr('Drag right to add a guide')} onPointerDown={(e) => startGuide(e, a, 'x')} />
                    </>
                  )}
                  <div className="cm-scale" style={{ width: a.width * zoom, height: a.height * zoom, ['--z' as string]: zoom }}>
                    <div
                      className="cm-zoomed"
                      style={{ transform: `scale(${zoom})`, width: a.width, height: a.height }}
                      onPointerDownCapture={(e) => commenting && e.button === 0 && placeComment(e, a)}
                      onPointerDown={(e) => (e.target as HTMLElement).classList.contains('cm-board') && startMarquee(e, a)}
                      onContextMenu={(e) => {
                        if (!(e.target as HTMLElement).classList.contains('cm-board')) return
                        e.preventDefault()
                        select(a.id)
                        setMenu({ x: e.clientX, y: e.clientY })
                      }}
                    >
                      <ArtboardView artboard={a} project={project} logos={logos} time={mode === 'motion' && a.id === board.id ? time : undefined} renderLayer={(l, content, frame) => renderLayer(a, l, content, frame)}>
                        {a.print && <PrintGuides board={a} />}
                        {view.grid && a.grid && !a.grid.hidden && <GridView board={a} grid={a.grid} />}
                        {a.platform && <PlatformZones zones={zonesOf(a)} zoom={zoom} label={(s) => tr(s)} />}
                        {view.rulers && <Guides guides={a.guides ?? []} hide={live?.guide?.id} onGrab={(e, g) => startGuide(e, a, g.axis, g)} />}
                        {live?.board === a.id && (
                          <>
                            {live.safe && <SafeArea margin={safeMargin(a)} />}
                            {live.zones && <Zones zones={live.zones} />}
                            {live.lines && <SnapLines lines={live.lines} zoom={zoom} />}
                            {live.gaps?.map((g, i) => <Distance key={i} gap={g} zoom={zoom} kind="gap" />)}
                            {live.marquee && <Marquee box={live.marquee} />}
                            {live.guide && <DraftGuide guide={live.guide} zoom={zoom} />}
                            {live.badge && <Badge box={live.badge.box} text={live.badge.text} zoom={zoom} />}
                          </>
                        )}
                        {selBox && selected.length > 1 && (
                          <GroupFrame box={selBox} zoom={zoom} onResize={(e, dir) => startGroupResize(e, a, dir)} onRotate={(e) => startGroupRotate(e, a)} />
                        )}
                        {measuring.map((g, i) => <Distance key={'m' + i} gap={g} zoom={zoom} kind="measure" />)}
                        <CommentPins design={design} artboardId={a.id} zoom={zoom} focus={focusComment} draft={draft} onPick={(c) => { setFocusComment(c.id); setTab('comments') }} />
                      </ArtboardView>
                      {current && croppingLayer && (
                        <div data-noexport className="cm-ghost-frame" style={{ ...layerBox(croppingLayer), opacity: undefined }}>
                          <CropGhost layer={croppingLayer} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {mode === 'motion' && (
          <Timeline
            board={board}
            time={time}
            playing={playing}
            selected={sel.layers}
            onTime={setTime}
            onPlay={setPlaying}
            onSelect={(id) => select(board.id, [id])}
          />
        )}
        {renderAt !== null && (
          <div ref={offscreen} className="cm-offscreen" aria-hidden>
            <ArtboardView artboard={board} project={project} logos={logos} time={renderAt} />
          </div>
        )}
        <aside className="cm-props">
          {mode === 'print' && (
            <PrintPanel
              board={board}
              brand={brand}
              issues={printIssues}
              busy={busy === 'print'}
              softProof={softProof}
              onSoftProof={setSoftProof}
              onConvert={makePrintVersion}
              onFix={applyFix}
              onFixAll={() => updateBoard(board.id, (a) => ({ ...a, layers: a.layers.map((l) => printIssues.filter((i) => i.layerId === l.id && i.fix).reduce((acc, i) => ({ ...acc, ...i.fix!.patch }) as Layer, l)) }))}
              onPick={(i) => select(board.id, [i.layerId])}
              onPdf={printPdf}
              onPng={() => run('print', async () => saveBlob(await image(board, 'png', 1), fileName(`${design.name} – ${board.name} – print.png`)))}
            />
          )}
          {mode === 'motion' && (
            <MotionPanel
              board={board}
              layer={layer}
              progress={video}
              onAnim={(anim, record) => patch({ anim }, record)}
              onBoard={(duration, record) => updateBoard(board.id, (a) => ({ ...a, motion: duration ? { duration } : undefined }), record)}
              onAuto={() => { updateBoard(board.id, (a) => autoAnimate(a)); setTime(0); setPlaying(true) }}
              onClear={() => updateBoard(board.id, (a) => ({ ...a, motion: undefined, layers: a.layers.map((l) => (l.anim ? { ...l, anim: undefined } : l)) }))}
              onExport={exportVideo}
            />
          )}
          {mode === 'design' && <div className="cm-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'design'} onClick={() => setTab('design')}>{tr('Design')}</button>
            <button role="tab" aria-selected={tab === 'ai'} onClick={() => setTab('ai')}><Sparkles size={12} /> {tr('AI')}</button>
            <button role="tab" aria-selected={tab === 'comments'} onClick={() => setTab('comments')}>{tr('Comments')}{openThreads > 0 && <span className="cm-count">{openThreads}</span>}</button>
          </div>}
          {mode === 'design' && tab === 'ai' && (
            <AiPanel
              project={project}
              design={design}
              board={board}
              layer={layer}
              brand={brand}
              request={aiRequest}
              onPlace={placeImage}
              onReplace={(id, src) => updateLayer(board.id, id, (l) => ({ ...l, src }) as Layer)}
              onExpanded={(id, src) => updateLayer(board.id, id, (l) => ({ ...l, src, x: 0, y: 0, w: board.width, h: board.height, fit: 'cover', focus: undefined, mask: undefined, rotation: 0 }) as Layer)}
              onText={(text) => (layer?.type === 'text' ? patch({ text, name: text.slice(0, 24) }) : addLayer({ ...newText(board, brand, text, text.length < 60), name: text.slice(0, 24) }))}
              onRemember={(entry) => change((d) => ({ ...d, aiImages: [aiEntry(entry), ...(d.aiImages ?? [])].slice(0, 40) }), false)}
            />
          )}
          {mode === 'design' && tab === 'comments' && (
            <CommentsPanel
              project={project}
              design={design}
              me={me.name}
              draft={draft}
              focus={focusComment}
              onChange={setComments}
              onDraftDone={() => setDraft(null)}
              onPick={(c) => {
                setFocusComment(c.id)
                const a = design.artboards.find((x) => x.id === c.artboardId)
                if (a) { select(a.id); boardEls.current[a.id]?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }) }
              }}
            />
          )}
          {mode === 'design' && tab === 'design' && (layer ? (
            <>
              <IssueList issues={issues.filter((i) => i.layerId === layer.id)} onFix={applyFix} />
              <LayerProps
                key={layer.id}
                layer={layer}
                board={board}
                brand={brand}
                logos={logos}
                project={project}
                cropping={cropping === layer.id}
                clientEdits={hasFeature(state, 'clientEdits')}
                onChange={patch}
                onShuffle={(style) => generateBackground(style)}
                onAlign={alignTo}
                onOrder={order}
                onFlip={flip}
                onCrop={() => setCropping(cropping === layer.id ? null : layer.id)}
                onFit={() => fitToContent()}
                onAi={openAi}
                onDuplicate={duplicateSelected}
                onDelete={removeSelected}
                addImage={async (f) => (await addImageFile(f)).src}
              />
            </>
          ) : selected.length > 1 ? (
            <MultiProps
              layers={selected}
              brand={brand}
              grouped={selectedGroups.length > 0}
              onColour={(c) => updateLayers(board.id, sel.layers, (l) => (l.type === 'text' ? { ...l, colour: c, gradient: undefined } : l.type === 'shape' ? { ...l, fill: c, gradient: undefined } : l.type === 'icon' ? { ...l, colour: c } : l))}
              onFont={(font) => updateLayers(board.id, sel.layers, (l) => (l.type === 'text' ? { ...l, font } : l))}
              onOpacity={(o, record) => updateLayers(board.id, sel.layers, (l) => ({ ...l, opacity: o }), record)}
              onAlign={alignTo}
              onDistribute={distributeAlong}
              onOrder={order}
              onFlip={flip}
              onGroup={group}
              onUngroup={ungroupSelected}
              onDuplicate={duplicateSelected}
              onDelete={removeSelected}
            />
          ) : (
            <BoardProps
              key={board.id}
              board={board}
              brand={brand}
              issues={issues}
              templates={templates}
              onPickIssue={(i) => select(board.id, [i.layerId])}
              onFix={applyFix}
              onFixAll={fixAll}
              onBackground={(style) => generateBackground(style)}
              onChange={(p, record) => updateBoard(board.id, (a) => ({ ...a, ...p }), record)}
              onResize={(id) => { const size = SIZES.find((s) => s.id === id); if (size) updateBoard(board.id, (a) => ({ ...resizeArtboard(a, size), id: a.id })) }}
              onTemplate={(id) => {
                const apply = () => {
                  const photo = board.layers.find((l) => l.type === 'image')
                  updateBoard(board.id, (a) => applyTemplate(a, brand, id, photo && photo.type === 'image' ? { src: photo.src, ratio: photo.w / photo.h } : undefined))
                }
                board.layers.length ? confirm(tr('Replace what’s on this artboard with the layout?'), apply, tr('Replace')) : apply()
              }}
              onUseTemplate={useTemplate}
              onSaveTemplate={(name) => { setTemplates([...templates, { id: uid(), name, projectId: project.id, artboard: structuredClone(board), createdAt: now() }]); setNote(tr('Saved as a template. Use it on any client’s brand from “Layouts and templates”.')) }}
              onDeleteTemplate={(id) => confirm(tr('Delete this template?'), () => setTemplates(templates.filter((t) => t.id !== id)), tr('Delete'))}
              onEverySize={everySize}
              onRemix={() => setModal('remix')}
              onBulk={() => setModal('bulk')}
            />
          ))}
          {mode === 'design' && tab === 'design' && <p className="cm-hint muted">{tr('Tip: hold ⌘ to skip snapping, Alt to measure or drag a copy, Shift to keep proportions or move straight. Space + drag pans. Press ? for every shortcut.')}</p>}
        </aside>
      </div>
      {menu && <ContextMenu at={menu} items={menuItems} onClose={() => setMenu(null)} />}
      {help && <ShortcutSheet onClose={() => setHelp(false)} />}
      {modal === 'bulk' && <BulkCreate board={board} onCreate={(boards) => { addArtboards(boards); setNote(tr('{n} artboards made from the sheet. Export them all at once with Export → All artboards.', { n: boards.length })) }} onClose={() => setModal(null)} />}
      {modal === 'remix' && (
        <RemixPanel
          board={board}
          project={project}
          onUse={(r) => updateBoard(board.id, (a) => ({ ...a, background: r.background, backgroundGradient: r.backgroundGradient, layers: r.layers }))}
          onAdd={(r) => addArtboards([{ ...resizeArtboard(r, r), name: `${board.name} – ${tr('remix')}` }])}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'preview' && <FeedPreview design={design} project={project} start={board.id} onClose={() => setModal(null)} />}
      {confirmNode}
    </div>
  )
}

/** Saved states of the whole design, to go back to. */
function Versions({ design, onSave, onRestore, onDelete }: { design: Design; onSave: (name: string) => void; onRestore: (v: NonNullable<Design['versions']>[number]) => void; onDelete: (id: string) => void }) {
  const tr = useT()
  const [naming, setNaming] = useState(false)
  const list = design.versions ?? []
  return (
    <section>
      <h4><History size={11} style={{ verticalAlign: -1 }} /> {tr('Versions')}</h4>
      {naming ? (
        <form className="cm-inline" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get('name') ?? '').trim(); if (v) onSave(v); setNaming(false) }}>
          <input name="name" className="input input-sm" autoFocus placeholder={tr('e.g. “First round”')} aria-label={tr('Version name')} onKeyDown={(e) => e.key === 'Escape' && setNaming(false)} />
          <button className="btn btn-sm btn-primary">{tr('Save')}</button>
        </form>
      ) : (
        <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => setNaming(true)}><Wand2 size={13} /> {tr('Save this version')}</button>
      )}
      {list.map((v) => (
        <div key={v.id} className="cm-row">
          <button className="cm-row-main" onClick={() => onRestore(v)} title={tr('Go back to this version')}>
            <span>{v.name}</span>
            <small>{new Date(v.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} {new Date(v.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small>
          </button>
          <button className="cm-icon" title={tr('Delete')} onClick={() => onDelete(v.id)}><Trash2 size={13} /></button>
        </div>
      ))}
    </section>
  )
}

/** Typing into a text layer, right on the canvas. */
function TextEditor({ layer, onDone }: { layer: TextLayer; onDone: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // The text is set here, not rendered by React: while typing, the browser owns this node.
    el.innerText = layer.text
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const s = window.getSelection()
    s?.removeAllRanges()
    s?.addRange(range)
  }, [])
  return (
    <div
      ref={ref}
      contentEditable
      className="cm-typing"
      style={textStyle(layer)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') e.currentTarget.blur()
      }}
      onBlur={(e) => onDone(e.currentTarget.innerText.replace(/\n$/, ''))}
    />
  )
}
