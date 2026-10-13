/** Content Machine: layouts made from the brand, logos that read, snapping and resizing. */
import { describe, expect, it } from 'vitest'
import { seed } from '../data/seed'
import type { Artboard, Layer, State, TextLayer } from '../data/types'
import { SIZES, TEMPLATES, applyTemplate, backgroundAt, brandOf, checkArtboard, chooseLogo, newArtboard, newDesign, newImage as newImageLayer, newLogo, newShape, newText, resizeArtboard } from '../features/content/model'
import { snapBox, snapTargets } from '../features/content/geometry'
import { contrast } from '../features/color'

const fresh = (): State => JSON.parse(JSON.stringify(seed))
const ray = () => fresh().projects.find((p) => p.id === 'p-ray')!
const inside = (a: Artboard, l: Layer) => l.x >= 0 && l.y >= 0 && l.x + l.w <= a.width + 1 && l.y + l.h <= a.height + 1

describe('content machine', () => {
  it('starts every layout on the brand, inside the artboard, in every size', () => {
    const brand = brandOf(ray())
    for (const size of SIZES)
      for (const t of TEMPLATES) {
        const a = applyTemplate(newArtboard(size, brand), brand, t.id, { src: 'x', ratio: 1.5 })
        for (const l of a.layers) expect(inside(a, l), `${t.id} ${size.id} ${l.name}`).toBe(true)
        if (t.id === 'announcement') expect(a.background).toBe(brand.primary)
        const heading = a.layers.find((l) => l.type === 'text')
        if (heading?.type === 'text') expect(brand.fonts).toContain(heading.font)
      }
  })

  it('picks a light logo on dark backgrounds and a dark one on light', () => {
    const logos = [{ id: 'white', tone: 'light' as const }, { id: 'black', tone: 'dark' as const }]
    expect(chooseLogo(logos, '#111111')).toBe('white')
    expect(chooseLogo(logos, '#f5f4f0')).toBe('black')
    expect(chooseLogo([{ id: 'both', tone: 'mixed' }], '#111111')).toBe('both')
    expect(chooseLogo([], '#111111')).toBeUndefined()
  })

  it('looks at the shape under a logo, not just the artboard', () => {
    const brand = brandOf(ray())
    const a = newArtboard(SIZES[0], brand)
    const box = { ...newShape(a, brand), x: 0, y: 800, w: 1080, h: 280, fill: '#111111' }
    const logo = { ...newShape(a, brand), x: 100, y: 900, w: 200, h: 80 }
    const board = { ...a, background: '#ffffff', layers: [box, logo] }
    expect(backgroundAt(board, logo, 200, 940)).toBe('#111111')
    expect(backgroundAt(board, logo, 200, 100)).toBe('#ffffff')
  })

  it('snaps to the centre and edges when close, and not when far', () => {
    const a = newArtboard(SIZES[0], brandOf(ray()))
    const ctx = { board: a, others: [] }
    const t = snapTargets(ctx)
    expect(snapBox({ x: 437, y: 300, w: 200, h: 100 }, t, ctx, 6).x).toBe(440)
    expect(snapBox({ x: 3, y: 300, w: 200, h: 100 }, t, ctx, 6).x).toBe(0)
    expect(snapBox({ x: 300, y: 300, w: 200, h: 100 }, t, ctx, 6)).toMatchObject({ x: 300, y: 300, lines: [] })
  })

  it('makes the same design in another size: full-bleed stretches, corners stay in their corner', () => {
    const d = newDesign(ray(), 'ig-post', 'photo', { src: 'x', ratio: 1.5 })
    const post = d.artboards[0]
    const story = resizeArtboard(post, SIZES.find((s) => s.id === 'story')!)
    expect(story).toMatchObject({ width: 1080, height: 1920 })
    const photo = story.layers.find((l) => l.name === 'Photo')!
    expect(photo).toMatchObject({ x: 0, y: 0, w: 1080, h: 1920 })
    const logoBefore = post.layers.find((l) => l.type === 'logo')!
    const logoAfter = story.layers.find((l) => l.type === 'logo')!
    // Same distance from the bottom edge in both sizes.
    expect(1920 - (logoAfter.y + logoAfter.h)).toBeCloseTo(1080 - (logoBefore.y + logoBefore.h), 0)
    for (const l of story.layers) expect(inside(story, l)).toBe(true)
  })
})

