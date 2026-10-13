/**
 * Email contents. Until an email service is connected, emails are queued in the outbox and can be
 * opened in the user's own mail app with one click (mailto:), so nothing is lost.
 *
 * Client emails are written in the client's language, studio emails in the owner's. All wording
 * lives in the dictionary (see i18n.tsx), keyed by the English text.
 */
import { APP_NAME } from '../components/brand'
import { translateTo } from './i18n'
import { isComplete, stageName } from './store'
import type { Email, Invoice, Lang, Project, State } from './types'

type Draft = Omit<Email, 'id' | 'at' | 'status'>
type Vars = Record<string, string | number>

const origin = () => (typeof location !== 'undefined' ? location.origin : 'https://aftryk.app')
const kr = (n: number) => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(n) + ' kr.'
const date = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(lang === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'long' })

/** A translator fixed to one language, so every line of an email uses the same one. */
const inLang = (lang: Lang | undefined) => (k: string, vars?: Vars) => translateTo(lang, k, vars)

/** The studio owner's language, for emails to the studio itself. */
const ownerLang = (s: State): Lang => s.team.find((m) => m.role === 'Owner')?.lang ?? 'en'

export function buildEmail(s: State, audience: 'studio' | 'client', project: Project, text: string, link: string): Draft | null {
  const client = s.clients.find((c) => c.id === project.clientId)
  if (audience === 'studio') {
    const t = inLang(ownerLang(s))
    return {
      to: s.studio.email,
      subject: `${client?.name ?? project.name}: ${text}`,
      body: t('{text}\n\nProject: {project}\nOpen it: {link}\n\n— {app}', { app: APP_NAME, text, project: project.name, link: origin() + link }),
      kind: 'notification',
      projectId: project.id,
    }
  }
  if (!client?.contactEmail) return null
  const t = inLang(client.language)
  const first = client.contactName.split(' ')[0] || client.name
  return {
    to: client.contactEmail,
    subject: t('An update from {studio}: {project}', { studio: s.studio.name, project: project.name }),
    body: t('Hi {name},\n\n{text}.\n\nTake a look: {link}\n\nBest,\n{owner}, {studio}', {
      name: first, text, link: origin() + link, owner: s.studio.owner, studio: s.studio.name,
    }),
    kind: 'notification',
    projectId: project.id,
  }
}

export function reminderEmail(s: State, inv: Invoice): Draft | null {
  const client = s.clients.find((c) => c.id === inv.clientId)
  if (!client?.contactEmail || !inv.due) return null
  const t = inLang(client.language)
  const first = client.contactName.split(' ')[0] || client.name
  const pay = inv.paymentLink ? '\n' + t('Pay here: {link}', { link: inv.paymentLink }) : ''
  return {
    to: client.contactEmail,
    subject: t('Friendly reminder: invoice {number}', { number: inv.number }),
    body: t('Hi {name},\n\nA friendly reminder that invoice {number} for {amount} was due on {due}.{pay}\n\nIf you’ve already paid, please ignore this email.\n\nBest,\n{owner}, {studio}', {
      name: first, number: inv.number, amount: kr(inv.amount), due: date(inv.due, client.language), pay, owner: s.studio.owner, studio: s.studio.name,
    }),
    kind: 'reminder',
    projectId: inv.projectId,
  }
}

/** The studio's weekly summary: what's waiting, what's overdue, what's unpaid. */
export function digestEmail(s: State): Draft {
  const lang = ownerLang(s)
  const t = inLang(lang)
  const today = new Date().toISOString().slice(0, 10)
  const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
  const waiting = [
    ...s.files.filter((f) => f.status === 'In review').map((f) => `• ${f.name} (${t('review')})`),
    ...s.decks.filter((d) => d.status === 'In review').map((d) => `• ${d.title} (${t('presentation')})`),
    ...s.proposals.filter((p) => p.status === 'Sent').map((p) => `• ${p.title} (${t('proposal')})`),
    ...s.contracts.filter((c) => c.status === 'Sent').map((c) => `• ${c.title} (${t('signature')})`),
  ]
  const feedback = [...s.files, ...s.decks].filter((x) => x.status === 'Changes requested' || x.comments.some((c) => c.fromClient && !c.resolved))
  const dueSoon = s.projects.flatMap((p) =>
    p.tasks.filter((x) => !x.done && x.due && x.due <= week).map((x) => `• ${x.title} – ${p.name} (${x.due! < today ? t('overdue') : date(x.due!, lang)})`),
  )
  const unpaid = s.invoices.filter((i) => i.status === 'Issued')
  const overdue = unpaid.filter((i) => i.due && i.due < today)
  const active = s.projects.filter((p) => !p.archived && !isComplete(s, p))

  const lines = [
    t('Here’s your week at {studio}.', { studio: s.studio.name }),
    '',
    t('ACTIVE PROJECTS: {n}', { n: active.length }),
    '',
    t('CLIENT FEEDBACK TO HANDLE: {n}', { n: feedback.length }),
    ...feedback.map((x) => `• ${'name' in x ? x.name : x.title}`),
    '',
    t('WAITING ON CLIENTS: {n}', { n: waiting.length }),
    ...waiting,
    '',
    t('DUE THIS WEEK: {n}', { n: dueSoon.length }),
    ...dueSoon,
    '',
    t('UNPAID: {amount} across {n} invoices', { amount: kr(unpaid.reduce((n, i) => n + i.amount, 0)), n: unpaid.length }) +
      (overdue.length ? ' — ' + t('{n} overdue', { n: overdue.length }) : ''),
    ...overdue.map((i) => '• ' + t('{number} {amount}, due {due}', { number: i.number, amount: kr(i.amount), due: date(i.due!, lang) })),
    '',
    t('Open {app}: {link}', { app: APP_NAME, link: `${origin()}/app` }),
  ]
  return { to: s.studio.email, subject: t('Your week at {studio}', { studio: s.studio.name }), body: lines.join('\n'), kind: 'digest' }
}

