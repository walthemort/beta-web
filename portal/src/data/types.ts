/** Default stage names. Studios can rename, recolour, reorder and add stages in Settings → Workflow. */
export const STAGES = ['Onboarding', 'Discovery', 'Strategy', 'Design', 'Delivery', 'Complete'] as const
export type Stage = (typeof STAGES)[number]

export interface StageDef {
  id: string
  name: string
  colour: string
  /** Reaching this stage triggers “At delivery” payment steps. */
  delivery?: boolean
}

/** A way of working – its own stages. A studio that does brand and web work has one for each. */
export interface Workflow {
  id: string
  name: string
  /** The stages, in order. The last one means “complete”. */
  stages: StageDef[]
}

export const SERVICES = ['Brand identity', 'Motion', 'Web', 'Print', 'Strategy'] as const
export type Service = (typeof SERVICES)[number]

export type Lang = 'en' | 'da'
/** 'auto' follows the viewer's device; the others lock the page. */
export type Theme = 'auto' | 'light' | 'dark'

export interface Contact {
  id: string
  name: string
  email: string
  role?: string
}

export interface Client {
  id: string
  name: string
  contactName: string
  contactEmail: string
  /** Extra people at the client (added during onboarding). */
  contacts: Contact[]
  /** Language of the client portal and emails. */
  language: Lang
  /** For invoices. */
  address?: string
  cvr?: string
  /** Danish VAT, EU reverse charge or outside the EU (default: Danish VAT). */
  vat?: VatTreatment
  sample?: boolean
}

export type VatTreatment = 'dk' | 'eu' | 'export'

/* ---------- Team ---------- */

export const ROLES = ['Owner', 'Designer', 'Freelancer'] as const
export type Role = (typeof ROLES)[number]

export interface Member {
  id: string
  name: string
  email: string
  role: Role
  /** Hours per week available for project work. */
  capacity: number
  colour: string
  /** Language of the studio app for this person (default English). */
  lang?: Lang
  /** One of the example people that come with the sample projects. */
  sample?: boolean
  /** How the studio app looks for this member. */
  theme?: Theme
}

export interface Task {
  id: string
  title: string
  done: boolean
  due?: string // ISO date
  assigneeId?: string
  /** The client comment this task was made from; finishing the task resolves the comment. */
  fromCommentId?: string
}

/* ---------- Brand hub ---------- */

export const COLOUR_ROLES = ['Primary', 'Secondary', 'Accent', 'Neutral'] as const
export type ColourRole = (typeof COLOUR_ROLES)[number]

export interface BrandColour {
  id: string
  name: string
  hex: string
  role?: ColourRole
  /** Share of use in the brand, in percent (drives the palette strip). */
  usage?: number
}

export interface LogoRules {
  /** Clear space around the logo, as a fraction of the logo height. */
  clearSpace: number
  minWidthPx: number
  minWidthMm: number
  dos: string[]
  donts: string[]
}

export interface ToneOfVoice {
  summary: string
  weAre: string[]
  weAreNot: string[]
  examples: { id: string; say: string; dontSay: string }[]
}

export interface TypeScale {
  base: number // px
  ratio: number // e.g. 1.25
}

export interface BrandHub {
  colours: BrandColour[]
  fonts: { id: string; name: string; usage: string }[]
  logoRules: LogoRules
  typeScale: TypeScale
  tone: ToneOfVoice
  /** Photo direction shown above the moodboard images. */
  imagery: string
  /** Optional protection for the shared hub. */
  access: { passwordHash?: string; expiresAt?: string }
  /** How this hub looks to the client; unset means the portal's setting. */
  theme?: Theme
  updatedAt: string
}

export interface HubVersion {
  id: string
  projectId: string
  label: string
  note?: string
  snapshot: Omit<BrandHub, 'access'>
  at: string
}

/* ---------- Projects ---------- */

