import { translate } from './i18n'
import type { Discovery, Proposal, ProposalTemplate, ProjectTemplate, State, StudioFile } from './types'
import { normalizeState } from './defaults'

export const DISCOVERY_TEMPLATE = [
  'In one sentence, what does your company do?',
  'Who are your most important customers?',
  'Which three words should people use about your brand?',
  'Who are your main competitors, and how are you different?',
  'Which brands do you admire (in any industry), and why?',
  'What must we absolutely avoid?',
  'Where will the brand be used most? (web, print, packaging, social…)',
  'Is there a deadline or launch date we should know about?',
]

/** The sample data keeps the English wording; new projects get it in the studio's language. */
export const discoveryFrom = (answers: string[] = [], lang = false): Discovery => ({
  questions: DISCOVERY_TEMPLATE.map((q, i) => ({ id: `q${i + 1}`, q: lang ? translate(q) : q, a: answers[i] ?? '' })),
})

export const DEFAULT_CONTRACT = `1. Scope
The studio delivers the work described in the accepted proposal. Additional work is quoted separately.

2. Timeline
Deadlines depend on timely feedback. Each review round is answered within 5 working days.

3. Revisions
Two rounds of revisions are included per deliverable. Further rounds are billed at the hourly rate.

4. Payment
50% is invoiced at start and 50% at delivery. Payment terms are 14 days net.

5. Rights
Full usage rights to the final, approved work transfer to the client when all invoices are paid. The studio may show the work in its portfolio.

6. Cancellation
If the project is cancelled, work completed up to that point is invoiced.`

