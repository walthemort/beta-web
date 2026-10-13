/**
 * The guard on the functions that spend money (Claude, fal.ai, the company register).
 * It has to let Aftryk's own pages through and turn away everything else.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { overLimit, refuse, resetLimits, sameSite } from '../../api/_guard'

const HOST = 'aftryk.app'
const req = (headers: Record<string, string>, url = `https://${HOST}/api/copy`) =>
  new Request(url, { method: 'POST', headers: { host: HOST, ...headers } })

beforeEach(resetLimits)

describe('who is allowed to call', () => {
  it('lets the app through: a POST from its own pages sends a matching Origin', () => {
    expect(sameSite(req({ origin: `https://${HOST}` }))).toBe(true)
  })

  it('lets a studio’s own portal domain through – same host, so same site', () => {
    const custom = new Request('https://clients.studionord.dk/api/assistant', {
      method: 'POST',
      headers: { host: 'clients.studionord.dk', origin: 'https://clients.studionord.dk' },
    })
    expect(sameSite(custom)).toBe(true)
  })

  it('turns away another site', () => {
    expect(sameSite(req({ origin: 'https://not-aftryk.example' }))).toBe(false)
    expect(sameSite(req({ origin: 'nonsense' }))).toBe(false)
  })

  it('turns away a script with no Origin at all – curl, mostly', () => {
    expect(sameSite(req({}))).toBe(false)
  })

  it('judges a GET by Sec-Fetch-Site, which a browser sends and a script does not', () => {
    const get = (headers: Record<string, string>) =>
      new Request(`https://${HOST}/api/cvr?q=ray`, { headers: { host: HOST, ...headers } })
    expect(sameSite(get({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(sameSite(get({ 'sec-fetch-site': 'cross-site' }))).toBe(false)
    expect(sameSite(get({}))).toBe(false)
  })
})

describe('how often', () => {
  const from = (ip: string) => req({ origin: `https://${HOST}`, 'x-forwarded-for': ip })

  it('allows the limit and stops the one after', () => {
    for (let i = 0; i < 3; i++) expect(overLimit(from('1.1.1.1'), 'copy', 3)).toBe(false)
    expect(overLimit(from('1.1.1.1'), 'copy', 3)).toBe(true)
  })

  it('counts each address on its own', () => {
    for (let i = 0; i < 3; i++) overLimit(from('1.1.1.1'), 'copy', 3)
    expect(overLimit(from('2.2.2.2'), 'copy', 3)).toBe(false)
  })

  it('keeps the expensive endpoints in their own bucket', () => {
    for (let i = 0; i < 3; i++) overLimit(from('1.1.1.1'), 'copy', 3)
    expect(overLimit(from('1.1.1.1'), 'image', 3)).toBe(false)
  })

  it('takes the first address when a proxy chain is forwarded', () => {
    const chain = req({ origin: `https://${HOST}`, 'x-forwarded-for': '9.9.9.9, 10.0.0.1' })
    overLimit(chain, 'copy', 1)
    expect(overLimit(from('9.9.9.9'), 'copy', 1)).toBe(true)
  })

  it('forgets an address once its minute is up', () => {
    vi.useFakeTimers()
    try {
      expect(overLimit(from('3.3.3.3'), 'copy', 1)).toBe(false)
      expect(overLimit(from('3.3.3.3'), 'copy', 1)).toBe(true)
      vi.advanceTimersByTime(61_000)
      expect(overLimit(from('3.3.3.3'), 'copy', 1)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('what the caller is told', () => {
  it('says no to another site, with 403', async () => {
    const res = refuse(req({ origin: 'https://not-aftryk.example' }), 'copy')!
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Not allowed from this site' })
  })

  it('says slow down, with 429', async () => {
    const ok = req({ origin: `https://${HOST}`, 'x-forwarded-for': '4.4.4.4' })
    expect(refuse(ok, 'copy', 1)).toBeNull()
    const res = refuse(ok, 'copy', 1)!
    expect(res.status).toBe(429)
  })

  it('gets out of the way when the request is fine', () => {
    expect(refuse(req({ origin: `https://${HOST}` }), 'copy')).toBeNull()
  })
})
