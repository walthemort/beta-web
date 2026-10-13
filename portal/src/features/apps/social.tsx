/**
 * Social Planner: posts in the calendar – a design from the Content Machine (or an image), a
 * caption, the channels and a date – sent to the client for approval in their portal. Posting is
 * by hand for now: copy the caption, download the image, mark it as posted.
 */
import { APP_NAME } from '../../components/brand'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, Download, ImagePlus, MessageSquare, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui'
import { putBlob, resolveSrc, useSrc } from '../../data/blobs'
import { now, today, uid, useCurrentMember, useStore } from '../../data/store'
import { SOCIAL_CHANNELS, type Comment, type Design, type PostStatus, type Project, type SocialChannel, type SocialPost } from '../../data/types'
import { activeLang, dateLocale, useT } from '../../data/i18n'
import { ArtboardView, Thumbnail, artboardImage, useBrandLogos } from '../content/render'
import '../content/content.css'

export const POST_STATUSES: PostStatus[] = ['Draft', 'For approval', 'Changes requested', 'Approved', 'Posted']
const LIMITS: Partial<Record<SocialChannel, number>> = { X: 280, Instagram: 2200, LinkedIn: 3000, TikTok: 2200, Facebook: 63206 }
/** A comment on a post. */
const note = (text: string, author: string, fromClient: boolean): Comment => ({ id: uid(), text, author, fromClient, at: now() })
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The picture of a post: its design's artboard, or its image. */
export function PostPicture({ post, width = 120 }: { post: SocialPost; width?: number }) {
  const { state } = useStore()
  const url = useSrc(post.image)
  const design = state.designs.find((d) => d.id === post.designId)
  const board = design?.artboards.find((a) => a.id === post.artboardId) ?? design?.artboards[0]
  const project = state.projects.find((p) => p.id === post.projectId)
  if (board && project) return <Thumbnail artboard={board} project={project} width={width} />
  if (url) return <img src={url} alt="" style={{ width, display: 'block', borderRadius: 4 }} />
  return <span className="sp-noimage" style={{ width, height: width }}><ImagePlus size={16} /></span>
}

const saveBlob = (blob: Blob, name: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/** Draws a design's artboard off screen and downloads it as a PNG. */
function DesignDownload({ design, artboardId, project, onDone }: { design: Design; artboardId?: string; project: Project; onDone: () => void }) {
  const logos = useBrandLogos(project)
  const ref = useRef<HTMLDivElement>(null)
  const board = design.artboards.find((a) => a.id === artboardId) ?? design.artboards[0]
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const node = ref.current?.querySelector<HTMLElement>('.cm-board')
        if (node) saveBlob(await artboardImage(node, board, 'png'), `${design.name} – ${board.name}.png`)
      } finally {
        onDone()
      }
    }, 400)
    return () => clearTimeout(t)
  }, [])
  return (
    <div ref={ref} className="cm-offscreen" aria-hidden>
      <ArtboardView artboard={board} project={project} logos={logos} />
    </div>
  )
}

/* ---------- The studio: a month of posts ---------- */

