/**
 * Aftryk's plans. Everything a plan gives – prices, limits and features – is set here, in one
 * place. Billing isn't connected yet, so switching plan is free while Aftryk is in beta.
 */
import type { AppId, State } from './types'
import { APPS } from './apps'

import { countryOf, formatMoney, type Currency } from './countries'

export type PlanId = 'free' | 'pro' | 'studio'
export type Period = 'monthly' | 'yearly'
export type { Currency }

/** Features that only some plans include. */
export type Feature = 'contentMachine' | 'aiImages' | 'aiDrafts' | 'customDomain' | 'hubHosting' | 'clientEdits' | 'whiteLabel' | 'companyLookup'

/**
 * Features in early access: in no plan yet, switched on studio by studio (`studio.earlyAccess`), or
 * for a whole deployment with VITE_EARLY_ACCESS=companyLookup. Add one to a plan's features to sell it.
 */
export type EarlyFeature = 'companyLookup'
const deployedEarly = () => String(import.meta.env.VITE_EARLY_ACCESS ?? '').split(',').map((f) => f.trim())

export interface Plan {
  id: PlanId
  name: string
  /** A month, excl. VAT / sales tax. */
  prices: Record<Currency, number>
  tagline: string
  limits: {
    /** Projects that aren't archived or complete. */
    activeProjects: number
    /** Team members, the owner included. */
    members: number
    /** Space for uploaded files (once Aftryk is online). */
    storageGb: number
    /** AI images a month in the Content Machine – each one costs Aftryk a few cents. */
    aiImages: number
    /** Apps the studio can switch on (see apps.ts). */
    apps: number
  }
  features: Feature[]
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    prices: { usd: 0, eur: 0, gbp: 0, dkk: 0, sek: 0, nok: 0 },
    tagline: 'For freelancers and the first few clients',
    limits: { activeProjects: 3, members: 2, storageGb: 1, aiImages: 0, apps: 0 },
    features: [],
  },
  {
    id: 'pro',
    name: 'Pro',
    prices: { usd: 39, eur: 35, gbp: 32, dkk: 249, sek: 390, nok: 390 },
    tagline: 'For studios with a steady flow of clients',
    limits: { activeProjects: Infinity, members: 5, storageGb: 50, aiImages: 150, apps: 3 },
    features: ['aiImages', 'aiDrafts', 'customDomain'],
  },
  {
    id: 'studio',
    name: 'Studio',
    prices: { usd: 89, eur: 79, gbp: 69, dkk: 599, sek: 890, nok: 890 },
    tagline: 'For agencies that sell content and hosting too',
    limits: { activeProjects: Infinity, members: Infinity, storageGb: 500, aiImages: 600, apps: Infinity },
    features: ['aiImages', 'aiDrafts', 'customDomain', 'hubHosting', 'clientEdits', 'whiteLabel'],
  },
]

/** Extra file space on top of a plan, bought in packs – a month, excl. VAT. */
export const STORAGE_PACK = { gb: 100, prices: { usd: 5, eur: 5, gbp: 4, dkk: 39, sek: 59, nok: 59 } as Record<Currency, number> }

/** Paying yearly: ten months for twelve. */
export const YEARLY_MONTHS = 10

/** A price for a period: monthly as set, yearly as ten months. */
export const priceFor = (monthly: number, period: Period) => (period === 'yearly' ? monthly * YEARLY_MONTHS : monthly)

/** The studio's currency, from the country it chose in setup. */
export const currencyOf = (s: Pick<State, 'studio'>): Currency => countryOf(s.studio.country).currency

/** “$39” / “249 kr.” */
export const formatPrice = (amount: number, currency: Currency) => formatMoney(amount, currency)