describe('brand checks', () => {
  const rules = { clearSpace: 0.5, minWidthPx: 80 }
  const setup = () => {
    const brand = brandOf(ray())
    return { brand, a: { ...newArtboard(SIZES[0], brand), background: '#ffffff' } }
  }
  const text = (brand: ReturnType<typeof brandOf>, a: Artboard, patch: Partial<TextLayer> = {}): TextLayer => ({ ...newText(a, brand, 'Hello', true), x: 100, y: 400, w: 600, colour: brand.dark, ...patch })

  it('flag unreadable text and offer the brand colour that reads best', () => {
    const { brand, a } = setup()
    const t = text(brand, a, { colour: '#f2f1ec' })
    const issue = checkArtboard({ ...a, layers: [t] }, brand, rules).find((i) => i.kind === 'contrast')!
    expect(issue).toBeTruthy()
    expect(contrast((issue.fix!.patch as Partial<TextLayer>).colour!, '#ffffff')).toBeGreaterThanOrEqual(3)
  })

  it('flag things too close to the edge and move them in', () => {
    const { brand, a } = setup()
    const t = text(brand, a, { x: 10 })
    const issue = checkArtboard({ ...a, layers: [t] }, brand, rules).find((i) => i.kind === 'edge')!
    expect(issue.fix!.patch.x).toBe(54) // 5% of 1080
  })

  it('protect the logo’s clear space and minimum size from the brand hub', () => {
    const { brand, a } = setup()
    const logo = { ...newLogo(a), x: 400, y: 800, w: 60, h: 24, colour: 'auto' }
    const t = text(brand, a, { y: 780, x: 300, w: 400 })
    const kinds = checkArtboard({ ...a, layers: [logo, t] }, brand, rules).filter((i) => i.layerId === logo.id).map((i) => i.kind)
    expect(kinds).toEqual(expect.arrayContaining(['logo-size', 'clearspace']))
  })

  it('flag colours and fonts that aren’t the brand’s – and nothing on a design that follows the rules', () => {
    const { brand, a } = setup()
    const off = text(brand, a, { colour: '#ff00aa', font: 'Comic Sans MS' })
    expect(checkArtboard({ ...a, layers: [off] }, brand, rules).map((i) => i.kind)).toEqual(expect.arrayContaining(['colour', 'font']))
    const d = newDesign(ray(), 'ig-post', 'announcement').artboards[0]
    expect(checkArtboard(d, brand, rules)).toEqual([])
  })
})

describe('generated backgrounds', () => {
  it('are made of the brand’s colours, and the checks read text against them', async () => {
    const { backgroundImage, BACKGROUND_STYLES } = await import('../features/content/backgrounds')
    const brand = brandOf(ray())
    for (const style of BACKGROUND_STYLES) {
      const a = backgroundImage(style.id, brand, 1080, 1080, 42)
      expect(a.src.startsWith('data:image/svg+xml')).toBe(true)
      // Same seed, same picture – that's what makes “Shuffle” and saving predictable.
      expect(backgroundImage(style.id, brand, 1080, 1080, 42).src).toBe(a.src)
    }
    const light = { ...brand, primary: '#f5f4f0', light: '#f5f4f0', dark: '#f5f4f0', accent: '#eeeeee', swatches: ['#f5f4f0', '#eeeeee', '#ffffff', '#000000'] }
    const { src, colour } = backgroundImage('gradient', light, 1080, 1080, 7)
    const a = newArtboard(SIZES[0], brand)
    const bg = { ...newImageLayer(a, src), x: 0, y: 0, w: 1080, h: 1080, generated: { style: 'gradient', seed: 7, colour } }
    const t = { ...newText(a, brand, 'Hello', true), x: 100, y: 400, w: 600, colour: '#ffffff' }
    expect(checkArtboard({ ...a, layers: [bg, t] }, brand, { clearSpace: 0.5, minWidthPx: 80 }).some((i) => i.kind === 'contrast')).toBe(true)
  })
})
