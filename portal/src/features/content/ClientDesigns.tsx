/**
 * Designs in the client portal: what the studio has shared from the Content Machine. The client
 * pins comments on it, changes the words the studio allows, and approves it or asks for changes.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, MessageSquare, RotateCcw } from 'lucide-react'
import { StatusPill } from '../../components/kit'
import { now, useStore } from '../../data/store'
import type { Artboard, Comment, Design, Layer, Project, ReviewStatus, TextLayer } from '../../data/types'
import { useT } from '../../data/i18n'
import { hasFeature } from '../../data/plans'
import { ArtboardView, BrandFonts, Thumbnail, useBrandLogos } from './render'
import { brandOf } from './model'
import { CommentPins, Composer, Thread, newComment, threads, type Draft } from './comments'
import './content.css'

const shared = (s: { designs: Design[] }, projectId: string) => s.designs.filter((d) => d.projectId === projectId && d.shared)

export const hasSharedDesigns = (s: { designs: Design[] }, projectId: string) => shared(s, projectId).length > 0

export function ClientDesignList({ project, base }: { project: Project; base: string }) {
  const t = useT()
  const { state } = useStore()
  const list = shared(state, project.id)
  if (!list.length) return <p className="muted">{t('Nothing to see here yet.')}</p>
  return (
    <>
      <h1 className="cp-h1">{t('Designs')}</h1>
      <div className="cm-grid">
        {list.map((d) => {
          const a = d.artboards[0]
          return (
            <Link key={d.id} to={`${base}/designs/${d.id}`} className="card cm-card">
              <div className="cm-card-art"><Thumbnail artboard={a} project={project} width={a.width >= a.height ? 220 : Math.round(220 * (a.width / a.height))} /></div>
              <div className="cm-card-body">
                <b>{d.name}</b>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusPill status={d.shared!.status} />
                  <small className="muted">{d.artboards.length === 1 ? t('1 size') : t('{n} sizes', { n: d.artboards.length })}</small>
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}

/** One artboard, fitted to the page, with its comment pins – a click pins a new one. */
function Board({ design, artboard, project, width, draft, focus, onDraft, onPick }: {
  design: Design; artboard: Artboard; project: Project; width: number; draft: Draft | null; focus: string | null; onDraft: (d: Draft) => void; onPick: (c: Comment) => void
}) {
  const logos = useBrandLogos(project)
  const ref = useRef<HTMLDivElement>(null)
  const s = width / artboard.width
  const place = (e: ReactPointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    onDraft({ artboardId: artboard.id, x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 })
  }
  return (
    <div className="cd-board" ref={ref} style={{ width, height: artboard.height * s, ['--z' as string]: s }} onPointerDown={place}>
      <div style={{ transform: `scale(${s})`, transformOrigin: '0 0', width: artboard.width, height: artboard.height }}>
        <ArtboardView artboard={artboard} project={project} logos={logos}>
          <CommentPins design={design} artboardId={artboard.id} zoom={s} focus={focus} draft={draft} onPick={onPick} />
        </ArtboardView>
      </div>
    </div>
  )
}

export function ClientDesign({ project, designId, base }: { project: Project; designId: string; base: string }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const design = shared(state, project.id).find((d) => d.id === designId)
  const client = state.clients.find((c) => c.id === project.clientId)
  const me = client?.contactName || client?.name || t('Client')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  if (!design) return <p className="muted">{t('This design isn’t shared any more.')}</p>
  const brand = brandOf(project)
  const update = (fn: (d: Design) => Design) => dispatch({ type: 'update', coll: 'designs', id: design.id, fn: (d: Design) => ({ ...fn(d), updatedAt: now() }) })
  const setComments = (comments: Comment[]) => update((d) => ({ ...d, comments }))
  const setStatus = (status: ReviewStatus) => {
    update((d) => ({ ...d, shared: { ...d.shared!, status, by: me } }))
    dispatch({ type: 'log', log: { text: `${me}: ${status === 'Approved' ? 'approved' : 'asked for changes to'} the design “${design.name}”`, projectId: project.id } })
  }
  // Words the studio lets the client change – only on plans that include it.
  const editable = hasFeature(state, 'clientEdits')
    ? design.artboards.flatMap((a) => a.layers.filter((l): l is TextLayer => l.type === 'text' && !!l.clientEditable).map((l) => ({ a, l })))
    : []
  const setText = (artboardId: string, layerId: string, text: string) =>
    update((d) => ({ ...d, artboards: d.artboards.map((a) => (a.id !== artboardId ? a : { ...a, layers: a.layers.map((l): Layer => (l.id === layerId && l.type === 'text' ? { ...l, text } : l)) })) }))
  const list = threads(design)
  const status = design.shared!.status

  return (
    <div className="cd">
      <BrandFonts brand={brand} />
      <Link to={`${base}/designs`} className="link-arrow"><ArrowLeft size={14} /> {t('All designs')}</Link>
      <div className="cd-head">
        <div>
          <h1 className="cp-h1" style={{ margin: 0 }}>{design.name}</h1>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}><StatusPill status={status} /><small className="muted">{t('Click anywhere on the design to leave a comment there.')}</small></span>
        </div>
        <div className="cd-actions">
          {status === 'Approved' ? (
            <button className="btn" onClick={() => setStatus('In review')}><RotateCcw size={15} /> {t('Undo approval')}</button>
          ) : (
            <>
              <button className="btn" onClick={() => setStatus('Changes requested')} disabled={status === 'Changes requested'}><MessageSquare size={15} /> {t('Ask for changes')}</button>
              <button className="btn btn-primary" onClick={() => setStatus('Approved')}><Check size={15} /> {t('Approve')}</button>
            </>
          )}
        </div>
      </div>
      <div className="cd-body">
        <div className="cd-boards">
          {design.artboards.map((a) => (
            <figure key={a.id} className="cd-figure">
              <Board design={design} artboard={a} project={project} width={Math.min(560, a.width >= a.height ? 560 : Math.round(560 * (a.width / a.height)))} draft={draft} focus={focus} onDraft={(d) => { setDraft(d); setFocus(null) }} onPick={(c) => setFocus(c.id)} />
              <figcaption className="muted">{a.name} · {a.width} × {a.height}</figcaption>
            </figure>
          ))}
        </div>
        <aside className="cd-side">
          {editable.length > 0 && (
            <section className="card panel cd-words">
              <h3>{t('Change the words')}</h3>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t('The studio has opened these texts for you. Changes show on the design straight away.')}</p>
              {editable.map(({ a, l }) => (
                <label key={a.id + l.id} className="field">
                  <span className="muted" style={{ fontSize: 12 }}>{design.artboards.length > 1 ? `${a.name} · ` : ''}{l.name}</span>
                  <textarea className="input" rows={Math.min(4, Math.max(2, Math.ceil(l.text.length / 40)))} value={l.text} onChange={(e) => setText(a.id, l.id, e.target.value)} />
                </label>
              ))}
            </section>
          )}
          <section className="card panel cd-comments">
            <h3>{t('Comments')}</h3>
            {draft && (
              <Composer
                onSave={(text) => {
                  setComments([...(design.comments ?? []), newComment(text, me, true, draft)])
                  setDraft(null)
                }}
                onCancel={() => setDraft(null)}
              />
            )}
            {!draft && !list.length && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t('No comments yet. Click on the design to add one.')}</p>}
            {list.map((c) => <Thread key={c.id} design={design} comment={c} me={me} fromClient focus={focus === c.id} onChange={setComments} onPick={() => setFocus(c.id)} />)}
          </section>
        </aside>
      </div>
    </div>
  )
}
