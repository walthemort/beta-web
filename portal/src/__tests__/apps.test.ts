/** The apps: print and motion in the Content Machine, mockups, signatures, Presenter, Pages, the Brand Assistant and the Brand Audit. */
import { describe, expect, it } from 'vitest'
import { seed } from '../data/seed'
import type { Artboard, AuditResult, Layer, State, TextLayer } from '../data/types'
import { brandOf } from '../features/content/model'
import { BLEED_MM, PRINT_FORMATS, mmToPx, preflight, printArtboard, printBoxes, toCmyk } from '../features/content/print'
import { STILL, autoAnimate, durationOf, frameAt, isAnimated } from '../features/content/motion'
import { squareToQuad, coverCrop } from '../features/apps/mockups/scenes'
import { signatureHtml, signatureText } from '../features/apps/signatures'
import { LAYOUTS, SLIDE, contactLine, fitLogo, palette } from '../features/apps/presenter/office'
import { PAGE_TEMPLATES, freeSlug, href, newBlock, pageColours, signupsCsv, slugify, timeLeft, validEmail } from '../features/apps/pages/blocks'
import { brandGuide, checkRequest, textPairs } from '../features/apps/assistant/context'
import { checkUrl, coloursIn, compareWithHub, fontsIn, isPublicAddress, normaliseColour, readHtml, runChecks } from '../features/apps/audit/extract'
import { contrast } from '../features/color'

const fresh = (): State => JSON.parse(JSON.stringify(seed))
const forma = () => fresh().projects.find((p) => p.id === 'p-forma')!
const text = (over: Partial<TextLayer> = {}): TextLayer => ({ id: 't', type: 'text', name: 'T', text: 'Hello', x: 100, y: 100, w: 400, h: 60, font: 'Inter Tight', size: 40, weight: 400, colour: '#111111', align: 'left', lineHeight: 1.2, letterSpacing: 0, ...over })
const board = (layers: Layer[] = [], over: Partial<Artboard> = {}): Artboard => ({ id: 'a', name: 'Post', width: 1080, height: 1080, background: '#ffffff', layers, ...over })

describe('Print', () => {
  it('make a business card at 300 dpi with 3 mm bleed on every side', () => {
    const a = printArtboard(board([text()]), 'business-card', true)
    expect(a.dpi).toBe(300)
    expect(a.width).toBe(mmToPx(85 + BLEED_MM * 2, 300))
    expect(a.height).toBe(mmToPx(55 + BLEED_MM * 2, 300))
    expect(a.width).toBeGreaterThan(a.height)
    const boxes = printBoxes(a)
    expect(boxes.trim.x).toBe(mmToPx(3, 300))
    expect(boxes.safe.x).toBeGreaterThan(boxes.trim.x)
  })

  it('turn a format upright or on its side', () => {
    const up = printArtboard(board(), 'flyer-a5', false)
    const side = printArtboard(board(), 'flyer-a5', true)
    expect(up.height).toBeGreaterThan(up.width)
    expect(side.width).toBe(up.height)
  })

  it('flag text near the cut, tiny type and low-resolution pictures', () => {
    const a = printArtboard(board(), 'business-card', true)
    const near = text({ id: 'near', x: 2, y: 2, size: 60 })
    const tiny = text({ id: 'tiny', x: 200, y: 200, size: 10 })
    const photo: Layer = { id: 'img', type: 'image', name: 'Photo', src: 'x', x: 0, y: 0, w: a.width, h: a.height, fit: 'cover' } as Layer
    const issues = preflight({ ...a, layers: [near, tiny, photo] }, { heightOf: (l) => l.h, natural: { img: { w: 300, h: 200 } } })
    const on = (id: string) => issues.filter((i) => i.layerId === id).map((i) => i.message)
    expect(on('near').some((m) => /close to the cut/.test(m))).toBe(true)
    expect(on('tiny').some((m) => /Under 6 pt/.test(m))).toBe(true)
    expect(on('img').some((m) => /Low resolution/.test(m))).toBe(true)
  })

  it('give rough CMYK for screen colours', () => {
    expect(toCmyk('#000000')).toEqual({ c: 0, m: 0, y: 0, k: 100 })
    expect(toCmyk('#ffffff')).toEqual({ c: 0, m: 0, y: 0, k: 0 })
    expect(PRINT_FORMATS.every((f) => f.dpi >= 100)).toBe(true)
  })
})

