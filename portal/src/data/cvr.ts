/**
 * Company lookup (the CVR register). The studio points this at its own endpoint – never at an
 * API that needs a key, because anything in the browser is public. The key stays on that server.
 */

export type CompanyHit = {
  company: string
  cvr?: string
  address?: string
  email?: string
  phone?: string
  website?: string
  /** Industry ("Reklamebureauer"), for sorting leads by trade. */
  industry?: string
  /** The DB07 code behind that industry, e.g. '433200'. */
  industryCode?: string
  /** Employee band as the register writes it, e.g. "5-9". */
  employees?: string
  /** False when the company is closed down. */
  active?: boolean
}

/* ---------- The CVR register's own shape ---------- */

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj | undefined => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : undefined)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined)

/**
 * A company as the CVR register returns it (Vrvirksomhed). Everything is optional on purpose:
 * the register leaves plenty of fields empty, and we only want the handful a lead needs.
 */
export function fromVrvirksomhed(source: unknown): CompanyHit | null {
  const v = obj(obj(source)?.Vrvirksomhed) ?? obj(source)
  const meta = obj(v?.virksomhedMetadata)
  if (!v || !meta) return null
  const company = str(obj(meta.nyesteNavn)?.navn)
  if (!company) return null

  const a = obj(meta.nyesteBeliggenhedsadresse)
  const house = [str(a?.husnummerFra), str(a?.bogstavFra)].filter(Boolean).join('')
  const street = [str(a?.vejnavn), house].filter(Boolean).join(' ')
  const floor = [str(a?.etage) && `${str(a?.etage)}.`, str(a?.sidedoer)].filter(Boolean).join(' ')
  const town = [str(a?.postnummer), str(a?.postdistrikt)].filter(Boolean).join(' ')
  const address = [[street, floor].filter(Boolean).join(', '), town].filter(Boolean).join('\n') || undefined

  // Phone, email and website all arrive in one list of strings.
  const contacts = Array.isArray(meta.nyesteKontaktoplysninger) ? meta.nyesteKontaktoplysninger.map(str).filter(Boolean) as string[] : []
  const email = contacts.find((c) => c.includes('@'))
  const website = contacts.find((c) => /^(https?:\/\/|www\.)/i.test(c))
  const phone = contacts.find((c) => c !== email && c !== website && /\d{6,}/.test(c.replace(/[\s+]/g, '')))

  const status = str(v.sammensatStatus) ?? str(obj(meta.nyesteStatus)?.kreditoplysningtekst)
  return {
    company,
    cvr: str(v.cvrNummer),
    address,
    email,
    phone,
    website,
    industry: str(obj(meta.nyesteHovedbranche)?.branchetekst),
    industryCode: str(obj(meta.nyesteHovedbranche)?.branchekode),
    employees: str(obj(meta.nyesteAntalAnsatte)?.intervalKodeAntalAnsatte)?.replace(/^ANTAL_/, '').replace(/_/g, '-'),
    active: status ? !/ophørt|opløst|tvangsopl/i.test(status) : undefined,
  }
}

const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return undefined
}

/** Different providers name things differently, so take what we recognise and ignore the rest. */
export function toCompanyHits(data: unknown): CompanyHit[] {
  const rows = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null
      ? (() => {
          const d = data as Record<string, unknown>
          const hits = d.hits as Record<string, unknown> | undefined
          // Elasticsearch: { hits: { hits: [ { _source } ] } }
          if (hits && Array.isArray(hits.hits)) return hits.hits
          return d.results ?? d.hits ?? [data]
        })()
      : []
  const list = Array.isArray(rows) ? rows : []
  return list
    .map((raw): CompanyHit | null => {
      if (typeof raw !== 'object' || raw === null) return null
      const o = raw as Record<string, unknown>
      const src = (typeof o._source === 'object' && o._source !== null ? (o._source as Record<string, unknown>) : o) as Record<string, unknown>
      const fromRegister = fromVrvirksomhed(src)
      if (fromRegister) return fromRegister
      const company = pick(src, 'company', 'name', 'navn', 'virksomhedsnavn')
      if (!company) return null
      const street = pick(src, 'address', 'adresse', 'vejnavn')
      const zip = pick(src, 'zipcode', 'postnummer', 'postnr')
      const city = pick(src, 'city', 'bynavn', 'by')
      return {
        company,
        cvr: pick(src, 'cvr', 'vat', 'cvrNummer', 'cvrnummer'),
        address: [street, [zip, city].filter(Boolean).join(' ')].filter(Boolean).join('\n') || undefined,
        email: pick(src, 'email', 'elektroniskpost'),
        phone: pick(src, 'phone', 'telefon', 'telefonnummer'),
        website: pick(src, 'website', 'hjemmeside', 'url'),
        industry: pick(src, 'industry', 'branchetekst'),
        industryCode: pick(src, 'industryCode', 'branchekode'),
      }
    })
    .filter((x): x is CompanyHit => x !== null)
    .slice(0, 8)
}

/** Aftryk's own lookup endpoint (api/cvr.ts), used unless the studio points somewhere else. */
export const DEFAULT_LOOKUP = '/api/cvr?q={q}'

/** Asks the studio's own lookup endpoint. `{q}` in the URL is replaced with the search text. */
export async function lookupCompany(endpoint: string, query: string, signal?: AbortSignal): Promise<CompanyHit[]> {
  const url = endpoint.includes('{q}') ? endpoint.replace('{q}', encodeURIComponent(query)) : endpoint + encodeURIComponent(query)
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } })
  // In dev (and anywhere without the server function) the app's own HTML comes back instead.
  if (!res.headers.get('content-type')?.includes('json')) throw new Error('Company lookup needs the server – it works once Aftryk is hosted.')
  const body = await res.json().catch(() => null)
  // The server explains itself when it can (not configured, register down…).
  if (!res.ok) {
    const said = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : ''
    throw new Error(said || `Lookup failed (${res.status})`)
  }
  return toCompanyHits(body)
}
