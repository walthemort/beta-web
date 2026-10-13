import { APP_NAME } from '../components/brand'
import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_CONTRACT, seed } from './seed'
import { normalizeState } from './defaults'
import { buildEmail, digestEmail, reminderEmail } from './emails'
import type {
  Choice, Client, Comment, Contract, Design, Deck, Expense, HubVersion, Lead, LeadList, Invoice, InvoiceStatus, LineItem, Member, Project, ProjectTemplate,
  Proposal, ProposalTemplate, State, Studio, StudioFile, Task, TimeEntry, TimeOff, Mockup, SocialPost, WebPage, Audit,
} from './types'
import type { Lang, StageDef, Workflow } from './types'
import { clientVatRate, projectVatRate, round2 } from './vat'
import { activeLang, dateLocale, translate } from './i18n'
import { recordApprovals } from './approvals'
import { applyRetainers } from './retainers'

/*
 * Still `forme:`, two names ago, and deliberately so: renaming a storage key is a data migration,
 * and this one holds the whole workspace. Every studio would have to copy it across on the next
 * load, with a fallback for anyone who doesn't come back before the old key is removed – all of
 * that risk to change a string nobody but a developer ever sees. Keys written later carry
 * `formlar:` for the same reason. The name the product goes by lives in APP_NAME, not here.
 */
const STORAGE_KEY = 'forme:v1'

export const uid = () => Math.random().toString(36).slice(2, 10)
export const now = () => new Date().toISOString()
export const today = () => new Date().toISOString().slice(0, 10)

type Collections = {
  clients: Client
  projects: Project
  files: StudioFile
  decks: Deck
  choices: Choice
  proposals: Proposal
  contracts: Contract
  invoices: Invoice
  team: Member
  timeEntries: TimeEntry
  hubVersions: HubVersion
  timeOff: TimeOff
  expenses: Expense
  leads: Lead
  leadLists: LeadList
  designs: Design
  mockups: Mockup
  posts: SocialPost
  webPages: WebPage
  audits: Audit
  projectTemplates: ProjectTemplate
  proposalTemplates: ProposalTemplate
}
type Coll = keyof Collections

/**
 * Something that happened. It always lands in the activity feed; `notify` also creates an
 * in-app notification and an email for the other side (the client or the studio).
 */
export type LogEntry = { text: string; projectId?: string; fromClient?: boolean; notify?: boolean; link?: string }

export type Action =
  | { type: 'addProject'; project: Project }
  | { type: 'updateProject'; id: string; patch: Partial<Project>; log?: LogEntry }
  | { type: 'deleteProject'; id: string }
  | { type: 'setStage'; id: string; stage: number }
  | { type: 'setStages'; workflowId: string; stages: StageDef[] }
  | { type: 'setWorkflows'; workflows: Workflow[] }
  | { type: 'addTask'; projectId: string; task: Task }
  | { type: 'updateTask'; projectId: string; taskId: string; patch: Partial<Task> }
  | { type: 'toggleTask'; projectId: string; taskId: string }
  | { type: 'deleteTask'; projectId: string; taskId: string }
  | { type: 'addClient'; client: Client }
  | { type: 'deleteClient'; id: string }
  | { type: 'addInvoice'; invoice: Omit<Invoice, 'id' | 'number' | 'remindersSent'> & { remindersSent?: string[] }; log?: LogEntry }
  | { type: 'setInvoiceStatus'; id: string; status: InvoiceStatus }
  | { type: 'deleteInvoice'; id: string }
  | { type: 'updateStudio'; patch: Partial<Studio> }
  | { type: 'setCurrentMember'; id: string }
  | { type: 'log'; log: LogEntry }
  | { type: 'markNotificationsRead'; audience: 'studio' | 'client'; projectId?: string }
  | { type: 'readNotification'; id: string }
  | { type: 'emailOpened'; id: string }
  | { type: 'queueEmail'; email: Omit<State['outbox'][number], 'id' | 'at' | 'status'> }
  | { type: 'automations' }
  | { type: 'trimHistory' }
  // Generic helpers for collections.
  | { [K in Coll]: { type: 'insert'; coll: K; item: Collections[K]; log?: LogEntry } }[Coll]
  | { [K in Coll]: { type: 'update'; coll: K; id: string; fn: (item: Collections[K]) => Collections[K]; log?: LogEntry } }[Coll]
  | { type: 'remove'; coll: Coll; id: string; log?: LogEntry }
  | { type: 'completeSetup'; studio: Partial<Studio>; sample: boolean; lang?: Lang }
  | { type: 'replace'; state: State }
  /** The workspace as it is in the cloud – put in place as it is, without running automations again. */
  | { type: 'sync'; state: State }
  | { type: 'revert'; before: State; after: State }
  | { type: 'reset' }

