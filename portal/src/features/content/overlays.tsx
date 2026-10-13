/**
 * What the editor draws over an artboard while you work – never exported: rulers, guides, the
 * layout grid, snap lines, distances, the selection and its handles. Inside the artboard, sizes are
 * divided by the zoom so they look the same on screen at any zoom.
 */
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useSrc } from '../../data/blobs'
import type { Artboard, ImageLayer, Layer, LayoutGrid } from '../../data/types'
import { gridTracks, rulerStep, type Axis, type Box, type Gap, type Handle, type SnapLine } from './geometry'
import { printBoxes } from './print'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const RULER = 18

/** A ruler along the top or left of an artboard. Drag from it to pull out a guide. */
export function Ruler({ axis, length, zoom, mark, title, onPointerDown }: {
  axis: Axis
  length: number
  zoom: number
  /** The selection's extent, shown as a band. */
  mark?: [number, number]
  title: string
  onPointerDown: (e: ReactPointerEvent) => void
}) {
  const step = rulerStep(zoom)
  const sub = [10, 5, 2].find((n) => (step / n) * zoom >= 6) ?? 1
  const minor = step / sub
  const flat = axis === 'x'
  const px = length * zoom
  const ticks = Array.from({ length: Math.floor(length / minor) + 1 }, (_, i) => i)
  return (
    <svg className={'cm-ruler ' + axis} width={flat ? px : RULER} height={flat ? RULER : px} onPointerDown={onPointerDown} aria-label={title}>
      <title>{title}</title>
      {mark && (flat
        ? <rect className="mark" x={mark[0] * zoom} y={0} width={(mark[1] - mark[0]) * zoom} height={RULER} />
        : <rect className="mark" x={0} y={mark[0] * zoom} width={RULER} height={(mark[1] - mark[0]) * zoom} />)}
      {ticks.map((i) => {
        const v = i * minor
        const p = Math.round(v * zoom) + 0.5
        const major = i % sub === 0
        const len = major ? 7 : 3
        return (
          <g key={i}>
            {flat ? <line x1={p} x2={p} y1={RULER} y2={RULER - len} /> : <line y1={p} y2={p} x1={RULER} x2={RULER - len} />}
            {major && (flat ? <text x={p + 3} y={9}>{Math.round(v)}</text> : <text transform={`translate(9 ${p - 3}) rotate(-90)`}>{Math.round(v)}</text>)}
          </g>
        )
      })}
    </svg>
  )
}

/** Guides pulled out of the rulers. Drag one to move it; drag it off the artboard to remove it. */
export function Guides({ guides, hide, onGrab }: { guides: NonNullable<Artboard['guides']>; hide?: string; onGrab: (e: ReactPointerEvent, g: NonNullable<Artboard['guides']>[number]) => void }) {
  return (
    <>
      {guides.filter((g) => g.id !== hide).map((g) => (
        <span key={g.id} data-noexport className={'cm-uguide ' + g.axis} style={g.axis === 'x' ? { left: g.at } : { top: g.at }} onPointerDown={(e) => onGrab(e, g)} />
      ))}
    </>
  )
}

/** A guide being dragged, with where it is. */
export function DraftGuide({ guide: g, zoom }: { guide: { axis: Axis; at: number }; zoom: number }) {
  return (
    <span data-noexport className={'cm-uguide draft ' + g.axis} style={g.axis === 'x' ? { left: g.at } : { top: g.at }}>
      <span className="cm-pill guide" style={{ fontSize: 11 / zoom, padding: `${1 / zoom}px ${5 / zoom}px`, borderRadius: 3 / zoom }}>{Math.round(g.at)}</span>
    </span>
  )
}

/** Columns and rows of the layout grid. */
export function GridView({ board, grid }: { board: Artboard; grid: LayoutGrid }) {
  const cols = gridTracks(board.width, grid.columns, grid.gutter, grid.margin)
  const rows = gridTracks(board.height, grid.rows, grid.gutter, grid.margin)
  return (
    <div data-noexport className="cm-gridview">
      {cols.map(([s, e], i) => <span key={'c' + i} style={{ left: s, width: e - s, top: 0, bottom: 0 }} />)}
      {rows.map(([s, e], i) => <span key={'r' + i} style={{ top: s, height: e - s, left: 0, right: 0 }} />)}
    </div>
  )
}

/** The brand's safe margin, shown while something moves. */
export const SafeArea = ({ margin }: { margin: number }) => <span data-noexport className="cm-safe" style={{ inset: margin }} />

/** Logos' clear space, shown while text or a logo moves near them. */
export const Zones = ({ zones }: { zones: Box[] }) => (
  <>
    {zones.map((z, i) => <span key={i} data-noexport className="cm-zone" style={{ left: z.x, top: z.y, width: z.w, height: z.h }} />)}
  </>
)

/** The lines a moving layer snapped to. */
export function SnapLines({ lines, zoom }: { lines: SnapLine[]; zoom: number }) {
  const t = 1 / zoom
  return (
    <>
      {lines.map((l, i) => (
        <span
          key={i}
          data-noexport
          className={'cm-snap ' + l.kind}
          style={l.axis === 'x' ? { left: l.at - t / 2, top: l.from, height: l.to - l.from, width: t } : { top: l.at - t / 2, left: l.from, width: l.to - l.from, height: t }}
        />
      ))}
    </>
  )
}

