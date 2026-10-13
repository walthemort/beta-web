/** Leads, the pipeline, what needs chasing, and reading company data from a lookup service. */
import { describe, expect, it } from 'vitest'
import { seed } from '../data/seed'
import type { Lead, State } from '../data/types'
import { leadStats, lostReasons, nudges, NUDGE_AFTER_DAYS } from '../features/sales'
import { fromVrvirksomhed, toCompanyHits } from '../data/cvr'
import { buildCvrQuery, matchesSize, parseLeadQuery } from '../data/leadSearch'
import { leadsCsv, mergeFilters } from '../features/leadFinder'

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))
const lead = (over: Partial<Lead>): Lead => ({
  id: Math.random().toString(36).slice(2), company: 'Acme', source: 'Referral', stage: 'New',
  createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-01-05T10:00:00Z', ...over,
})
/** Leads only: the sample data ships with a sent proposal that would show up as a nudge. */
const withLeads = (leads: Lead[]): State => ({ ...clone(seed), leads, proposals: [] })

describe('pipeline', () => {
  it('counts only live leads and what they are worth', () => {
    const s = withLeads([
      lead({ stage: 'New', value: 40000 }),
      lead({ stage: 'Proposal sent', value: 60000 }),
      lead({ stage: 'Won', value: 90000, updatedAt: '2026-03-01T10:00:00Z' }),
      lead({ stage: 'Lost', value: 20000 }),
    ])
    const stats = leadStats(s, 2026)
    expect(stats).toMatchObject({ open: 2, pipeline: 100000, wonThisYear: 1, wonValue: 90000, decided: 2 })
    expect(stats.winRate).toBe(0.5)
  })

  it('has no win rate before anything is decided', () => {
    expect(leadStats(withLeads([lead({})])).winRate).toBe(0)
  })

  it('groups the reasons work is lost, most common first', () => {
    const s = withLeads([
      lead({ stage: 'Lost', lostReason: 'Price' }),
      lead({ stage: 'Lost', lostReason: 'Price' }),
      lead({ stage: 'Lost', lostReason: 'Timing' }),
      lead({ stage: 'Won' }),
    ])
    expect(lostReasons(s)).toEqual([{ reason: 'Price', count: 2 }, { reason: 'Timing', count: 1 }])
  })
})

describe('what needs chasing', () => {
  const today = '2026-09-25'

  it('lists next steps that are due, and ignores ones still ahead', () => {
    const s = withLeads([
      lead({ company: 'Due today', nextStep: 'Call', nextStepDue: today }),
      lead({ company: 'Overdue', nextStep: 'Send quote', nextStepDue: '2026-09-20' }),
      lead({ company: 'Later', nextStep: 'Coffee', nextStepDue: '2026-10-10' }),
    ])
    expect(nudges(s, today).map((n) => n.what)).toEqual(['Send quote', 'Call'])
  })

  it('leaves won and lost leads alone', () => {
    const s = withLeads([lead({ stage: 'Won', nextStep: 'Call', nextStepDue: '2026-01-01' })])
    expect(nudges(s, today)).toHaveLength(0)
  })

  it('flags proposals with no answer, but only after a few days', () => {
    const s = clone(seed)
    const sent = new Date(new Date(today).getTime() - (NUDGE_AFTER_DAYS + 3) * 864e5).toISOString()
    s.proposals = s.proposals.map((p, i) => (i === 0 ? { ...p, status: 'Sent' as const, sentAt: sent } : { ...p, status: 'Draft' as const }))
    const found = nudges({ ...s, leads: [] }, today)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ kind: 'proposal', days: NUDGE_AFTER_DAYS + 3 })

    s.proposals = s.proposals.map((p, i) => (i === 0 ? { ...p, sentAt: new Date().toISOString() } : p))
    expect(nudges({ ...s, leads: [] }, today)).toHaveLength(0)
  })
})

describe('company lookup', () => {
  it('reads the common shapes, in Danish or English', () => {
    expect(toCompanyHits([{ name: 'Forma ApS', vat: 12345678, address: 'Vestergade 1', zipcode: '8000', city: 'Aarhus' }])[0]).toEqual({
      company: 'Forma ApS', cvr: '12345678', address: 'Vestergade 1\n8000 Aarhus', email: undefined, phone: undefined, website: undefined,
    })
    expect(toCompanyHits({ results: [{ navn: 'NORD A/S', cvrNummer: '87654321', vejnavn: 'Havnegade 4', postnummer: '5000', bynavn: 'Odense' }] })[0]).toMatchObject({
      company: 'NORD A/S', cvr: '87654321', address: 'Havnegade 4\n5000 Odense',
    })
    expect(toCompanyHits({ hits: [{ _source: { navn: 'RAY', telefon: '12345678' } }] })[0]).toMatchObject({ company: 'RAY', phone: '12345678' })
  })

  it('skips anything without a company name and never returns a huge list', () => {
    expect(toCompanyHits([{ cvr: '1' }, 'nonsense', null])).toEqual([])
    expect(toCompanyHits(Array.from({ length: 30 }, (_, i) => ({ name: `Co ${i}` })))).toHaveLength(8)
    expect(toCompanyHits(null)).toEqual([])
  })
})

