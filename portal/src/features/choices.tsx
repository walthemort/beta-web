import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Clock, Plus, Send, Trash2, X } from 'lucide-react'
import { useUndo } from '../components/Undo'
import { AutoText, CopyLink, StatusPill } from '../components/kit'
import { useSrc } from '../data/blobs'
import { daysUntil, formatDateLong, now, uid, useStore } from '../data/store'
import type { Choice, Project } from '../data/types'
import { clientUrl } from './proposals'
import { useT } from '../data/i18n'

function OptionImage({ fileId }: { fileId?: string }) {
  const tr = useT()
  const { state } = useStore()
  const file = state.files.find((f) => f.id === fileId)
  const url = useSrc(file?.versions.at(-1)?.src)
  return <div className="route-img">{url ? <img src={url} alt="" /> : <span className="muted">{tr('No image')}</span>}</div>
}

export function DeadlineTag({ date }: { date?: string }) {
  const tr = useT()
  if (!date) return null
  const d = daysUntil(date)
  const cls = d < 0 ? 'pill-red' : d <= 2 ? 'pill-amber' : ''
  return (
    <span className={'pill ' + cls}>
      <Clock size={11} /> {d < 0 ? d === -1 ? tr('1 day overdue') : tr('{n} days overdue', { n: -d }) : d === 0 ? tr('Due today') : d === 1 ? tr('1 day left') : tr('{n} days left', { n: d })}
    </span>
  )
}

