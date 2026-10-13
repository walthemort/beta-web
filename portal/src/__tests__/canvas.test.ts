/** Content Machine canvas: smart guides, spacing, measuring, resizing, rotating and arranging. */
import { describe, expect, it } from 'vitest'
import { alignedLines, boundsOf, gridTracks, measure, resizeBox, rulerStep, snapAngle, snapBox, snapEdge, snapTargets, type SnapContext } from '../features/content/geometry'
import { align, distribute, dropNextTo, placePasted, reorder } from '../features/content/arrange'
import { clearZone, resizeArtboard, safeMargin } from '../features/content/model'
import type { Artboard, Layer } from '../data/types'

const board = { width: 1000, height: 1000 }
const ctx = (others: SnapContext['others'] = [], extra: Partial<SnapContext> = {}): SnapContext => ({ board, others, ...extra })
const snap = (box: { x: number; y: number; w: number; h: number }, c: SnapContext, t = 6) => snapBox(box, snapTargets(c), c, t)

describe('smart guides', () => {
  it('snap to other layers’ edges and centres, and draw the line across both', () => {
    const c = ctx([{ x: 100, y: 100, w: 200, h: 100 }])
    const s = snap({ x: 104, y: 400, w: 150, h: 80 }, c)
    expect(s.x).toBe(100)
    expect(s.lines).toContainEqual({ axis: 'x', at: 100, from: 100, to: 480, kind: 'layer' })
    // Centre on centre.
    expect(snap({ x: 172, y: 400, w: 50, h: 50 }, c).x).toBe(175)
  })

  it('snap to the safe margin, guides and the layout grid', () => {
    expect(snap({ x: 52, y: 300, w: 100, h: 100 }, ctx([], { margin: 50 })).x).toBe(50)
    expect(snap({ x: 300, y: 697, w: 100, h: 100 }, ctx([], { guides: [{ axis: 'y', at: 800 }] })).y).toBe(700)
    const grid = { columns: 4, rows: 0, gutter: 20, margin: 50 }
    const [first, second] = gridTracks(1000, 4, 20, 50)
    expect(first).toEqual([50, 260])
    expect(second).toEqual([280, 490])
    expect(snap({ x: 283, y: 300, w: 100, h: 100 }, ctx([], { grid })).x).toBe(280)
    expect(snap({ x: 283, y: 300, w: 100, h: 100 }, ctx([], { grid: { ...grid, hidden: true } })).x).toBe(283)
  })

  it('keep the same spacing as the gap that’s already there, and show both distances', () => {
    const c = ctx([{ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 0, w: 100, h: 100 }])
    const s = snap({ x: 397, y: 0, w: 100, h: 100 }, c)
    expect(s.x).toBe(400)
    expect(s.gaps).toEqual(expect.arrayContaining([
      { axis: 'x', from: 300, to: 400, at: 50 },
      { axis: 'x', from: 100, to: 200, at: 50 },
    ]))
  })

  it('centre between two neighbours', () => {
    const c = ctx([{ x: 0, y: 500, w: 100, h: 100 }, { x: 600, y: 500, w: 100, h: 100 }])
    const s = snap({ x: 263, y: 520, w: 180, h: 40 }, c)
    expect(s.x).toBe(260)
    expect(s.gaps.map((g) => g.to - g.from)).toEqual([160, 160])
  })

  it('don’t snap when nothing is close', () => {
    expect(snap({ x: 333, y: 377, w: 50, h: 50 }, ctx([{ x: 0, y: 0, w: 100, h: 100 }]))).toMatchObject({ x: 333, y: 377, lines: [], gaps: [] })
  })

  it('snap a logo’s clear space onto other things', () => {
    const logo = { x: 0, y: 0, w: 200, h: 80, rotation: 0 }
    const zone = clearZone(logo, 0.5)
    expect(zone).toEqual({ x: -40, y: -40, w: 280, h: 160 })
    // Text lines up just outside a logo's clear space.
    const c = ctx([], { zones: [{ x: 500, y: 500, w: 280, h: 160 }] })
    expect(snap({ x: 503, y: 300, w: 100, h: 100 }, c).x).toBe(500)
    // A moving logo keeps its clear space from a layer's edge.
    const other = ctx([{ x: 0, y: 0, w: 300, h: 1000 }])
    const s = snapBox({ x: 338, y: 400, w: 200, h: 80 }, snapTargets(other), other, 6, { x: [-40, 240] })
    expect(s.x).toBe(340)
  })

  it('snap a resized edge and find the lines a box lines up with', () => {
    const t = snapTargets(ctx([{ x: 600, y: 0, w: 100, h: 100 }]))
    expect(snapEdge(597, 'x', t, 6)).toBe(600)
    expect(snapEdge(580, 'x', t, 6)).toBe(580)
    expect(alignedLines({ x: 0, y: 0, w: 500, h: 50 }, t, board).map((l) => [l.axis, l.at])).toEqual(expect.arrayContaining([['x', 0], ['x', 500], ['y', 0]]))
  })
})

