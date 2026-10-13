/**
 * Translations. Strings are keyed by their English text, so untranslated strings simply fall back
 * to English. The client pages follow the client's language; the studio app each member's own.
 */
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Lang } from './types'
import { daStudio } from './da-studio'
import { daWorkspace } from './da-workspace'
import { daDocuments } from './da-documents'
import { daContent } from './da-content'
import { daPlans } from './da-plans'
import { daApps } from './da-apps'
import { daCustom } from './da-custom'

const da: Record<string, string> = {
  // Portal shell
  Overview: 'Overblik',
  Presentations: 'Præsentationer',
  'Pick a route': 'Vælg retning',
  Review: 'Gennemsyn',
  Questionnaire: 'Spørgeskema',
  Proposal: 'Tilbud',
  Contract: 'Aftale',
  Invoices: 'Fakturaer',
  'Brand hub': 'Brand hub',
  'Viewing as': 'Du ser siden som',
  'Shared by': 'Delt af',
  'Link not found.': 'Linket findes ikke.',
  'Ask your studio for a new link.': 'Bed dit studie om et nyt link.',
  // Home
  Hi: 'Hej',
  'Here’s where we are.': 'Her er status.',
  'Waiting for you': 'Venter på dig',
  'Nothing right now. We’ll let you know when there’s something to look at.': 'Intet lige nu. Vi giver besked, når der er noget at se på.',
  'Latest updates': 'Seneste nyt',
  'No updates yet.': 'Ingen opdateringer endnu.',
  'Fill in the discovery questionnaire': 'Udfyld spørgeskemaet',
  'About 10 minutes': 'Cirka 10 minutter',
  'Review and accept the proposal': 'Se og accepter tilbuddet',
  'Sign the project agreement': 'Underskriv aftalen',
  Review_file: 'Se',
  'Look through': 'Se',
  Presentation: 'Præsentation',
  Version: 'Version',
  'Get started': 'Kom i gang',
  'Finish getting started': 'Gør opstarten færdig',
  'Share material with the studio': 'Del materiale med studiet',
  'Old logos, photos, references — anything that helps.': 'Gamle logoer, billeder, referencer — alt der kan hjælpe.',
  'Drop files here': 'Slip filer her',
  'or click to upload': 'eller klik for at uploade',
  'You shared': 'Du har delt',
  // Stages
  Onboarding: 'Opstart',
  Discovery: 'Research',
  Strategy: 'Strategi',
  Design: 'Design',
  Delivery: 'Levering',
  Complete: 'Færdig',
  // Review
  'Work to review': 'Til gennemsyn',
  'Nothing to review yet.': 'Intet til gennemsyn endnu.',
  'All files': 'Alle filer',
  'All presentations': 'Alle præsentationer',
  Approve: 'Godkend',
  'Request changes': 'Bed om ændringer',
  'Your feedback': 'Din feedback',
  'Write a general comment…': 'Skriv en kommentar…',
  'Write a comment…': 'Skriv en kommentar…',
  'What should change here?': 'Hvad skal ændres her?',
  Comment: 'Kommentér',
  Reply: 'Svar',
  'Comment deleted': 'Kommentar slettet',
  'Billing details': 'Fakturaoplysninger',
  'So our invoices are addressed correctly.': 'Så vores fakturaer bliver stilet korrekt.',
  'Company address': 'Firmaadresse',
  'CVR / VAT number': 'CVR-/momsnummer',
  Undo: 'Fortryd',
  Cancel: 'Annullér',
  Voice: 'Tale',
  Download: 'Download',
  'Click on the image to pin a comment to that spot.': 'Klik på billedet for at sætte en kommentar på stedet.',
  'Click on the page to pin a comment to that spot.': 'Klik på siden for at sætte en kommentar på stedet.',
  'Add a comment first, so the studio knows what to change.': 'Skriv en kommentar først, så studiet ved, hvad der skal ændres.',
  'revision rounds left for this file.': 'rettelsesrunder tilbage for denne fil.',
  'revision round left for this file.': 'rettelsesrunde tilbage for denne fil.',
  'You’re looking at an older version.': 'Du ser en ældre version.',
  'Comment at this moment': 'Kommentér dette øjeblik',
  'No comments on this version yet.': 'Ingen kommentarer på denne version endnu.',
  'Tell us what you think. Add a slide number to point at something specific.': 'Fortæl os, hvad du synes. Skriv et slidenummer for at pege på noget bestemt.',
  'No presentations yet.': 'Ingen præsentationer endnu.',
  Present: 'Præsentér',
  'Open in Figma': 'Åbn i Figma',
  optional: 'valgfrit',
  Slide: 'Slide',
  // Choices
  'What made you choose it?': 'Hvorfor valgte du den?',
  Choose: 'Vælg',
  'Your choice': 'Dit valg',
  Selected: 'Valgt',
  'Nothing to choose right now.': 'Intet at vælge lige nu.',
  // Questionnaire
  'Tell us about you.': 'Fortæl os om jer.',
  'Your answers save automatically, so you can come back later. There are no wrong answers — short is fine.':
    'Dine svar gemmes automatisk, så du kan vende tilbage senere. Der er ingen forkerte svar — kort er fint.',
  'Send to the studio': 'Send til studiet',
  'Send updated answers': 'Send opdaterede svar',
  Saved: 'Gemt',
  // Proposal & contract
  'The proposal isn’t ready yet.': 'Tilbuddet er ikke klar endnu.',
  'Your total incl. VAT': 'Din pris inkl. moms',
  'Your full name': 'Dit fulde navn',
  'Accept proposal': 'Accepter tilbuddet',
  Decline: 'Afvis',
  'Save as PDF': 'Gem som PDF',
  'Comment on the presentation': 'Kommentér præsentationen',
  'The agreement isn’t ready yet.': 'Aftalen er ikke klar endnu.',
  'Your signature': 'Din underskrift',
  'Sign agreement': 'Underskriv aftalen',
  'Sign here': 'Skriv under her',
  Clear: 'Ryd',
  // Invoices
  'No invoices yet.': 'Ingen fakturaer endnu.',
  'Pay now': 'Betal nu',
  Due: 'Forfalder',
  Paid: 'Betalt',
  'To pay': 'Til betaling',
  Overdue: 'Forfalden',
  'Prefer a bank transfer?': 'Vil du hellere betale via bankoverførsel?',
  'Please quote the invoice number.': 'Angiv venligst fakturanummeret.',
  // Hub
  Logos: 'Logoer',
  'Logo rules': 'Logoregler',
  Colour: 'Farver',
  Typography: 'Typografi',
  'Tone of voice': 'Tone of voice',
  Imagery: 'Billedstil',
  'In use': 'I brug',
  Updated: 'Opdateret',
  'Brand kit (.zip)': 'Brand kit (.zip)',
  'Guidelines (PDF)': 'Retningslinjer (PDF)',
  // Onboarding
  Welcome: 'Velkommen',
  'Your team': 'Jeres team',
  'Share material': 'Del materiale',
  'All set': 'Klar',
  Next: 'Næste',
  Back: 'Tilbage',
  Skip: 'Spring over',
  'Who should we keep in the loop?': 'Hvem skal vi holde orienteret?',
  'Add the people who’ll give feedback or approve work.': 'Tilføj dem, der giver feedback eller godkender arbejdet.',
  Name: 'Navn',
  Email: 'E-mail',
  Role: 'Rolle',
  'Add person': 'Tilføj person',
  'Thank you!': 'Tak!',
  'We’ve got everything we need to get started. We’ll be in touch soon.': 'Vi har alt, vi skal bruge for at komme i gang. Vi vender tilbage snart.',
  'Go to your project': 'Gå til dit projekt',
  // Feedback
  'The project is done': 'Projektet er færdigt',
  'How was it to work with us?': 'Hvordan var det at arbejde med os?',
  'Two quick questions. It helps us get better.': 'To hurtige spørgsmål. Det hjælper os til at blive bedre.',
  'How likely are you to recommend {studio} to a friend or colleague?': 'Hvor sandsynligt er det, at du vil anbefale {studio} til en ven eller kollega?',
  'Not likely': 'Ikke sandsynligt',
  'Very likely': 'Meget sandsynligt',
  'In a sentence or two: what was it like to work with us?': 'Med en sætning eller to: hvordan var det at arbejde med os?',
  '{studio} may quote this with my name and company': '{studio} må citere dette med mit navn og firma',
  'Send feedback': 'Send feedback',
  'Thank you for your feedback — it means a lot to us.': 'Tak for din feedback — den betyder meget for os.',
  // Handover
  'Final files': 'Færdige filer',
  'Your final files': 'Jeres færdige filer',
  'Your final files are ready': 'Jeres færdige filer er klar',
  'The final files aren’t ready yet.': 'De færdige filer er ikke klar endnu.',
  'Download everything (.zip)': 'Download det hele (.zip)',
  'Packing…': 'Pakker…',
  'final files': 'færdige filer',
  Files: 'Filer',
  'Brand guidelines': 'Brand-retningslinjer',
  'Colours, fonts, logo rules and tone of voice – to share with printers, agencies and colleagues.':
    'Farver, skrifter, logoregler og tone of voice – til at dele med trykkerier, bureauer og kolleger.',
  'Usage rights': 'Brugsret',
  'From client': 'Fra kunden',
  Artwork: 'Grafik',
  Documents: 'Dokumenter',
  Moodboard: 'Moodboard',
  // Portal shell, embeds and public pages
  'Client portal': 'Kundeportal',
  'Welcome video': 'Velkomstvideo',
  PDF: 'PDF',
  'brand hub': 'brand hub',
  'Brand hub not found.': 'Brand hubben findes ikke.',
  'Made with': 'Lavet med',
  by: 'af',
  'Your work,': 'Jeres arbejde,',
  'together.': 'samlet.',
  'Sign in with the email your studio invited you with.': 'Log ind med den e-mail, dit studie har inviteret dig med.',
  'Sign in to your client space': 'Log ind på din kundeside',
  'Don’t have access? Ask your studio to invite you.': 'Har du ikke adgang? Bed dit studie om en invitation.',
  status: 'status',
  Status: 'Status',
  'This link isn’t active.': 'Linket er ikke aktivt.',
  'Ask the studio for a new one.': 'Bed studiet om et nyt.',
  'Signature – draw with your mouse or finger': 'Underskrift – tegn med musen eller fingeren',
  'Not published.': 'Ikke udgivet.',
  'Case study': 'Case',
  // Client dashboard
  'Your projects': 'Jeres projekter',
  'All projects': 'Alle projekter',
  'Open project': 'Åbn projekt',
}

