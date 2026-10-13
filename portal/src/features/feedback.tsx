/**
 * Client feedback when a project is done: a 0–10 score and a sentence or two. Quotes the client
 * allows can go straight into the case study.
 */
import { useState } from 'react'
import { Quote, Send } from 'lucide-react'
import { now, useStore } from '../data/store'
import { useT } from '../data/i18n'
import type { Project, State } from '../data/types'

/** Average score, NPS (promoters 9–10 minus detractors 0–6) and the quotes you may use. */
export function feedbackStats(s: State) {
  const all = s.projects.filter((p) => p.feedback).map((p) => ({ project: p, fb: p.feedback! }))
  const n = all.length
  const promoters = all.filter((x) => x.fb.score >= 9).length
  const detractors = all.filter((x) => x.fb.score <= 6).length
  return {
    count: n,
    average: n ? all.reduce((sum, x) => sum + x.fb.score, 0) / n : 0,
    nps: n ? Math.round(((promoters - detractors) / n) * 100) : 0,
    quotes: all.filter((x) => x.fb.mayQuote && x.fb.quote).sort((a, b) => b.fb.at.localeCompare(a.fb.at)),
  }
}

/** In the client portal, once the project reaches its last stage. */
export function FeedbackRequest({ project }: { project: Project }) {
  const { state, dispatch } = useStore()
  const t = useT()
  const client = state.clients.find((c) => c.id === project.clientId)
  const [score, setScore] = useState<number | null>(null)
  const [quote, setQuote] = useState('')
  const [mayQuote, setMayQuote] = useState(true)
  const studio = state.studio.name

  if (project.feedback)
    return (
      <section className="card panel feedback-done">
        <Quote size={18} />
        <p>{t('Thank you for your feedback — it means a lot to us.')}</p>
      </section>
    )

  function send() {
    if (score === null) return
    const by = client?.contactName || client?.name || 'Client'
    dispatch({
      type: 'updateProject',
      id: project.id,
      patch: { feedback: { score, quote: quote.trim() || undefined, mayQuote: mayQuote && !!quote.trim(), by, at: now() } },
      log: { text: `${by} rated the project ${score}/10${quote.trim() ? `: “${quote.trim().slice(0, 80)}”` : ''}`, projectId: project.id, fromClient: true, notify: true, link: `/app/projects/${project.id}` },
    })
  }

  return (
    <section className="card panel feedback-ask">
      <span className="eyebrow">{t('The project is done')}</span>
      <h2>{t('How was it to work with us?')}</h2>
      <p className="muted">{t('Two quick questions. It helps us get better.')}</p>
      <fieldset className="nps">
        <legend>{t('How likely are you to recommend {studio} to a friend or colleague?', { studio })}</legend>
        <div className="nps-scale" role="radiogroup">
          {Array.from({ length: 11 }, (_, i) => (
            <button key={i} type="button" role="radio" aria-checked={score === i} className={score === i ? 'on' : ''} onClick={() => setScore(i)}>
              {i}
            </button>
          ))}
        </div>
        <div className="nps-ends"><span>{t('Not likely')}</span><span>{t('Very likely')}</span></div>
      </fieldset>
      <label className="field">
        <span>{t('In a sentence or two: what was it like to work with us?')}</span>
        <textarea className="input" rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} />
      </label>
      {quote.trim() && (
        <label className="check-row">
          <input type="checkbox" checked={mayQuote} onChange={(e) => setMayQuote(e.target.checked)} />
          {t('{studio} may quote this with my name and company', { studio })}
        </label>
      )}
      <button className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={score === null} onClick={send}>
        <Send size={15} /> {t('Send feedback')}
      </button>
    </section>
  )
}

/** On the project page in the studio. */
export function FeedbackSummary({ project }: { project: Project }) {
  const tr = useT()
  const { state } = useStore()
  const fb = project.feedback
  if (!fb) return null
  const client = state.clients.find((c) => c.id === project.clientId)
  const tone = fb.score >= 9 ? 'var(--green)' : fb.score >= 7 ? 'var(--amber)' : 'var(--danger)'
  return (
    <section className="card panel">
      <h3>{tr('Client feedback')}</h3>
      <div className="fb-score"><b style={{ color: tone }}>{fb.score}</b><span className="muted">/ 10</span></div>
      {fb.quote && (
        <blockquote className="fb-quote">
          “{fb.quote}”
          <footer>— {fb.by}, {client?.name}</footer>
        </blockquote>
      )}
      <small className="muted">{fb.quote ? (fb.mayQuote ? tr('May be quoted, e.g. in the case study.') : tr('Not for quoting.')) : tr('No comment given.')}</small>
    </section>
  )
}
