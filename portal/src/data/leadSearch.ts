/**
 * Turning "håndværkere i Aarhus" into a question the company register can answer.
 *
 * Trades map to industry codes (DB07). The query also matches the industry *text*, so a trade
 * still works when a company is registered under a code we didn't list.
 */

export type LeadFilters = {
  /** What's left of the phrase after the trade and place were understood. */
  text?: string
  trade?: string
  /** DB07 code prefixes, e.g. '43' for building work. */
  codes?: string[]
  /** Words to match against the industry text. */
  words?: string[]
  city?: string
  postal?: string
  employeesMin?: number
  employeesMax?: number
  activeOnly?: boolean
}

/** Danish trades, the words people actually type, and their industry codes. */
export const TRADES: { id: string; label: string; words: string[]; codes: string[] }[] = [
  { id: 'craft', label: 'Håndværkere', words: ['håndværker', 'håndværk'], codes: ['41', '43'] },
  { id: 'carpenter', label: 'Tømrere', words: ['tømrer', 'snedker'], codes: ['4332'] },
  { id: 'mason', label: 'Murere', words: ['murer'], codes: ['4399'] },
  { id: 'electrician', label: 'Elektrikere', words: ['elektriker', 'el-installat'], codes: ['4321'] },
  { id: 'plumber', label: 'VVS', words: ['vvs', 'blikkenslager'], codes: ['4322'] },
  { id: 'painter', label: 'Malere', words: ['maler'], codes: ['4334'] },
  { id: 'builder', label: 'Byggefirmaer', words: ['byggefirma', 'entreprenør', 'bygge'], codes: ['41', '42'] },
  { id: 'gardener', label: 'Anlægsgartnere', words: ['anlægsgartner', 'gartner'], codes: ['8130', '0130'] },
  { id: 'cleaning', label: 'Rengøring', words: ['rengøring', 'rengørings'], codes: ['8121', '8122'] },
  { id: 'restaurant', label: 'Restauranter', words: ['restaurant', 'spisested'], codes: ['5610'] },
  { id: 'cafe', label: 'Caféer', words: ['café', 'cafe', 'kaffebar'], codes: ['5610', '5630'] },
  { id: 'bakery', label: 'Bagerier', words: ['bager', 'bageri'], codes: ['1071', '4724'] },
  { id: 'hairdresser', label: 'Frisører', words: ['frisør', 'frisor'], codes: ['9602'] },
  { id: 'fitness', label: 'Fitness', words: ['fitness', 'træningscenter'], codes: ['9313'] },
  { id: 'dentist', label: 'Tandlæger', words: ['tandlæge'], codes: ['8623'] },
  { id: 'physio', label: 'Fysioterapeuter', words: ['fysioterapeut', 'kiropraktor'], codes: ['8690'] },
  { id: 'lawyer', label: 'Advokater', words: ['advokat'], codes: ['6910'] },
  { id: 'accountant', label: 'Revisorer', words: ['revisor', 'bogholder'], codes: ['6920'] },
  { id: 'architect', label: 'Arkitekter', words: ['arkitekt'], codes: ['7111'] },
  { id: 'engineer', label: 'Ingeniører', words: ['ingeniør', 'rådgivende ingeniør'], codes: ['7112'] },
  { id: 'estate', label: 'Ejendomsmæglere', words: ['ejendomsmægler', 'mægler'], codes: ['6831'] },
  { id: 'agency', label: 'Reklamebureauer', words: ['reklamebureau', 'bureau', 'marketing'], codes: ['7311'] },
  { id: 'it', label: 'IT-virksomheder', words: ['it-virksomhed', 'softwarehus', 'webbureau', 'programmering'], codes: ['6201', '6202'] },
  { id: 'shop', label: 'Butikker', words: ['butik', 'detailhandel'], codes: ['47'] },
  { id: 'webshop', label: 'Webshops', words: ['webshop', 'netbutik'], codes: ['4791'] },
  { id: 'transport', label: 'Vognmænd', words: ['vognmand', 'transportfirma', 'fragt'], codes: ['4941'] },
  { id: 'brewery', label: 'Bryggerier', words: ['bryggeri', 'bryghus'], codes: ['1105'] },
  { id: 'hotel', label: 'Hoteller', words: ['hotel', 'kro'], codes: ['5510'] },
  { id: 'clinic', label: 'Klinikker', words: ['klinik', 'lægehus'], codes: ['8621', '8622'] },
  { id: 'school', label: 'Skoler', words: ['skole', 'efterskole', 'højskole'], codes: ['85'] },
]

/**
 * Industry codes as people write them: "4332", "43.32.00", "branche 4332", or several at once.
 * A bare four-digit number is a postcode unless it's written as a code, so "8000" still means Aarhus.
 */
export function readCodes(phrase: string): { codes: string[]; rest: string } {
  const codes: string[] = []
  let rest = phrase

  // "branche 4332", "branchekode 43.32.00", "kode 4332 4321", "db07 4332"
  const labelled = rest.match(/\b(?:branchekoder?|branche|kode[r]?|db07)\s*:?\s*([\d.,\s]+)/i)
  if (labelled) {
    for (const m of labelled[1].matchAll(/\d[\d.]*/g)) codes.push(m[0])
    rest = rest.replace(labelled[0], ' ')
  }
  // Dotted or six-digit codes speak for themselves: 43.32.00, 433200
  for (const m of [...rest.matchAll(/\b\d{2}\.\d{2}(?:\.\d{2})?\b|\b\d{6}\b/g)]) {
    codes.push(m[0])
    rest = rest.replace(m[0], ' ')
  }
  return { codes: [...new Set(codes.map((c) => c.replace(/\D/g, '')).filter(Boolean))], rest }
}