describe('Motion', () => {
  it('bring a layer in over its duration, then keep it still', () => {
    const anim = { in: 'rise' as const, delay: 0.5, duration: 1 }
    expect(frameAt(anim, 0, 80).opacity).toBe(0)
    expect(frameAt(anim, 0, 80).ty).toBe(80)
    const mid = frameAt(anim, 1, 80)
    expect(mid.opacity).toBeGreaterThan(0)
    expect(mid.opacity).toBeLessThan(1)
    expect(frameAt(anim, 2, 80)).toEqual(STILL)
    expect(frameAt(undefined, 1, 80)).toEqual(STILL)
  })

  it('type text letter by letter and loop after coming in', () => {
    expect(frameAt({ in: 'type', delay: 0, duration: 2 }, 1, 50).chars).toBeCloseTo(0.5)
    const spin = frameAt({ in: 'none', delay: 0, duration: 1, loop: 'spin' }, 4, 50)
    expect(spin.rotate).toBeCloseTo(180)
  })

  it('animate a whole artboard: words one after another, the logo last', () => {
    const logo: Layer = { id: 'logo', type: 'logo', name: 'Logo', fileId: 'auto', x: 0, y: 900, w: 200, h: 80 }
    const a = autoAnimate(board([text({ id: 'b', y: 500 }), text({ id: 'a', y: 100 }), logo]))
    const at = (id: string) => a.layers.find((l) => l.id === id)!.anim!
    expect(at('a').delay).toBeLessThan(at('b').delay)
    expect(at('logo').delay).toBeGreaterThan(at('b').delay)
    expect(isAnimated(a)).toBe(true)
    expect(durationOf(a)).toBeGreaterThanOrEqual(at('logo').delay + at('logo').duration)
  })
})

describe('Mockups', () => {
  it('map the corners of the picture onto the four corners of a surface', () => {
    const quad: [number, number][] = [[10, 20], [110, 30], [100, 140], [5, 120]]
    const map = squareToQuad(quad)
    const close = (p: [number, number], q: [number, number]) => {
      expect(p[0]).toBeCloseTo(q[0], 6)
      expect(p[1]).toBeCloseTo(q[1], 6)
    }
    close(map(0, 0), quad[0])
    close(map(1, 0), quad[1])
    close(map(1, 1), quad[2])
    close(map(0, 1), quad[3])
  })

  it('crop a picture to fill a shape, like object-fit: cover', () => {
    const c = coverCrop({ width: 2000, height: 1000 } as never, 1)
    expect(c).toEqual({ x: 500, y: 0, w: 1000, h: 1000 })
  })
})

describe('Email signatures', () => {
  const brand = brandOf(forma())
  const person = { id: 'p', name: 'Ada <Lovelace>', title: 'Designer', email: 'ada@forma.dk', phone: '+45 12 34 56 78' }

  it('are tables with inline styles, safe from what people type', () => {
    for (const layout of ['simple', 'logo', 'bar'] as const) {
      const html = signatureHtml({ layout, people: [person], website: 'forma.dk', logoUrl: 'javascript:alert(1)' }, person, brand)
      expect(html.startsWith('<table')).toBe(true)
      expect(html).not.toContain('<Lovelace>')
      expect(html).toContain('Ada &lt;Lovelace&gt;')
      expect(html).not.toContain('javascript:')
      expect(html).toContain('tel:+4512345678')
      expect(html).toContain('https://forma.dk')
    }
  })

  it('have a plain-text version', () => {
    expect(signatureText({ layout: 'simple', people: [], website: 'https://www.forma.dk/' }, person, brand).split('\n')[0]).toBe('Ada <Lovelace>')
  })
})