export interface Project {
  id: string
  name: string
  clientId: string
  tagline: string
  description: string
  service: Service
  stage: number // index into its workflow's stages
  /** Which of the studio's workflows this project follows. */
  workflowId?: string
  startDate: string
  due?: string
  cover: { bg: string; fg: string; wordmark: string; serif?: boolean }
  tasks: Task[]
  hub: BrandHub
  discovery: Discovery
  /** Internal notes – never shown to the client. */
  notes: string
  memberIds: string[]
  budgetHours?: number
  /** Revision rounds included in the price. */
  roundsIncluded: number
  onboarding: { welcome: string; videoUrl?: string; completedAt?: string }
  archived?: boolean
  caseStudy?: { published: boolean; intro: string; fileIds: string[]; showQuote?: boolean }
  /** A fixed monthly fee for a number of hours (excl. VAT). Months are 'YYYY-MM'. */
  retainer?: { monthlyFee: number; hoursIncluded: number; startMonth: string; endMonth?: string; invoicedMonths: string[]; extraInvoicedMonths?: string[] }
  /** The final files, guidelines and usage rights for the client. Visible to them once shared. */
  handover?: { message?: string; rights: string; fileIds?: string[]; sharedAt?: string }
  /** Email signatures for the client's team, made from the brand. */
  signatures?: SignatureSet
  /** The details on the Word letterhead (Presenter). */
  letterhead?: { company?: string; address?: string; phone?: string; email?: string; website?: string; vat?: string }
  /** The Brand Assistant (an AI that knows the brand) in the client portal. */
  assistant?: { enabled: boolean; welcome?: string }
  /** The studio keeps the brand hub online for the client for a monthly fee, invoiced like a retainer. */
  hubHosting?: { monthlyFee: number; startMonth: string; endMonth?: string; invoicedMonths: string[] }
  /** The client's score and words when the project is done. */
  feedback?: { score: number; quote?: string; mayQuote: boolean; by: string; at: string }
  updatedAt: string
  sample?: boolean
}

export interface ProjectTemplate {
  id: string
  name: string
  service: Service
  description: string
  tasks: { title: string; offsetDays?: number }[]
  questions: string[]
  proposalTemplateId?: string
  budgetHours?: number
  roundsIncluded: number
}

/* ---------- Comments (shared by files and presentations) ---------- */

export const REACTIONS = ['👍', '❤️', '🤔', '🎉'] as const
export type Reaction = (typeof REACTIONS)[number]

export interface Comment {
  id: string
  /** File version the comment belongs to (files only). */
  versionId?: string
  parentId?: string
  author: string
  fromClient: boolean
  text: string
  /** Image/PDF pin, as a percentage of the page. */
  x?: number
  y?: number
  /** PDF page (1-based). */
  page?: number
  /** Video timestamp in seconds. */
  time?: number
  /** Presentation slide. */
  slide?: number
  /** Content Machine: the artboard a pin sits on (x/y are then % of the artboard). */
  artboardId?: string
  voice?: { src: string; seconds: number }
  reactions?: Partial<Record<Reaction, string[]>>
  resolved?: boolean
  at: string
}

/* ---------- Files, versions & review ---------- */

export const FILE_CATEGORIES = ['Logos', 'Artwork', 'Presentations', 'Documents', 'Moodboard', 'From client'] as const
export type FileCategory = (typeof FILE_CATEGORIES)[number]
export type ReviewStatus = 'Not shared' | 'In review' | 'Changes requested' | 'Approved'

export interface FileVersion {
  id: string
  /** 'idb:<key>' for uploaded blobs, or a data: URL for small built-in files. */
  src: string
  mime: string
  size: number
  note?: string
  createdAt: string
}

export interface StudioFile {
  id: string
  projectId: string
  name: string
  category: FileCategory
  versions: FileVersion[] // newest last
  status: ReviewStatus
  /** Shown in the brand hub / client downloads. */
  published: boolean
  /** What a logo is shown on in the hub: worked out from the image ('auto'), or chosen. */
  previewBg?: 'auto' | 'light' | 'dark' | 'brand'
  comments: Comment[]
  /** How many times the client has requested changes (revision rounds used). */
  roundsUsed: number
  reviewBy?: string
  uploadedBy?: 'studio' | 'client'
  approvedBy?: string
  approvedAt?: string
  changesRequestedBy?: string
  createdAt: string
}