/** Studio side: set up the routes and see what the client chose. */
export function ProjectChoices({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const choices = state.choices.filter((c) => c.projectId === project.id)
  const images = state.files.filter((f) => f.projectId === project.id && f.versions.at(-1)?.mime.startsWith('image/'))

  const add = () =>
    dispatch({
      type: 'insert',
      coll: 'choices',
      item: {
        id: uid(),
        projectId: project.id,
        title: 'Creative routes',
        question: 'Which route feels most like you?',
        options: [
          { id: uid(), label: 'Route A', description: '' },
          { id: uid(), label: 'Route B', description: '' },
        ],
        status: 'Draft',
        createdAt: now(),
      },
    })

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="section-head" style={{ margin: 0 }}>
        <p className="muted" style={{ fontSize: 14, maxWidth: 560 }}>
          {tr('Show 2–4 directions side by side. The client picks one and tells you why. Great after the first presentation.')}
        </p>
        <button className="btn btn-primary" onClick={add}><Plus size={16} /> {tr('New choice')}</button>
      </div>
      {choices.length === 0 && <div className="empty"><p>{tr('No choices yet.')}</p></div>}
      {choices.map((c) => {
        const set = (fn: (x: Choice) => Choice, log?: string, notify?: boolean) =>
          dispatch({ type: 'update', coll: 'choices', id: c.id, fn, log: log ? { text: log, projectId: project.id, notify, link: `/p/${project.id}/routes` } : undefined })
        const locked = c.status !== 'Draft'
        const chosen = c.options.find((o) => o.id === c.chosenId)
        return (
          <section key={c.id} className="card panel">
            <div className="section-head" style={{ margin: 0, flexWrap: 'wrap' }}>
              <input className="input title-input" value={c.title} disabled={locked} onChange={(e) => set((x) => ({ ...x, title: e.target.value }))} aria-label={tr('Title')} />
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <DeadlineTag date={c.status === 'Open' ? c.reviewBy : undefined} />
                <StatusPill status={c.status === 'Open' ? 'In review' : c.status === 'Decided' ? 'Approved' : 'Draft'} />
              </span>
            </div>
            <input className="input" value={c.question} disabled={locked} onChange={(e) => set((x) => ({ ...x, question: e.target.value }))} aria-label={tr('Question for the client')} />

            <div className="routes">
              {c.options.map((o, i) => (
                <div key={o.id} className={'route' + (c.chosenId === o.id ? ' chosen' : '')}>
                  <OptionImage fileId={o.fileId} />
                  {!locked && (
                    <select
                      className="input input-sm"
                      value={o.fileId ?? ''}
                      aria-label={tr('Image for {label}', { label: o.label })}
                      onChange={(e) => set((x) => ({ ...x, options: x.options.map((y) => (y.id === o.id ? { ...y, fileId: e.target.value || undefined } : y)) }))}
                    >
                      <option value="">{tr('Choose an image…')}</option>
                      {images.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  )}
                  <input className="input input-sm" value={o.label} disabled={locked} aria-label={tr('Name of option {x0}', { x0: i + 1 })} onChange={(e) => set((x) => ({ ...x, options: x.options.map((y) => (y.id === o.id ? { ...y, label: e.target.value } : y)) }))} />
                  <AutoText value={o.description} disabled={locked} placeholder={tr('The idea in a sentence or two')} aria-label={tr('Description of option {x0}', { x0: i + 1 })} onChange={(e) => set((x) => ({ ...x, options: x.options.map((y) => (y.id === o.id ? { ...y, description: e.target.value } : y)) }))} />
                  {!locked && c.options.length > 2 && (
                    <button className="btn btn-ghost btn-icon route-del" aria-label={tr('Remove {label}', { label: o.label })} onClick={() => set((x) => ({ ...x, options: x.options.filter((y) => y.id !== o.id) }))}><X size={14} /></button>
                  )}
                  {c.chosenId === o.id && <span className="route-badge"><Check size={13} /> {tr('Chosen')}</span>}
                </div>
              ))}
              {!locked && c.options.length < 4 && (
                <button className="route add" onClick={() => set((x) => ({ ...x, options: [...x.options, { id: uid(), label: `Route ${String.fromCharCode(65 + x.options.length)}`, description: '' }] }))}>
                  <Plus size={18} /> {tr('Add route')}
                </button>
              )}
            </div>

            {c.status === 'Decided' && chosen && (
              <p className="decided">
                <b>{c.chosenBy}</b> {tr('chose')} <b>{chosen.label}</b> {tr('on')} {formatDateLong(c.decidedAt)}{c.reason && <>: “{c.reason}”</>}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {c.status === 'Draft' && (
                <>
                  <label className="muted" style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                    {tr('Answer by')}
                    <input type="date" className="input input-sm" value={c.reviewBy ?? ''} onChange={(e) => set((x) => ({ ...x, reviewBy: e.target.value || undefined }))} />
                  </label>
                  <button className="btn btn-primary btn-sm" onClick={() => set((x) => ({ ...x, status: 'Open' }), `${c.title}: pick your favourite route`, true)}>
                    <Send size={14} /> {tr('Send to client')}
                  </button>
                </>
              )}
              {c.status === 'Open' && <CopyLink url={clientUrl(`/p/${project.id}/routes`)} className="btn btn-sm" />}
              {c.status !== 'Draft' && (
                <button className="btn btn-sm btn-ghost" onClick={() => set((x) => ({ ...x, status: 'Draft', chosenId: undefined, chosenBy: undefined, reason: undefined, decidedAt: undefined }))}>
                  {tr('Reopen for editing')}
                </button>
              )}
              <Link className="btn btn-sm" to={`/p/${project.id}/routes`} target="_blank">{tr('Preview as client')} <ArrowUpRight size={14} /></Link>
              <button className="btn btn-ghost btn-icon" style={{ marginLeft: 'auto' }} aria-label={tr('Delete {title}', { title: c.title })} onClick={() => undoable(tr('“{title}” deleted', { title: c.title }), () => dispatch({ type: 'remove', coll: 'choices', id: c.id }))}>
                <Trash2 size={15} />
              </button>
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Client side: pick one route and say why. */
export function ClientChoices({ project }: { project: Project }) {
  const { state, dispatch } = useStore()
  const client = state.clients.find((c) => c.id === project.clientId)
  const choices = state.choices.filter((c) => c.projectId === project.id && c.status !== 'Draft')
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [reason, setReason] = useState<Record<string, string>>({})
  const t = useT()
  if (!choices.length) return <div className="empty"><p>{t('Nothing to choose right now.')}</p></div>
  const who = client?.contactName || client?.name || 'Client'

  return (
    <>
      {choices.map((c) => {
        const sel = picked[c.id] ?? c.chosenId
        return (
          <section key={c.id} style={{ display: 'grid', gap: 16 }}>
            <div className="section-head" style={{ margin: 0 }}>
              <div>
                <span className="eyebrow">{t(c.title)}</span>
                <h1 className="cp-h1" style={{ marginTop: 4 }}>{t(c.question)}</h1>
              </div>
              {c.status === 'Open' && <DeadlineTag date={c.reviewBy} />}
            </div>
            <div className="routes client">
              {c.options.map((o) => (
                <button
                  key={o.id}
                  className={'route pick' + (sel === o.id ? ' chosen' : '')}
                  disabled={c.status === 'Decided'}
                  onClick={() => setPicked({ ...picked, [c.id]: o.id })}
                  aria-pressed={sel === o.id}
                >
                  <OptionImage fileId={o.fileId} />
                  <b>{t(o.label)}</b>
                  {o.description && <span className="muted">{t(o.description)}</span>}
                  {sel === o.id && <span className="route-badge"><Check size={13} /> {c.status === 'Decided' ? t('Your choice') : t('Selected')}</span>}
                </button>
              ))}
            </div>
            {c.status === 'Open' ? (
              <div className="card panel" style={{ maxWidth: 620 }}>
                <label htmlFor={'why-' + c.id} style={{ fontWeight: 500, fontSize: 14 }}>{t('What made you choose it?')} <span className="muted">({t('optional')})</span></label>
                <AutoText id={'why-' + c.id} value={reason[c.id] ?? ''} onChange={(e) => setReason({ ...reason, [c.id]: e.target.value })} placeholder={t('E.g. it feels warmer and more like us')} />
                <button
                  className="btn btn-primary"
                  style={{ justifySelf: 'start' }}
                  disabled={!sel}
                  onClick={() => {
                    const label = c.options.find((o) => o.id === sel)?.label
                    dispatch({
                      type: 'update',
                      coll: 'choices',
                      id: c.id,
                      fn: (x) => ({ ...x, status: 'Decided', chosenId: sel, chosenBy: who, reason: (reason[c.id] ?? '').trim() || undefined, decidedAt: now() }),
                      log: { text: `${who} chose ${label} (${c.title})`, projectId: project.id, fromClient: true, link: `/app/projects/${project.id}/routes` },
                    })
                  }}
                >
                  <Check size={16} /> {t('Choose')} {sel ? c.options.find((o) => o.id === sel)?.label : ''}
                </button>
              </div>
            ) : (
              <p className="muted">{t('You chose')} {c.options.find((o) => o.id === c.chosenId)?.label} {t('on')} {formatDateLong(c.decidedAt)}{t('. Thank you!')}</p>
            )}
          </section>
        )
      })}
    </>
  )
}