export function ContentPlan() {
  const tr = useT()
  const { state } = useStore()
  const [params, setParams] = useSearchParams()
  const [client, setClient] = useState('')
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [editing, setEditing] = useState<SocialPost | { date: string } | null>(null)
  const posts = state.posts.filter((p) => !client || p.projectId === client)
  const projects = state.projects.filter((p) => !p.archived)

  // Opened from a calendar event: /app/calendar/social?post=…
  useEffect(() => {
    const id = params.get('post')
    const p = id && state.posts.find((x) => x.id === id)
    if (p) {
      setEditing(p)
      setCursor(new Date(Number(p.date.slice(0, 4)), Number(p.date.slice(5, 7)) - 1, 1))
      params.delete('post')
      setParams(params, { replace: true })
    }
  }, [params])

  const offset = (cursor.getDay() + 6) % 7
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - offset)
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  const waiting = posts.filter((p) => p.status === 'For approval').length
  const changes = posts.filter((p) => p.status === 'Changes requested').length

  return (
    <div className="sp">
      <div className="sp-bar">
        <select className="input input-sm" value={client} onChange={(e) => setClient(e.target.value)} aria-label={tr('Client')}>
          <option value="">{tr('All clients')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 13 }}>
          {waiting > 0 && tr('{n} waiting for the client', { n: waiting })}
          {waiting > 0 && changes > 0 && ' · '}
          {changes > 0 && <b className="sp-changes">{tr('{n} with changes asked for', { n: changes })}</b>}
        </span>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing({ date: today() })}><Plus size={14} /> {tr('New post')}</button>
      </div>
      <div className="card cal">
        <div className="cal-head">
          <button className="btn btn-ghost btn-icon" onClick={() => move(-1)} aria-label={tr('Previous month')}><ChevronLeft size={16} /></button>
          <b>{cursor.toLocaleDateString(dateLocale(activeLang()), { month: 'long', year: 'numeric' })}</b>
          <button className="btn btn-ghost btn-icon" onClick={() => move(1)} aria-label={tr('Next month')}><ChevronRight size={16} /></button>
          <span className="cal-legend">
            {POST_STATUSES.map((s) => <span key={s} className="sp-legend"><i className={'sp-dot ' + statusClass(s)} /> {tr(s)}</span>)}
          </span>
        </div>
        <div className="cal-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="cal-dow">{tr(d)}</span>)}
          {days.map((d) => {
            const key = ymd(d)
            const list = posts.filter((p) => p.date === key).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
            return (
              <div key={key} className={'cal-day sp-day' + (d.getMonth() !== cursor.getMonth() ? ' other' : '') + (key === today() ? ' today' : '')} onDoubleClick={() => setEditing({ date: key })}>
                <span className="cal-num">{d.getDate()}</span>
                {list.map((p) => (
                  <button key={p.id} className="sp-chip" onClick={() => setEditing(p)} title={p.caption.slice(0, 120)}>
                    <PostPicture post={p} width={34} />
                    <span className="sp-chip-text">
                      <i className={'sp-dot ' + statusClass(p.status)} />
                      {p.time && <b>{p.time}</b>} {p.channels.map((c) => c.slice(0, 2)).join(' ')}
                    </span>
                  </button>
                ))}
                <button className="sp-add" onClick={() => setEditing({ date: key })} aria-label={tr('New post')}><Plus size={12} /></button>
              </div>
            )
          })}
        </div>
      </div>
      {editing && <PostModal post={'id' in editing ? editing : undefined} date={'id' in editing ? undefined : editing.date} projectId={client} onClose={() => setEditing(null)} />}
    </div>
  )
}

export const statusClass = (s: PostStatus) => s.toLowerCase().replace(/\s+/g, '-')

