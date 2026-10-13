/**
 * Content Machine geometry: the boxes things take up, what a moving layer snaps to, distances,
 * resizing and rotating. Pure functions in artboard pixels, so they're tested.
 */
import type { Layer, LayoutGrid } from '../../data/types'

export type Box = { x: number; y: number; w: number; h: number }
export type Axis = 'x' | 'y'
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** What a snap line belongs to – each is drawn a little differently. */
export type LineKind = 'board' | 'margin' | 'layer' | 'guide' | 'grid' | 'clearspace'

/** A line something can snap to. `axis: 'x'` is a vertical line at x = `at`. */
export type Target = { axis: Axis; at: number; kind: LineKind; /** How far the thing it belongs to reaches along the line. */ span?: [number, number] }
/** A snap line to draw, from → to along the line. */
export type SnapLine = { axis: Axis; at: number; from: number; to: number; kind: LineKind }
/** A distance to draw: from → to along `axis`, at `at` on the other axis. */
export type Gap = { axis: Axis; from: number; to: number; at: number }

const other = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x')
const start = (b: Box, axis: Axis) => (axis === 'x' ? b.x : b.y)
const size = (b: Box, axis: Axis) => (axis === 'x' ? b.w : b.h)
const end = (b: Box, axis: Axis) => start(b, axis) + size(b, axis)

/** The box a layer takes up – for a rotated layer, the upright box around it. */
export function boundsOf(l: Pick<Layer, 'x' | 'y' | 'w' | 'rotation'>, h: number): Box {
  const r = ((l.rotation ?? 0) * Math.PI) / 180
  if (!r) return { x: l.x, y: l.y, w: l.w, h }
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const w = l.w * c + h * s
  const hh = l.w * s + h * c
  return { x: l.x + l.w / 2 - w / 2, y: l.y + h / 2 - hh / 2, w, h: hh }
}

export function union(boxes: Box[]): Box {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 }
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y }
}

export const intersects = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
export const contains = (outer: Box, inner: Box) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

/** A box from two corners, in any order – for dragging out a selection. */
export const boxFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })

/* ---------- Layout grid ---------- */

/** The columns (or rows) of a layout grid, as [start, end] pairs along `length`. */
export function gridTracks(length: number, count: number, gutter: number, margin: number): [number, number][] {
  if (count < 1) return []
  const track = (length - margin * 2 - gutter * (count - 1)) / count
  if (track <= 0) return []
  return Array.from({ length: count }, (_, i) => {
    const s = margin + i * (track + gutter)
    return [s, s + track]
  })
}

/* ---------- Snapping ---------- */

export type SnapContext = {
  board: { width: number; height: number }
  /** Everything else on the artboard. */
  others: Box[]
  guides?: { axis: Axis; at: number }[]
  grid?: LayoutGrid
  /** The safe margin the brand checks ask for. */
  margin?: number
  /** Logos' clear-space zones: other things line up just outside them. */
  zones?: Box[]
}

/** Every line a moving layer can snap to on this artboard. */
export function snapTargets(ctx: SnapContext): Target[] {
  const { width: W, height: H } = ctx.board
  const t: Target[] = []
  for (const at of [0, W / 2, W]) t.push({ axis: 'x', at, kind: 'board' })
  for (const at of [0, H / 2, H]) t.push({ axis: 'y', at, kind: 'board' })
  if (ctx.margin) {
    t.push({ axis: 'x', at: ctx.margin, kind: 'margin' }, { axis: 'x', at: W - ctx.margin, kind: 'margin' })
    t.push({ axis: 'y', at: ctx.margin, kind: 'margin' }, { axis: 'y', at: H - ctx.margin, kind: 'margin' })
  }
  for (const b of ctx.others) {
    for (const at of [b.x, b.x + b.w / 2, b.x + b.w]) t.push({ axis: 'x', at, kind: 'layer', span: [b.y, b.y + b.h] })
    for (const at of [b.y, b.y + b.h / 2, b.y + b.h]) t.push({ axis: 'y', at, kind: 'layer', span: [b.x, b.x + b.w] })
  }
  for (const g of ctx.guides ?? []) t.push({ axis: g.axis, at: g.at, kind: 'guide' })
  if (ctx.grid && !ctx.grid.hidden) {
    for (const [s, e] of gridTracks(W, ctx.grid.columns, ctx.grid.gutter, ctx.grid.margin)) t.push({ axis: 'x', at: s, kind: 'grid' }, { axis: 'x', at: e, kind: 'grid' })
    for (const [s, e] of gridTracks(H, ctx.grid.rows, ctx.grid.gutter, ctx.grid.margin)) t.push({ axis: 'y', at: s, kind: 'grid' }, { axis: 'y', at: e, kind: 'grid' })
  }
  for (const z of ctx.zones ?? []) {
    t.push({ axis: 'x', at: z.x, kind: 'clearspace', span: [z.y, z.y + z.h] }, { axis: 'x', at: z.x + z.w, kind: 'clearspace', span: [z.y, z.y + z.h] })
    t.push({ axis: 'y', at: z.y, kind: 'clearspace', span: [z.x, z.x + z.w] }, { axis: 'y', at: z.y + z.h, kind: 'clearspace', span: [z.x, z.x + z.w] })
  }
  return t
}