/* ---------- Figma presentations ---------- */

export const DECK_PURPOSES = ['Proposal', 'Direction', 'Presentation'] as const
export type DeckPurpose = (typeof DECK_PURPOSES)[number]

/** A Figma file, prototype or Slides deck shown to the client as a 16:9 presentation. */
export interface Deck {
  id: string
  projectId: string
  title: string
  url: string
  purpose: DeckPurpose
  status: ReviewStatus
  comments: Comment[]
  roundsUsed: number
  reviewBy?: string
  approvedBy?: string
  approvedAt?: string
  changesRequestedBy?: string
  createdAt: string
  updatedAt: string
}

/** "Pick a route": the client chooses one of several directions. */
export interface Choice {
  id: string
  projectId: string
  title: string
  question: string
  options: { id: string; label: string; description: string; fileId?: string }[]
  status: 'Draft' | 'Open' | 'Decided'
  chosenId?: string
  chosenBy?: string
  reason?: string
  decidedAt?: string
  reviewBy?: string
  createdAt: string
}

/* ---------- Proposals & contracts ---------- */

export type ProposalStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined'

export interface LineItem {
  id: string
  description: string
  qty: number
  price: number // per unit, excl. VAT
}

export interface Package {
  id: string
  name: string
  description: string
  items: LineItem[]
  recommended?: boolean
}

export const PAYMENT_TRIGGERS = ['On signing', 'At delivery', 'On completion'] as const
export type PaymentTrigger = (typeof PAYMENT_TRIGGERS)[number]

export interface PaymentStep {
  id: string
  label: string
  percent: number
  trigger: PaymentTrigger
  invoiceId?: string
  /** Set by “Invoice now” to create this step’s invoice before its trigger. */
  invoiceNow?: boolean
}

export interface Proposal {
  id: string
  projectId: string
  title: string
  intro: string
  sections: { id: string; title: string; body: string }[]
  /** Fixed scope (used when there are no packages). */
  items: LineItem[]
  /** Optional: the client picks one package instead of fixed items. */
  packages: Package[]
  /** Optional extras the client can tick. */
  addons: LineItem[]
  paymentPlan: PaymentStep[]
  chosenPackageId?: string
  chosenAddonIds: string[]
  status: ProposalStatus
  validUntil?: string
  sentAt?: string
  respondedBy?: string
  respondedAt?: string
  createdAt: string
}

export interface ProposalTemplate {
  id: string
  name: string
  intro: string
  sections: { title: string; body: string }[]
  items: Omit<LineItem, 'id'>[]
  packages: { name: string; description: string; items: Omit<LineItem, 'id'>[]; recommended?: boolean }[]
  addons: Omit<LineItem, 'id'>[]
  paymentPlan: { label: string; percent: number; trigger: PaymentTrigger }[]
}

export type ContractStatus = 'Draft' | 'Sent' | 'Signed'

export interface Contract {
  id: string
  projectId: string
  proposalId?: string
  title: string
  body: string
  status: ContractStatus
  signedBy?: string
  signedAt?: string
  /** Drawn signature as a PNG data URL. */
  signature?: string
  /** Recorded at signing (IP is added once there is a server). */
  signedMeta?: { userAgent: string; timezone: string; ip?: string }
  createdAt: string
}

/* ---------- Discovery ---------- */

export interface Discovery {
  questions: { id: string; q: string; a: string }[]
  sentAt?: string
  submittedAt?: string
}

/* ---------- Money & time ---------- */

export type InvoiceStatus = 'Draft' | 'Issued' | 'Paid'