/** Activity + notifications + queued emails for one log entry. */
function withLog(s: State, e?: LogEntry): Pick<State, 'activity' | 'notifications' | 'outbox'> {
  if (!e) return { activity: s.activity, notifications: s.notifications, outbox: s.outbox }
  const at = now()
  const activity = [{ id: uid(), at, text: e.text, projectId: e.projectId, fromClient: e.fromClient }, ...s.activity].slice(0, 200)
  // Client actions always notify the studio; studio actions only notify the client when flagged.
  const audience: 'studio' | 'client' | null = e.fromClient ? 'studio' : e.notify ? 'client' : null
  if (!audience) return { activity, notifications: s.notifications, outbox: s.outbox }
  const project = s.projects.find((p) => p.id === e.projectId)
  const link = e.link ?? (audience === 'studio' ? `/app/projects/${e.projectId}` : `/p/${e.projectId}`)
  const notifications = [{ id: uid(), audience, projectId: e.projectId, text: e.text, link, read: false, at }, ...s.notifications].slice(0, 200)
  const wanted = audience === 'studio' ? s.studio.emails.notifyStudio : s.studio.emails.notifyClient
  const email = wanted && project ? buildEmail(s, audience, project, e.text, link) : null
  return { activity, notifications, outbox: email ? [{ ...email, id: uid(), at, status: 'Queued' as const }, ...s.outbox].slice(0, 300) : s.outbox }
}

const mapProject = (s: State, id: string, fn: (p: Project) => Project): Project[] =>
  s.projects.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p))

function nextNumber(s: State) {
  return `INV-${String(s.nextInvoiceNumber).padStart(3, '0')}`
}

/**
 * Payment plans: when a trigger is reached (contract signed, project at Delivery / Complete),
 * a draft invoice is created automatically for that step. Runs after every change.
 */
function applyPaymentPlans(s: State): State {
  let next = s
  for (const p of s.proposals) {
    if (p.status !== 'Accepted' || !p.paymentPlan.length) continue
    const project = s.projects.find((x) => x.id === p.projectId)
    if (!project) continue
    const contract = s.contracts.find((c) => c.projectId === p.projectId)
    const reached = {
      // Waits for a real signature. Studios that skip contracts use “Invoice now” on the proposal.
      'On signing': contract?.status === 'Signed',
      'At delivery': project.stage >= deliveryIndex(s, project),
      'On completion': project.stage >= lastStage(s, project),
    }
    const due = p.paymentPlan.filter((step) => !step.invoiceId && (reached[step.trigger] || step.invoiceNow))
    if (!due.length) continue
    const vatRate = clientVatRate(next, next.clients.find((c) => c.id === project.clientId))
    const total = proposalTotals(proposalScope(p), vatRate).total
    let invoices = next.invoices
    let n = next.nextInvoiceNumber
    const plan = p.paymentPlan.map((step) => {
      if (!due.includes(step)) return step
      const id = uid()
      invoices = [
        {
          id,
          number: `INV-${String(n++).padStart(3, '0')}`,
          clientId: project.clientId,
          projectId: project.id,
          amount: round2((total * step.percent) / 100),
          vatRate,
          description: `${step.label} – ${project.name}`,
          due: new Date(Date.now() + next.studio.paymentTermsDays * 864e5).toISOString().slice(0, 10),
          remindersSent: [],
          status: 'Draft',
        },
        ...invoices,
      ]
      return { ...step, invoiceId: id, invoiceNow: undefined }
    })
    next = {
      ...next,
      invoices,
      nextInvoiceNumber: n,
      proposals: next.proposals.map((x) => (x.id === p.id ? { ...x, paymentPlan: plan } : x)),
      ...withLog(next, { text: `Draft invoice${due.length > 1 ? 's' : ''} created from the payment plan (${due.map((d) => d.label).join(', ')})`, projectId: project.id }),
    }
  }
  return next
}