/** A distance: a line with ticks at the ends and the number of pixels. */
export function Distance({ gap: g, zoom, kind }: { gap: Gap; zoom: number; kind: 'gap' | 'measure' }) {
  const len = g.to - g.from
  const t = 1 / zoom
  return (
    <span
      data-noexport
      className={`cm-dist ${kind} ${g.axis}`}
      style={g.axis === 'x' ? { left: g.from, top: g.at - t / 2, width: len, height: t } : { top: g.from, left: g.at - t / 2, height: len, width: t }}
    >
      <span className={'cm-pill ' + kind} style={{ fontSize: 11 / zoom, padding: `${1 / zoom}px ${5 / zoom}px`, borderRadius: 3 / zoom }}>{Math.round(len)}</span>
    </span>
  )
}

/** Dragging out a selection. */
export const Marquee = ({ box }: { box: Box }) => <span data-noexport className="cm-marquee" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />

/** Position, size or angle while dragging, just under what's moving. */
export function Badge({ box, text, zoom }: { box: Box; text: string; zoom: number }) {
  return (
    <span data-noexport className="cm-pill badge" style={{ left: box.x + box.w / 2, top: box.y + box.h + 10 / zoom, fontSize: 11 / zoom, padding: `${2 / zoom}px ${6 / zoom}px`, borderRadius: 4 / zoom }}>
      {text}
    </span>
  )
}

/** The frame around several selected layers, with handles to size and turn them together. */
export function GroupFrame({ box, zoom, onResize, onRotate }: { box: Box; zoom: number; onResize?: (e: ReactPointerEvent, dir: Handle) => void; onRotate?: (e: ReactPointerEvent) => void }) {
  return (
    <div data-noexport className="cm-group" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
      {onResize && HANDLES.map((d) => (
        <span key={d} className={`cm-h cm-h-${d}`} style={{ width: 10 / zoom, height: 10 / zoom, borderWidth: 1.5 / zoom }} onPointerDown={(e) => onResize(e, d)} />
      ))}
      {onRotate && <span className="cm-rot" style={{ width: 12 / zoom, height: 12 / zoom, top: -28 / zoom, borderWidth: 1.5 / zoom }} onPointerDown={onRotate} />}
    </div>
  )
}

/** Where the app's own buttons, captions or crops cover the post. */
export function PlatformZones({ zones, zoom, label }: { zones: (Box & { label: string })[]; zoom: number; label: (s: string) => string }) {
  return (
    <>
      {zones.map((z, i) => (
        <span key={i} data-noexport className="cm-platform" style={{ left: z.x, top: z.y, width: z.w, height: z.h }}>
          <span style={{ fontSize: 11 / zoom, padding: `${2 / zoom}px ${6 / zoom}px`, borderRadius: 4 / zoom }}>{label(z.label)}</span>
        </span>
      ))}
    </>
  )
}

/** Filters that show the canvas as people with colour blindness see it. */
export function VisionFilters({ list }: { list: readonly { id: string; matrix: string | null }[] }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      {list.filter((v) => v.matrix).map((v) => (
        <filter key={v.id} id={`cm-vision-${v.id}`} colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={v.matrix!} />
        </filter>
      ))}
    </svg>
  )
}

/** The frame, handles and rotate handle around the selected layer. */
export function Selection({ layer, zoom, handles, onResize, onRotate }: {
  layer: Layer
  zoom: number
  /** Only one layer selected: it can be resized and rotated. */
  handles: boolean
  onResize: (e: ReactPointerEvent, dir: Handle) => void
  onRotate: (e: ReactPointerEvent) => void
}) {
  const live = handles && !layer.locked
  const list = !live ? [] : layer.type === 'text' ? (['e', 'w'] as Handle[]) : HANDLES
  return (
    <div data-noexport className={'cm-sel' + (layer.locked ? ' locked' : '')} style={{ outlineWidth: 1.5 / zoom }}>
      {list.map((d) => (
        <span key={d} className={`cm-h cm-h-${d}`} style={{ width: 10 / zoom, height: 10 / zoom, borderWidth: 1.5 / zoom }} onPointerDown={(e) => onResize(e, d)} />
      ))}
      {live && <span className="cm-rot" style={{ width: 12 / zoom, height: 12 / zoom, top: -28 / zoom, borderWidth: 1.5 / zoom }} onPointerDown={onRotate} />}
    </div>
  )
}

/** The whole photo, faded, while you move it inside its frame – so you see what's cut off. */
export function CropGhost({ layer: l }: { layer: ImageLayer }) {
  const url = useSrc(l.src)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  if (!url) return null
  if (!natural) return <img src={url} alt="" hidden onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })} />
  const scale = Math.max(l.w / natural.w, l.h / natural.h)
  const w = natural.w * scale
  const h = natural.h * scale
  const f = l.focus ?? { x: 50, y: 50 }
  return <img src={url} alt="" draggable={false} className="cm-ghost" style={{ left: -(w - l.w) * (f.x / 100), top: -(h - l.h) * (f.y / 100), width: w, height: h }} />
}

/** A print artboard's bleed (printed, then cut off), its cut line and its safe area. */
export function PrintGuides({ board }: { board: Artboard }) {
  const { bleed, trim, safe } = printBoxes(board)
  const band = (key: string, style: Record<string, number>) => <span key={key} data-noexport className="cm-bleed" style={style} />
  return (
    <>
      {band('t', { left: 0, top: 0, width: board.width, height: bleed })}
      {band('b', { left: 0, top: board.height - bleed, width: board.width, height: bleed })}
      {band('l', { left: 0, top: bleed, width: bleed, height: board.height - bleed * 2 })}
      {band('r', { left: board.width - bleed, top: bleed, width: bleed, height: board.height - bleed * 2 })}
      <span data-noexport className="cm-trim" style={{ left: trim.x, top: trim.y, width: trim.w, height: trim.h }} />
      <span data-noexport className="cm-safe-print" style={{ left: safe.x, top: safe.y, width: safe.w, height: safe.h }} />
    </>
  )
}