export interface Invoice {
  id: string
  number: string
  clientId: string
  projectId?: string
  amount: number // incl. VAT, in DKK
  /** The VAT rate that applied when the invoice was created (0 for reverse charge/export). */
  vatRate?: number
  description?: string
  due?: string
  issuedAt?: string
  paidAt?: string
  /** The month ('YYYY-MM') a retainer invoice covers. */
  retainerMonth?: string
  /** The month ('YYYY-MM') a brand hub hosting invoice covers. */
  hostingMonth?: string
  /** Billable expenses this invoice passes on to the client. */
  expenseIds?: string[]
  /** MobilePay / Stripe / bank payment link shown to the client. */
  paymentLink?: string
  remindersSent: string[]
  status: InvoiceStatus
}

export interface TimeEntry {
  id: string
  projectId: string
  memberId: string
  minutes: number
  note: string
  date: string // YYYY-MM-DD
}

/* ---------- Activity, notifications & email ---------- */

export interface Activity {
  id: string
  text: string
  projectId?: string
  fromClient?: boolean
  at: string
}

export interface Notification {
  id: string
  audience: 'studio' | 'client'
  projectId?: string
  text: string
  link?: string
  read: boolean
  at: string
}

export interface Email {
  id: string
  to: string
  subject: string
  body: string
  kind: 'notification' | 'digest' | 'reminder' | 'invite'
  projectId?: string
  /** "Queued" until an email service is connected; "Opened in Mail" when sent by hand. */
  status: 'Queued' | 'Opened in Mail' | 'Sent'
  at: string
}

export interface Studio {
  name: string
  owner: string
  email: string
  address: string
  cvr: string
  vatRate: number // e.g. 0.25
  paymentTermsDays: number
  bank: string
  hourlyRate: number // kr. excl. VAT, used for extra rounds and profitability
  /** Rename uploads to a tidy, server-safe name (on unless turned off). */
  tidyNames?: boolean
  /** The studio's own company-lookup endpoint; '{q}' is replaced with the search text. */
  cvrLookupUrl?: string
  /** Portal branding. */
  brand: {
    logoSrc?: string
    /** Optional logo for dark backgrounds; without it the normal logo is used everywhere. */
    logoDarkSrc?: string
    /** The accent on light backgrounds. */
    accent: string
    /** The accent on dark backgrounds; without it a readable shade of `accent` is worked out. */
    accentDark?: string
    /** Light, dark or the viewer's own setting on every client page. */
    portalTheme?: Theme
    portalDomain?: string
  }
  /** The studio's workflows; every project follows one of them (the first when it hasn't picked one). */
  workflows: Workflow[]
  /** False until the first-time setup has been completed. */
  setupDone?: boolean
  /** When a backup was last downloaded (the reminder counts from here). */
  lastBackupAt?: string
  /** “Remind me later” on the backup reminder. */
  backupSnoozeUntil?: string
  /** Read-only share link for the status board (a random token). */
  boardShareToken?: string
  /** Which email types are generated. */
  emails: { notifyStudio: boolean; notifyClient: boolean; weeklyDigest: boolean; overdueReminders: boolean }
  /** Which Aftryk plan the studio is on (see plans.ts); none means Free. */
  plan?: 'free' | 'pro' | 'studio'
  /** Where the studio is based (ISO code) – sets the currency for Aftryk's prices and the VAT on them. */
  country?: string
  /** The studio's subscription to Aftryk. Filled in by checkout (see billing.ts). */
  billing?: Billing
  /** Extras unlocked before plans existed (kept for studios that already use them). */
  addons?: { contentMachine?: { since: string } }
  /** The apps a Pro studio has picked (Studio has them all – see hasApp in plans.ts). */
  apps?: AppId[]
  /** AI images made in the Content Machine this month (see aiAllowance in plans.ts). */
  aiUsage?: { month: string; images: number }
  /** Artboards saved as starting points, for any client's brand. */
  designTemplates?: DesignTemplate[]
  /** Features switched on studio by studio before they join a plan: asked for, or granted. */
  earlyAccess?: { companyLookup?: { requestedAt?: string; granted?: boolean } }
  /** Steps Aftryk takes by itself when the client does something. */
  automations: { contractFromProposal: boolean; deliverWhenApproved: boolean }
}