export const mailto = (e: Pick<Email, 'to' | 'subject' | 'body'>) =>
  `mailto:${encodeURIComponent(e.to)}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`

/**
 * The weekly client update: where the project stands, what's new this week, what's waiting on
 * the client and what comes next – written in the client's language, ready to edit and send.
 */
export function clientUpdateEmail(s: State, project: Project, at = Date.now()): Draft | null {
  const client = s.clients.find((c) => c.id === project.clientId)
  if (!client) return null
  const lang = client.language
  const t = inLang(lang)
  const first = client.contactName.split(' ')[0] || client.name
  const weekAgo = new Date(at - 7 * 864e5).toISOString()
  const files = s.files.filter((f) => f.projectId === project.id && f.uploadedBy !== 'client')
  const decks = s.decks.filter((d) => d.projectId === project.id)
  const stage = t(stageName(s, project.stage, project))
  const link = `${origin()}/p/${project.id}`

  const news = [
    ...files.filter((f) => f.approvedAt && f.approvedAt >= weekAgo).map((f) => t('You approved {file}', { file: f.name })),
    ...files.filter((f) => f.versions.at(-1)!.createdAt >= weekAgo).map((f) => t('New version of {file} (version {n})', { file: f.name, n: f.versions.length })),
    ...decks.filter((d) => d.createdAt >= weekAgo).map((d) => t('New presentation: {title}', { title: d.title })),
  ]
  const proposal = s.proposals.find((p) => p.projectId === project.id)
  const contract = s.contracts.find((c) => c.projectId === project.id)
  const waiting = [
    ...(project.discovery.sentAt && !project.discovery.submittedAt ? [t('The discovery questionnaire')] : []),
    ...files
      .filter((f) => f.status === 'In review')
      .map((f) => (f.reviewBy ? t('Review {file} by {date}', { file: f.name, date: date(f.reviewBy, lang) }) : t('Review {file}', { file: f.name }))),
    ...decks.filter((d) => d.status === 'In review').map((d) => t('Look through {title}', { title: d.title })),
    ...(proposal?.status === 'Sent' ? [t('Accept the proposal')] : []),
    ...(contract?.status === 'Sent' ? [t('Sign the agreement')] : []),
  ]
  const next = project.tasks
    .filter((x) => !x.done && !x.fromCommentId)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
    .slice(0, 3)
    .map((x) => x.title + (x.due ? ` (${date(x.due, lang)})` : ''))

  const list = (items: string[]) => items.map((x) => `• ${x}`).join('\n')
  const parts = [
    t('Hi {name},', { name: first }),
    t('Here’s this week’s update on {project}. We’re in the {stage} stage.', { project: project.name, stage }),
    news.length ? `${t('New this week')}:\n${list(news)}` : '',
    waiting.length ? `${t('Waiting on you')}:\n${list(waiting)}` : t('Nothing is waiting on you right now.'),
    next.length ? `${t('Coming up')}:\n${list(next)}` : '',
    `${t('Everything is in your portal')}: ${link}`,
    t('Best,\n{owner}, {studio}', { owner: s.studio.owner, studio: s.studio.name }),
  ]
  return {
    to: client.contactEmail,
    subject: t('{project} – this week’s update', { project: project.name }),
    body: parts.filter(Boolean).join('\n\n'),
    kind: 'digest',
    projectId: project.id,
  }
}
