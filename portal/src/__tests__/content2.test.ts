/** Content Machine, round two: AI requests, looks, sheets, platforms, remix, PDF, fitting, groups, pins, rebranding. */
import { describe, expect, it } from 'vitest'
import { seed } from '../data/seed'
import type { Artboard, Layer, State, TextLayer } from '../data/types'
import { contrast } from '../features/color'
import { AiInputError, aiSize, brandPrompt, copyLength, expandPlan, imageJob, nearestPreset } from '../features/content/ai'
import { adjustFilter, duotoneTables, emphasisParts, gradientVector, maskClip, shapePoints, textStyles } from '../features/content/look'
import { guessMapping, looksLikeHeaders, mergeRow, parseTable } from '../features/content/merge'
import { hiddenByPlatform, platformsFor, zonesOf } from '../features/content/platforms'
import { remixes, schemes } from '../features/content/remix'
import { jpegPdf } from '../features/content/pdf'
import { containRect, fitPatch } from '../features/content/fit'
import { cloneLayers, groupLayers, rotateLayers, scaleLayers, tidyGroups, ungroup, withGroups } from '../features/content/arrange'
import { SIZES, applyTemplate, backgroundAt, brandOf, checkArtboard, newArtboard, newDesign, rebrand, resizeArtboard, textColour } from '../features/content/model'

const fresh = (): State => JSON.parse(JSON.stringify(seed))
const project = (id: string) => fresh().projects.find((p) => p.id === id)!
const ray = () => project('p-ray')
const text = (over: Partial<TextLayer> = {}): TextLayer => ({ id: 't', type: 'text', name: 'T', text: 'Hello', x: 100, y: 100, w: 400, h: 60, font: 'Inter Tight', size: 40, weight: 400, colour: '#111111', align: 'left', lineHeight: 1.2, letterSpacing: 0, ...over })
const board = (layers: Layer[] = [], over: Partial<Artboard> = {}): Artboard => ({ id: 'a', name: 'Post', width: 1000, height: 1000, background: '#ffffff', layers, ...over })
const ids = (a: Artboard) => a.layers.map((l) => l.id)
let n = 0
const newId = () => `n${++n}`

describe('AI image requests', () => {
  it('ask for about a megapixel in the artboard’s shape, in multiples of 32', () => {
    const s = aiSize(1080, 1920)
    expect(s.width % 32).toBe(0)
    expect(s.height % 32).toBe(0)
    expect(s.width / s.height).toBeCloseTo(1080 / 1920, 1)
    expect((s.width * s.height) / 1e6).toBeGreaterThan(0.85)
    expect(nearestPreset(1080, 1920)).toBe('portrait_16_9')
    expect(nearestPreset(1200, 627)).toBe('landscape_16_9')
    expect(nearestPreset(1080, 1080)).toBe('square_hd')
  })

  it('add the brand to the prompt, and keep text and logos out', () => {
    const p = brandPrompt('A barista pouring milk', 'photo', { colours: ['#1a4dff', 'not a colour'], imagery: 'Warm daylight, real people' })
    expect(p).toContain('A barista pouring milk')
    expect(p).toContain('Warm daylight, real people')
    expect(p).toContain('#1a4dff')
    expect(p).not.toContain('not a colour')
    expect(p).toMatch(/No text/)
  })

  it('pick the model for the job', () => {
    const photo = imageJob({ action: 'create', prompt: 'x', kind: 'photo', width: 1080, height: 1080 })
    expect(photo.model).toBe('fal-ai/flux-2-pro')
    expect(photo.input).toMatchObject({ sync_mode: true, output_format: 'jpeg' })
    const drawn = imageJob({ action: 'create', prompt: 'x', kind: 'illustration', width: 1080, height: 1080, brand: { colours: ['#ff0000'] } })
    expect(drawn.model).toBe('fal-ai/recraft/v3/text-to-image')
    expect(drawn.input).toMatchObject({ style: 'digital_illustration', colors: [{ r: 255, g: 0, b: 0 }], image_size: 'square_hd' })
    expect(imageJob({ action: 'create', prompt: 'x', kind: 'graphic', width: 1, height: 1 }).input.style).toBe('vector_illustration')
    // A background needs no description.
    expect(imageJob({ action: 'create', prompt: '', kind: 'texture', width: 1080, height: 1920 }).model).toBe('fal-ai/recraft/v3/text-to-image')
    expect(() => imageJob({ action: 'create', prompt: ' ', kind: 'photo', width: 1, height: 1 })).toThrow(AiInputError)
  })

  it('check images and sizes for the photo tools', () => {
    const img = 'data:image/png;base64,AAAA'
    expect(imageJob({ action: 'cutout', image: img }).model).toBe('fal-ai/birefnet/v2')
    expect(imageJob({ action: 'edit', prompt: 'make it evening', image: img }).input).toMatchObject({ image_urls: [img] })
    expect(() => imageJob({ action: 'cutout', image: 'javascript:alert(1)' })).toThrow(AiInputError)
    expect(() => imageJob({ action: 'cutout', image: 'data:image/png;base64,' + 'A'.repeat(6_000_001) })).toThrow(/too big/)
    const plan = expandPlan({ width: 1080, height: 1920 }, { x: 0, y: 600, w: 1080, h: 720 }, 960)
    expect(plan.canvas).toEqual([540, 960])
    expect(plan.place).toEqual({ x: 0, y: 300, w: 540, h: 360 })
    expect(imageJob({ action: 'expand', image: img, canvas: plan.canvas, place: plan.place }).input).toMatchObject({ canvas_size: [540, 960], original_image_location: [0, 300], original_image_size: [540, 360] })
    expect(() => imageJob({ action: 'expand', image: img, canvas: [10, 10], place: plan.place })).toThrow(AiInputError)
  })

  it('ask for words that fit the text layer', () => {
    expect(copyLength('headline', { w: 800, size: 80 })).toBeLessThan(copyLength('body', { w: 800, size: 30 }))
  })
})