function PostModal({ post, date, projectId, onClose }: { post?: SocialPost; date?: string; projectId?: string; onClose: () => void }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const me = useCurrentMember()
  const projects = state.projects.filter((p) => !p.archived)
  const [p, setP] = useState<SocialPost>(
    post ?? { id: uid(), projectId: projectId || projects[0]?.id || '', date: date ?? today(), time: '09:00', channels: ['Instagram'], caption: '', status: 'Draft', comments: [], createdAt: now(), updatedAt: now() },
  )
  const [downloading, setDownloading] = useState(false)
  const [writing, setWriting] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const project = state.projects.find((x) => x.id === p.projectId)
  const designs = state.designs.filter((d) => d.projectId === p.projectId)
  const design = designs.find((d) => d.id === p.designId)
  const limit = Math.min(...p.channels.map((c) => LIMITS[c] ?? Infinity))
  const set = (patch: Partial<SocialPost>) => setP((x) => ({ ...x, ...patch }))
  const save = (patch: Partial<SocialPost> = {}, close = true) => {
    const next = { ...p, ...patch, updatedAt: now() }
    if (post) dispatch({ type: 'update', coll: 'posts', id: p.id, fn: () => next })
    else dispatch({ type: 'insert', coll: 'posts', item: next, log: { text: `Post planned for ${next.date}`, projectId: next.projectId } })
    if (close) onClose()
    else setP(next)
  }
  /** Caption ideas in the brand's voice, from the Brand hub's tone of voice. */
  async function write() {
    if (!project) return
    setWriting('…')
    try {
      const tone = project.hub.tone
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'body', brief: p.caption || design?.name || project.name, current: p.caption, brand: state.clients.find((c) => c.id === project.clientId)?.name ?? project.name, tone: { summary: tone.summary, weAre: tone.weAre, weAreNot: tone.weAreNot, examples: tone.examples }, lang: activeLang(), maxChars: Math.min(limit, 400) }),
      })
      const data = (await res.json().catch(() => ({}))) as { options?: string[]; error?: string }
      if (res.status === 501) return setWriting(tr('AI isn’t switched on yet. Whoever runs {app} adds the keys – see docs/AI-IMAGES.md.', { app: APP_NAME }))
      if (!res.ok || !data.options?.length) return setWriting(data.error ?? tr('Nothing came back – try again'))
      set({ caption: data.options[0] })
      setWriting(null)
    } catch {
      setWriting(tr('Could not reach {app} – check the connection', { app: APP_NAME }))
    }
  }

  return (
    <Modal title={post ? tr('Post') : tr('New post')} onClose={onClose} wide>
      <div className="form sp-form">
        <div className="sp-form-grid">
          <div className="sp-form-picture">
            <PostPicture post={p} width={200} />
            <select className="input input-sm" value={p.designId ? `${p.designId}:${p.artboardId ?? ''}` : ''} onChange={(e) => { const [designId, artboardId] = e.target.value.split(':'); set({ designId: designId || undefined, artboardId: artboardId || undefined, image: designId ? undefined : p.image }) }} aria-label={tr('Design')}>
              <option value="">{designs.length ? tr('Pick a design…') : tr('No designs for this client yet')}</option>
              {designs.map((d) => (
                <optgroup key={d.id} label={d.name}>
                  {d.artboards.map((a) => <option key={a.id} value={`${d.id}:${a.id}`}>{a.name} · {a.width}×{a.height}</option>)}
                </optgroup>
              ))}
            </select>
            <button className="btn btn-sm btn-ghost" onClick={() => file.current?.click()}><ImagePlus size={14} /> {tr('Or upload an image')}</button>
            <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ image: await putBlob(f), designId: undefined, artboardId: undefined }); e.target.value = '' }} />
          </div>
          <div className="sp-form-fields">
            <label>
              {tr('Client')}
              <select className="input" value={p.projectId} onChange={(e) => set({ projectId: e.target.value, designId: undefined, artboardId: undefined })}>
                {projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <div className="form-row">
              <label>{tr('Date')}<input className="input" type="date" value={p.date} onChange={(e) => set({ date: e.target.value })} /></label>
              <label>{tr('Time')}<input className="input" type="time" value={p.time ?? ''} onChange={(e) => set({ time: e.target.value || undefined })} /></label>
            </div>
            <div className="field">
              <span>{tr('Where')}</span>
              <div className="sp-channels">
                {SOCIAL_CHANNELS.map((c) => (
                  <button key={c} type="button" className={'btn btn-sm' + (p.channels.includes(c) ? ' on' : '')} aria-pressed={p.channels.includes(c)} onClick={() => set({ channels: p.channels.includes(c) ? p.channels.filter((x) => x !== c) : [...p.channels, c] })}>{c}</button>
                ))}
              </div>
            </div>
            <label>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>{tr('Caption')} <small className={'muted' + (p.caption.length > limit ? ' error' : '')}>{p.caption.length}{limit < Infinity ? ` / ${limit}` : ''}</small></span>
              <textarea className="input" rows={6} value={p.caption} onChange={(e) => set({ caption: e.target.value })} placeholder={tr('What the post says. #hashtags at the end.')} />
            </label>
            <div className="cm-actions">
              <button type="button" className="btn btn-sm" onClick={write} disabled={writing === '…'}><Sparkles size={14} /> {writing === '…' ? tr('Writing…') : tr('Write it with AI')}</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard?.writeText(p.caption)} disabled={!p.caption}><ClipboardCopy size={14} /> {tr('Copy caption')}</button>
              {(design || p.image) && (
                <button type="button" className="btn btn-sm btn-ghost" disabled={downloading} onClick={async () => {
                  if (design) setDownloading(true)
                  else if (p.image) {
                    const url = await resolveSrc(p.image)
                    if (url) saveBlob(await (await fetch(url)).blob(), `post-${p.date}.png`)
                  }
                }}><Download size={14} /> {tr('Download image')}</button>
              )}
            </div>
            {writing && writing !== '…' && <small className="error">{writing}</small>}
          </div>
        </div>

        <div className="sp-status">
          <span className="muted">{tr('Status')}</span>
          <select className="input input-sm" value={p.status} onChange={(e) => set({ status: e.target.value as PostStatus })}>
            {POST_STATUSES.map((s) => <option key={s} value={s}>{tr(s)}</option>)}
          </select>
          {p.approvedBy && p.status === 'Approved' && <small className="muted">{tr('Approved by {name}', { name: p.approvedBy })}</small>}
        </div>

        {(p.comments.length > 0 || post) && (
          <div className="sp-comments">
            {p.comments.map((c: Comment) => (
              <div key={c.id} className={'sp-comment' + (c.fromClient ? ' client' : '')}><b>{c.author}</b> <span>{c.text}</span></div>
            ))}
            <div className="cm-inline">
              <input className="input input-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={tr('Write a comment…')} aria-label={tr('Comment')} />
              <button type="button" className="btn btn-sm" disabled={!reply.trim()} onClick={() => { set({ comments: [...p.comments, note(reply.trim(), me.name, false)] }); setReply('') }}><MessageSquare size={14} /></button>
            </div>
          </div>
        )}

        <div className="modal-actions">
          {post && <button type="button" className="btn btn-ghost" onClick={() => { dispatch({ type: 'remove', coll: 'posts', id: p.id }); onClose() }}><Trash2 size={15} /> {tr('Delete')}</button>}
          <span style={{ flex: 1 }} />
          {p.status === 'Approved' && <button type="button" className="btn" onClick={() => save({ status: 'Posted' })}><Check size={15} /> {tr('Mark as posted')}</button>}
          {(p.status === 'Draft' || p.status === 'Changes requested') && (
            <button type="button" className="btn" disabled={!p.projectId} onClick={() => save({ status: 'For approval' })}><Send size={15} /> {tr('Send to the client')}</button>
          )}
          <button type="button" className="btn btn-primary" disabled={!p.projectId} onClick={() => save()}>{tr('Save')}</button>
        </div>
      </div>
      {downloading && design && project && <DesignDownload design={design} artboardId={p.artboardId} project={project} onDone={() => setDownloading(false)} />}
    </Modal>
  )
}

