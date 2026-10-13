/**
 * Arranging layers: lining them up, spacing them evenly, stacking order and pasting onto another
 * artboard. Pure functions, so they're tested.
 */
import type { Artboard, Layer } from '../../data/types'
import { union, type Axis, type Box } from './geometry'

export type AlignHow = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
export type Moves = Record<string, { dx: number; dy: number }>

/** How far each box moves to line up with the others – or with `to` (the artboard, for one layer). */
export function align(items: { id: string; box: Box }[], how: AlignHow, to: Box = union(items.map((i) => i.box))): Moves {
  const out: Moves = {}
  for (const { id, box } of items) {
    const dx = how === 'left' ? to.x - box.x : how === 'hcenter' ? to.x + to.w / 2 - (box.x + box.w / 2) : how === 'right' ? to.x + to.w - (box.x + box.w) : 0
    const dy = how === 'top' ? to.y - box.y : how === 'vcenter' ? to.y + to.h / 2 - (box.y + box.h / 2) : how === 'bottom' ? to.y + to.h - (box.y + box.h) : 0
    out[id] = { dx, dy }
  }
  return out
}

/** The same gap between every box along `axis`; the first and the last stay where they are. */
export function distribute(items: { id: string; box: Box }[], axis: Axis): Moves {
  if (items.length < 3) return {}
  const s = (b: Box) => (axis === 'x' ? b.x : b.y)
  const len = (b: Box) => (axis === 'x' ? b.w : b.h)
  const sorted = [...items].sort((a, b) => s(a.box) - s(b.box))
  const all = union(items.map((i) => i.box))
  const gap = (len(all) - sorted.reduce((n, i) => n + len(i.box), 0)) / (items.length - 1)
  const out: Moves = {}
  let pos = s(all)
  for (const { id, box } of sorted) {
    out[id] = axis === 'x' ? { dx: pos - box.x, dy: 0 } : { dx: 0, dy: pos - box.y }
    pos += len(box) + gap
  }
  return out
}

export type Order = 'front' | 'forward' | 'backward' | 'back'

/** Layers (bottom first) with the chosen ones moved up or down the stack, keeping their own order. */
export function reorder<T extends { id: string }>(layers: T[], ids: string[], how: Order): T[] {
  const picked = (l: T) => ids.includes(l.id)
  if (how === 'front') return [...layers.filter((l) => !picked(l)), ...layers.filter(picked)]
  if (how === 'back') return [...layers.filter(picked), ...layers.filter((l) => !picked(l))]
  const out = [...layers]
  if (how === 'forward') {
    for (let i = out.length - 2; i >= 0; i--) if (picked(out[i]) && !picked(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]]
  } else {
    for (let i = 1; i < out.length; i++) if (picked(out[i]) && !picked(out[i - 1])) [out[i - 1], out[i]] = [out[i], out[i - 1]]
  }
  return out
}

/** A layer dropped next to another in the layers list: just above it in the stack, or just below. */
export function dropNextTo<T extends { id: string }>(layers: T[], id: string, targetId: string, above: boolean): T[] {
  const moving = layers.find((l) => l.id === id)
  if (!moving || id === targetId) return layers
  const rest = layers.filter((l) => l.id !== id)
  const at = rest.findIndex((l) => l.id === targetId) + (above ? 1 : 0)
  return [...rest.slice(0, at), moving, ...rest.slice(at)]
}

/**
 * Copied layers pasted onto an artboard: new ids, and on an artboard of another size, in the same
 * place relative to its edges (a logo top right stays top right).
 */
export function placePasted(layers: Layer[], from: { width: number; height: number }, to: { width: number; height: number }, newId: () => string): Layer[] {
  let dx = 0
  let dy = 0
  if (from.width !== to.width || from.height !== to.height) {
    const b = union(layers.map((l) => ({ x: l.x, y: l.y, w: l.w, h: l.h })))
    dx = ((b.x + b.w / 2) / from.width) * to.width - (b.x + b.w / 2)
    dy = ((b.y + b.h / 2) / from.height) * to.height - (b.y + b.h / 2)
  }
  return layers.map((l) => ({ ...l, id: newId(), x: Math.round(l.x + dx), y: Math.round(l.y + dy) }))
}

/* ---------- Groups ---------- */

/** Picking one layer of a group picks the whole group. */
export function withGroups(layers: { id: string; groupId?: string }[], ids: string[]): string[] {
  const groups = new Set(layers.filter((l) => ids.includes(l.id) && l.groupId).map((l) => l.groupId))
  return layers.filter((l) => ids.includes(l.id) || (l.groupId && groups.has(l.groupId))).map((l) => l.id)
}