/** A studio's subscription to Aftryk. */
export interface Billing {
  /** 'beta': switched on without payment while Aftryk is in beta. */
  provider: 'beta' | 'stripe'
  status: 'active' | 'past_due' | 'canceled'
  period: 'monthly' | 'yearly'
  /** Extra file-space packs on top of the plan. */
  extraStorage: number
  startedAt: string
  renewsAt: string
  /** When a cancelled subscription ends (it runs until the end of the period paid for). */
  cancelAt?: string
  customerId?: string
  subscriptionId?: string
  /** Who Aftryk invoices. */
  details: { company: string; email: string; address: string; vatNumber?: string }
}

/* ---------- Sales: leads before they are clients ---------- */

export const LEAD_STAGES = ['New', 'Contacted', 'Meeting booked', 'Proposal sent', 'Won', 'Lost'] as const
export type LeadStage = (typeof LEAD_STAGES)[number]
/** The stages a lead is still live in – what the pipeline shows. */
export const OPEN_LEAD_STAGES = LEAD_STAGES.filter((s) => s !== 'Won' && s !== 'Lost')

export const LEAD_SOURCES = ['Referral', 'Instagram', 'LinkedIn', 'Website', 'Search engine', 'Event', 'Company register', 'Cold outreach', 'Other'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const LOST_REASONS = ['Price', 'Timing', 'Went elsewhere', 'Did it in-house', 'No answer', 'Not a fit', 'Other'] as const
export type LostReason = (typeof LOST_REASONS)[number]

/** Someone who might become a client. Becomes a real client + project when you win it. */
export interface Lead {
  id: string
  company: string
  /** From the CVR register, when looked up. */
  cvr?: string
  address?: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  source: LeadSource
  stage: LeadStage
  /** What you expect to invoice, excl. VAT. */
  value?: number
  note?: string
  /** The single next thing you owe this lead. */
  nextStep?: string
  nextStepDue?: string
  lostReason?: LostReason
  /** Which sales lists this lead is on. */
  listIds?: string[]
  /** Who on the team is working it. */
  assigneeId?: string
  /** Industry and size, when the lead came from the company register. */
  industry?: string
  employees?: string
  /** Set when the lead is won and turned into real work. */
  clientId?: string
  projectId?: string
  createdAt: string
  updatedAt: string
  sample?: boolean
}

/** A named list of leads for the sales team to work through. */
export interface LeadList {
  id: string
  name: string
  /** What the list was built from, e.g. "håndværkere i Aarhus". */
  query?: string
  assigneeId?: string
  createdAt: string
}

/* ---------- Expenses ---------- */

export const EXPENSE_CATEGORIES = ['Fonts & licences', 'Stock images', 'Print & production', 'Freelancers', 'Software', 'Travel', 'Other'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

/** A cost on a project, excl. VAT. Billable ones are passed on to the client. */
export interface Expense {
  id: string
  projectId: string
  date: string
  description: string
  amount: number
  category: ExpenseCategory
  billable: boolean
}

/* ---------- Time off ---------- */

export const TIME_OFF_KINDS = ['Holiday', 'Sick', 'Other'] as const
export type TimeOffKind = (typeof TIME_OFF_KINDS)[number]

export interface TimeOff {
  id: string
  memberId: string
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD, inclusive
  kind: TimeOffKind
  note?: string
}

/* ---------- Approval record ---------- */

export type ApprovalAction = 'Approved' | 'Changes requested' | 'Chose' | 'Accepted' | 'Declined' | 'Signed' | 'Submitted'
export type ApprovalKind = 'File' | 'Presentation' | 'Route' | 'Proposal' | 'Contract' | 'Questionnaire'

/** One decision, kept for good (never trimmed) – the basis of the approval record PDF. */
export interface ApprovalEntry {
  id: string
  projectId: string
  at: string
  by: string
  action: ApprovalAction
  kind: ApprovalKind
  itemId: string
  item: string
  /** Version, chosen package, reason, signature details… */
  detail?: string
}

export interface State {
  version: 3
  studio: Studio
  team: Member[]
  /** Who is using the app right now (until there is real login). */
  currentMemberId: string
  clients: Client[]
  projects: Project[]
  projectTemplates: ProjectTemplate[]
  proposalTemplates: ProposalTemplate[]
  files: StudioFile[]
  decks: Deck[]
  choices: Choice[]
  proposals: Proposal[]
  contracts: Contract[]
  invoices: Invoice[]
  nextInvoiceNumber: number
  timeEntries: TimeEntry[]
  hubVersions: HubVersion[]
  approvals: ApprovalEntry[]
  timeOff: TimeOff[]
  expenses: Expense[]
  leads: Lead[]
  leadLists: LeadList[]
  activity: Activity[]
  notifications: Notification[]
  outbox: Email[]
  /** Content Machine: social posts and other graphics made on the client's brand. */
  designs: Design[]
  /** Mockups app: work shown on business cards, phones, posters… */
  mockups: Mockup[]
  /** Social Planner app: posts in the calendar, approved by the client. */
  posts: SocialPost[]
  /** Pages app: link-in-bio, coming-soon and campaign pages. */
  webPages: WebPage[]
  /** Brand Audit app: reports on how on-brand a website is. */
  audits: Audit[]
}

/* ---------- Apps ---------- */

export type AppId = 'contentMachine' | 'mockups' | 'presenter' | 'socialPlanner' | 'pages' | 'assistant' | 'audit'

/** Email signatures: one layout for the client, one entry per person. */
export interface SignatureSet {
  layout: 'simple' | 'logo' | 'bar'
  /** A logo on the web (email programs don't show attached or embedded images reliably). */
  logoUrl?: string
  website?: string
  address?: string
  people: { id: string; name: string; title: string; phone?: string; email: string }[]
}

export interface Mockup {
  id: string
  projectId: string
  name: string
  /** One of the scenes in features/apps/mockups/scenes.ts, or 'photo' for your own. */
  scene: string
  source:
    /** A design's artboard – and, for things with more sides, which artboard goes on each ('' = the brand colour). */
    | { kind: 'design'; designId: string; artboardId: string; faces?: { back?: string; side?: string; top?: string; envelope?: string; card?: string } }
    | { kind: 'file'; fileId: string }
    | { kind: 'logo' }
  /** For 'photo': the picture, and where the design's four corners sit on it (0–1). */
  photo?: string
  corners?: [number, number][]
  /** The scene's own colour (wall, shirt, background). */
  tint?: string
  /** Blend the design into the photo's light and texture. */
  blend?: boolean
  /** 3D scenes: how the camera is turned, and the light. */
  view?: { az: number; el: number; zoom: number }
  mood?: 'studio' | 'sun' | 'plant'
  /** The last render, for the list. */
  preview?: string
  createdAt: string
  updatedAt: string
}

export const SOCIAL_CHANNELS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X'] as const
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number]
export type PostStatus = 'Draft' | 'For approval' | 'Approved' | 'Changes requested' | 'Posted'

export interface SocialPost {
  id: string
  projectId: string
  /** YYYY-MM-DD and HH:MM */
  date: string
  time?: string
  channels: SocialChannel[]
  caption: string
  /** A design from the Content Machine, or an image. */
  designId?: string
  artboardId?: string
  image?: string
  status: PostStatus
  comments: Comment[]
  approvedBy?: string
  createdAt: string
  updatedAt: string
}

export type PageBlock =
  | { id: string; type: 'hero'; heading: string; text: string; image?: string; button?: { label: string; url: string } }
  | { id: string; type: 'links'; items: { id: string; label: string; url: string }[] }
  | { id: string; type: 'text'; heading?: string; body: string }
  | { id: string; type: 'image'; src: string; caption?: string }
  | { id: string; type: 'gallery'; images: string[] }
  | { id: string; type: 'countdown'; label: string; date: string }
  | { id: string; type: 'signup'; heading: string; button: string }
  | { id: string; type: 'contact'; email?: string; phone?: string; address?: string }
  | { id: string; type: 'social'; links: { network: string; url: string }[] }

export interface WebPage {
  id: string
  projectId: string
  title: string
  /** The address: /site/<slug> (or the studio's own domain). */
  slug: string
  theme: 'light' | 'dark' | 'brand'
  blocks: PageBlock[]
  description?: string
  published: boolean
  /** Emails left with a sign-up block. */
  signups?: { email: string; at: string }[]
  views?: number
  createdAt: string
  updatedAt: string
}

export interface AuditResult {
  url: string
  finalUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  lang?: string
  themeColour?: string
  /** Set up for phones (a viewport tag). */
  viewport?: boolean
  https: boolean
  loadMs: number
  colours: { hex: string; count: number }[]
  fonts: string[]
  images: { count: number; missingAlt: number }
  headings: { h1: number; h2: number }
  /** Labels and details are English templates – `vars` fill in the {placeholders}. */
  checks: { id: string; ok: boolean; label: string; detail?: string; vars?: Record<string, string | number> }[]
  score: number
  summary?: string
  advice?: string[]
}

export interface Audit {
  id: string
  url: string
  /** Compared with this client's brand hub, when chosen. */
  projectId?: string
  leadId?: string
  result: AuditResult
  createdAt: string
}

/* ---------- Content Machine ---------- */

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'soft-light' | 'color' | 'luminosity'
/** Two brand colours blended: along an angle, or out from the middle. */
export interface Gradient {
  type: 'linear' | 'radial'
  angle: number
  stops: [string, string]
}
export interface Shadow {
  x: number
  y: number
  blur: number
  colour: string
  /** 0–1 */
  opacity: number
}
/**
 * How a layer follows when its artboard changes size, like Figma's constraints: stay by the start
 * or end edge, stay centred, stretch with it, or scale with it. Unset means Aftryk decides.
 */
export type Pin = 'start' | 'end' | 'centre' | 'stretch' | 'scale'

/** Everything on an artboard. Positions and sizes are in the artboard's own pixels. */
interface LayerBase {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  /** Mirrored left–right / top–bottom. */
  flipX?: boolean
  flipY?: boolean
  opacity?: number
  hidden?: boolean
  locked?: boolean
  /** Layers in a group move, size and select together (see Artboard.groups). */
  groupId?: string
  blend?: BlendMode
  shadow?: Shadow
  /** Soften the whole layer, in px. */
  blur?: number
  pin?: { x: Pin; y: Pin }
  /** Motion: how the layer comes in, and whether it keeps moving. */
  anim?: LayerAnim
}

export type AnimIn = 'none' | 'fade' | 'rise' | 'drop' | 'slide-left' | 'slide-right' | 'zoom' | 'pop' | 'blur' | 'wipe' | 'type'
export interface LayerAnim {
  in: AnimIn
  /** Seconds from the start, and how long the entrance takes. */
  delay: number
  duration: number
  loop?: 'none' | 'pulse' | 'float' | 'spin'
}
export interface TextLayer extends LayerBase {
  type: 'text'
  text: string
  font: string
  size: number
  weight: number
  colour: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
  uppercase?: boolean
  italic?: boolean
  underline?: boolean
  /** Outline around the letters, in px. */
  stroke?: { colour: string; width: number }
  /** A coloured box behind each line of text; padding in em. */
  highlight?: { colour: string; padding: number }
  /** Letters filled with a gradient instead of `colour`. */
  gradient?: Gradient
  /** Words written *like this* show in this colour. */
  emphasis?: string
  /** The client may change the words in the client portal. */
  clientEditable?: boolean
}
export interface ImageLayer extends LayerBase {
  type: 'image'
  src: string
  fit: 'cover' | 'contain'
  /** Which part of a filled photo shows, in % from the left and top (50/50 is the middle). */
  focus?: { x: number; y: number }
  /** Light and colour, each -100…100 (0 = as shot); blur in px. */
  adjust?: ImageAdjust
  /** The photo in two brand colours: shadows, highlights. */
  duotone?: [string, string]
  /** The photo cut into a shape. */
  mask?: ImageMask
  /** Set on backgrounds made from the brand's palette, so they can be shuffled. */
  generated?: { style: string; seed: number; colour?: string }
}
export interface LogoLayer extends LayerBase {
  type: 'logo'
  /** A logo file from the brand hub – or 'auto' to pick the version that reads on what's behind it. */
  fileId: string | 'auto'
  /**
   * The mark's colour: 'auto' (a brand colour that reads on what's behind it), 'original' (the
   * file's own colours, without its background) or a hex colour.
   */
  colour?: string
  /** Centre the mark in its box (mockups); otherwise it sits at the box's left edge. */
  centred?: boolean
}
export interface ImageAdjust {
  brightness: number
  contrast: number
  saturation: number
  warmth: number
  blur: number
}
export type ImageMask = 'circle' | 'rounded' | 'arch' | 'hexagon' | 'star' | 'blob'
export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow' | 'triangle' | 'star' | 'polygon'
export interface ShapeLayer extends LayerBase {
  type: 'shape'
  shape: ShapeKind
  fill: string
  radius: number
  /** Corners of a polygon, points of a star. */
  sides?: number
  stroke?: { colour: string; width: number; dash?: boolean }
  gradient?: Gradient
}
/** An icon from Aftryk's set, drawn in a brand colour. */
export interface IconLayer extends LayerBase {
  type: 'icon'
  icon: string
  colour: string
  strokeWidth: number
}
export type Layer = TextLayer | ImageLayer | LogoLayer | ShapeLayer | IconLayer

export interface Artboard {
  id: string
  name: string
  width: number
  height: number
  background: string
  /** Layers, bottom first. */
  layers: Layer[]
  /** Guides dragged out of the rulers. `axis: 'x'` is a vertical line at x = `at`. */
  guides?: { id: string; axis: 'x' | 'y'; at: number }[]
  /** Columns and rows to line things up on. */
  grid?: LayoutGrid
  backgroundGradient?: Gradient
  /** Named groups; their layers carry the group's id. */
  groups?: { id: string; name: string }[]
  /** Where this will be posted – shows where the app's own buttons cover it. */
  platform?: string
  /** Print resolution; screens are 96. Sets the page size of a PDF. */
  dpi?: number
  /** A print artboard: its trim size and bleed in mm (the artboard includes the bleed). */
  print?: PrintSpec
  /** Motion: how long the animation runs, in seconds. */
  motion?: { duration: number }
}

export interface PrintSpec {
  format: string
  trimW: number
  trimH: number
  bleed: number
  /** Keep words and logos this far inside the trim. */
  safe: number
}

export interface LayoutGrid {
  columns: number
  rows: number
  gutter: number
  margin: number
  hidden?: boolean
}

export interface Design {
  id: string
  projectId: string
  name: string
  artboards: Artboard[]
  /** Pinned on the artboards, by the studio or the client. */
  comments?: Comment[]
  /** Saved states to go back to. */
  versions?: DesignVersion[]
  /** Shown to the client in the portal. */
  shared?: { at: string; status: ReviewStatus; by?: string }
  /** Images made with AI for this design, newest first. */
  aiImages?: { id: string; src: string; prompt: string; kind: string; at: string }[]
  createdAt: string
  updatedAt: string
}

export interface DesignVersion {
  id: string
  name: string
  artboards: Artboard[]
  at: string
}

/** An artboard saved as a starting point – usable on any client's brand. */
export interface DesignTemplate {
  id: string
  name: string
  /** The brand it was made on, so its colours and fonts can be swapped for another's. */
  projectId?: string
  artboard: Artboard
  createdAt: string
}
