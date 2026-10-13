/**
 * Company lookup against the CVR register (system-to-system access from Erhvervsstyrelsen).
 *
 * This runs on the server, never in the browser, because it carries the credentials. Set these in
 * Vercel → Settings → Environment Variables:
 *
 *   VIRK_URL       the search endpoint you were given, e.g. http://distribution.virk.dk/cvr-permanent/_search
 *   VIRK_USER      the username from the welcome mail
 *   VIRK_PASSWORD  the password from the welcome mail
 *
 * The app calls /api/cvr?q=… and gets back a short, tidy list – not the register's raw payload.
 */
import { refuse } from './_guard'
import { fromVrvirksomhed, type CompanyHit } from '../src/data/cvr'
import { buildCvrQuery, matchesSize, parseLeadQuery, type LeadFilters } from '../src/data/leadSearch'

/** One company by name, or a whole list of them for the sales team. */
function query(q: string, url: URL) {
  const size = Math.min(Number(url.searchParams.get('size')) || 8, 100)
  const from = Math.max(Number(url.searchParams.get('from')) || 0, 0)
  const digits = q.replace(/\D/g, '')
  if (digits.length === 8) return { body: { size: 1, query: { term: { 'Vrvirksomhed.cvrNummer': Number(digits) } } }, filters: {} as LeadFilters }

  // "håndværkere i aarhus" – or explicit filters from the lead finder.
  const filters: LeadFilters = url.searchParams.has('city') || url.searchParams.has('codes')
    ? {
        text: url.searchParams.get('text') || undefined,
        codes: url.searchParams.get('codes')?.split(',').filter(Boolean),
        words: url.searchParams.get('words')?.split(',').filter(Boolean),
        city: url.searchParams.get('city') || undefined,
        postal: url.searchParams.get('postal') || undefined,
        employeesMin: Number(url.searchParams.get('employeesMin')) || undefined,
        employeesMax: Number(url.searchParams.get('employeesMax')) || undefined,
        activeOnly: url.searchParams.get('activeOnly') !== 'false',
      }
    : parseLeadQuery(q)
  return { body: buildCvrQuery(filters, size, from), filters }
}

export default async function handler(req: Request): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=60' } })

  const stop = refuse(req, 'cvr', 30)
  if (stop) return stop

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const structured = url.searchParams.has('city') || url.searchParams.has('codes')
  if (q.length < 2 && !structured) return json([])

  const endpoint = process.env.VIRK_URL
  const user = process.env.VIRK_USER
  const password = process.env.VIRK_PASSWORD
  if (!endpoint || !user || !password) return json({ error: 'Company lookup is not configured on the server.' }, 501)

  try {
    const { body: esQuery, filters } = query(q, url)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64'),
        'content-type': 'application/json',
      },
      body: JSON.stringify(esQuery),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return json({ error: `The register answered ${res.status}.` }, 502)
    const data = (await res.json()) as { hits?: { hits?: { _source?: unknown }[] } }
    const hits = (data.hits?.hits ?? [])
      .map((h) => fromVrvirksomhed(h._source))
      .filter((h): h is CompanyHit => h !== null)
      // The register stores staff as a band, so size is filtered here rather than in the query.
      .filter((h) => matchesSize(h.employees, filters))
      // Closed companies are rarely who you want to pitch.
      .sort((a, b) => Number(b.active ?? true) - Number(a.active ?? true))
    return json(hits)
  } catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError' ? 'The register took too long to answer.' : 'Could not reach the register.'
    return json({ error: message }, 502)
  }
}
