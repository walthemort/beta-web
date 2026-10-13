/**
 * Defaults for every record, used both for new records and to upgrade data saved by
 * older versions of the app (anything missing is filled in; nothing is thrown away).
 */
import type {
  BrandHub, Choice, Client, Contract, Deck, Invoice, Member, Project, Proposal, StageDef, State, Studio, StudioFile, Workflow,
} from './types'

export const DEFAULT_LOGO_RULES: BrandHub['logoRules'] = {
  clearSpace: 0.5,
  minWidthPx: 80,
  minWidthMm: 20,
  dos: ['Use the logo on brand colours with enough contrast', 'Keep the clear space free', 'Use the files from this hub'],
  donts: ['Stretch or squash the logo', 'Change the colours', 'Add shadows or effects', 'Place it on busy photos'],
}

export const DEFAULT_TONE: BrandHub['tone'] = { summary: '', weAre: [], weAreNot: [], examples: [] }

export const emptyHub = (updatedAt = new Date().toISOString()): BrandHub => ({
  colours: [],
  fonts: [],
  logoRules: DEFAULT_LOGO_RULES,
  typeScale: { base: 16, ratio: 1.25 },
  tone: DEFAULT_TONE,
  imagery: '',
  access: {},
  updatedAt,
})

export const DEFAULT_STAGES: StageDef[] = [
  { id: 'st-onboarding', name: 'Onboarding', colour: '#9a9993' },
  { id: 'st-discovery', name: 'Discovery', colour: '#c08a2e' },
  { id: 'st-strategy', name: 'Strategy', colour: '#8a4fff' },
  { id: 'st-design', name: 'Design', colour: '#1a4dff' },
  { id: 'st-delivery', name: 'Delivery', colour: '#e0673a', delivery: true },
  { id: 'st-complete', name: 'Complete', colour: '#2f7a4a' },
]

export const DEFAULT_WORKFLOW: Workflow = { id: 'wf-main', name: 'Brand & design', stages: DEFAULT_STAGES }

export const DEFAULT_STUDIO_EXTRAS: Pick<Studio, 'hourlyRate' | 'brand' | 'emails' | 'workflows' | 'automations'> = {
  hourlyRate: 950,
  workflows: [DEFAULT_WORKFLOW],
  brand: { accent: '#1a4dff' },
  emails: { notifyStudio: true, notifyClient: true, weeklyDigest: true, overdueReminders: true },
  automations: { contractFromProposal: true, deliverWhenApproved: true },
}

export const MEMBER_COLOURS = ['#1a4dff', '#e0673a', '#2f7a4a', '#8a4fff', '#c2342b', '#a86a12']

export function normalizeProject(p: Partial<Project> & { id: string }, fallback?: Partial<Project>): Project {
  const hub = (p.hub ?? {}) as Partial<BrandHub>
  return {
    name: '',
    clientId: '',
    tagline: '',
    description: '',
    service: 'Brand identity',
    stage: 0,
    cover: { bg: '#141414', fg: '#faf9f6', wordmark: p.name ?? 'Project' },
    tasks: [],
    discovery: fallback?.discovery ?? { questions: [] },
    notes: '',
    memberIds: [],
    roundsIncluded: 2,
    onboarding: { welcome: '' },
    updatedAt: new Date().toISOString(),
    ...p,
    startDate: p.startDate ?? (p as { createdAt?: string }).createdAt ?? p.updatedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    hub: { ...emptyHub(hub.updatedAt), ...hub, logoRules: { ...DEFAULT_LOGO_RULES, ...(hub.logoRules ?? {}) }, tone: { ...DEFAULT_TONE, ...(hub.tone ?? {}) }, access: hub.access ?? {} },
  } as Project
}

export const normalizeClient = (c: Partial<Client> & { id: string }): Client =>
  ({ name: '', contactName: '', contactEmail: '', contacts: [], language: 'en', ...c }) as Client

export const normalizeFile = (f: Partial<StudioFile> & { id: string }): StudioFile =>
  ({ comments: [], versions: [], published: false, status: 'Not shared', category: 'Artwork', roundsUsed: 0, uploadedBy: 'studio', ...f }) as StudioFile

export const normalizeDeck = (d: Partial<Deck> & { id: string }): Deck =>
  ({ comments: [], status: 'Not shared', purpose: 'Presentation', roundsUsed: 0, ...d }) as Deck

export const normalizeProposal = (p: Partial<Proposal> & { id: string }): Proposal =>
  ({ sections: [], items: [], packages: [], addons: [], paymentPlan: [], chosenAddonIds: [], status: 'Draft', intro: '', ...p }) as Proposal

export const normalizeInvoice = (i: Partial<Invoice> & { id: string }): Invoice =>
  ({ remindersSent: [], status: 'Draft', amount: 0, ...i }) as Invoice

export const normalizeContract = (c: Partial<Contract> & { id: string }): Contract => ({ status: 'Draft', body: '', ...c }) as Contract
export const normalizeChoice = (c: Partial<Choice> & { id: string }): Choice =>
  ({ options: [], status: 'Draft', question: '', ...c }) as Choice

export function ownerMember(studio: Pick<Studio, 'owner' | 'email'>): Member {
  return { id: 'm-owner', name: studio.owner, email: studio.email, role: 'Owner', capacity: 32, colour: MEMBER_COLOURS[0] }
}