/** Small inline SVG logo as a data URL (sample files only). */
const svg = (text: string, fg: string, bg: string, serif = false) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="${bg}"/><text x="400" y="${serif ? 300 : 290}" text-anchor="middle" font-family="${serif ? 'Georgia, serif' : 'Helvetica, Arial, sans-serif'}" font-style="${serif ? 'italic' : 'normal'}" font-weight="${serif ? 400 : 700}" font-size="${text.length > 5 ? 150 : 210}" letter-spacing="-8" fill="${fg}">${text}</text></svg>`,
  )

const file = (id: string, projectId: string, name: string, src: string, extra: Partial<StudioFile> = {}): StudioFile => ({
  id,
  projectId,
  name,
  category: 'Logos',
  versions: [{ id: id + '-v1', src, mime: 'image/svg+xml', size: src.length, createdAt: '2026-09-15T10:00:00' }],
  status: 'Approved',
  published: true,
  comments: [],
  createdAt: '2026-09-15T10:00:00',
  roundsUsed: 0,
  ...extra,
}) as StudioFile

const proposal = (id: string, projectId: string, name: string, status: Proposal['status'], extra: Partial<Proposal> = {}): Proposal => ({
  id,
  projectId,
  title: `A new chapter for ${name}`,
  intro: `Thank you for thinking of us. Here is how we would approach the ${name} project, what you get, and what it costs.`,
  sections: [
    { id: 's1', title: 'The challenge', body: `${name} has outgrown its current identity. We need a brand that feels confident, works everywhere and is easy for the team to use.` },
    { id: 's2', title: 'Our approach', body: 'Discovery workshop → strategic direction → two creative routes → refinement of the chosen route → brand hub and handover.' },
    { id: 's3', title: 'Timeline', body: 'About 8 weeks from kick-off to final files.' },
  ],
  items: [
    { id: 'i1', description: 'Discovery & strategy workshop', qty: 1, price: 12000 },
    { id: 'i2', description: 'Visual identity (logo, colour, typography)', qty: 1, price: 38000 },
    { id: 'i3', description: 'Brand hub & handover', qty: 1, price: 8000 },
  ],
  status,
  validUntil: '2026-10-31',
  createdAt: '2026-09-10T09:00:00',
  packages: [],
  addons: [],
  paymentPlan: [],
  chosenAddonIds: [],
  ...extra,
}) as Proposal

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: 'pt-brand',
    name: 'Brand identity',
    intro: 'Thank you for thinking of us. Here is how we would build your new identity, what you get, and what it costs.',
    sections: [
      { title: 'The challenge', body: '' },
      { title: 'Our approach', body: 'Discovery workshop → strategic direction → two creative routes → refinement of the chosen route → brand hub and handover.' },
      { title: 'Timeline', body: 'About 8 weeks from kick-off to final files.' },
    ],
    items: [
      { description: 'Discovery & strategy workshop', qty: 1, price: 12000 },
      { description: 'Visual identity (logo, colour, typography)', qty: 1, price: 38000 },
      { description: 'Brand hub & handover', qty: 1, price: 8000 },
    ],
    packages: [],
    addons: [
      { description: 'Social media templates (10)', qty: 1, price: 8000 },
      { description: 'Stationery set (cards, letterhead, envelope)', qty: 1, price: 6000 },
      { description: 'Brand guidelines as a printed book', qty: 1, price: 5500 },
    ],
    paymentPlan: [
      { label: '50% at start', percent: 50, trigger: 'On signing' },
      { label: '50% at delivery', percent: 50, trigger: 'At delivery' },
    ],
  },
  {
    id: 'pt-web',
    name: 'Website',
    intro: 'Here is our plan for a website that is easy to update and a pleasure to use.',
    sections: [
      { title: 'Goals', body: '' },
      { title: 'Our approach', body: 'Sitemap and wireframes → visual design → build → content → launch.' },
      { title: 'Timeline', body: 'About 10 weeks.' },
    ],
    items: [],
    packages: [
      { name: 'Launch', description: 'A focused 5-page site.', items: [{ description: 'Design & build (5 pages)', qty: 1, price: 45000 }] },
      { name: 'Grow', description: 'Up to 12 pages with a blog and CMS training.', recommended: true, items: [{ description: 'Design & build (12 pages)', qty: 1, price: 78000 }, { description: 'Blog & CMS training', qty: 1, price: 9000 }] },
    ],
    addons: [
      { description: 'Copywriting (per page)', qty: 5, price: 2400 },
      { description: 'Hosting & care plan (12 months)', qty: 12, price: 750 },
    ],
    paymentPlan: [
      { label: '40% at start', percent: 40, trigger: 'On signing' },
      { label: '40% at delivery', percent: 40, trigger: 'At delivery' },
      { label: '20% after launch', percent: 20, trigger: 'On completion' },
    ],
  },
  {
    id: 'pt-motion',
    name: 'Motion',
    intro: 'Here is how we would bring your brand to life in motion.',
    sections: [
      { title: 'The idea', body: '' },
      { title: 'Deliverables', body: 'Storyboard, styleframes, animation and exports for every channel.' },
    ],
    items: [
      { description: 'Storyboard & styleframes', qty: 1, price: 14000 },
      { description: 'Animation (per 15 seconds)', qty: 2, price: 11000 },
    ],
    packages: [],
    addons: [{ description: 'Sound design', qty: 1, price: 6500 }],
    paymentPlan: [
      { label: '50% at start', percent: 50, trigger: 'On signing' },
      { label: '50% at delivery', percent: 50, trigger: 'At delivery' },
    ],
  },
]

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tpl-brand',
    name: 'Brand identity',
    service: 'Brand identity',
    description: 'Discovery → strategy → two routes → refinement → brand hub.',
    tasks: [
      { title: 'Kick-off meeting', offsetDays: 3 },
      { title: 'Send discovery questionnaire', offsetDays: 3 },
      { title: 'Strategy presentation', offsetDays: 14 },
      { title: 'Present two creative routes', offsetDays: 28 },
      { title: 'Refine the chosen route', offsetDays: 42 },
      { title: 'Build the brand hub', offsetDays: 52 },
      { title: 'Handover & final files', offsetDays: 56 },
    ],
    questions: DISCOVERY_TEMPLATE,
    proposalTemplateId: 'pt-brand',
    budgetHours: 70,
    roundsIncluded: 2,
  },
  {
    id: 'tpl-web',
    name: 'Website',
    service: 'Web',
    description: 'Sitemap → wireframes → design → build → launch.',
    tasks: [
      { title: 'Kick-off & content plan', offsetDays: 5 },
      { title: 'Sitemap & wireframes', offsetDays: 14 },
      { title: 'Visual design', offsetDays: 30 },
      { title: 'Build', offsetDays: 55 },
      { title: 'Content entry & testing', offsetDays: 65 },
      { title: 'Launch', offsetDays: 70 },
    ],
    questions: [
      'What should a visitor do on the site?',
      'Which pages do you need?',
      'Who writes the content?',
      'Which websites do you like, and why?',
      'Do you have a domain and hosting already?',
    ],
    proposalTemplateId: 'pt-web',
    budgetHours: 110,
    roundsIncluded: 2,
  },
  {
    id: 'tpl-motion',
    name: 'Motion',
    service: 'Motion',
    description: 'Storyboard → styleframes → animation → exports.',
    tasks: [
      { title: 'Script & storyboard', offsetDays: 7 },
      { title: 'Styleframes', offsetDays: 14 },
      { title: 'Animation', offsetDays: 28 },
      { title: 'Sound & exports', offsetDays: 33 },
    ],
    questions: ['Where will the film be shown?', 'How long should it be?', 'What should people feel afterwards?', 'Any references you love?'],
    proposalTemplateId: 'pt-motion',
    budgetHours: 45,
    roundsIncluded: 2,
  },
]

const base = {
  version: 3,
  studio: {
    name: 'BETA_01',
    owner: 'Jonathan Walther',
    email: 'hello@beta01.studio',
    address: 'Studiestræde 1, 1455 København K',
    cvr: '12345678',
    country: 'DK',
    vatRate: 0.25,
    paymentTermsDays: 14,
    bank: 'Reg. 1234 · Konto 1234567890',
    hourlyRate: 950,
    setupDone: false,
    brand: { accent: '#1a4dff' },
    emails: { notifyStudio: true, notifyClient: true, weeklyDigest: true, overdueReminders: true },
    automations: { contractFromProposal: true, deliverWhenApproved: true },
  },
  team: [
    { id: 'm-owner', name: 'Jonathan Walther', email: 'hello@beta01.studio', role: 'Owner', capacity: 32, colour: '#1a4dff' },
    { id: 'm-mathilde', name: 'Mathilde Holm', email: 'mathilde@beta01.studio', role: 'Designer', capacity: 37, colour: '#e0673a', sample: true },
    { id: 'm-kasper', name: 'Kasper Lund', email: 'kasper@freelance.dk', role: 'Freelancer', capacity: 15, colour: '#2f7a4a', sample: true },
  ],
  currentMemberId: 'm-owner',
  projectTemplates: PROJECT_TEMPLATES,
  proposalTemplates: PROPOSAL_TEMPLATES,
  clients: [
    { id: 'c-beta', name: 'BETA_01', contactName: 'Jonathan Walther', contactEmail: 'hello@beta01.studio' },
    { id: 'c-forma', name: 'Kvist', contactName: 'Oliver Jensen', contactEmail: 'oliver@kvist.dk', sample: true },
    { id: 'c-nord', name: 'NORD', contactName: 'Sofie Larsen', contactEmail: 'sofie@nord.dk', sample: true },
    { id: 'c-ray', name: 'RAY', contactName: 'Alex Morgan', contactEmail: 'alex@ray.co', sample: true },
  ],
  projects: [
    {
      id: 'p-forma',
      name: 'Kvist – Brand strategy',
      clientId: 'c-forma',
      tagline: 'Space for a new perspective.',
      description: 'Positioning and verbal identity for an architecture practice.',
      service: 'Strategy',
      stage: 2,
      due: '2026-10-23',
      cover: { bg: '#D8E790', fg: '#353D26', wordmark: 'kvist.', serif: true },
      startDate: '2026-09-01',
      memberIds: ['m-owner', 'm-kasper'],
      budgetHours: 40,
      notes: 'Oliver prefers calls to email. Budget is tight — keep the strategy deck short.',
      tasks: [
        { id: 't1', title: 'Refine the brand positioning', done: false, due: '2026-10-23', assigneeId: 'm-kasper' },
        { id: 't2', title: 'Stakeholder interviews', done: true },
      ],
      hub: {
        colours: [
          { id: 'k1', name: 'Forest', hex: '#353D26', role: 'Primary', usage: 55 },
          { id: 'k2', name: 'Lime', hex: '#D8E790', role: 'Accent', usage: 15 },
          { id: 'k3', name: 'Chalk', hex: '#F6F5EF', role: 'Neutral', usage: 30 },
        ],
        fonts: [
          { id: 'f1', name: 'Instrument Serif', usage: 'Headlines' },
          { id: 'f2', name: 'Inter Tight', usage: 'Body text' },
        ],
        updatedAt: '2026-09-18',
      },
      discovery: {
        ...discoveryFrom(['We design calm, light-filled homes.', 'Families building their first home.']),
        sentAt: '2026-09-05T09:00:00',
      },
      updatedAt: '2026-09-20',
      sample: true,
    },
    {
      id: 'p-nord',
      name: 'NORD – Brand identity',
      clientId: 'c-nord',
      tagline: 'Made to feel like home.',
      description: 'A calm, Nordic identity for a furniture label.',
      service: 'Brand identity',
      stage: 1,
      due: '2026-10-16',
      cover: { bg: '#eab8a4', fg: '#2a1a14', wordmark: 'NORD' },
      startDate: '2026-09-08',
      memberIds: ['m-mathilde'],
      budgetHours: 60,
      tasks: [
        { id: 't1', title: 'Complete the discovery questionnaire', done: false, due: '2026-10-16', assigneeId: 'm-mathilde' },
        { id: 't2', title: 'Kick-off workshop', done: true },
      ],
      hub: { colours: [], fonts: [], updatedAt: '2026-09-12' },
      discovery: { ...discoveryFrom(['Solid-wood furniture made in Denmark.', 'Design-aware couples, 30–45.']), sentAt: '2026-09-12T09:00:00' },
      updatedAt: '2026-09-17',
      sample: true,
    },
    {
      id: 'p-ray',
      name: 'RAY – Brand identity',
      clientId: 'c-ray',
      tagline: 'A brighter kind of everyday.',
      description: 'A fresh identity for a new generation of everyday essentials.',
      service: 'Brand identity',
      stage: 3,
      due: '2026-10-08',
      cover: { bg: '#1a4dff', fg: '#ffffff', wordmark: 'ray.' },
      startDate: '2026-08-25',
      memberIds: ['m-owner', 'm-mathilde'],
      budgetHours: 70,
      roundsIncluded: 2,
      notes: 'Alex signs off on everything — loop in their CMO (Sam) for the packaging round.',
      onboarding: { welcome: 'Welcome aboard! This is where everything for the RAY identity lives.', completedAt: '2026-08-27T10:00:00' },
      tasks: [
        { id: 't1', title: 'Review the identity presentation', done: false, due: '2026-10-08', assigneeId: 'm-owner' },
        { id: 't3', title: 'Packaging mockups for round 2', done: false, due: '2026-10-02', assigneeId: 'm-mathilde' },
        { id: 't2', title: 'Gather brand inspiration', done: true },
      ],
      hub: {
        colours: [
          { id: 'k1', name: 'Cobalt', hex: '#1A4DFF', role: 'Primary', usage: 50 },
          { id: 'k2', name: 'Off-white', hex: '#F2F1EC', role: 'Neutral', usage: 30 },
          { id: 'k3', name: 'Ink', hex: '#111111', role: 'Secondary', usage: 12 },
          { id: 'k4', name: 'Sunny', hex: '#FFD23F', role: 'Accent', usage: 8 },
        ],
        fonts: [
          { id: 'f1', name: 'Inter Tight', usage: 'Headlines & body' },
          { id: 'f2', name: 'JetBrains Mono', usage: 'Labels' },
        ],
        tone: {
          summary: 'RAY talks like a cheerful neighbour: warm, direct and a little bit playful. Never smug, never salesy.',
          weAre: ['Bright', 'Honest', 'Friendly', 'Down to earth'],
          weAreNot: ['Preachy', 'Luxurious', 'Corporate', 'Cutesy'],
          examples: [
            { id: 'e1', say: 'Soap that smells like Sunday morning.', dontSay: 'Premium artisanal cleansing experience.' },
            { id: 'e2', say: 'Out of stock — back Tuesday!', dontSay: 'This item is currently unavailable.' },
          ],
        },
        imagery: 'Real homes, real light. Bright daylight, warm skin tones, a pop of cobalt in every shot. No studio white-outs.',
        updatedAt: '2026-09-20',
      },
      discovery: {
        ...discoveryFrom([
          'Affordable everyday essentials — soap, towels, kitchen basics.',
          'Young urban households who care about design but not luxury.',
          'Bright, honest, friendly.',
          'Big supermarket own-brands. We are more joyful and better designed.',
          'Muji for honesty, Oatly for tone of voice.',
          'Nothing that looks cheap or “eco-beige”.',
          'Packaging and Instagram first.',
          'Launch in stores 1 February.',
        ]),
        sentAt: '2026-08-28T09:00:00',
        submittedAt: '2026-09-01T16:20:00',
      },
      updatedAt: '2026-09-20',
      sample: true,
    },
    {
      id: 'p-beta',
      name: 'BETA_01 – Brand identity',
      clientId: 'c-beta',
      tagline: '',
      description: 'Our own studio identity.',
      service: 'Brand identity',
      stage: 0,
      cover: { bg: '#141414', fg: '#faf9f6', wordmark: 'BETA_01' },
      startDate: '2026-09-20',
      memberIds: ['m-owner'],
      tasks: [{ id: 't1', title: 'Collect questionnaire and references', done: false }],
      hub: { colours: [], fonts: [], updatedAt: '2026-09-20' },
      discovery: discoveryFrom(),
      updatedAt: '2026-09-20',
    },
  ],
  files: [
    file('f-ray-1', 'p-ray', 'ray-primary-cobalt.svg', svg('ray.', '#ffffff', '#1a4dff'), { approvedBy: 'Alex Morgan', approvedAt: '2026-09-18T12:00:00' }),
    file('f-ray-2', 'p-ray', 'ray-primary-offwhite.svg', svg('ray.', '#1a4dff', '#f2f1ec'), { approvedBy: 'Alex Morgan', approvedAt: '2026-09-18T12:00:00' }),
    file('f-ray-3', 'p-ray', 'ray-icon-black.svg', svg('r.', '#f2f1ec', '#111111'), {
      status: 'In review',
      published: false,
      versions: [
        { id: 'f-ray-3-v1', src: svg('r', '#f2f1ec', '#111111'), mime: 'image/svg+xml', size: 900, note: 'First round', createdAt: '2026-09-14T10:00:00' },
        { id: 'f-ray-3-v2', src: svg('r.', '#f2f1ec', '#111111'), mime: 'image/svg+xml', size: 900, note: 'Added the dot from the wordmark', createdAt: '2026-09-19T10:00:00' },
      ],
      comments: [
        { id: 'cm1', versionId: 'f-ray-3-v1', author: 'Alex Morgan', fromClient: true, text: 'Feels a bit anonymous without the dot?', x: 62, y: 55, resolved: true, at: '2026-09-15T09:00:00' },
        { id: 'cm2', versionId: 'f-ray-3-v2', author: 'Jonathan Walther', fromClient: false, text: 'Dot added — same proportion as in the wordmark.', at: '2026-09-19T10:05:00' },
      ],
    }),
    file('f-forma-1', 'p-forma', 'kvist-wordmark.svg', svg('kvist.', '#2f3a1c', '#d9e4a0', true)),
  ],
  decks: [],
  proposals: [
    proposal('pr-ray', 'p-ray', 'RAY', 'Accepted', {
      sentAt: '2026-09-02T10:00:00',
      respondedBy: 'Alex Morgan',
      respondedAt: '2026-09-04T15:00:00',
      paymentPlan: [
        { id: 'pp1', label: '50% at start', percent: 50, trigger: 'On signing', invoiceId: 'i1' },
        { id: 'pp2', label: '50% at delivery', percent: 50, trigger: 'At delivery', invoiceId: 'i2' },
      ],
    }),
    proposal('pr-forma', 'p-forma', 'kvist.', 'Sent', {
      sentAt: '2026-09-18T10:00:00',
      items: [],
      packages: [
        { id: 'pk1', name: 'Essential', description: 'Positioning and a sharp verbal identity.', items: [{ id: 'a', description: 'Strategy workshop', qty: 1, price: 12000 }, { id: 'b', description: 'Positioning & messaging', qty: 1, price: 18000 }] },
        { id: 'pk2', name: 'Complete', description: 'Everything in Essential, plus a tone-of-voice guide and naming.', recommended: true, items: [{ id: 'a', description: 'Strategy workshop', qty: 1, price: 12000 }, { id: 'b', description: 'Positioning & messaging', qty: 1, price: 18000 }, { id: 'c', description: 'Tone of voice guide', qty: 1, price: 9000 }, { id: 'd', description: 'Naming for 3 services', qty: 1, price: 7000 }] },
      ],
      addons: [
        { id: 'ad1', description: 'Website copy (5 pages)', qty: 1, price: 14000 },
        { id: 'ad2', description: 'Team workshop on the new messaging', qty: 1, price: 6000 },
      ],
      paymentPlan: [
        { id: 'pp1', label: '50% at start', percent: 50, trigger: 'On signing' },
        { id: 'pp2', label: '50% on completion', percent: 50, trigger: 'On completion' },
      ],
    }),
    proposal('pr-nord', 'p-nord', 'NORD', 'Draft'),
  ],
  contracts: [
    {
      id: 'ct-ray',
      projectId: 'p-ray',
      proposalId: 'pr-ray',
      title: 'Project agreement – RAY',
      body: DEFAULT_CONTRACT,
      status: 'Signed',
      signedBy: 'Alex Morgan',
      signedAt: '2026-09-05T11:00:00',
      createdAt: '2026-09-04T16:00:00',
    },
  ],
  invoices: [
    { id: 'i1', number: 'INV-001', clientId: 'c-ray', projectId: 'p-ray', amount: 36250, description: '50% at start – RAY brand identity', issuedAt: '2026-09-06', due: '2026-09-20', status: 'Paid' },
    { id: 'i2', number: 'INV-002', clientId: 'c-ray', projectId: 'p-ray', amount: 36250, description: '50% at delivery – RAY brand identity', issuedAt: '2026-09-17', due: '2026-10-01', status: 'Issued' },
    { id: 'i3', number: 'INV-003', clientId: 'c-forma', projectId: 'p-forma', amount: 15622, description: 'Strategy workshop', due: '2026-10-01', status: 'Draft' },
  ],
  nextInvoiceNumber: 4,
  choices: [],
  timeEntries: [
    { id: 'te1', projectId: 'p-ray', memberId: 'm-owner', minutes: 900, note: 'Workshop + strategy', date: '2026-08-28' },
    { id: 'te2', projectId: 'p-ray', memberId: 'm-mathilde', minutes: 1500, note: 'Identity concepts', date: '2026-09-10' },
    { id: 'te3', projectId: 'p-ray', memberId: 'm-mathilde', minutes: 660, note: 'Icon round 2', date: '2026-09-19' },
    { id: 'te4', projectId: 'p-forma', memberId: 'm-kasper', minutes: 480, note: 'Interviews', date: '2026-09-12' },
    { id: 'te5', projectId: 'p-nord', memberId: 'm-mathilde', minutes: 240, note: 'Kick-off', date: '2026-09-15' },
  ],
  hubVersions: [],
  approvals: [],
  timeOff: [],
  expenses: [],
  notifications: [],
  outbox: [],
  designs: [],
  mockups: [],
  posts: [],
  webPages: [],
  audits: [],
  activity: [
    { id: 'a0', text: 'Version 2 of ray-icon-black.svg shared for review', projectId: 'p-ray', at: '2026-09-19T10:05:00' },
    { id: 'a1', text: 'Proposal sent', projectId: 'p-forma', at: '2026-09-18T10:00:00' },
    { id: 'a2', text: 'Brand hub updated', projectId: 'p-ray', at: '2026-09-20T11:02:00' },
    { id: 'a3', text: 'Project created', projectId: 'p-beta', at: '2026-09-20T09:30:00' },
  ],
} as unknown as State

export const seed: State = normalizeState(base as unknown as State & Record<string, unknown>, base)
