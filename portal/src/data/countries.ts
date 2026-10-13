/**
 * Where a studio is based. It decides the currency Aftryk's prices are shown and charged in, and
 * the VAT on Aftryk's own invoices (Aftryk is sold from Denmark).
 */
export type Currency = 'dkk' | 'sek' | 'nok' | 'eur' | 'gbp' | 'usd'

export interface Country {
  code: string
  name: string
  currency: Currency
  /** In the EU: businesses with a VAT number pay no Danish VAT (reverse charge). */
  eu: boolean
  /** Standard VAT rate, for customers without a VAT number (EU One-Stop-Shop). */
  vat: number
}

/** Standard rates as of 2025. Stripe Tax (see docs/PAYMENTS.md) keeps them current once payments are on. */
export const COUNTRIES: Country[] = [
  { code: 'DK', name: 'Denmark', currency: 'dkk', eu: true, vat: 0.25 },
  { code: 'SE', name: 'Sweden', currency: 'sek', eu: true, vat: 0.25 },
  { code: 'NO', name: 'Norway', currency: 'nok', eu: false, vat: 0 },
  { code: 'FI', name: 'Finland', currency: 'eur', eu: true, vat: 0.255 },
  { code: 'DE', name: 'Germany', currency: 'eur', eu: true, vat: 0.19 },
  { code: 'NL', name: 'Netherlands', currency: 'eur', eu: true, vat: 0.21 },
  { code: 'BE', name: 'Belgium', currency: 'eur', eu: true, vat: 0.21 },
  { code: 'FR', name: 'France', currency: 'eur', eu: true, vat: 0.2 },
  { code: 'ES', name: 'Spain', currency: 'eur', eu: true, vat: 0.21 },
  { code: 'IT', name: 'Italy', currency: 'eur', eu: true, vat: 0.22 },
  { code: 'PT', name: 'Portugal', currency: 'eur', eu: true, vat: 0.23 },
  { code: 'IE', name: 'Ireland', currency: 'eur', eu: true, vat: 0.23 },
  { code: 'AT', name: 'Austria', currency: 'eur', eu: true, vat: 0.2 },
  { code: 'PL', name: 'Poland', currency: 'eur', eu: true, vat: 0.23 },
  { code: 'CZ', name: 'Czechia', currency: 'eur', eu: true, vat: 0.21 },
  { code: 'EE', name: 'Estonia', currency: 'eur', eu: true, vat: 0.24 },
  { code: 'LV', name: 'Latvia', currency: 'eur', eu: true, vat: 0.21 },
  { code: 'LT', name: 'Lithuania', currency: 'eur', eu: true, vat: 0.21 },
  { code: 'LU', name: 'Luxembourg', currency: 'eur', eu: true, vat: 0.17 },
  { code: 'GR', name: 'Greece', currency: 'eur', eu: true, vat: 0.24 },
  { code: 'IS', name: 'Iceland', currency: 'eur', eu: false, vat: 0 },
  { code: 'CH', name: 'Switzerland', currency: 'eur', eu: false, vat: 0 },
  { code: 'GB', name: 'United Kingdom', currency: 'gbp', eu: false, vat: 0 },
  { code: 'US', name: 'United States', currency: 'usd', eu: false, vat: 0 },
  { code: 'CA', name: 'Canada', currency: 'usd', eu: false, vat: 0 },
  { code: 'AU', name: 'Australia', currency: 'usd', eu: false, vat: 0 },
  { code: 'OTHER', name: 'Another country', currency: 'usd', eu: false, vat: 0 },
]

export const countryOf = (code?: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES.find((c) => c.code === 'OTHER')!

/** A best guess from the browser (“da-DK” → Denmark), for the front page and the setup default. */
export function guessCountry(languages: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []): string {
  const byLanguage: Record<string, string> = { da: 'DK', sv: 'SE', nb: 'NO', nn: 'NO', no: 'NO', fi: 'FI', de: 'DE', nl: 'NL', fr: 'FR', es: 'ES', it: 'IT', pt: 'PT', pl: 'PL', cs: 'CZ', et: 'EE', is: 'IS' }
  for (const tag of languages) {
    const [lang, region] = tag.split('-')
    if (region && COUNTRIES.some((c) => c.code === region.toUpperCase())) return region.toUpperCase()
    if (byLanguage[lang?.toLowerCase()]) return byLanguage[lang.toLowerCase()]
  }
  return 'US'
}

/**
 * The VAT on Aftryk's invoice to a studio. Aftryk is Danish: Danish studios pay Danish VAT; EU studios
 * with a VAT number pay none (reverse charge); other EU studios pay their own country's rate;
 * studios outside the EU pay none. An estimate – the payment provider calculates the final amount.
 */
export function taxFor(countryCode: string | undefined, hasVatNumber: boolean): { rate: number; note: 'dk' | 'reverse' | 'oss' | 'export' } {
  const c = countryOf(countryCode)
  if (c.code === 'DK') return { rate: 0.25, note: 'dk' }
  if (c.eu) return hasVatNumber ? { rate: 0, note: 'reverse' } : { rate: c.vat, note: 'oss' }
  return { rate: 0, note: 'export' }
}

export function formatMoney(amount: number, currency: Currency) {
  const locale = { dkk: 'da-DK', sek: 'sv-SE', nok: 'nb-NO', eur: 'de-DE', gbp: 'en-GB', usd: 'en-US' }[currency]
  // Danish kroner the Danish way (“249 kr.”); the rest as each currency is usually written.
  if (currency === 'dkk') return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount) + ' kr.'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount)
}