/* ---------- The client: approve or ask for changes ---------- */

export const clientPosts = (s: { posts: SocialPost[] }, projectId: string) => s.posts.filter((p) => p.projectId === projectId && p.status !== 'Draft')

export function ClientContentPlan({ project }: { project: Project }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const client = state.clients.find((c) => c.id === project.clientId)
  const me = client?.contactName || client?.name || t('Client')
  const posts = useMemo(() => clientPosts(state, project.id).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))), [state.posts, project.id])
  const [asking, setAsking] = useState<string | null>(null)
  const [text, setText] = useState('')
  const update = (p: SocialPost, patch: Partial<SocialPost>) => dispatch({ type: 'update', coll: 'posts', id: p.id, fn: (x) => ({ ...x, ...patch, updatedAt: now() }) })
  const fmt = (d: string) => new Date(d + 'T12:00').toLocaleDateString(dateLocale(activeLang()), { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <div className="sp-client">
      <h1 className="cp-h1">{t('Content plan')}</h1>
      <p className="muted">{t('The posts the studio has planned for you. Approve them, or say what should change.')}</p>
      {!posts.length && <p className="muted">{t('Nothing to see here yet.')}</p>}
      {posts.map((p) => (
        <article key={p.id} className="card sp-post">
          <PostPicture post={p} width={180} />
          <div className="sp-post-body">
            <div className="sp-post-head">
              <b>{fmt(p.date)}{p.time ? ` · ${p.time}` : ''}</b>
              <span className="muted">{p.channels.join(', ')}</span>
              <span className={'pill sp-pill ' + statusClass(p.status)}>{t(p.status)}</span>
            </div>
            <p className="sp-caption">{p.caption || <span className="muted">{t('No caption yet')}</span>}</p>
            {p.comments.map((c) => <div key={c.id} className={'sp-comment' + (c.fromClient ? ' client' : '')}><b>{c.author}</b> <span>{c.text}</span></div>)}
            {p.status === 'For approval' && asking !== p.id && (
              <div className="cm-actions">
                <button className="btn btn-primary btn-sm" onClick={() => update(p, { status: 'Approved', approvedBy: me })}><Check size={14} /> {t('Approve')}</button>
                <button className="btn btn-sm" onClick={() => { setAsking(p.id); setText('') }}><MessageSquare size={14} /> {t('Ask for changes')}</button>
              </div>
            )}
            {asking === p.id && (
              <div className="field">
                <textarea className="input" rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t('What should change?')} />
                <div className="cm-actions">
                  <button className="btn btn-sm btn-primary" disabled={!text.trim()} onClick={() => { update(p, { status: 'Changes requested', comments: [...p.comments, note(text.trim(), me, true)] }); setAsking(null) }}>{t('Send')}</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setAsking(null)}>{t('Cancel')}</button>
                </div>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