describe('Presenter', () => {
  const brand = brandOf(forma())

  it('put readable text on every layout', () => {
    for (const l of LAYOUTS) {
      const c = palette(brand, l.bg)
      expect(contrast(c.ink, c.bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c.heading, c.bg)).toBeGreaterThanOrEqual(3)
      for (const b of [l.title, ...(l.body ?? []), l.picture, l.logo].filter(Boolean) as { x: number; y: number; w: number; h: number }[]) {
        expect(b.x).toBeGreaterThanOrEqual(0)
        expect(b.x + b.w).toBeLessThanOrEqual(SLIDE.w + 0.001)
        expect(b.y + b.h).toBeLessThanOrEqual(SLIDE.h + 0.001)
      }
    }
  })

  it('fit a logo inside its box, keeping its shape and its side', () => {
    const box = { x: 1, y: 1, w: 4, h: 1, align: 'right' as const }
    const wide = fitLogo(box, 8)
    expect(wide.w).toBe(4)
    expect(wide.h).toBeCloseTo(0.5)
    const tall = fitLogo(box, 1)
    expect(tall).toMatchObject({ w: 1, h: 1, x: 4 })
    expect(fitLogo({ ...box, align: 'center' }, 1).x).toBe(2.5)
  })

  it('write one contact line, skipping what’s empty', () => {
    expect(contactLine({ company: 'Forma', address: 'Vej 1', email: ' ', website: 'forma.dk' })).toBe('Vej 1   ·   forma.dk')
  })
})