/**
 * The studio's own automations (Settings → Workflow), run when a client action changes something:
 * an accepted proposal gets a draft contract, and a project whose files are all approved moves
 * to Delivery – which in turn creates the “At delivery” invoice from the payment plan.
 */
export function applyAutomations(prev: State, s: State): State {
  const auto = s.studio.automations
  if (!auto) return s
  let next = s
  if (auto.contractFromProposal) {
    for (const p of s.proposals) {
      const was = prev.proposals.find((x) => x.id === p.id)
      if (p.status !== 'Accepted' || was?.status === 'Accepted' || next.contracts.some((c) => c.projectId === p.projectId)) continue
      const project = next.projects.find((x) => x.id === p.projectId)
      if (!project) continue
      const client = next.clients.find((c) => c.id === project.clientId)
      const contract: Contract = {
        id: uid(), projectId: project.id, proposalId: p.id, status: 'Draft', createdAt: now(),
        title: `${translate('Project agreement')} – ${client?.name ?? project.name}`, body: translate(DEFAULT_CONTRACT),
      }
      next = { ...next, contracts: [...next.contracts, contract], ...withLog(next, { text: 'Proposal accepted – contract drafted automatically', projectId: project.id }) }
    }
  }
  if (auto.deliverWhenApproved) {
    const ready = (st: State, projectId: string) => {
      const files = st.files.filter((f) => f.projectId === projectId && f.uploadedBy !== 'client' && f.status !== 'Not shared')
      return files.length > 0 && files.every((f) => f.status === 'Approved')
    }
    for (const project of next.projects) {
      const delivery = deliveryIndex(next, project)
      if (project.archived || project.stage >= delivery || !ready(next, project.id) || ready(prev, project.id)) continue
      next = {
        ...next,
        projects: mapProject(next, project.id, (p) => ({ ...p, stage: delivery })),
        ...withLog(next, { text: `Every file is approved – moved to ${stageName(next, delivery, project)}`, projectId: project.id, notify: true }),
      }
    }
  }
  return next
}

export function reducer(state: State, a: Action): State {
  // What comes from the cloud has already been through the automations on the device that made it.
  if (a.type === 'sync') return a.state
  const s = base(state, a)
  if (s === state) return s
  // Loading, restoring or undoing a whole workspace isn't something a client did.
  const wholesale = a.type === 'replace' || a.type === 'revert' || a.type === 'completeSetup' || a.type === 'reset'
  const approved = recordApprovals(state, s)
  return applyRetainers(applyPaymentPlans(wholesale ? approved : applyAutomations(state, approved)))
}

