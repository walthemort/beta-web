/**
 * Brand Assistant: a chat in the client portal that answers from the brand hub (api/assistant.ts),
 * and the studio's page to switch it on per client and try it.
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ExternalLink, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { useStore } from '../../../data/store'
import type { Project } from '../../../data/types'
import { useLang, useT } from '../../../data/i18n'
import { hasApp } from '../../../data/plans'
import { AppGate } from '../../../app/Apps'
import { STARTERS, brandGuide, type ChatMessage } from './context'

/** Is the assistant in this client's portal? */
export const assistantOn = (state: Parameters<typeof hasApp>[0], project: Project) => hasApp(state, 'assistant') && !!project.assistant?.enabled

/** Bold, lists and paragraphs – the little Markdown the answers use. */
function Answer({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>))
  return (
    <>
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n')
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s/.test(l)))
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s/, ''))}</li>)}</ul>
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l.replace(/^#+\s*/, ''))}</Fragment>)}</p>
      })}
    </>
  )
}

export function BrandChat({ project, compact }: { project: Project; compact?: boolean }) {
  const t = useT()
  const { lang } = useLang()
  const { state } = useStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const client = state.clients.find((c) => c.id === project.clientId)
  const welcome = project.assistant?.welcome?.trim() || t('Hi! Ask me anything about using the {name} brand – colours, fonts, the logo, or a text in our tone of voice.', { name: client?.name ?? project.name })

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [messages.length, busy])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user' as const, content: q }].slice(-20)
    setMessages(next)
    setDraft('')
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ context: brandGuide(state, project), messages: next, lang }) })
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string }
      if (res.status === 501) setError(t('The assistant isn’t switched on yet – the studio needs to add the AI key.'))
      else if (!res.ok || !data.reply) setError(data.error ?? t('No answer came back – try again'))
      else setMessages([...next, { role: 'assistant', content: data.reply }])
    } catch {
      setError(t('Could not reach the assistant – check the connection'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={'ba' + (compact ? ' compact' : '')}>
      <div className="ba-log" aria-live="polite">
        <div className="ba-msg assistant"><p>{welcome}</p></div>
        {messages.map((m, i) => (
          <div key={i} className={'ba-msg ' + m.role}>{m.role === 'assistant' ? <Answer text={m.content} /> : <p>{m.content}</p>}</div>
        ))}
        {busy && <div className="ba-msg assistant"><Loader2 size={16} className="spin" /></div>}
        {error && <div className="ba-error" role="alert">{error}</div>}
        {!messages.length && (
          <div className="ba-starters">
            {STARTERS.map((s) => <button key={s} className="btn btn-sm" onClick={() => ask(t(s))}>{t(s)}</button>)}
          </div>
        )}
        <div ref={end} />
      </div>
      <form className="ba-input" onSubmit={(e) => { e.preventDefault(); ask(draft) }}>
        <textarea
          className="input" rows={1} value={draft} maxLength={2000} placeholder={t('Ask about the brand…')} aria-label={t('Ask about the brand…')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(draft) } }}
        />
        {messages.length > 0 && <button type="button" className="btn btn-ghost btn-icon" title={t('Start over')} onClick={() => { setMessages([]); setError(null) }}><RotateCcw size={15} /></button>}
        <button className="btn btn-primary btn-icon" disabled={!draft.trim() || busy} aria-label={t('Send')}><ArrowUp size={16} /></button>
      </form>
      <small className="muted ba-note">{t('Answers come from the brand hub, written by AI – check anything important with the studio.')}</small>
    </div>
  )
}

/** The portal's “Ask the brand” page. */
export function ClientAssistant({ project }: { project: Project }) {
  const t = useT()
  return (
    <section className="ba-page">
      <div>
        <h2>{t('Ask the brand')}</h2>
        <p className="muted">{t('Quick answers about the colours, fonts and logo – and texts in the brand’s tone of voice.')}</p>
      </div>
      <BrandChat project={project} />
    </section>
  )
}

/* ---------- The studio's page ---------- */

export default function AssistantPage() {
  return <AppGate id="assistant"><Studio /></AppGate>
}

function Studio() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const projects = state.projects.filter((p) => !p.archived)
  const [selected, setSelected] = useState(projects[0]?.id ?? '')
  const project = projects.find((p) => p.id === selected)
  const set = (p: Project, patch: Partial<NonNullable<Project['assistant']>>) =>
    dispatch({ type: 'updateProject', id: p.id, patch: { assistant: { enabled: false, ...p.assistant, ...patch } } })
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('App')}</span>
          <h1>{tr('Brand Assistant')}</h1>
          <p className="muted">{tr('An AI in the client portal that knows the brand inside out')}</p>
        </div>
      </div>
      <div className="ba-studio">
        <section className="card list">
          {projects.map((p) => (
            <div key={p.id} className={'list-item ba-client' + (p.id === selected ? ' on' : '')}>
              <button className="grow cell-title" onClick={() => setSelected(p.id)} style={{ textAlign: 'left' }}>
                <b style={{ fontWeight: 500 }}>{p.name}</b>
                <small>{p.assistant?.enabled ? tr('In the portal') : tr('Not in the portal')}</small>
              </button>
              <label className="switch" title={tr('Show in the client portal')}>
                <input type="checkbox" checked={!!p.assistant?.enabled} onChange={(e) => set(p, { enabled: e.target.checked })} />
                <span />
              </label>
            </div>
          ))}
        </section>
        {project && (
          <section className="card ba-try">
            <div className="ba-try-head">
              <div>
                <h3>{tr('Try it as {name}', { name: state.clients.find((c) => c.id === project.clientId)?.name ?? project.name })}</h3>
                <p className="muted">{tr('It answers from the brand hub – the more the hub says about the logo, colours and tone, the better the answers.')}</p>
              </div>
              <span style={{ display: 'flex', gap: 6 }}>
                <Link className="btn btn-sm" to={`/app/projects/${project.id}/hub`}><Sparkles size={14} /> {tr('Brand hub')}</Link>
                {project.assistant?.enabled && <a className="btn btn-sm" href={`/p/${project.id}/assistant`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {tr('Portal')}</a>}
              </span>
            </div>
            <label className="field">
              <span className="cm-label">{tr('Welcome message (optional)')}</span>
              <input className="input input-sm" value={project.assistant?.welcome ?? ''} onChange={(e) => set(project, { welcome: e.target.value })} placeholder={tr('Hi! Ask me anything about using the {name} brand – colours, fonts, the logo, or a text in our tone of voice.', { name: state.clients.find((c) => c.id === project.clientId)?.name ?? project.name })} />
            </label>
            <BrandChat key={project.id} project={project} compact />
          </section>
        )}
      </div>
    </>
  )
}