describe('Pages', () => {
  it('make addresses from names, and never the same twice', () => {
    expect(slugify('Bageriet Ærø – Åbning!')).toBe('bageriet-aeroe-aabning')
    expect(slugify('***')).toBe('page')
    expect(freeSlug('Forma', ['forma', 'forma-2'])).toBe('forma-3')
    expect(freeSlug('Forma', ['forma'], 'forma')).toBe('forma')
  })

  it('have templates made of real blocks', () => {
    for (const t of PAGE_TEMPLATES) for (const type of t.blocks) expect(newBlock(type).type).toBe(type)
    expect(newBlock('hero', (s) => `DA:${s}`)).toMatchObject({ heading: 'DA:A headline that says it' })
  })

  it('use brand colours that read on each theme', () => {
    const brand = brandOf(forma())
    for (const theme of ['light', 'dark', 'brand'] as const) {
      const c = pageColours(brand, theme)
      expect(contrast(c.ink, c.bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(3)
    }
  })

  it('count down, check emails, fix links and export sign-ups', () => {
    const now = Date.parse('2026-10-01T10:00:00Z')
    expect(timeLeft('2026-10-02T11:01:05Z', now)).toEqual({ done: false, days: 1, hours: 1, minutes: 1, seconds: 5 })
    expect(timeLeft('2026-09-01T00:00:00Z', now).done).toBe(true)
    expect(validEmail('a@b.dk')).toBe(true)
    expect(validEmail('a@b')).toBe(false)
    expect(href('forma.dk')).toBe('https://forma.dk')
    expect(href('mailto:a@b.dk')).toBe('mailto:a@b.dk')
    expect(signupsCsv({ signups: [{ email: 'a@b.dk', at: '2026-10-01T10:00:00Z' }] } as never)).toBe('email,date\na@b.dk,2026-10-01')
  })
})

describe('Brand Assistant', () => {
  it('writes the hub out as a guide – colours, which ones carry text, fonts, logo rules', () => {
    const s = fresh()
    const guide = brandGuide(s, forma())
    expect(guide).toContain('#353D26')
    expect(guide).toMatch(/text on/i)
    expect(guide).toContain('Clear space')
    expect(guide).toContain(s.studio.name)
    expect(textPairs([{ name: 'White', hex: '#ffffff', extra: true }, { name: 'Black', hex: '#000000', extra: true }])).toEqual([])
  })

  it('only sends conversations the server accepts', () => {
    expect(checkRequest({ context: 'guide', messages: [{ role: 'user', content: 'Hi' }], lang: 'en' })).toBeNull()
    expect(checkRequest({ context: '', messages: [{ role: 'user', content: 'Hi' }] })).not.toBeNull()
    expect(checkRequest({ context: 'g', messages: [{ role: 'assistant', content: 'Hi' }] })).not.toBeNull()
    expect(checkRequest({ context: 'g', messages: [{ role: 'user', content: 'x'.repeat(2001) }] })).not.toBeNull()
    expect(checkRequest({ context: 'g', messages: [{ role: 'system' as never, content: 'x' }] })).not.toBeNull()
  })
})

describe('Brand Audit', () => {
  it('never reaches private addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '224.0.0.1'])
      expect(isPublicAddress(ip), ip).toBe(false)
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:2800:220:1::'])
      expect(isPublicAddress(ip), ip).toBe(true)
    for (const bad of ['http://localhost', 'http://127.0.0.1/', 'http://[::1]/', 'https://a:b@example.com', 'http://example.com:8080', 'file:///etc/passwd', 'http://printer.local', 'intranet'])
      expect(typeof checkUrl(bad), bad).toBe('string')
    expect((checkUrl('example.com') as URL).toString()).toBe('https://example.com/')
  })

  it('read colours, fonts and the basics from a page', () => {
    const html = `<!doctype html><html lang="da"><head><title>Bageriet – brød fra Nørrebro</title>
      <meta name="description" content="Surdejsbrød og kager, bagt hver morgen på Nørrebro siden 2012. Kom forbi!">
      <meta property="og:image" content="/share.jpg"><meta name="viewport" content="width=device-width">
      <link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/site.css">
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&amp;family=Inter&display=swap" rel="stylesheet">
      <style>body{color:#353d26;background:#F6F5EF;font-family:"Fraunces", Georgia, serif} .b{background:rgb(216,231,144)} .c{color:#353D27}</style></head>
      <body><h1>Hej</h1><img src="a.jpg" alt="Brød"><img src="b.jpg"></body></html>`
    const r = readHtml(html, 'https://bageriet.dk/')
    expect(r.title).toBe('Bageriet – brød fra Nørrebro')
    expect(r.image).toBe('https://bageriet.dk/share.jpg')
    expect(r.favicon).toBe('https://bageriet.dk/favicon.png')
    expect(r.lang).toBe('da')
    expect(r.viewport).toBe(true)
    expect(r.images).toEqual({ count: 2, missingAlt: 1 })
    expect(r.stylesheets).toEqual(['https://bageriet.dk/site.css'])
    const colours = coloursIn(r.inlineCss)
    expect(colours[0]).toEqual({ hex: '#353d26', count: 2 }) // two near-identical greens count as one
    expect(colours.map((c) => c.hex)).toContain('#d8e790')
    expect(fontsIn(r.inlineCss, html)).toEqual(['Fraunces', 'Inter'])
    expect(normaliseColour('rgba(0,0,0,0)')).toBeNull()
    expect(normaliseColour('#abc')).toBe('#aabbcc')
  })

  it('score the basics and compare with a brand hub', () => {
    const base: Omit<AuditResult, 'checks' | 'score'> = {
      url: 'https://x.dk/', finalUrl: 'https://x.dk/', title: 'A good title for a site', description: 'x'.repeat(120), image: 'https://x.dk/s.jpg', favicon: 'https://x.dk/f.png', lang: 'da', viewport: true,
      https: true, loadMs: 800, colours: [{ hex: '#353d26', count: 9 }, { hex: '#ff0000', count: 2 }, { hex: '#ffffff', count: 20 }], fonts: ['Instrument Serif', 'Comic Sans MS'], images: { count: 4, missingAlt: 0 }, headings: { h1: 1, h2: 3 },
    }
    const good = runChecks(base)
    expect(good.score).toBe(100)
    const bad = runChecks({ ...base, https: false, viewport: false, headings: { h1: 3, h2: 0 } })
    expect(bad.score).toBeLessThan(80)
    expect(bad.checks.find((c) => c.id === 'h1')).toMatchObject({ ok: false, vars: { n: 3 } })
    const cmp = compareWithHub({ ...base, ...good }, forma().hub)
    expect(cmp.colours.find((c) => c.hex === '#353d26')?.match?.name).toBe('Forest')
    expect(cmp.colours.find((c) => c.hex === '#ff0000')?.match).toBeUndefined()
    expect(cmp.fonts.find((f) => f.name === 'Instrument Serif')?.used).toBe(true)
    expect(cmp.otherFonts).toEqual(['Comic Sans MS'])
    expect(cmp.onBrand).toBeGreaterThan(0)
    expect(cmp.onBrand).toBeLessThan(100)
  })
})

describe('Brand Audit on the server', () => {
  it('refuses to connect when a name resolves to a private address', async () => {
    const { safeLookup } = await import('../../api/audit')
    const err = await new Promise<Error | null>((resolve) => safeLookup('localhost', {}, (e) => resolve(e)))
    expect(err?.message).toMatch(/public internet/)
  })
})