function base(s: State, a: Action): State {
  switch (a.type) {
    case 'addProject':
      return { ...s, projects: [a.project, ...s.projects], ...withLog(s, { text: 'Project created', projectId: a.project.id }) }
    case 'updateProject':
      return { ...s, projects: mapProject(s, a.id, (p) => ({ ...p, ...a.patch })), ...withLog(s, a.log) }
    case 'deleteProject':
      return {
        ...s,
        projects: s.projects.filter((p) => p.id !== a.id),
        files: s.files.filter((f) => f.projectId !== a.id),
        decks: s.decks.filter((d) => d.projectId !== a.id),
        choices: s.choices.filter((d) => d.projectId !== a.id),
        proposals: s.proposals.filter((x) => x.projectId !== a.id),
        contracts: s.contracts.filter((x) => x.projectId !== a.id),
        timeEntries: s.timeEntries.filter((x) => x.projectId !== a.id),
        hubVersions: s.hubVersions.filter((x) => x.projectId !== a.id),
        approvals: s.approvals.filter((x) => x.projectId !== a.id),
        expenses: s.expenses.filter((x) => x.projectId !== a.id),
        activity: s.activity.filter((x) => x.projectId !== a.id),
        notifications: s.notifications.filter((x) => x.projectId !== a.id),
        designs: s.designs.filter((x) => x.projectId !== a.id),
        mockups: s.mockups.filter((x) => x.projectId !== a.id),
        posts: s.posts.filter((x) => x.projectId !== a.id),
        webPages: s.webPages.filter((x) => x.projectId !== a.id),
      }
    case 'setStage':
      return {
        ...s,
        projects: mapProject(s, a.id, (p) => ({ ...p, stage: a.stage })),
        ...withLog(s, { text: `Moved to ${stageName(s, a.stage, s.projects.find((p) => p.id === a.id))}`, projectId: a.id, notify: true }),
      }
    case 'setStages': {
      // Keep every project on the same stage (by id) when a workflow's stages are renamed, moved or
      // deleted. A project on a deleted stage moves to the nearest earlier stage that still exists.
      const flow = s.studio.workflows.find((w) => w.id === a.workflowId)
      if (!flow) return s
      const old = flow.stages
      const remap = (i: number) => {
        for (let j = Math.min(i, old.length - 1); j >= 0; j--) {
          const k = a.stages.findIndex((x) => x.id === old[j].id)
          if (k >= 0) return k
        }
        return 0
      }
      return {
        ...s,
        studio: { ...s.studio, workflows: s.studio.workflows.map((w) => (w.id === flow.id ? { ...w, stages: a.stages } : w)) },
        projects: s.projects.map((p) => (workflowOf(s, p).id === flow.id ? { ...p, stage: remap(p.stage) } : p)),
      }
    }
    case 'setWorkflows': {
      if (!a.workflows.length) return s
      // Projects on a workflow that was removed move to the first one, at the same point in the work.
      const next: State = { ...s, studio: { ...s.studio, workflows: a.workflows } }
      const projects = s.projects.map((p) => {
        if (a.workflows.some((w) => w.id === workflowOf(s, p).id)) return p.workflowId && !a.workflows.some((w) => w.id === p.workflowId) ? { ...p, workflowId: undefined } : p
        const share = p.stage / Math.max(1, lastStage(s, p))
        return { ...p, workflowId: a.workflows[0].id, stage: Math.round(share * lastStage(next, { workflowId: a.workflows[0].id })) }
      })
      return { ...next, projects }
    }
    case 'addTask':
      return { ...s, projects: mapProject(s, a.projectId, (p) => ({ ...p, tasks: [...p.tasks, a.task] })) }
    case 'updateTask':
      return {
        ...s,
        projects: mapProject(s, a.projectId, (p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === a.taskId ? { ...t, ...a.patch } : t)) })),
      }
    case 'toggleTask': {
      const task = s.projects.find((p) => p.id === a.projectId)?.tasks.find((t) => t.id === a.taskId)
      // A task made from a client comment resolves (or reopens) that comment along with it.
      const cid = task?.fromCommentId
      const resolve = <T extends { comments: Comment[] }>(x: T): T =>
        cid && x.comments.some((c) => c.id === cid) ? { ...x, comments: x.comments.map((c) => (c.id === cid ? { ...c, resolved: !task!.done } : c)) } : x
      return {
        ...s,
        projects: mapProject(s, a.projectId, (p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === a.taskId ? { ...t, done: !t.done } : t)) })),
        files: cid ? s.files.map(resolve) : s.files,
        decks: cid ? s.decks.map(resolve) : s.decks,
        designs: cid ? s.designs.map((d) => (d.comments?.some((c) => c.id === cid) ? resolve({ ...d, comments: d.comments }) : d)) : s.designs,
      }
    }
    case 'deleteTask':
      return { ...s, projects: mapProject(s, a.projectId, (p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== a.taskId) })) }
    case 'addClient':
      return { ...s, clients: [...s.clients, a.client] }
    case 'deleteClient':
      return { ...s, clients: s.clients.filter((c) => c.id !== a.id) }
    case 'addInvoice': {
      // Numbers are never reused, even after a delete.
      const number = nextNumber(s)
      return {
        ...s,
        invoices: [{ remindersSent: [], vatRate: projectVatRate(s, a.invoice.projectId), ...a.invoice, id: uid(), number }, ...s.invoices],
        nextInvoiceNumber: s.nextInvoiceNumber + 1,
        ...withLog(s, a.log ?? { text: `Invoice ${number} created`, projectId: a.invoice.projectId }),
      }
    }
    case 'setInvoiceStatus': {
      const inv = s.invoices.find((i) => i.id === a.id)
      return {
        ...s,
        invoices: s.invoices.map((i) =>
          i.id === a.id
            ? {
                ...i,
                status: a.status,
                issuedAt: a.status === 'Issued' && !i.issuedAt ? today() : i.issuedAt,
                paidAt: a.status === 'Paid' ? today() : undefined,
              }
            : i,
        ),
        ...withLog(s, a.status === 'Issued' && inv ? { text: `Invoice ${inv.number} is ready`, projectId: inv.projectId, notify: true, link: `/p/${inv.projectId}/invoices` } : undefined),
      }
    }
    case 'deleteInvoice':
      return { ...s, invoices: s.invoices.filter((i) => i.id !== a.id) }
    case 'updateStudio':
      return { ...s, studio: { ...s.studio, ...a.patch } }
    case 'setCurrentMember':
      return { ...s, currentMemberId: a.id }
    case 'log':
      return { ...s, ...withLog(s, a.log) }
    case 'markNotificationsRead':
      return {
        ...s,
        notifications: s.notifications.map((n) =>
          n.audience === a.audience && (!a.projectId || n.projectId === a.projectId) ? { ...n, read: true } : n,
        ),
      }
    case 'readNotification':
      return { ...s, notifications: s.notifications.map((n) => (n.id === a.id ? { ...n, read: true } : n)) }
    case 'emailOpened':
      return { ...s, outbox: s.outbox.map((e) => (e.id === a.id ? { ...e, status: 'Opened in Mail' } : e)) }
    case 'queueEmail':
      return { ...s, outbox: [{ ...a.email, id: uid(), at: now(), status: 'Queued' }, ...s.outbox] }
    case 'automations':
      // Runs when the app opens: reminders, the weekly digest and this month's retainer invoices.
      return applyRetainers(runAutomations(s))
    case 'trimHistory':
      // Frees space: keeps the latest activity and notifications, and only unsent emails.
      return {
        ...s,
        activity: s.activity.slice(0, 30),
        notifications: s.notifications.filter((n) => !n.read).slice(0, 50),
        outbox: s.outbox.filter((e) => e.status === 'Queued').slice(0, 30),
      }
    case 'insert':
      return { ...s, [a.coll]: [...(s[a.coll] as { id: string }[]), a.item], ...withLog(s, a.log) }
    case 'update':
      return {
        ...s,
        [a.coll]: (s[a.coll] as { id: string }[]).map((x) => (x.id === a.id ? (a.fn as unknown as (i: typeof x) => typeof x)(x) : x)),
        ...withLog(s, a.log),
      }
    case 'remove':
      return { ...s, [a.coll]: (s[a.coll] as { id: string }[]).filter((x) => x.id !== a.id), ...withLog(s, a.log) }
    case 'completeSetup': {
      const from = a.sample ? sampleWorkspace() : emptyWorkspace()
      const studio = { ...from.studio, ...a.studio, setupDone: true, lastBackupAt: now() }
      // The owner in the team is the person who set the studio up.
      const team = from.team.map((m) => (m.role === 'Owner' ? { ...m, name: studio.owner, email: studio.email, lang: a.lang } : m))
      return { ...from, studio, team }
    }
    case 'replace':
    case 'sync':
      return a.state
    case 'revert':
      return revertChange(s, a.before, a.after)
    case 'reset':
      return seed
  }
}