const dict: Record<Lang, Record<string, string>> = { en: {}, da: { ...daStudio, ...daWorkspace, ...daContent, ...daDocuments, ...daPlans, ...daApps, ...da, ...daCustom } }

/** Every Danish dictionary, lowest priority first – for the translation sheet (scripts/translations.mjs). */
export const DANISH_SOURCES = [
  { area: 'Studio app', file: 'src/data/da-studio.ts', entries: daStudio },
  { area: 'Studio app', file: 'src/data/da-workspace.ts', entries: daWorkspace },
  { area: 'Studio app', file: 'src/data/da-content.ts', entries: daContent },
  { area: 'Studio app', file: 'src/data/da-plans.ts', entries: daPlans },
  { area: 'Studio app', file: 'src/data/da-apps.ts', entries: daApps },
  { area: 'Emails & documents', file: 'src/data/da-documents.ts', entries: daDocuments },
  { area: 'Client pages', file: 'src/data/i18n.tsx', entries: da },
  { area: 'Your wording', file: 'src/data/da-custom.ts', entries: daCustom },
] as const

/** For tests: is there a translation for this text? */
export const hasTranslation = (lang: Lang, s: string) => s in dict[lang]

/** The language on screen right now – for the few places outside React (date formats, the Undo toast). */
let active: Lang = 'en'
export const activeLang = () => active
/** Only for tests and non-React entry points. */
export const setActiveLang = (l: Lang) => {
  active = l
}