describe('measuring', () => {
  it('shows the distance between two things side by side', () => {
    expect(measure({ x: 0, y: 0, w: 100, h: 100 }, { x: 150, y: 50, w: 100, h: 100 })).toEqual([{ axis: 'x', from: 100, to: 150, at: 75 }])
  })
  it('shows the distance to each side of what it’s inside', () => {
    const d = measure({ x: 100, y: 200, w: 100, h: 100 }, { x: 0, y: 0, w: 1000, h: 1000 })
    expect(d.map((g) => g.to - g.from)).toEqual([100, 800, 200, 700])
  })
})

describe('resizing and rotating', () => {
  it('resizes from any handle, keeping the other side still', () => {
    expect(resizeBox({ x: 100, y: 100, w: 200, h: 100 }, 'se', 20, 10)).toEqual({ x: 100, y: 100, w: 220, h: 110 })
    expect(resizeBox({ x: 100, y: 100, w: 200, h: 100 }, 'nw', 20, 10)).toEqual({ x: 120, y: 110, w: 180, h: 90 })
  })
  it('keeps proportions and resizes from the centre', () => {
    expect(resizeBox({ x: 0, y: 0, w: 200, h: 100 }, 'se', 100, 0, { keepRatio: true })).toEqual({ x: 0, y: 0, w: 300, h: 150 })
    expect(resizeBox({ x: 100, y: 100, w: 200, h: 100 }, 'e', 10, 0, { fromCentre: true })).toEqual({ x: 90, y: 100, w: 220, h: 100 })
  })
  it('resizes a rotated layer along its own sides', () => {
    // Turned 90°: its right-hand handle points down, so dragging down makes it wider.
    const b = resizeBox({ x: 0, y: 0, w: 200, h: 100, rotation: 90 }, 'e', 0, 40)
    expect(b.w).toBeCloseTo(240)
    expect(b.h).toBeCloseTo(100)
    // The other end stays put: its top on screen (the layer's left edge) doesn't move.
    const topBefore = boundsOf({ x: 0, y: 0, w: 200, rotation: 90 }, 100).y
    expect(boundsOf({ ...b, rotation: 90 }, b.h).y).toBeCloseTo(topBefore)
  })
  it('resizes a flipped layer from the side you grab', () => {
    // Mirrored: the “east” handle sits on the left, so dragging it left makes it wider.
    expect(resizeBox({ x: 100, y: 0, w: 200, h: 100, flipX: true }, 'e', -30, 0)).toEqual({ x: 70, y: 0, w: 230, h: 100 })
  })
  it('never makes something smaller than 8 px', () => {
    expect(resizeBox({ x: 0, y: 0, w: 100, h: 100 }, 'e', -500, 0).w).toBe(8)
  })
  it('turns in 15° steps with Shift, and settles on right angles', () => {
    expect(snapAngle(37, 15)).toBe(30)
    expect(snapAngle(92)).toBe(90)
    expect(snapAngle(47)).toBe(47)
    expect(snapAngle(-190)).toBe(170)
    expect(snapAngle(-181)).toBe(180)
    expect(snapAngle(359)).toBe(0)
  })
  it('knows the box around a rotated layer', () => {
    const b = boundsOf({ x: 0, y: 0, w: 200, rotation: 90 }, 100)
    expect([b.x, b.y, b.w, b.h].map((n) => Math.round(n))).toEqual([50, -50, 100, 200])
  })
  it('keeps ruler numbers readable at any zoom', () => {
    expect(rulerStep(1)).toBe(100)
    expect(rulerStep(0.1)).toBe(1000)
    expect(rulerStep(4)).toBe(20)
  })
})