/**
 * Undo one change (before → after) without touching anything that has happened since:
 * removed items come back in their old place, items the change edited get their old version back,
 * and items it added (activity, emails…) go away – but only while nobody has changed them since.
 */
export function revertChange(current: State, before: State, after: State): State {
  type Item = { id: string }
  const out: Record<string, unknown> = { ...current }
  for (const key of Object.keys(before) as (keyof State)[]) {
    const b = before[key], a = after[key], c = current[key]
    if (b === a || !Array.isArray(b) || !Array.isArray(a) || !Array.isArray(c)) continue
    const was = new Map((b as Item[]).map((x) => [x.id, x]))
    const then = new Map((a as Item[]).map((x) => [x.id, x]))
    const list = (c as Item[])
      .filter((x) => was.has(x.id) || then.get(x.id) !== x)
      .map((x) => (then.get(x.id) === x ? was.get(x.id)! : x))
    ;(b as Item[]).forEach((x, i) => {
      if (!then.has(x.id) && !list.some((y) => y.id === x.id)) list.splice(Math.min(i, list.length), 0, x)
    })
    out[key] = list
  }
  return out as unknown as State
}

/** Weekdays (Mon–Fri) someone is off in the week starting on `monday` (YYYY-MM-DD). */
export function daysOff(s: Pick<State, 'timeOff'>, memberId: string, monday: string): number {
  const start = new Date(monday + 'T12:00:00Z')
  let n = 0
  for (let i = 0; i < 5; i++) {
    const day = new Date(start.getTime() + i * 864e5).toISOString().slice(0, 10)
    if (s.timeOff.some((o) => o.memberId === memberId && o.from <= day && day <= o.to)) n++
  }
  return n
}

