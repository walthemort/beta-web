/**
 * Every date that matters, for the Calendar page and for exporting to Google/Apple/Outlook (.ics).
 * Each event has a fixed id, so the same deadline is the same calendar event every time it's exported.
 */
import type { State } from './types'
import { translate as t } from './i18n'
import { hasApp } from './plans'

export type CalEvent = {
  id: string
  date: string // YYYY-MM-DD
  label: string
  to: string
  kind: 'deadline' | 'task' | 'review' | 'invoice' | 'post'
  colour?: string
  /** The team member it belongs to (tasks). */
  memberId?: string
  projectName?: string
}

export function calendarEvents(s: State): CalEvent[] {
  const ev: CalEvent[] = []
  for (const p of s.projects.filter((x) => !x.archived)) {
    if (p.due) ev.push({ id: `project-${p.id}`, date: p.due, label: t('{name} due', { name: p.name }), to: `/app/projects/${p.id}`, kind: 'deadline', colour: p.cover.bg, projectName: p.name })
    for (const t of p.tasks)
      if (t.due && !t.done)
        ev.push({ id: `task-${p.id}-${t.id}`, date: t.due, label: t.title, to: `/app/projects/${p.id}`, kind: 'task', colour: s.team.find((m) => m.id === t.assigneeId)?.colour, memberId: t.assigneeId, projectName: p.name })
  }
  const project = (id: string) => s.projects.find((p) => p.id === id)?.name
  for (const f of s.files)
    if (f.reviewBy && f.status === 'In review') ev.push({ id: `file-${f.id}`, date: f.reviewBy, label: t('Review: {name}', { name: f.name }), to: `/app/projects/${f.projectId}/files/${f.id}`, kind: 'review', projectName: project(f.projectId) })
  for (const d of s.decks)
    if (d.reviewBy && d.status === 'In review') ev.push({ id: `deck-${d.id}`, date: d.reviewBy, label: t('Review: {name}', { name: d.title }), to: `/app/projects/${d.projectId}/presentations/${d.id}`, kind: 'review', projectName: project(d.projectId) })
  for (const c of s.choices)
    if (c.reviewBy && c.status === 'Open') ev.push({ id: `choice-${c.id}`, date: c.reviewBy, label: t('Choice: {name}', { name: c.title }), to: `/app/projects/${c.projectId}/routes`, kind: 'review', projectName: project(c.projectId) })
  for (const i of s.invoices)
    if (i.due && i.status === 'Issued') ev.push({ id: `invoice-${i.id}`, date: i.due, label: t('{name} due', { name: i.number }), to: '/app/invoices', kind: 'invoice', projectName: i.projectId ? project(i.projectId) : undefined })
  // Social Planner: the posts, once the app is on.
  if (hasApp(s, 'socialPlanner'))
    for (const p of s.posts)
      if (p.status !== 'Posted')
        ev.push({ id: `post-${p.id}`, date: p.date, label: t('Post: {channels}', { channels: p.channels.join(', ') || t('Social') }), to: `/app/calendar/social?post=${p.id}`, kind: 'post', projectName: project(p.projectId) })
  return ev
}

/* ---------- iCalendar (RFC 5545) ---------- */

const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Lines longer than 75 bytes are folded (continued on the next line after a space). */
function fold(line: string) {
  const bytes = new TextEncoder()
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ch
    } else cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}

const nextDay = (date: string) => {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const icsDate = (date: string) => date.replace(/-/g, '')

const KIND: Record<CalEvent['kind'], string> = { deadline: 'Deadline', task: 'Task', review: 'Client review', invoice: 'Invoice', post: 'Social post' }

export function toIcs(events: CalEvent[], opts: { name: string; origin: string; stamp?: Date }) {
  const stamp = (opts.stamp ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aftryk//Studio calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(opts.name)}`,
  ]
  for (const e of events) {
    const url = opts.origin + e.to
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@aftryk`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `DTEND;VALUE=DATE:${icsDate(nextDay(e.date))}`,
      `SUMMARY:${esc(e.projectName && e.kind === 'task' ? `${e.label} (${e.projectName})` : e.label)}`,
      `DESCRIPTION:${esc(`${t(KIND[e.kind])}${e.projectName ? ` · ${e.projectName}` : ''}\n${url}`)}`,
      `URL:${url}`,
      `CATEGORIES:${t(KIND[e.kind])}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