describe('arranging', () => {
  const items = [
    { id: 'a', box: { x: 0, y: 0, w: 100, h: 50 } },
    { id: 'b', box: { x: 300, y: 100, w: 50, h: 50 } },
    { id: 'c', box: { x: 700, y: 40, w: 100, h: 100 } },
  ]
  it('lines things up with each other, or one thing with the artboard', () => {
    expect(align(items, 'left').b).toEqual({ dx: -300, dy: 0 })
    expect(align(items, 'bottom').a).toEqual({ dx: 0, dy: 100 })
    expect(align([items[0]], 'hcenter', { x: 0, y: 0, w: 1000, h: 1000 }).a).toEqual({ dx: 450, dy: 0 })
  })
  it('spaces three or more evenly, keeping the first and last', () => {
    const d = distribute(items, 'x')
    // 800 wide, 250 of boxes: two gaps of 275.
    expect(d.a.dx).toBe(0)
    expect(d.b.dx).toBe(375 - 300)
    expect(d.c.dx).toBe(0)
    expect(distribute(items.slice(0, 2), 'x')).toEqual({})
  })
  it('changes the stacking order, keeping the chosen layers’ own order', () => {
    const l = ['1', '2', '3', '4'].map((id) => ({ id }))
    const ids = (x: { id: string }[]) => x.map((i) => i.id).join('')
    expect(ids(reorder(l, ['1', '2'], 'front'))).toBe('3412')
    expect(ids(reorder(l, ['3'], 'back'))).toBe('3124')
    expect(ids(reorder(l, ['1', '2'], 'forward'))).toBe('3124')
    expect(ids(reorder(l, ['3', '4'], 'backward'))).toBe('1342')
    expect(ids(dropNextTo(l, '1', '3', true))).toBe('2314')
    expect(ids(dropNextTo(l, '4', '2', false))).toBe('1423')
  })
  it('pastes onto another size in the same place relative to the edges', () => {
    const logo = { id: 'x', type: 'shape', name: 'Box', shape: 'rect', fill: '#000', radius: 0, x: 880, y: 20, w: 100, h: 100 } as Layer
    const [same] = placePasted([logo], { width: 1000, height: 1000 }, { width: 1000, height: 1000 }, () => 'n')
    expect(same).toMatchObject({ id: 'n', x: 880, y: 20 })
    const [wide] = placePasted([logo], { width: 1000, height: 1000 }, { width: 2000, height: 1000 }, () => 'n')
    expect(wide.x).toBe(1810)
  })
  it('keeps guides and the grid when the artboard changes size', () => {
    const a: Artboard = { id: 'a', name: 'Post', width: 1000, height: 1000, background: '#fff', layers: [], guides: [{ id: 'g', axis: 'x', at: 500 }], grid: { columns: 6, rows: 0, gutter: 20, margin: 50 } }
    const b = resizeArtboard(a, { name: 'Story', width: 1080, height: 1920 })
    expect(b.guides).toEqual([{ id: 'g', axis: 'x', at: 540 }])
    expect(b.grid).toMatchObject({ columns: 6, gutter: 22, margin: 54 })
    expect(safeMargin(b)).toBe(54)
  })
})
