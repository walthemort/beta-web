/**
 * Comments pinned on a design's artboards – from the studio in the editor and from the client in
 * their portal. Open client comments can be turned into tasks, like feedback on files.
 */
import { useState } from 'react'
import { Check, MessageSquare, RotateCcw, Trash2 } from 'lucide-react'
import { now, timeAgo, uid } from '../../data/store'
import type { Comment, Design, Project } from '../../data/types'
import { useT } from '../../data/i18n'
import { FeedbackToTasks } from '../feedbackTasks'

export type Draft = { artboardId: string; x: number; y: number }

/** Comments that start a thread, numbered in the order they were made. */
export const threads = (d: Pick<Design, 'comments'>) => (d.comments ?? []).filter((c) => !c.parentId && c.artboardId)
export const pinNumber = (d: Pick<Design, 'comments'>, id: string) => threads(d).findIndex((c) => c.id === id) + 1

export function newComment(text: string, author: string, fromClient: boolean, at: Draft | { parentId: string }): Comment {
  return { id: uid(), text, author, fromClient, at: now(), ...('parentId' in at ? { parentId: at.parentId } : { artboardId: at.artboardId, x: at.x, y: at.y }) }
}

/** The numbered pins on one artboard (in % of it, so they sit right at any size). */
export function CommentPins({ design, artboardId, zoom, focus, draft, onPick }: { design: Design; artboardId: string; zoom: number; focus?: string | null; draft?: Draft | null; onPick: (c: Comment) => void }) {
  const list = threads(design)
  const size = 26 / zoom
  const pin = (key: string, x: number, y: number, n: number | string, cls: string, onClick?: () => void) => (
    <button
      key={key}
      data-noexport
      className={'cm-pin ' + cls}
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, fontSize: 12 / zoom, borderWidth: 2 / zoom }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      {n}
    </button>
  )
  return (
    <>
      {list.map((c, i) => (c.artboardId === artboardId ? pin(c.id, c.x ?? 0, c.y ?? 0, i + 1, (c.resolved ? 'resolved' : '') + (c.fromClient ? ' client' : '') + (focus === c.id ? ' on' : ''), () => onPick(c)) : null))}
      {draft?.artboardId === artboardId && pin('draft', draft.x, draft.y, '+', 'draft on')}
    </>
  )
}

/** One thread: the pin's comment, its replies, and a reply box. */
export function Thread({ design, comment: c, me, fromClient, focus, onChange, onPick }: {
  design: Design; comment: Comment; me: string; fromClient: boolean; focus?: boolean; onChange: (comments: Comment[]) => void; onPick?: () => void
}) {
  const tr = useT()
  const [reply, setReply] = useState('')
  const all = design.comments ?? []
  const replies = all.filter((r) => r.parentId === c.id)
  const set = (list: Comment[]) => onChange(list)
  return (
    <div className={'cm-thread' + (c.resolved ? ' resolved' : '') + (focus ? ' on' : '')}>
      <button className="cm-thread-head" onClick={onPick}>
        <span className={'cm-pin-badge' + (c.fromClient ? ' client' : '')}>{pinNumber(design, c.id)}</span>
        <b>{c.author}</b>
        <small className="muted">{timeAgo(c.at)}</small>
      </button>
      <p>{c.text}</p>
      {replies.map((r) => (
        <div key={r.id} className="cm-reply">
          <b>{r.author}</b> <small className="muted">{timeAgo(r.at)}</small>
          <p>{r.text}</p>
        </div>
      ))}
      <form
        className="cm-inline"
        onSubmit={(e) => {
          e.preventDefault()
          if (!reply.trim()) return
          set([...all, newComment(reply.trim(), me, fromClient, { parentId: c.id })])
          setReply('')
        }}
      >
        <input className="input input-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={tr('Reply…')} aria-label={tr('Reply')} />
      </form>
      <div className="cm-actions">
        <button className="btn btn-sm btn-ghost" onClick={() => set(all.map((x) => (x.id === c.id ? { ...x, resolved: !x.resolved } : x)))}>
          {c.resolved ? <RotateCcw size={13} /> : <Check size={13} />} {c.resolved ? tr('Reopen') : tr('Resolve')}
        </button>
        {c.author === me && (
          <button className="btn btn-sm btn-ghost" onClick={() => set(all.filter((x) => x.id !== c.id && x.parentId !== c.id))}><Trash2 size={13} /> {tr('Delete')}</button>
        )}
      </div>
    </div>
  )
}

/** Writing a new comment at a pin that's just been placed. */
export function Composer({ onSave, onCancel }: { onSave: (text: string) => void; onCancel: () => void }) {
  const tr = useT()
  const [text, setText] = useState('')
  return (
    <form
      className="cm-thread on"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) onSave(text.trim())
      }}
    >
      <textarea className="input" rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={tr('What should change here?')} aria-label={tr('Comment')}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit(); if (e.key === 'Escape') onCancel() }} />
      <div className="cm-actions">
        <button className="btn btn-sm btn-primary" disabled={!text.trim()}>{tr('Comment')}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>{tr('Cancel')}</button>
      </div>
    </form>
  )
}

/** The editor's comments tab. */
export function CommentsPanel({ project, design, me, draft, focus, onChange, onDraftDone, onPick }: {
  project: Project; design: Design; me: string; draft: Draft | null; focus: string | null
  onChange: (comments: Comment[]) => void; onDraftDone: () => void; onPick: (c: Comment) => void
}) {
  const tr = useT()
  const [resolved, setResolved] = useState(false)
  const list = threads(design)
  const shown = list.filter((c) => resolved || !c.resolved)
  return (
    <div className="cm-panel cm-comments">
      <div className="cm-actions" style={{ alignItems: 'center' }}>
        <FeedbackToTasks project={project} comments={design.comments ?? []} source={design.name} />
        {list.some((c) => c.resolved) && (
          <label className="cm-toggle-row" style={{ marginLeft: 'auto' }}>
            <input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} /> <span>{tr('Show resolved')}</span>
          </label>
        )}
      </div>
      {draft && (
        <Composer
          onSave={(text) => {
            onChange([...(design.comments ?? []), newComment(text, me, false, draft)])
            onDraftDone()
          }}
          onCancel={onDraftDone}
        />
      )}
      {!draft && !shown.length && (
        <p className="muted cm-empty-note">
          <MessageSquare size={14} /> {tr('No comments yet. Press C, or the comment button, and click on the artboard to pin one. Clients can comment too when the design is shared.')}
        </p>
      )}
      {shown.map((c) => (
        <Thread key={c.id} design={design} comment={c} me={me} fromClient={false} focus={focus === c.id} onChange={onChange} onPick={() => onPick(c)} />
      ))}
    </div>
  )
}
