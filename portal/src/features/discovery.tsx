import { Link } from 'react-router-dom'
import { ArrowUpRight, Plus, Send, X } from 'lucide-react'
import { AutoText, CopyLink, StatusPill } from '../components/kit'
import { formatDateLong, now, uid, useStore } from '../data/store'
import type { Project } from '../data/types'
import { clientUrl } from './proposals'
import { useT } from '../data/i18n'

export const discoveryStatus = (p: Project) => (p.discovery.submittedAt ? 'Submitted' : p.discovery.sentAt ? 'Sent' : 'Draft')

export function ProjectDiscovery({ project }: { project: Project }) {
  const tr = useT()
  const { dispatch } = useStore()
  const d = project.discovery
  const answered = d.questions.filter((q) => q.a.trim()).length
  const setD = (fn: (x: typeof d) => typeof d, log?: string) =>
    dispatch({ type: 'updateProject', id: project.id, patch: { discovery: fn(d) }, log: log ? { text: log, projectId: project.id } : undefined })
  const link = `/p/${project.id}/discovery`

  return (
    <div className="split split-aside">
      <div className="card panel" style={{ gap: 0 }}>
        {d.questions.map((q, i) => (
          <div key={q.id} className="qa">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ fontWeight: 500 }}
                value={q.q}
                aria-label={tr('Question {x0}', { x0: i + 1 })}
                onChange={(e) => setD((x) => ({ ...x, questions: x.questions.map((y) => (y.id === q.id ? { ...y, q: e.target.value } : y)) }))}
              />
              <button className="btn btn-ghost btn-icon" aria-label={tr('Remove question {x0}', { x0: i + 1 })} onClick={() => setD((x) => ({ ...x, questions: x.questions.filter((y) => y.id !== q.id) }))}>
                <X size={15} />
              </button>
            </div>
            <AutoText
              value={q.a}
              placeholder={tr('Client’s answer (they can fill this in through the link)')}
              aria-label={tr('Answer {x0}', { x0: i + 1 })}
              onChange={(e) => setD((x) => ({ ...x, questions: x.questions.map((y) => (y.id === q.id ? { ...y, a: e.target.value } : y)) }))}
            />
          </div>
        ))}
        <button className="btn btn-ghost" style={{ justifySelf: 'start', marginTop: 12 }} onClick={() => setD((x) => ({ ...x, questions: [...x.questions, { id: uid(), q: 'New question', a: '' }] }))}>
          <Plus size={15} /> {tr('Add question')}
        </button>
      </div>
      <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 72, alignContent: 'start' }}>
        <section className="card panel">
          <div className="section-head" style={{ margin: 0 }}>
            <h3>{tr('Questionnaire')}</h3>
            <StatusPill status={discoveryStatus(project)} />
          </div>
          <p className="muted" style={{ fontSize: 14 }}>
            {answered} {tr('of')} {d.questions.length} {tr('answered')}
            {d.submittedAt && <> {tr('· submitted')} {formatDateLong(d.submittedAt)}</>}
          </p>
          {!d.sentAt ? (
            <button className="btn btn-primary" onClick={() => setD((x) => ({ ...x, sentAt: now() }), 'Discovery questionnaire sent')}>
              <Send size={15} /> {tr('Mark as sent')}
            </button>
          ) : (
            <CopyLink url={clientUrl(link)} />
          )}
          <Link className="btn" to={link} target="_blank">{tr('Preview as client')} <ArrowUpRight size={15} /></Link>
        </section>
      </aside>
    </div>
  )
}