/** Groups that still have two or more layers; the rest are forgotten. */
export function tidyGroups(a: Artboard): Artboard {
  if (!a.groups?.length) return a
  const count = (id: string) => a.layers.filter((l) => l.groupId === id).length
  const keep = a.groups.filter((g) => count(g.id) >= 2)
  const gone = new Set(a.groups.filter((g) => !keep.includes(g)).map((g) => g.id))
  if (!gone.size) return a
  return { ...a, groups: keep, layers: a.layers.map((l) => (l.groupId && gone.has(l.groupId) ? { ...l, groupId: undefined } : l)) }
}

/** Puts layers in one group, next to each other in the stack where the topmost of them was. */
export function groupLayers(a: Artboard, ids: string[], group: { id: string; name: string }): Artboard {
  const members = a.layers.filter((l) => ids.includes(l.id))
  if (members.length < 2) return a
  const top = Math.max(...members.map((m) => a.layers.indexOf(m)))
  const above = a.layers.slice(top + 1).filter((l) => !ids.includes(l.id))
  const below = a.layers.slice(0, top + 1).filter((l) => !ids.includes(l.id))
  const layers = [...below, ...members.map((m) => ({ ...m, groupId: group.id })), ...above]
  return tidyGroups({ ...a, layers, groups: [...(a.groups ?? []), group] })
}

export function ungroup(a: Artboard, groupIds: string[]): Artboard {
  return { ...a, groups: (a.groups ?? []).filter((g) => !groupIds.includes(g.id)), layers: a.layers.map((l) => (l.groupId && groupIds.includes(l.groupId) ? { ...l, groupId: undefined } : l)) }
}

/**
 * Copies of layers with new ids – and new groups for any groups they were in, so a copied group
 * is its own group. Returns the groups to add to the artboard.
 */
export function cloneLayers(layers: Layer[], groups: Artboard['groups'], newId: () => string): { layers: Layer[]; groups: { id: string; name: string }[] } {
  const map = new Map<string, string>()
  for (const l of layers) if (l.groupId && !map.has(l.groupId)) map.set(l.groupId, newId())
  return {
    layers: layers.map((l) => ({ ...l, id: newId(), groupId: l.groupId ? map.get(l.groupId) : undefined })),
    groups: [...map].map(([old, id]) => ({ id, name: groups?.find((g) => g.id === old)?.name ?? 'Group' })),
  }
}

/* ---------- Several layers at once ---------- */

type Sized = { layer: Layer; h: number }

/**
 * Layers resized together, as if they were one picture: each keeps its place in the selection.
 * Text grows with the smaller of the two directions, so it never stretches.
 */
export function scaleLayers(items: Sized[], from: Box, to: Box): Layer[] {
  const sx = to.w / Math.max(1, from.w)
  const sy = to.h / Math.max(1, from.h)
  const k = Math.min(sx, sy)
  return items.map(({ layer: l, h }) => {
    const cx = to.x + (l.x + l.w / 2 - from.x) * sx
    const cy = to.y + (l.y + h / 2 - from.y) * sy
    const w = Math.max(4, l.w * sx)
    const nh = Math.max(4, l.h * sy)
    const next = { ...l, x: Math.round(cx - w / 2), y: Math.round(cy - (l.type === 'text' ? h * k : nh) / 2), w: Math.round(w), h: Math.round(nh) } as Layer
    if (next.type === 'text') {
      next.size = Math.max(4, Math.round(next.size * k))
      if (next.stroke) next.stroke = { ...next.stroke, width: Math.round(next.stroke.width * k * 10) / 10 }
    }
    if (next.type === 'shape') {
      next.radius = Math.round(next.radius * k)
      if (next.stroke) next.stroke = { ...next.stroke, width: Math.max(1, Math.round(next.stroke.width * k)) }
    }
    return next
  })
}

/** Layers turned together around a point: each moves round it and turns by the same angle. */
export function rotateLayers(items: Sized[], centre: { x: number; y: number }, degrees: number): Layer[] {
  const a = (degrees * Math.PI) / 180
  const [c, s] = [Math.cos(a), Math.sin(a)]
  return items.map(({ layer: l, h }) => {
    const dx = l.x + l.w / 2 - centre.x
    const dy = l.y + h / 2 - centre.y
    const nx = centre.x + dx * c - dy * s
    const ny = centre.y + dx * s + dy * c
    let r = ((((l.rotation ?? 0) + degrees + 180) % 360) + 360) % 360 - 180
    if (Math.abs(r) < 0.05) r = 0
    return { ...l, x: Math.round(nx - l.w / 2), y: Math.round(ny - h / 2), rotation: Math.round(r * 10) / 10 }
  })
}