describe('looks', () => {
  it('splits *starred* words out of text', () => {
    expect(emphasisParts('Save *20%* this week')).toEqual([{ text: 'Save ', em: false }, { text: '20%', em: true }, { text: ' this week', em: false }])
    expect(emphasisParts('5 * 3 = 15')).toEqual([{ text: '5 * 3 = 15', em: false }])
  })
  it('makes text styles from the brand’s type scale, sized for the artboard', () => {
    const s = textStyles({ base: 16, ratio: 1.25 }, { width: 1080, height: 1080 }, { heading: 'Serif', body: 'Sans' })
    const size = (id: string) => s.find((x) => x.id === id)!.size
    expect(size('heading')).toBeGreaterThan(size('subheading'))
    expect(size('subheading')).toBeGreaterThan(size('body'))
    expect(size('body')).toBe(37)
    expect(s.find((x) => x.id === 'heading')!.font).toBe('Serif')
    expect(s.find((x) => x.id === 'body')!.font).toBe('Sans')
  })
  it('turns adjustments, shapes, masks and duotones into what the browser draws', () => {
    expect(adjustFilter({ brightness: 10, contrast: 0, saturation: -100, warmth: 0, blur: 0 })).toBe('brightness(1.1) saturate(0)')
    expect(adjustFilter(undefined)).toBeUndefined()
    expect(shapePoints('star', 5)!.split(' ')).toHaveLength(10)
    expect(shapePoints('rect')).toBeNull()
    expect(maskClip('circle')).toContain('ellipse')
    expect(duotoneTables('#000000', '#ffffff')).toEqual({ r: '0 1', g: '0 1', b: '0 1' })
    expect(gradientVector(90)).toMatchObject({ x1: 0, x2: 1 })
  })
})

describe('many posts from a sheet', () => {
  it('reads pasted rows from spreadsheets and CSV files', () => {
    expect(parseTable('Headline\tText\nHi\tThere\n')).toEqual([['Headline', 'Text'], ['Hi', 'There']])
    expect(parseTable('a;b\n"x; y";z')).toEqual([['a', 'b'], ['x; y', 'z']])
    expect(parseTable('a,b\n"line one\nline two","say ""hi"""')).toEqual([['a', 'b'], ['line one\nline two', 'say "hi"']])
    expect(looksLikeHeaders([['Headline', 'Text'], ['x', 'y']])).toBe(true)
  })
  it('fills each row into the design – by {{placeholder}}, by layer name, or top to bottom', () => {
    const a = board([
      text({ id: 'h', name: 'Headline', text: 'Title', y: 100 }),
      text({ id: 'd', name: 'Body', text: 'Open from {{Date}}', y: 300 }),
    ])
    const headers = ['Headline', 'Date']
    const map = guessMapping(a, headers)
    expect(map).toEqual({ h: 0, d: 1 })
    const out = mergeRow(a, headers, ['Autumn menu', '1 October'], map, newId)
    expect(out.layers.map((l) => (l as TextLayer).text)).toEqual(['Autumn menu', 'Open from 1 October'])
    expect(out.id).not.toBe(a.id)
    expect(new Set(ids(out)).size).toBe(2)
    // No names match: the columns go in from the top.
    const plain = board([text({ id: 'x', name: 'A', y: 500 }), text({ id: 'y', name: 'B', y: 50 })])
    expect(guessMapping(plain, ['One', 'Two'])).toEqual({ y: 0, x: 1 })
  })
})