type Vars = Record<string, string | number | undefined>

/**
 * A text in a language. Keys are the English text; when the same English needs different Danish
 * in different places, the key carries a context after '§' ("Due§invoice"), which never shows.
 */
function lookup(lang: Lang, s: string, vars?: Vars) {
  const text = dict[lang][s] ?? (s.includes('§') ? s.slice(0, s.indexOf('§')) : s)
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? '') : m)) : text
}

/** Like useT, for code outside components. */
export function translate(s: string, vars?: Vars) {
  return lookup(active, s, vars)
}

/** A text in a given language – for emails and documents, which follow the client's language, not the screen's. */
export function translateTo(lang: Lang | undefined, s: string, vars?: Vars) {
  return lookup(lang === 'da' ? 'da' : 'en', s, vars)
}

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} })

/**
 * Client pages: the viewer can switch language; the default is the client's language.
 * Studio app: controlled – `lang` is the member's own setting and `onChange` saves it.
 */
export function LangProvider({ initial = 'en', lang: fixed, onChange, children }: { initial?: Lang; lang?: Lang; onChange?: (l: Lang) => void; children: ReactNode }) {
  const [chosen, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('forme:lang') as Lang) || initial
    } catch {
      return initial
    }
  })
  const lang = fixed ?? chosen
  active = lang
  const setLang = (l: Lang) => {
    if (onChange) return onChange(l)
    setLangState(l)
    try {
      localStorage.setItem('forme:lang', l)
    } catch {
      /* ignore */
    }
  }
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>
}

export function useLang() {
  return useContext(LangCtx)
}

/**
 * t('Overview') → 'Overblik' in Danish. Unknown strings stay in English.
 * Placeholders are filled in after translating: t('{name} deleted', { name }) → 'RAY slettet'.
 */
export function useT() {
  const { lang } = useContext(LangCtx)
  return (s: string, vars?: Vars) => (s === 'Review_file' && !dict[lang][s] ? 'Review' : lookup(lang, s, vars))
}

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div className="seg lang-switch" role="group" aria-label="Language">
      <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      <button aria-pressed={lang === 'da'} onClick={() => setLang('da')}>DA</button>
    </div>
  )
}

export const dateLocale = (lang: Lang) => (lang === 'da' ? 'da-DK' : 'en-GB')