/** Upgrades any saved state (v1, v2 or v3) to the current shape. */
export function normalizeState(raw: Partial<State> & Record<string, unknown>, seed: State): State {
  const studio = { ...seed.studio, ...DEFAULT_STUDIO_EXTRAS, ...(raw.studio ?? {}) } as Studio
  studio.brand = { ...DEFAULT_STUDIO_EXTRAS.brand, ...(raw.studio?.brand ?? {}) }
  studio.emails = { ...DEFAULT_STUDIO_EXTRAS.emails, ...(raw.studio?.emails ?? {}) }
  studio.automations = { ...DEFAULT_STUDIO_EXTRAS.automations, ...(raw.studio?.automations ?? {}) }
  // Saves from before workflows had one list of stages: that becomes the first workflow, with the
  // same stage ids, so every project stays exactly where it was.
  const legacy = (raw.studio as { stages?: StageDef[] } | undefined)?.stages
  if (raw.studio && !raw.studio.workflows?.length) studio.workflows = [{ ...DEFAULT_WORKFLOW, stages: legacy?.length ? legacy : DEFAULT_STAGES }]
  if (!studio.workflows?.length) studio.workflows = [DEFAULT_WORKFLOW]
  // Studios from before the country choice were all set up the Danish way (CVR, moms).
  if (!studio.country) studio.country = 'DK'
  delete (studio as { stages?: unknown }).stages
  // Anyone who already has saved data has, by definition, set up their studio.
  // (Check the saved value, not the merged one: the sample data’s `false` is merged in above.)
  if (raw.studio && raw.studio.setupDone === undefined) studio.setupDone = true
  // Saves from before the backup reminder start counting today, instead of nagging straight away.
  if (raw.studio && !raw.studio.lastBackupAt) studio.lastBackupAt = new Date().toISOString()
  // Saves from before teams existed get the sample team (with the owner's own name), so the
  // sample projects' assignments still point at real people.
  const team = raw.team?.length
    ? raw.team
    : seed.team.length
      ? seed.team.map((m) => (m.role === 'Owner' ? { ...m, name: studio.owner, email: studio.email } : m))
      : [ownerMember(studio)]
  const hasProjects = Array.isArray(raw.projects)
  // Older saves only had some collections; for sample projects, bring in the matching sample data.
  const forKnownProjects = <T extends { projectId: string }>(list: T[]) =>
    hasProjects ? list.filter((x) => raw.projects!.some((p) => p.id === x.projectId)) : list

  return {
    ...seed,
    ...raw,
    version: 3,
    studio,
    team,
    currentMemberId: raw.currentMemberId && team.some((m) => m.id === raw.currentMemberId) ? raw.currentMemberId : team[0].id,
    clients: (raw.clients ?? seed.clients).map(normalizeClient),
    projects: (raw.projects ?? seed.projects).map((p) => {
      const fromSeed = seed.projects.find((x) => x.id === p.id)
      // Sample projects saved before colour roles existed get the richer sample palettes.
      const upgradeSample = p.sample && fromSeed && !(p.hub?.colours ?? []).some((c) => c.role)
      const base = upgradeSample ? { ...p, cover: fromSeed!.cover, hub: { ...p.hub, colours: fromSeed!.hub.colours, fonts: fromSeed!.hub.fonts } as BrandHub } : p
      const np = normalizeProject(fromSeed ? { ...fromSeed, ...base, hub: { ...fromSeed.hub, ...base.hub } } : base, fromSeed)
      const flow = studio.workflows.find((w) => w.id === np.workflowId) ?? studio.workflows[0]
      return { ...np, stage: Math.min(Math.max(0, np.stage), flow.stages.length - 1) }
    }),
    projectTemplates: raw.projectTemplates ?? seed.projectTemplates,
    proposalTemplates: raw.proposalTemplates ?? seed.proposalTemplates,
    files: (raw.files ?? forKnownProjects(seed.files)).map(normalizeFile),
    decks: (raw.decks ?? []).map(normalizeDeck),
    choices: (raw.choices ?? forKnownProjects(seed.choices)).map(normalizeChoice),
    proposals: (raw.proposals ?? forKnownProjects(seed.proposals)).map(normalizeProposal),
    contracts: (raw.contracts ?? forKnownProjects(seed.contracts)).map(normalizeContract),
    // Invoices from before per-invoice VAT keep the rate they were created with.
    invoices: (raw.invoices ?? seed.invoices).map((i) => normalizeInvoice({ vatRate: studio.vatRate, ...i })),
    timeEntries: raw.timeEntries ?? forKnownProjects(seed.timeEntries),
    hubVersions: raw.hubVersions ?? [],
    approvals: raw.approvals ?? [],
    timeOff: raw.timeOff ?? [],
    expenses: raw.expenses ?? [],
    leads: raw.leads ?? [],
    leadLists: raw.leadLists ?? [],
    activity: raw.activity ?? [],
    notifications: raw.notifications ?? [],
    outbox: raw.outbox ?? [],
    designs: raw.designs ?? [],
    // The T-shirt and tote bag scenes were retired – those mockups show business cards now.
    mockups: (raw.mockups ?? []).map((m) => (m.scene === 'tshirt' || m.scene === 'tote' ? { ...m, scene: 'cards' } : m)),
    posts: raw.posts ?? [],
    webPages: raw.webPages ?? [],
    audits: raw.audits ?? [],
  }
}