const STOP = new Set(['i', 'in', 'på', 'pa', 'fra', 'omkring', 'nær', 'ved', 'med', 'og', 'alle', 'find', 'søg', 'search'])

/** "over 10 ansatte", "5-20 ansatte", "under 50 medarbejdere" */
function readEmployees(phrase: string) {
  const range = phrase.match(/(\d+)\s*[-–]\s*(\d+)\s*(ansatte|medarbejdere|employees)/)
  if (range) return { employeesMin: Number(range[1]), employeesMax: Number(range[2]), matched: range[0] }
  const over = phrase.match(/(over|mindst|flere end|more than)\s*(\d+)\s*(ansatte|medarbejdere|employees)/)
  if (over) return { employeesMin: Number(over[2]), matched: over[0] }
  const under = phrase.match(/(under|højst|færre end|less than)\s*(\d+)\s*(ansatte|medarbejdere|employees)/)
  if (under) return { employeesMax: Number(under[2]), matched: under[0] }
  return null
}

/**
 * Reads a plain sentence: a trade, a place, and optionally a size.
 * Anything it doesn't recognise is kept as free text, so nothing is silently dropped.
 */
export function parseLeadQuery(phrase: string): LeadFilters {
  const clean = phrase.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!clean) return { activeOnly: true }
  let rest = clean

  const employees = readEmployees(rest)
  if (employees) rest = rest.replace(employees.matched, ' ')

  const typedCodes = readCodes(rest)
  rest = typedCodes.rest

  // A four to five digit number is a postcode; anything longer is a CVR number and handled elsewhere.
  const postal = rest.match(/\b(\d{4})\b/)
  if (postal) rest = rest.replace(postal[0], ' ')

  const trade = typedCodes.codes.length ? undefined : TRADES.find((t) => t.words.some((w) => rest.includes(w)))
  if (trade) {
    // Drop whole words, not just the stem: "restauranter" must not leave an "er" behind, and a
    // two-word trade like "rådgivende ingeniør" must not leave "rådgivende" either.
    const stems = trade.words.flatMap((w) => w.split(' '))
    rest = rest
      .split(/\s+/)
      .filter((tok) => !stems.some((stem) => tok.includes(stem)))
      .join(' ')
  }

  // The place is what follows "i" / "på"; otherwise whatever words are left.
  const after = rest.match(/\b(?:i|på|in)\s+([a-zæøå][a-zæøå\s-]*)$/)
  let city: string | undefined
  if (after) {
    // "odense med" – trailing joining words belong to the next phrase, not to the town.
    const words = after[1].trim().split(/\s+/)
    while (words.length && STOP.has(words[words.length - 1])) words.pop()
    city = words.join(' ') || undefined
    rest = rest.replace(after[0], ' ')
  }
  const leftover = rest
    .split(/[^a-zæøå0-9&.-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .join(' ')
    .trim()
  if (!city && !trade && leftover) city = undefined

  return {
    trade: trade?.id,
    codes: typedCodes.codes.length ? typedCodes.codes : trade?.codes,
    words: trade ? [trade.label.toLowerCase()] : undefined,
    city: city || undefined,
    postal: postal?.[1],
    text: leftover || undefined,
    employeesMin: employees?.employeesMin,
    employeesMax: employees?.employeesMax,
    activeOnly: true,
  }
}

/** The Elasticsearch body the register expects. */
export function buildCvrQuery(f: LeadFilters, size = 25, from = 0) {
  const meta = 'Vrvirksomhed.virksomhedMetadata'
  const must: unknown[] = []
  const should: unknown[] = []
  const filter: unknown[] = []

  if (f.codes?.length || f.words?.length) {
    for (const code of f.codes ?? []) should.push({ prefix: { [`${meta}.nyesteHovedbranche.branchekode`]: code } })
    for (const word of f.words ?? []) should.push({ match: { [`${meta}.nyesteHovedbranche.branchetekst`]: word } })
  }
  if (f.text) must.push({ multi_match: { query: f.text, fields: [`${meta}.nyesteNavn.navn^3`, `${meta}.nyesteHovedbranche.branchetekst`] } })
  if (f.city) must.push({ match_phrase_prefix: { [`${meta}.nyesteBeliggenhedsadresse.postdistrikt`]: f.city } })
  if (f.postal) filter.push({ term: { [`${meta}.nyesteBeliggenhedsadresse.postnummer`]: Number(f.postal) } })
  if (f.activeOnly !== false) filter.push({ term: { 'Vrvirksomhed.virksomhedMetadata.sammensatStatus': 'NORMAL' } })

  return {
    size,
    from,
    query: {
      bool: {
        ...(must.length ? { must } : {}),
        ...(should.length ? { should, minimum_should_match: 1 } : {}),
        ...(filter.length ? { filter } : {}),
      },
    },
  }
}

/** The register reports staff as a band ("5-9"); this reads it back as numbers. */
export function employeeRange(band?: string): { min: number; max: number } | null {
  if (!band) return null
  const nums = band.match(/\d+/g)?.map(Number) ?? []
  if (!nums.length) return null
  return { min: nums[0], max: nums[1] ?? nums[0] }
}

/** Size filtering happens on the way out: the register stores a band, not a number. */
export function matchesSize(band: string | undefined, f: Pick<LeadFilters, 'employeesMin' | 'employeesMax'>) {
  if (f.employeesMin === undefined && f.employeesMax === undefined) return true
  const range = employeeRange(band)
  if (!range) return false
  if (f.employeesMin !== undefined && range.max < f.employeesMin) return false
  if (f.employeesMax !== undefined && range.min > f.employeesMax) return false
  return true
}
