/**
 * Shared guard for the functions that cost money: Claude, fal.ai and the company register all
 * run on the studio's own keys, so a request that didn't come from Aftryk's own pages shouldn't
 * reach them. Files starting with "_" aren't endpoints of their own on Vercel.
 *
 * Two checks, and it's worth being clear about what each is worth:
 *
 *  - sameSite() requires an Origin header that matches the host. Browsers always send Origin on a
 *    POST, so the app is unaffected, and a plain `curl https://…/api/copy` no longer works. An
 *    attacker can still set the header by hand – this stops drive-by use, not a determined one.
 *  - overLimit() caps how often one address may call. Each serverless instance counts on its own,
 *    so the real ceiling is higher than the number here; it turns a runaway loop into a nuisance
 *    rather than a bill.
 *
 * The real fix is a signed session per studio once sign-in is live (docs/BACKEND.md); these two
 * keep the bill sane until then.
 */

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * Did this request come from Aftryk's own pages? A custom portal domain answers yes: same host.
 *
 * A browser sends Origin on every POST, but not on a same-origin GET – so a GET is judged by
 * Sec-Fetch-Site instead, which every current browser sends and a plain script does not.
 */
export function sameSite(req: Request) {
  const origin = req.headers.get('origin')
  if (origin) {
    try {
      if (new URL(origin).host === req.headers.get('host')) return true
    } catch {
      return false
    }
    return false
  }
  return req.headers.get('sec-fetch-site') === 'same-origin'
}

type Window = { count: number; until: number }
const seen = new Map<string, Window>()

/** The caller's address, as far as the platform will say. */
const caller = (req: Request) =>
  (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'

/**
 * True when this address has already had its allowance this minute. `bucket` keeps the expensive
 * endpoints from sharing a count with the cheap ones.
 */
export function overLimit(req: Request, bucket: string, limit = 20, windowMs = 60_000) {
  const key = `${bucket}:${caller(req)}`
  const now = Date.now()
  const win = seen.get(key)
  if (!win || now > win.until) {
    seen.set(key, { count: 1, until: now + windowMs })
    // Old entries would otherwise pile up on a long-lived instance.
    if (seen.size > 5000) for (const [k, v] of seen) if (now > v.until) seen.delete(k)
    return false
  }
  win.count += 1
  return win.count > limit
}

/**
 * The check every paid endpoint starts with. Returns a Response to send back, or null to carry on.
 */
export function refuse(req: Request, bucket: string, limit?: number): Response | null {
  if (!sameSite(req)) return json({ error: 'Not allowed from this site' }, 403)
  if (overLimit(req, bucket, limit)) return json({ error: 'Too many requests – wait a minute and try again' }, 429)
  return null
}

/** For tests: forget everything counted so far. */
export const resetLimits = () => seen.clear()
