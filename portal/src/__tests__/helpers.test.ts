/** Colour maths, Figma links and brand exports. */
import { describe, expect, it } from 'vitest'
import { accessibleShade, clashes, contrast, darkVariant, formats, hexToRgb, mix, printShift, rating, readableOn, rgbToHex, rgbToHsl, simulate } from '../features/color'
import { figmaEmbed, parseFigma } from '../features/decks'
import { aseFile, cssVariables } from '../features/brandExport'
import { calendarEvents, toIcs, type CalEvent } from '../data/calendar'
import { stripLayout } from '../features/palette'
import { seed } from '../data/seed'

describe('colour', () => {
  it('converts between hex and RGB, including short hex', () => {
    expect(hexToRgb('#1a4dff')).toEqual([26, 77, 255])
    expect(hexToRgb('#fff')).toEqual([255, 255, 255])
    expect(rgbToHex([26, 77, 255])).toBe('#1A4DFF')
  })

  it('calculates WCAG contrast (black on white is 21:1)', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5)
  })

  it('rates contrast like WCAG 2', () => {
    expect(rating(7.2).label).toBe('AAA')
    expect(rating(4.6).label).toBe('AA')
    expect(rating(3.1)).toMatchObject({ label: 'AA Large', ok: 'large' })
    expect(rating(2).ok).toBe('no')
  })

  it('picks readable text colours', () => {
    expect(readableOn('#1a4dff')).toBe('#ffffff')
    expect(readableOn('#f6f5ef')).toBe('#111111')
  })

  it('mixes colours and lists every format', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(formats('#1A4DFF').map((f) => f.label)).toEqual(['HEX', 'RGB', 'HSL', 'CMYK'])
  })
})

describe('Figma links', () => {
  it('recognise Slides, prototypes and design files', () => {
    expect(parseFigma('https://www.figma.com/deck/abc/Name')?.kind).toBe('Figma Slides')
    expect(parseFigma('https://www.figma.com/proto/abc/Name')?.kind).toBe('Prototype')
    expect(parseFigma('https://www.figma.com/design/abc/Name')?.kind).toBe('Design file')
  })

  it('reject anything that isn’t Figma', () => {
    expect(parseFigma('https://example.com/deck/abc')).toBeNull()
    expect(parseFigma('https://www.figma.com/community/file/1')).toBeNull()
    expect(parseFigma('not a url')).toBeNull()
  })

  it('use the embed.figma.com endpoint and keep the frame (node-id)', () => {
    const url = figmaEmbed('https://www.figma.com/deck/abc/Name?node-id=1-2')
    expect(url).toMatch(/^https:\/\/embed\.figma\.com\/deck\/abc\/Name\?/)
    expect(url).toContain('node-id=1-2')
    expect(url).toContain('embed-host=aftryk')
  })

  it('map old /file/ links to /design/', () => {
    expect(figmaEmbed('https://www.figma.com/file/abc/Name')).toContain('embed.figma.com/design/abc')
  })
})

describe('brand exports', () => {
  const colours = [
    { id: '1', name: 'Cobalt', hex: '#1a4dff' },
    { id: '2', name: 'Off White', hex: '#f2f1ec' },
  ]

  it('writes a valid Adobe swatch (.ase) file', async () => {
    const buf = new Uint8Array(await aseFile(colours, 'Test').arrayBuffer())
    const view = new DataView(buf.buffer)
    expect(String.fromCharCode(...buf.slice(0, 4))).toBe('ASEF')
    expect(view.getUint16(4)).toBe(1) // version 1.0
    expect(view.getUint32(8)).toBe(colours.length + 2) // group start + colours + group end
  })

  it('writes CSS variables with safe names', () => {
    expect(cssVariables(colours)).toBe(':root {\n  --cobalt: #1A4DFF;\n  --off-white: #F2F1EC;\n}\n')
  })
})