describe('the CVR register’s own shape', () => {
  const company = {
    Vrvirksomhed: {
      cvrNummer: 12345678,
      sammensatStatus: 'NORMAL',
      virksomhedMetadata: {
        nyesteNavn: { navn: 'Kaffe & Co ApS' },
        nyesteBeliggenhedsadresse: { vejnavn: 'Vestergade', husnummerFra: 12, bogstavFra: 'B', etage: '2', postnummer: 8000, postdistrikt: 'Aarhus C' },
        nyesteKontaktoplysninger: ['+45 12 34 56 78', 'hej@kaffeco.dk', 'www.kaffeco.dk'],
        nyesteHovedbranche: { branchekode: '561010', branchetekst: 'Restauranter' },
        nyesteAntalAnsatte: { intervalKodeAntalAnsatte: 'ANTAL_5_9' },
      },
    },
  }

  it('picks out what a lead needs', () => {
    expect(fromVrvirksomhed(company)).toEqual({
      company: 'Kaffe & Co ApS',
      cvr: '12345678',
      address: 'Vestergade 12B, 2.\n8000 Aarhus C',
      email: 'hej@kaffeco.dk',
      phone: '+45 12 34 56 78',
      website: 'www.kaffeco.dk',
      industry: 'Restauranter',
      industryCode: '561010',
      employees: '5-9',
      active: true,
    })
  })

  it('marks closed companies so they can be sorted last', () => {
    const closed = { Vrvirksomhed: { ...company.Vrvirksomhed, sammensatStatus: 'OPHØRT' } }
    expect(fromVrvirksomhed(closed)?.active).toBe(false)
  })

  it('copes with the many fields the register leaves empty', () => {
    const bare = { Vrvirksomhed: { cvrNummer: 1, virksomhedMetadata: { nyesteNavn: { navn: 'Bare ApS' } } } }
    expect(fromVrvirksomhed(bare)).toMatchObject({ company: 'Bare ApS', cvr: '1', address: undefined, phone: undefined })
    expect(fromVrvirksomhed({ Vrvirksomhed: { virksomhedMetadata: {} } })).toBeNull()
    expect(fromVrvirksomhed(null)).toBeNull()
  })

  it('reads a whole Elasticsearch response', () => {
    const hits = toCompanyHits({ hits: { total: 1, hits: [{ _index: 'cvr', _source: company }] } })
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ company: 'Kaffe & Co ApS', industry: 'Restauranter' })
  })
})

describe('reading a search phrase', () => {
  it('understands a trade and a town', () => {
    const f = parseLeadQuery('håndværkere i Aarhus')
    expect(f.trade).toBe('craft')
    expect(f.codes).toEqual(['41', '43'])
    expect(f.city).toBe('aarhus')
    expect(f.activeOnly).toBe(true)
  })

  it('copes with singular, plural and English', () => {
    expect(parseLeadQuery('frisør i Odense').trade).toBe('hairdresser')
    expect(parseLeadQuery('frisører i Odense').trade).toBe('hairdresser')
    expect(parseLeadQuery('reklamebureauer i København').trade).toBe('agency')
    expect(parseLeadQuery('tandlæger 8000').postal).toBe('8000')
  })

  it('reads how big they should be', () => {
    expect(parseLeadQuery('restauranter i Odense med 5-20 ansatte')).toMatchObject({ trade: 'restaurant', city: 'odense', employeesMin: 5, employeesMax: 20 })
    expect(parseLeadQuery('bagere med over 10 ansatte').employeesMin).toBe(10)
    expect(parseLeadQuery('butikker under 50 medarbejdere').employeesMax).toBe(50)
  })

  it('keeps words it doesn’t know rather than dropping them', () => {
    const f = parseLeadQuery('bryggeri Mikkeller i København')
    expect(f.trade).toBe('brewery')
    expect(f.text).toContain('mikkeller')
    expect(f.city).toBe('københavn')
  })

  it('survives an empty or nonsense phrase', () => {
    expect(parseLeadQuery('')).toEqual({ activeOnly: true })
    expect(parseLeadQuery('   ')).toEqual({ activeOnly: true })
    expect(parseLeadQuery('xyzzy').text).toBe('xyzzy')
  })
})

