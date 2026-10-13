/** The Danish studio app: every text has a translation, placeholders work, dates follow the language. */
import { afterEach, describe, expect, it } from 'vitest'
import { hasTranslation, setActiveLang, translate } from '../data/i18n'
import { formatDate, formatHours, timeAgo } from '../data/store'

afterEach(() => setActiveLang('en'))

/** Symbols and brand/technical words that are the same in Danish. */
const SAME = new Set(['AA', 'AAA', 'Aa', 'Aa Bb Cc', 'CNAME', 'Figma', 'mm', 'px', 'px ·', 'rem'])

/** Every source file except the tests, as text. */
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../__tests__/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('Danish translations', () => {
  it('cover every text the app translates', () => {
    const missing = new Set<string>()
    for (const [file, src] of Object.entries(sources)) {
      // t('…'), tr('…'), translate('…') – and translateTo(lang, '…') for emails and documents.
      const calls = [...src.matchAll(/\b(?:t|tr|translate)\('((?:[^'\\]|\\.)*)'/g), ...src.matchAll(/\btranslateTo\([^,()]+,\s*'((?:[^'\\]|\\.)*)'/g)]
      for (const m of calls) {
        const key = m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\\\/g, '\\')
        if (!SAME.has(key) && !hasTranslation('da', key)) missing.add(`${key}   (${file})`)
      }
    }
    expect([...missing]).toEqual([])
  })

  it('fill in placeholders after translating', () => {
    setActiveLang('da')
    expect(translate('{name} deleted', { name: 'RAY' })).toBe('RAY slettet')
    expect(translate('Stage {n} of {total} · {name}', { n: 4, total: 6, name: 'Design' })).toBe('Fase 4 af 6 · Design')
  })

  it('fall back to English for anything unknown', () => {
    setActiveLang('da')
    expect(translate('Some brand-new text')).toBe('Some brand-new text')
  })

  it('format dates, hours and “time ago” in the language on screen', () => {
    const iso = '2026-10-08T12:00:00Z'
    expect(formatDate(iso)).toBe('8 Oct')
    setActiveLang('da')
    expect(formatDate(iso)).toBe('8. okt.')
    expect(formatHours(2.5)).toBe('2,5 t')
    expect(timeAgo(new Date().toISOString())).toBe('lige nu')
  })
})