/** What each feature is called on the plans page, in the order they're listed. */
export const FEATURES: { id: Feature; name: string; hint: string }[] = [
  { id: 'aiImages', name: 'AI images and copy', hint: 'Photos, illustrations and headlines made for each client’s brand' },
  { id: 'aiDrafts', name: 'AI proposal drafts', hint: 'The first draft written from the client’s discovery answers' },
  { id: 'customDomain', name: 'Your own portal address', hint: 'e.g. clients.yourstudio.dk' },
  { id: 'hubHosting', name: 'Brand hub hosting', hint: 'Keep clients’ hubs online for a monthly fee' },
  { id: 'clientEdits', name: 'Clients change the words', hint: 'Clients update the text of approved designs in their portal' },
  { id: 'whiteLabel', name: 'No Aftryk branding', hint: 'Clients only see your studio' },
]

/**
 * The plan the studio has right now. A cancelled subscription keeps its plan until the period it
 * paid for ends; after that, the studio is on Free again and paid features lock.
 */
export function planOf(s: Pick<State, 'studio'>, now = new Date().toISOString()): Plan {
  const b = s.studio.billing
  if (b?.cancelAt && b.cancelAt <= now) return PLANS[0]
  return PLANS.find((p) => p.id === s.studio.plan) ?? PLANS[0]
}

/** File space: the plan's, plus any extra packs. */
export const storageGb = (s: Pick<State, 'studio'>) => planOf(s).limits.storageGb + (planOf(s).id === 'free' ? 0 : (s.studio.billing?.extraStorage ?? 0) * STORAGE_PACK.gb)
export const isPlanId = (v: string | null): v is PlanId => PLANS.some((p) => p.id === v)

/** Does the studio's plan include this? Studios that unlocked the Content Machine in the beta keep it. */
export function hasFeature(s: Pick<State, 'studio'>, f: Feature) {
  if (f === 'contentMachine') return hasApp(s, 'contentMachine')
  if (f === 'companyLookup' && (s.studio.earlyAccess?.companyLookup?.granted || deployedEarly().includes(f))) return true
  return planOf(s).features.includes(f)
}

/**
 * Is this app on? Studio has every app; Pro has the ones it picked, up to its limit; Free has
 * none. Studios that turned the Content Machine on in the beta keep it, on any plan.
 */
export function hasApp(s: Pick<State, 'studio'>, id: AppId) {
  if (id === 'contentMachine' && s.studio.addons?.contentMachine) return true
  return appSlots(s).on.includes(id)
}

/** The apps that are on, and how many more a Pro studio can pick. */
export function appSlots(s: Pick<State, 'studio'>) {
  const limit = planOf(s).limits.apps
  if (limit === Infinity) return { limit, on: APPS.map((a) => a.id), left: Infinity }
  const on = (s.studio.apps ?? []).filter((id) => APPS.some((a) => a.id === id)).slice(0, limit)
  return { limit, on, left: Math.max(0, limit - on.length) }
}

/** The cheapest plan that includes a feature – what an upgrade button offers. */
export const planFor = (f: Exclude<Feature, EarlyFeature>) => PLANS.find((p) => p.features.includes(f))!

/** The example people from the sample workspace (saves from before the `sample` flag). */
const SAMPLE_PEOPLE = ['m-mathilde', 'm-kasper']

/** How much of the plan is in use. */
export function usage(s: State) {
  const last = (p: State['projects'][number]) => (s.studio.workflows.find((w) => w.id === p.workflowId) ?? s.studio.workflows[0]).stages.length - 1
  return {
    // Sample projects don't count – they're there to explore with, not the studio's own work.
    activeProjects: s.projects.filter((p) => !p.archived && !p.sample && p.stage < last(p)).length,
    // The example people that come with the sample projects don't count either.
    members: s.team.filter((m) => !m.sample && !SAMPLE_PEOPLE.includes(m.id)).length,
  }
}

/** AI images made this month, and how many the plan allows. */
export function aiAllowance(s: Pick<State, 'studio'>, now = new Date()) {
  const month = now.toISOString().slice(0, 7)
  const used = s.studio.aiUsage?.month === month ? s.studio.aiUsage.images : 0
  const limit = hasFeature(s, 'aiImages') ? planOf(s).limits.aiImages : 0
  return { month, used, limit, left: Math.max(0, limit - used) }
}

/** Room for one more active project / team member on this plan? */
export const canAdd = (s: State, what: 'activeProjects' | 'members') => usage(s)[what] < planOf(s).limits[what]