/** Hours someone can work that week, after time off. */
export const availableHours = (s: Pick<State, 'timeOff'>, m: Member, monday: string) => (m.capacity * (5 - daysOff(s, m.id, monday))) / 5

/** Days since the last backup, when it's time to remind (own work exists, 14+ days, not snoozed). */
export const BACKUP_EVERY_DAYS = 14
export function backupReminder(s: State, at = Date.now()): number | null {
  if (!s.projects.some((p) => !p.sample)) return null
  if (s.studio.backupSnoozeUntil && new Date(s.studio.backupSnoozeUntil).getTime() > at) return null
  const days = Math.floor((at - new Date(s.studio.lastBackupAt ?? 0).getTime()) / 864e5)
  return days >= BACKUP_EVERY_DAYS ? days : null
}

/** The sample clients and projects only (without the demo studio’s own BETA_01 project). */
export function sampleWorkspace(): State {
  const keep = new Set(seed.projects.filter((p) => p.sample).map((p) => p.id))
  const own = <T extends { projectId?: string }>(l: T[]) => l.filter((x) => !x.projectId || keep.has(x.projectId))
  return {
    ...seed,
    clients: seed.clients.filter((c) => c.sample),
    projects: seed.projects.filter((p) => keep.has(p.id)),
    files: own(seed.files),
    proposals: own(seed.proposals),
    contracts: own(seed.contracts),
    invoices: own(seed.invoices),
    timeEntries: own(seed.timeEntries),
    activity: own(seed.activity),
  }
}