describe('where it’s posted', () => {
  it('shows the app’s buttons and moves words out from under them', () => {
    const story = board([text({ id: 'top', y: 20, x: 100 })], { width: 1080, height: 1920, platform: 'ig-story' })
    expect(zonesOf(story)).toHaveLength(2)
    const hidden = hiddenByPlatform(story, (l) => ({ x: l.x, y: l.y, w: l.w, h: 60 }))
    expect(hidden[0].layerId).toBe('top')
    expect(hidden[0].to.y).toBeGreaterThan(1920 * 0.13)
    const issues = checkArtboard(story, brandOf(ray()), { clearSpace: 0.5, minWidthPx: 10 })
    expect(issues.some((i) => i.kind === 'platform')).toBe(true)
    expect(platformsFor({ width: 1080, height: 1920 }).map((p) => p.id)).toContain('tiktok')
    // A square post in a 3:4 profile grid loses its sides.
    const square = board([], { platform: 'ig-grid' })
    expect(zonesOf(square).map((z) => Math.round(z.w))).toEqual([125, 125])
  })
})

describe('remix', () => {
  it('gives other layouts and brand colours that keep every layer and stay readable', () => {
    const brand = brandOf(ray())
    expect(schemes(brand).length).toBeGreaterThan(1)
    for (const template of ['announcement', 'quote'] as const) {
      const a = applyTemplate(newArtboard(SIZES[0], brand), brand, template)
      const list = remixes(a, brand)
      expect(list.length).toBeGreaterThan(3)
      for (const r of list) {
        expect(new Set(ids(r.artboard))).toEqual(new Set(ids(a)))
        for (const l of r.artboard.layers) {
          expect(l.x, `${r.name} ${l.name}`).toBeGreaterThanOrEqual(0)
          expect(l.x + l.w, `${r.name} ${l.name}`).toBeLessThanOrEqual(a.width + 1)
          if (l.type === 'text') {
            const bg = backgroundAt(r.artboard, l, l.x + l.w / 2, l.y + 20)
            expect(contrast(textColour(l, r.artboard, brand), bg), `${r.name}`).toBeGreaterThanOrEqual(3)
          }
        }
      }
    }
  })
  it('moves a photo around too', () => {
    const brand = brandOf(ray())
    const a = newDesign(ray(), 'ig-post', 'photo', { src: 'x', ratio: 1.5 }).artboards[0]
    const names = remixes(a, brand).map((r) => r.name)
    expect(names).toContain('Round photo')
    expect(names).toContain('Photo above · words below')
  })
})

describe('PDF export', () => {
  it('makes one page per artboard at its real print size', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const blob = jpegPdf([{ jpeg, width: 2480, height: 3508, dpi: 300 }, { jpeg, width: 1080, height: 1080 }])
    return blob.text().then((t) => {
      expect(t.startsWith('%PDF-1.4')).toBe(true)
      expect(t).toContain('/Count 2')
      expect(t).toContain('/MediaBox [0 0 595.2 841.92]')
      expect(t).toContain('/MediaBox [0 0 810 810]')
      expect(t.trim().endsWith('%%EOF')).toBe(true)
    })
  })
})

describe('fit box to content', () => {
  it('finds a fitted picture inside its box', () => {
    expect(containRect(400, 200, 1)).toEqual({ x: 100, y: 0, w: 200, h: 200 })
    expect(containRect(200, 400, 2)).toEqual({ x: 0, y: 150, w: 200, h: 100 })
  })
  it('shrinks the box and keeps what’s drawn exactly where it was', () => {
    const logo = { id: 'l', type: 'logo', name: 'Logo', fileId: 'auto', x: 100, y: 100, w: 400, h: 200 } as Layer
    expect(fitPatch(logo, 200, { x: 100, y: 0, w: 200, h: 200 })).toMatchObject({ x: 200, y: 100, w: 201, h: 200 })
    // Turned 90°, the drawn part's offset turns with it.
    const turned = { ...logo, rotation: 90 } as Layer
    const p = fitPatch(turned, 200, { x: 0, y: 0, w: 400, h: 100 })!
    expect(Math.abs(p.x! + p.w! / 2 - 350)).toBeLessThanOrEqual(1)
    // Text keeps its top.
    const t = text({ x: 100, y: 300, w: 800 })
    expect(fitPatch(t, 60, { x: 0, y: 0, w: 300, h: 60 })).toMatchObject({ x: 100, y: 300, w: 301 })
    expect(fitPatch(t, 60, { x: 0, y: 0, w: 800, h: 60 })).toBeNull()
  })
})