describe('the query sent to the register', () => {
  it('asks for the trade by code or by industry text, and narrows by town', () => {
    const q = JSON.stringify(buildCvrQuery(parseLeadQuery('håndværkere i Aarhus'), 25))
    expect(q).toContain('"prefix"')
    expect(q).toContain('nyesteHovedbranche.branchekode')
    expect(q).toContain('nyesteBeliggenhedsadresse.postdistrikt')
    expect(q).toContain('minimum_should_match')
    expect(JSON.parse(q).size).toBe(25)
  })

  it('filters out companies that have closed, unless asked not to', () => {
    expect(JSON.stringify(buildCvrQuery({ activeOnly: true }))).toContain('NORMAL')
    expect(JSON.stringify(buildCvrQuery({ activeOnly: false }))).not.toContain('NORMAL')
  })

  it('pages through results', () => {
    expect(buildCvrQuery({ city: 'Aarhus' }, 50, 100)).toMatchObject({ size: 50, from: 100 })
  })
})

describe('company size bands', () => {
  it('matches a band against a wanted range', () => {
    expect(matchesSize('5-9', { employeesMin: 5, employeesMax: 20 })).toBe(true)
    expect(matchesSize('1-4', { employeesMin: 5 })).toBe(false)
    expect(matchesSize('50-99', { employeesMax: 20 })).toBe(false)
    expect(matchesSize('20-49', { employeesMin: 5, employeesMax: 20 })).toBe(true)
  })

  it('keeps everyone when no size was asked for, and drops unknowns when it was', () => {
    expect(matchesSize(undefined, {})).toBe(true)
    expect(matchesSize(undefined, { employeesMin: 5 })).toBe(false)
  })
})

describe('the CSV the sales team gets', () => {
  const rows = [
    { id: '1', company: 'Kaffe & Co', cvr: '12345678', phone: '+45 12 34 56 78', email: 'hej@kaffeco.dk', industry: 'Restauranter', stage: 'New', source: 'Company register', createdAt: '', updatedAt: '' },
    { id: '2', company: 'Sig "hej" ApS', address: 'Vestergade 1\n8000 Aarhus', stage: 'Contacted', source: 'Referral', createdAt: '', updatedAt: '' },
  ] as Lead[]

  it('has a header and one row per lead', () => {
    const lines = leadsCsv(rows).split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('Virksomhed')
    expect(lines[1]).toContain('Kaffe & Co')
  })

  it('escapes quotes and newlines so Excel reads it in one piece', () => {
    const line = leadsCsv(rows).split('\n')[2]
    expect(line).toContain('"Sig ""hej"" ApS"')
    expect(line).toContain('"Vestergade 1, 8000 Aarhus"')
    expect(line.split('\n')).toHaveLength(1)
  })
})

describe('searching by industry code', () => {
  it('takes codes written as people write them', () => {
    expect(parseLeadQuery('branche 4332 i Aarhus')).toMatchObject({ codes: ['4332'], city: 'aarhus' })
    expect(parseLeadQuery('branchekoder 4332, 4321 i Odense').codes).toEqual(['4332', '4321'])
    expect(parseLeadQuery('43.32.00').codes).toEqual(['433200'])
    expect(parseLeadQuery('kode 433200').codes).toEqual(['433200'])
  })

  it('still reads a bare four-digit number as a postcode', () => {
    expect(parseLeadQuery('frisører 8000')).toMatchObject({ postal: '8000', trade: 'hairdresser' })
    expect(parseLeadQuery('4332 i Aarhus')).toMatchObject({ postal: '4332' })
  })

  it('lets a typed code win over a trade word in the same phrase', () => {
    const f = parseLeadQuery('håndværkere branche 4332')
    expect(f.codes).toEqual(['4332'])
    expect(f.trade).toBeUndefined()
  })

  it('asks the register for those codes as prefixes', () => {
    const q = JSON.stringify(buildCvrQuery(parseLeadQuery('branche 43 i Aarhus')))
    expect(q).toContain('"prefix"')
    expect(q).toContain('"43"')
  })

  it('merges what you typed with what you picked in the filters', () => {
    expect(mergeFilters('håndværkere i Aarhus', {})).toMatchObject({ trade: 'craft', city: 'aarhus' })
    expect(mergeFilters('håndværkere i Aarhus', { codes: ['4332'] })).toMatchObject({ codes: ['4332'], trade: undefined, city: 'aarhus' })
    expect(mergeFilters('håndværkere i Aarhus', { city: 'Odense' }).city).toBe('Odense')
    expect(mergeFilters('håndværkere i Aarhus', { codes: [] }).codes).toBeUndefined()
  })
})