/** A clean workspace: the studio’s templates, no clients or projects. */
export function emptyWorkspace(): State {
  const owner = seed.team.find((m) => m.role === 'Owner')!
  return {
    ...seed,
    team: [owner],
    currentMemberId: owner.id,
    clients: [],
    projects: [],
    files: [],
    decks: [],
    choices: [],
    proposals: [],
    contracts: [],
    invoices: [],
    nextInvoiceNumber: 1,
    timeEntries: [],
    hubVersions: [],
    approvals: [],
    timeOff: [],
    expenses: [],
    leads: [],
    leadLists: [],
    activity: [],
    notifications: [],
    outbox: [],
  }
}

/** Time-based jobs, run when the app opens: overdue reminders and the weekly summary. */
function runAutomations(s: State): State {
  let outbox = s.outbox
  let invoices = s.invoices
  const t = today()
  if (s.studio.emails.overdueReminders) {
    invoices = s.invoices.map((inv) => {
      if (inv.status !== 'Issued' || !inv.due || inv.due >= t) return inv
      const last = inv.remindersSent.at(-1)
      // At most one reminder a week per invoice.
      if (last && (Date.now() - new Date(last).getTime()) / 864e5 < 7) return inv
      const email = reminderEmail(s, inv)
      if (!email) return inv
      outbox = [{ ...email, id: uid(), at: now(), status: 'Queued' }, ...outbox]
      return { ...inv, remindersSent: [...inv.remindersSent, t] }
    })
  }
  if (s.studio.emails.weeklyDigest) {
    const lastDigest = outbox.find((e) => e.kind === 'digest')
    if (!lastDigest || (Date.now() - new Date(lastDigest.at).getTime()) / 864e5 >= 7) {
      outbox = [{ ...digestEmail(s), id: uid(), at: now(), status: 'Queued' }, ...outbox]
    }
  }
  if (outbox === s.outbox && invoices === s.invoices) return s
  return { ...s, outbox, invoices }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeState(JSON.parse(raw), seed)
  } catch (err) {
    console.warn('Could not read saved data – starting from sample data.', err)
  }
  return seed
}

/**
 * Browsers give each site about 5 MB for this kind of storage (counted as 2 bytes per character).
 * Uploaded files live in IndexedDB instead and don’t count towards it.
 */
export const STORAGE_LIMIT = 5 * 1024 * 1024
export type StorageInfo = { bytes: number; limit: number; error: boolean }

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void; storage: StorageInfo } | null>(null)