/** Where on the cross axis two boxes overlap, or null if they don't. */
function overlap(a: Box, b: Box, axis: Axis): [number, number] | null {
  const s = Math.max(start(a, axis), start(b, axis))
  const e = Math.min(end(a, axis), end(b, axis))
  return e > s ? [s, e] : null
}

/**
 * Equal spacing: positions along `axis` where the gap to a neighbour matches a gap that's already
 * there, or where the box sits exactly between its two neighbours.
 */
function spacingCandidates(box: Box, others: Box[], axis: Axis): { pos: number; gaps: (pos: number) => Gap[] }[] {
  const cross = other(axis)
  const row = others.filter((b) => overlap(b, box, cross)).sort((a, b) => start(a, axis) - start(b, axis))
  const mid = start(box, axis) + size(box, axis) / 2
  const before = row.filter((b) => end(b, axis) <= mid).sort((a, b) => end(b, axis) - end(a, axis))[0]
  const after = row.filter((b) => start(b, axis) >= mid).sort((a, b) => start(a, axis) - start(b, axis))[0]
  const gapAt = (a: Box, b: Box) => {
    const o = overlap(a, b, cross)
    return o ? (o[0] + o[1]) / 2 : (start(a, cross) + size(a, cross) / 2 + start(b, cross) + size(b, cross) / 2) / 2
  }
  const gapBetween = (a: Box, b: Box): Gap => ({ axis, from: end(a, axis), to: start(b, axis), at: gapAt(a, b) })
  const moved = (pos: number): Box => (axis === 'x' ? { ...box, x: pos } : { ...box, y: pos })

  // Gaps that are already there, between neighbours in the same row.
  const existing: Gap[] = []
  for (let i = 0; i < row.length - 1; i++) {
    const [a, b] = [row[i], row[i + 1]]
    if (end(a, axis) < start(b, axis) && overlap(a, b, cross)) existing.push(gapBetween(a, b))
  }
  const len = (g: Gap) => g.to - g.from
  const out: { pos: number; gaps: (pos: number) => Gap[] }[] = []
  for (const g of existing) {
    const same = (n: number) => existing.filter((e) => Math.abs(len(e) - n) < 0.5)
    if (before) out.push({ pos: end(before, axis) + len(g), gaps: (p) => [gapBetween(before, moved(p)), ...same(len(g))] })
    if (after) out.push({ pos: start(after, axis) - len(g) - size(box, axis), gaps: (p) => [gapBetween(moved(p), after), ...same(len(g))] })
  }
  if (before && after) {
    const room = start(after, axis) - end(before, axis) - size(box, axis)
    if (room > 0) out.push({ pos: end(before, axis) + room / 2, gaps: (p) => [gapBetween(before, moved(p)), gapBetween(moved(p), after)] })
  }
  return out
}

