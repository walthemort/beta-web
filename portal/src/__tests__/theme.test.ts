/** A studio's accent has to work on light and dark client pages. */
import { describe, expect, it } from 'vitest'
import { accentColours, SURFACE } from '../data/theme'
import { contrast } from '../features/color'

describe('accent colours', () => {
  it('work out a readable dark-mode twin, even for a black accent', () => {
    const c = accentColours({ accent: '#141414' })
    expect(c.autoDark).toBe(true)
    expect(contrast(c.dark, SURFACE.dark)).toBeGreaterThanOrEqual(4.5)
    // Button text flips to whatever reads on the button.
    expect(c.lightInk).toBe('#ffffff')
    expect(c.darkInk).toBe('#111111')
  })

  it('keep a dark-mode colour the studio chose, and flag it when it is hard to see', () => {
    const c = accentColours({ accent: '#1a4dff', accentDark: '#222222' })
    expect(c.dark).toBe('#222222')
    expect(c.autoDark).toBe(false)
    expect(c.darkRatio).toBeLessThan(3)
  })
})