/** Told about every change (before, after) – the cloud sync listens here. */
export const changeListeners = new Set<(prev: State, next: State) => void>()

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const [storage, setStorage] = useState<StorageInfo>({ bytes: 0, limit: STORAGE_LIMIT, error: false })
  const prev = useRef(state)
  useEffect(() => {
    const before = prev.current
    prev.current = state
    if (before !== state) changeListeners.forEach((fn) => fn(before, state))
  }, [state])
  useEffect(() => {
    const json = JSON.stringify(state)
    const bytes = json.length * 2
    try {
      localStorage.setItem(STORAGE_KEY, json)
      setStorage({ bytes, limit: STORAGE_LIMIT, error: false })
    } catch (err) {
      // Full (or blocked) storage: keep working in memory, but tell the user loudly.
      console.error('Aftryk could not save:', err)
      setStorage({ bytes, limit: STORAGE_LIMIT, error: true })
    }
  }, [state])
  useEffect(() => {
    dispatch({ type: 'automations' })
    // Keep tabs in sync: a client approving in one tab shows up in the studio tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) dispatch({ type: 'replace', state: normalizeState(JSON.parse(e.newValue), seed) })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return <Ctx.Provider value={{ state, dispatch, storage }}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

/** Downloads everything as a JSON file and restarts the backup reminder. */
export function useDownloadBackup() {
  const { state, dispatch } = useStore()
  return () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
    a.download = `${APP_NAME.toLowerCase()}-backup-${today()}.json`
    a.click()
    dispatch({ type: 'updateStudio', patch: { lastBackupAt: now(), backupSnoozeUntil: undefined } })
  }
}

export const useCurrentMember = () => {
  const { state } = useStore()
  return state.team.find((m) => m.id === state.currentMemberId) ?? state.team[0]
}

/* ---------- Derived helpers: one definition of each number, used everywhere ---------- */

/*
 * Stages belong to a workflow (Settings → Workflow); every project follows one – the first when
 * it hasn't picked one. The last stage of a workflow means “complete”.
 */
type OnWorkflow = Pick<Project, 'workflowId'> | undefined
export const workflowOf = (s: State, p?: OnWorkflow) => s.studio.workflows.find((w) => w.id === p?.workflowId) ?? s.studio.workflows[0]
export const stagesOf = (s: State, p?: OnWorkflow) => workflowOf(s, p).stages
export const stageName = (s: State, i: number, p?: OnWorkflow) => stagesOf(s, p)[i]?.name ?? '—'
export const stageColour = (s: State, i: number, p?: OnWorkflow) => stagesOf(s, p)[i]?.colour ?? '#9a9993'
export const lastStage = (s: State, p?: OnWorkflow) => stagesOf(s, p).length - 1
export const isComplete = (s: State, p: Project) => p.stage >= lastStage(s, p)
export const deliveryIndex = (s: State, p?: OnWorkflow) => {
  const stages = stagesOf(s, p)
  const i = stages.findIndex((x) => x.delivery)
  return i >= 0 ? i : Math.max(0, stages.length - 2)
}
/** Stage progress: the single "progress" figure shown across the app. */
export const stageProgress = (p: Project, s: State) => Math.round((p.stage / Math.max(1, lastStage(s, p))) * 100)
export const stageLabel = (p: Project, s: State) =>
  translate('Stage {n} of {total} · {name}', { n: p.stage + 1, total: stagesOf(s, p).length, name: translate(stageName(s, p.stage, p)) })
export const taskCount = (p: Project) => `${p.tasks.filter((t) => t.done).length}/${p.tasks.length} tasks`

export const proposalTotals = (items: LineItem[], vatRate: number) => {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0)
  const vat = Math.round(subtotal * vatRate * 100) / 100
  return { subtotal, vat, total: subtotal + vat }
}

/** The line items that are actually being bought: chosen (or recommended) package + chosen add-ons. */
export function proposalScope(p: Proposal, packageId = p.chosenPackageId, addonIds = p.chosenAddonIds): LineItem[] {
  const pkg = p.packages.find((x) => x.id === packageId) ?? p.packages.find((x) => x.recommended) ?? p.packages[0]
  const core = p.packages.length ? pkg?.items ?? [] : p.items
  return [...core, ...p.addons.filter((a) => addonIds.includes(a.id))]
}

export const hoursLogged = (s: State, projectId: string) =>
  s.timeEntries.filter((t) => t.projectId === projectId).reduce((n, t) => n + t.minutes, 0) / 60

export const isOverdue = (inv: Invoice) => inv.status === 'Issued' && !!inv.due && inv.due < today()

// Dates follow the language on screen (see LangProvider).
const locale = () => dateLocale(activeLang())
export const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) : translate('No due date')
export const formatDateLong = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
export const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return translate('just now')
  if (m < 60) return translate('{m} min ago', { m })
  if (m < 60 * 24) return translate('{h} h ago', { h: Math.round(m / 60) })
  return formatDate(iso)
}
export const daysUntil = (iso: string) => Math.ceil((new Date(iso + (iso.length === 10 ? 'T23:59:59' : '')).getTime() - Date.now()) / 864e5)

export const formatKr = (n: number) => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(n) + ' kr.'
/** Always with øre – for invoices. */
export const formatKrExact = (n: number) =>
  new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' kr.'
export const formatHours = (h: number) => translate('{n} h', { n: String(Math.round(h * 10) / 10).replace('.', activeLang() === 'da' ? ',' : '.') })

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