describe('groups and several layers', () => {
  const layers = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, type: 'shape', name: id, shape: 'rect', fill: '#000', radius: 0, x: i * 100, y: 0, w: 50, h: 50 }) as Layer)
  it('groups layers next to each other, and a pick takes the whole group', () => {
    const g = groupLayers(board(layers), ['a', 'c'], { id: 'g1', name: 'Group 1' })
    expect(ids(g)).toEqual(['b', 'a', 'c', 'd'])
    expect(withGroups(g.layers, ['a'])).toEqual(['a', 'c'])
    expect(ids(ungroup(g, ['g1']))).toEqual(['b', 'a', 'c', 'd'])
    expect(ungroup(g, ['g1']).layers.every((l) => !l.groupId)).toBe(true)
    // Deleting one of two leaves no group.
    const left = tidyGroups({ ...g, layers: g.layers.filter((l) => l.id !== 'a') })
    expect(left.groups).toEqual([])
    expect(left.layers.every((l) => !l.groupId)).toBe(true)
  })
  it('copies a group as a new group', () => {
    const g = groupLayers(board(layers), ['a', 'b'], { id: 'g1', name: 'Pair' })
    const { layers: copies, groups } = cloneLayers(g.layers.filter((l) => l.groupId), g.groups, newId)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ name: 'Pair' })
    expect(copies.every((l) => l.groupId === groups[0].id)).toBe(true)
  })
  it('sizes and turns several layers together', () => {
    const items = [{ layer: layers[0], h: 50 }, { layer: text({ id: 't', x: 100, y: 0, w: 100, size: 20 }), h: 50 }]
    const out = scaleLayers(items, { x: 0, y: 0, w: 200, h: 50 }, { x: 0, y: 0, w: 400, h: 100 })
    expect(out[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 100 })
    expect(out[1]).toMatchObject({ x: 200, size: 40, w: 200 })
    const turned = rotateLayers([{ layer: layers[1], h: 50 }], { x: 25, y: 25 }, 90)
    expect(turned[0]).toMatchObject({ x: 0, y: 100, rotation: 90 })
  })
})

describe('other sizes, auto colour and other brands', () => {
  it('follows each layer’s pin into a new size', () => {
    const logo = { id: 'l', type: 'logo', name: 'Logo', fileId: 'auto', x: 900, y: 900, w: 80, h: 40, pin: { x: 'end', y: 'end' } } as Layer
    const bar = { id: 'b', type: 'shape', name: 'Bar', shape: 'rect', fill: '#000', radius: 0, x: 100, y: 0, w: 800, h: 50, pin: { x: 'stretch', y: 'start' } } as Layer
    const wide = resizeArtboard(board([logo, bar]), { name: 'Wide', width: 2000, height: 1000 })
    const [l2, b2] = wide.layers
    expect(2000 - (l2.x + l2.w)).toBe(20)
    expect(b2.x).toBe(100)
    expect(2000 - (b2.x + b2.w)).toBe(100)
  })
  it('picks a text colour that reads when set to automatic', () => {
    const brand = brandOf(ray())
    const on = (bg: string) => textColour(text({ colour: 'auto' }), board([], { background: bg }), brand)
    expect(contrast(on('#111111'), '#111111')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(on('#f5f4f0'), '#f5f4f0')).toBeGreaterThanOrEqual(4.5)
  })
  it('moves a design onto another client’s brand, colour for colour and font for font', () => {
    const from = brandOf(ray())
    const to = brandOf(project('p-nord'))
    const a = applyTemplate(newArtboard(SIZES[0], from), from, 'announcement')
    const b = rebrand(a, from, to)
    expect(b.background).toBe(to.primary)
    const heading = b.layers.find((l) => l.type === 'text') as TextLayer
    expect(heading.font).toBe(to.heading)
    expect(ids(b)).toEqual(ids(a))
  })
  it('knows which sizes are social and which are for print', () => {
    expect(SIZES.filter((s) => s.social).length).toBeGreaterThanOrEqual(6)
    expect(SIZES.find((s) => s.id === 'a4')!.dpi).toBe(300)
  })
})