/** The snap lines a box lines up with, merged per line and stretched to reach the box. */
export function alignedLines(box: Box, targets: Target[], board: { width: number; height: number }): SnapLine[] {
  const lines = new Map<string, SnapLine>()
  for (const t of targets) {
    const edges = [start(box, t.axis), start(box, t.axis) + size(box, t.axis) / 2, end(box, t.axis)]
    if (!edges.some((e) => Math.abs(e - t.at) < 0.5)) continue
    const cross = other(t.axis)
    const [from, to] = t.span ? [Math.min(t.span[0], start(box, cross)), Math.max(t.span[1], end(box, cross))] : [0, cross === 'x' ? board.width : board.height]
    const key = `${t.axis}:${Math.round(t.at * 2) / 2}`
    const had = lines.get(key)
    // One line per position; a layer's line beats a full-length one, since it shows what lines up.
    if (!had) lines.set(key, { axis: t.axis, at: t.at, from, to, kind: t.kind })
    else if (t.span && (had.kind === 'layer' || had.kind === 'clearspace')) lines.set(key, { ...had, from: Math.min(had.from, from), to: Math.max(had.to, to) })
  }
  return [...lines.values()]
}

export type SnapResult = { x: number; y: number; lines: SnapLine[]; gaps: Gap[] }

/**
 * Snaps a moving box: its edges and centre onto the artboard's edges, centre and safe margin,
 * other layers, guides and the layout grid – or into equal spacing with its neighbours. Within
 * `threshold` artboard pixels; the nearest wins. `extra` adds more edges of the box to try (a
 * logo's clear space).
 */
export function snapBox(box: Box, targets: Target[], ctx: Pick<SnapContext, 'board' | 'others'>, threshold: number, extra: Partial<Record<Axis, number[]>> = {}): SnapResult {
  const gaps: Gap[] = []
  const pick = (axis: Axis) => {
    const pos = start(box, axis)
    const len = size(box, axis)
    const offsets = [0, len / 2, len, ...(extra[axis] ?? [])]
    let best: { pos: number; d: number; gaps?: (p: number) => Gap[] } | null = null
    for (const t of targets) {
      if (t.axis !== axis) continue
      for (const o of offsets) {
        const p = t.at - o
        const d = Math.abs(p - pos)
        if (d <= threshold && (!best || d < best.d)) best = { pos: p, d }
      }
    }
    for (const c of spacingCandidates(box, ctx.others, axis)) {
      const d = Math.abs(c.pos - pos)
      // Equal spacing that lands on the same spot as a line still shows its distances.
      if (d <= threshold && (!best || d < best.d || Math.abs(c.pos - best.pos) < 0.5)) best = { pos: c.pos, d, gaps: c.gaps }
    }
    if (best?.gaps) gaps.push(...best.gaps(best.pos))
    return best ? best.pos : pos
  }
  const x = pick('x')
  const y = pick('y')
  const lines = alignedLines({ ...box, x, y }, targets, ctx.board)
  // A clear-space zone only shows its line when that's what the box lined up with.
  if (extra.x?.length || extra.y?.length) {
    for (const axis of ['x', 'y'] as const)
      for (const o of extra[axis] ?? []) {
        const at = (axis === 'x' ? x : y) + o
        const t = targets.find((t) => t.axis === axis && Math.abs(t.at - at) < 0.5)
        if (t) lines.push({ axis, at, from: 0, to: axis === 'x' ? ctx.board.height : ctx.board.width, kind: t.kind })
      }
  }
  return { x, y, lines, gaps }
}

/** Snaps one edge being dragged (a resize) to the nearest line within `threshold`. */
export function snapEdge(value: number, axis: Axis, targets: Target[], threshold: number) {
  let best: { at: number; d: number } | null = null
  for (const t of targets) {
    if (t.axis !== axis) continue
    const d = Math.abs(t.at - value)
    if (d <= threshold && (!best || d < best.d)) best = { at: t.at, d }
  }
  return best ? best.at : value
}

/* ---------- Measuring ---------- */

/**
 * The distances between two boxes, the way design tools show them when you hold Alt: from each
 * edge to the other box's edge – or, when one is inside the other, from each side to the outer box.
 */