describe('calendar export (.ics)', () => {
  const ev = (over: Partial<CalEvent> = {}): CalEvent => ({ id: 'task-1', date: '2026-10-31', label: 'Logo, round 2; final', to: '/app/projects/p-ray', kind: 'task', projectName: 'RAY', ...over })
  const ics = (events: CalEvent[]) => toIcs(events, { name: 'BETA_01', origin: 'https://aftryk.app', stamp: new Date('2026-09-22T10:00:00Z') })

  it('is a valid calendar with CRLF line endings', () => {
    const out = ics([ev()])
    expect(out.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(out.replace(/\r\n/g, '')).not.toMatch(/\n/)
  })

  it('makes all-day events that end the next day, also across months', () => {
    const out = ics([ev()])
    expect(out).toContain('DTSTART;VALUE=DATE:20261031')
    expect(out).toContain('DTEND;VALUE=DATE:20261101')
  })

  it('escapes commas and semicolons, and keeps a stable id per item', () => {
    const out = ics([ev()])
    expect(out).toContain('SUMMARY:Logo\\, round 2\\; final (RAY)')
    expect(out).toContain('UID:task-1@aftryk')
  })

  it('folds long lines at 75 bytes (Danish letters count as 2)', () => {
    const out = ics([ev({ label: 'Æ'.repeat(80) })])
    for (const line of out.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(out.replace(/\r\n /g, '')).toContain('Æ'.repeat(80))
  })

  it('collects deadlines, open tasks, reviews and issued invoices – not done tasks or drafts', () => {
    const events = calendarEvents(seed)
    const doneTask = seed.projects.flatMap((p) => p.tasks).find((t) => t.done && t.due)
    if (doneTask) expect(events.some((e) => e.id.endsWith(`-${doneTask.id}`) && e.label === doneTask.title)).toBe(false)
    expect(events.filter((e) => e.kind === 'invoice').every((e) => seed.invoices.find((i) => `invoice-${i.id}` === e.id)?.status === 'Issued')).toBe(true)
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length)
  })
})

describe('colour strip layout', () => {
  const widths = (l: { w: number }[]) => l.map((b) => +b.w.toFixed(2))

  it('gives every colour the same width at rest', () => {
    expect(widths(stripLayout(4))).toEqual([25, 25, 25, 25])
    expect(widths(stripLayout(3))).toEqual([33.33, 33.33, 33.33])
    expect(stripLayout(4).map((b) => +b.x.toFixed(2))).toEqual([0, 25, 50, 75])
  })

  it('opens the one you point at and shares the rest evenly', () => {
    const l = stripLayout(4, 2)
    expect(widths(l)).toEqual([15, 15, 55, 15])
    expect(l.reduce((n, b) => n + b.w, 0)).toBeCloseTo(100, 6)
    expect(l[2].x).toBeCloseTo(l[1].x + l[1].w, 6)
  })

  it('leaves one or two colours alone when there is nothing to gain', () => {
    expect(widths(stripLayout(1, 0))).toEqual([100])
    expect(widths(stripLayout(2, 0))).toEqual([55, 45])
  })
})

describe('making a colour readable', () => {
  it('leaves a colour alone when it already passes', () => {
    const fixed = accessibleShade('#111111', '#ffffff')
    expect(fixed).toMatchObject({ hex: '#111111', steps: 0 })
  })

  it('moves lightness as little as it can, and reaches AA', () => {
    const fixed = accessibleShade('#FFD23F', '#ffffff')!
    expect(fixed.ratio).toBeGreaterThanOrEqual(4.5)
    expect(contrast(fixed.hex, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    // Yellow on white has to get much darker, so it moved down.
    expect(fixed.steps).toBeLessThan(0)
    expect(rgbToHsl(hexToRgb(fixed.hex))[0]).toBeCloseTo(rgbToHsl(hexToRgb('#FFD23F'))[0], 0)
  })

  it('can aim for AAA', () => {
    expect(accessibleShade('#1a4dff', '#ffffff', 7)!.ratio).toBeGreaterThanOrEqual(7)
  })

  it('gives up honestly when nothing passes', () => {
    expect(accessibleShade('#808080', '#808080', 21)).toBeNull()
  })
})

describe('colour blindness', () => {
  it('leaves colours alone for normal vision', () => {
    expect(simulate('#1A4DFF', 'normal')).toBe('#1A4DFF')
  })

  it('pulls red and green together for the common kinds', () => {
    const red = '#D33A2C'
    const green = '#2FA84F'
    expect(clashes(red, green, 'normal')).toBe(false)
    expect(simulate(red, 'protanopia')).not.toBe(red)
    expect(simulate(green, 'deuteranopia')).not.toBe(green)
  })

  it('turns everything to grey when asked', () => {
    const [r, g, b] = hexToRgb(simulate('#1A4DFF', 'grayscale'))
    expect(r).toBe(g)
    expect(g).toBe(b)
  })
})

describe('dark mode and print', () => {
  it('lifts a brand colour until it reads on a dark surface', () => {
    const dark = darkVariant('#1a4dff', '#111110')
    expect(contrast(dark, '#111110')).toBeGreaterThanOrEqual(4.5)
    expect(rgbToHsl(hexToRgb(dark))[0]).toBeCloseTo(rgbToHsl(hexToRgb('#1a4dff'))[0], 0)
  })

  it('warns about screen colours that print badly, and stays quiet about safe ones', () => {
    expect(printShift('#00FF66').warn).toBe(true)
    expect(printShift('#7A7A70').warn).toBe(false)
    expect(printShift('#111111').distance).toBeLessThan(20)
  })
})
