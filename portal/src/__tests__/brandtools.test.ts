/** Logo pack naming, tidy file names and the logo health check. */
import { describe, expect, it } from 'vitest'
import { packName, PACK } from '../features/logoPack'
import { healthScore, logoHealth, tidyFileName } from '../features/fileHealth'
import type { StudioFile } from '../data/types'

const file = (name: string, over: Partial<StudioFile> = {}): StudioFile =>
  ({
    id: name, projectId: 'p', name, category: 'Logos', status: 'Approved', published: true, comments: [], roundsUsed: 0,
    versions: [{ id: 'v', src: 'data:,', mime: 'image/svg+xml', size: 1024, createdAt: '' }], createdAt: '', ...over,
  }) as StudioFile

describe('tidy file names', () => {
  it('lowercases, removes spaces and keeps the extension', () => {
    expect(tidyFileName('RAY Logo Primary (FINAL v2).svg')).toBe('ray-logo-primary-final-v2.svg')
    expect(tidyFileName('Logo.PNG')).toBe('logo.png')
  })

  it('turns Danish letters into something every server can serve', () => {
    expect(tidyFileName('Blå Håndværker Æblegård.pdf')).toBe('blaa-haandvaerker-aeblegaard.pdf')
  })

  it('puts the client in front, but never twice', () => {
    expect(tidyFileName('logo-primary.svg', { prefix: 'RAY' })).toBe('ray_logo-primary.svg')
    expect(tidyFileName('ray-logo.svg', { prefix: 'ray' })).toBe('ray-logo.svg')
  })

  it('copes with odd input', () => {
    expect(tidyFileName('....')).toBe('file')
    expect(tidyFileName('no-extension')).toBe('no-extension')
  })
})

describe('logo health', () => {
  it('passes a well-prepared set', () => {
    const checks = logoHealth([file('ray_logo-primary.svg'), file('ray_logo-white.png')])
    expect(healthScore(checks)).toEqual({ passed: 7, total: 7 })
  })

  it('says what is missing, in plain words', () => {
    const checks = logoHealth([file('RAY Logo.jpg', { published: false })])
    const failed = checks.filter((c) => !c.ok).map((c) => c.id)
    expect(failed).toContain('vector')
    expect(failed).toContain('png')
    expect(failed).toContain('transparent')
    expect(failed).toContain('names')
    expect(failed).toContain('published')
    expect(checks.find((c) => c.id === 'vector')?.hint).toMatch(/scaled for print/)
  })

  it('flags files too big to email', () => {
    const huge = file('ray_logo.png', { versions: [{ id: 'v', src: 'data:,', mime: 'image/png', size: 9 * 1024 * 1024, createdAt: '' }] })
    expect(logoHealth([huge]).find((c) => c.id === 'size')?.ok).toBe(false)
  })

  it('has nothing to say about an empty set except what’s missing', () => {
    expect(logoHealth([]).every((c) => c.id === 'transparent' || c.id === 'names' || c.id === 'size' ? true : !c.ok)).toBe(true)
  })
})

describe('the logo pack', () => {
  it('names the folder after the client', () => {
    expect(packName('RAY')).toBe('ray-logo-pack')
    expect(packName('Kaffe & Co ApS')).toBe('kaffe-co-aps-logo-pack')
    expect(packName('')).toBe('logo-logo-pack')
  })

  it('covers the sizes people ask for', () => {
    const names = PACK.map((p) => p.name)
    expect(names).toContain('logo@2x.png')
    expect(names).toContain('favicon-32.png')
    expect(names).toContain('favicon-180-apple-touch.png')
    expect(names).toContain('social-avatar-1000.png')
    expect(PACK.filter((p) => p.height).every((p) => p.height === p.width)).toBe(true)
  })
})

describe('tidying is settled', () => {
  it('leaves an already tidy name exactly as it is', () => {
    for (const name of ['ray_logo-primary.svg', 'logo.png', 'kaffe-co_icon-512.png']) {
      expect(tidyFileName(name)).toBe(name)
      expect(tidyFileName(tidyFileName(name))).toBe(name)
    }
  })
})