export function measure(a: Box, b: Box): Gap[] {
  const [inner, outer] = contains(b, a) ? [a, b] : contains(a, b) ? [b, a] : [null, null]
  if (inner && outer) {
    const cx = inner.x + inner.w / 2
    const cy = inner.y + inner.h / 2
    return [
      { axis: 'x' as const, from: outer.x, to: inner.x, at: cy },
      { axis: 'x' as const, from: inner.x + inner.w, to: outer.x + outer.w, at: cy },
      { axis: 'y' as const, from: outer.y, to: inner.y, at: cx },
      { axis: 'y' as const, from: inner.y + inner.h, to: outer.y + outer.h, at: cx },
    ].filter((g) => g.to - g.from > 0.5)
  }
  const out: Gap[] = []
  for (const axis of ['x', 'y'] as const) {
    const cross = other(axis)
    const o = overlap(a, b, cross)
    const at = o ? (o[0] + o[1]) / 2 : start(a, cross) + size(a, cross) / 2
    if (end(a, axis) <= start(b, axis)) out.push({ axis, from: end(a, axis), to: start(b, axis), at })
    else if (end(b, axis) <= start(a, axis)) out.push({ axis, from: end(b, axis), to: start(a, axis), at })
  }
  return out.filter((g) => g.to - g.from > 0.5)
}

/* ---------- Resizing and rotating ---------- */

const rad = (deg: number) => (deg * Math.PI) / 180
const turn = (x: number, y: number, deg: number) => {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return { x: x * c - y * s, y: x * s + y * c }
}

/** A drag on the artboard in a layer's own directions (it may be rotated or flipped). */
export function toLocal(dx: number, dy: number, l: { rotation?: number; flipX?: boolean; flipY?: boolean }) {
  const p = turn(dx, dy, -(l.rotation ?? 0))
  return { x: p.x * (l.flipX ? -1 : 1), y: p.y * (l.flipY ? -1 : 1) }
}

/**
 * A box resized by dragging one of its handles by (dx, dy) on the artboard. Works for rotated and
 * flipped layers: the opposite side stays where it is on screen. `fromCentre` (Alt) grows both
 * sides; `keepRatio` keeps the proportions.
 */
export function resizeBox(
  s: Box & { rotation?: number; flipX?: boolean; flipY?: boolean },
  dir: Handle,
  dx: number,
  dy: number,
  opts: { keepRatio?: boolean; fromCentre?: boolean; min?: number } = {},
): Box {
  const deg = s.rotation ?? 0
  const fx = s.flipX ? -1 : 1
  const fy = s.flipY ? -1 : 1
  // The drag in the layer's own directions.
  const { x: ldx, y: ldy } = toLocal(dx, dy, s)
  const sx = dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0
  const sy = dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0
  const k = opts.fromCentre ? 2 : 1
  const min = opts.min ?? 8
  let w = s.w + sx * ldx * k
  let h = s.h + sy * ldy * k
  if (opts.keepRatio && s.h > 0) {
    const ratio = s.w / s.h
    if (sx && sy) {
      if (Math.abs(w - s.w) / s.w >= Math.abs(h - s.h) / s.h) h = w / ratio
      else w = h * ratio
    } else if (sx) h = w / ratio
    else w = h * ratio
  }
  if (w < min) {
    if (opts.keepRatio) h = (h * min) / w
    w = min
  }
  if (h < min) {
    if (opts.keepRatio) w = (w * min) / h
    h = min
  }

  // The point that stays put: the opposite side (or the centre), in the layer's own frame.
  const anchor = (width: number, height: number) => ({
    x: opts.fromCentre || !sx ? 0 : (sx === 1 ? -width : width) / 2,
    y: opts.fromCentre || !sy ? 0 : (sy === 1 ? -height : height) / 2,
  })
  const onScreen = (p: { x: number; y: number }) => turn(p.x * fx, p.y * fy, deg)
  const before = onScreen(anchor(s.w, s.h))
  const after = onScreen(anchor(w, h))
  const cx = s.x + s.w / 2 + before.x - after.x
  const cy = s.y + s.h / 2 + before.y - after.y
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** An angle kept between -180 and 180; to `step` degrees, or onto a right angle when within 3°. */
export function snapAngle(deg: number, step?: number) {
  let a = ((((deg + 180) % 360) + 360) % 360) - 180
  if (step) a = Math.round(a / step) * step
  else {
    const right = Math.round(a / 90) * 90
    if (Math.abs(a - right) <= 3) a = right
  }
  if (a === -180) a = 180
  return Object.is(a, -0) ? 0 : Math.round(a * 10) / 10
}

/** The distance between numbered ticks on a ruler, so labels stay about `minPx` apart on screen. */
export function rulerStep(zoom: number, minPx = 56) {
  return [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => s * zoom >= minPx) ?? 10000
}
