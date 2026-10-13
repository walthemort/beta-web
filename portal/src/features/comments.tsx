/**
 * Comments shared by file review and presentations: threads (#21), reactions (#22)
 * and voice notes (#26). The parent owns the comment array and passes an `update` function.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Mic, Square, Trash2, X } from 'lucide-react'
import { putBlob, useSrc } from '../data/blobs'
import { initials, now, timeAgo, uid } from '../data/store'
import { REACTIONS, type Comment, type Reaction } from '../data/types'
import { useT } from '../data/i18n'
import { useUndo } from '../components/Undo'

export type CommentUpdate = (fn: (list: Comment[]) => Comment[], log?: string) => void

/* ---------- Voice notes ---------- */

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const started = useRef(0)
  const resolveRef = useRef<((v: { blob: Blob; seconds: number } | null) => void) | null>(null)

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSeconds(Math.round((Date.now() - started.current) / 1000)), 250)
    return () => clearInterval(t)
  }, [recording])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream)
      chunks.current = []
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const secs = Math.max(1, Math.round((Date.now() - started.current) / 1000))
        resolveRef.current?.(chunks.current.length ? { blob: new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }), seconds: secs } : null)
      }
      rec.current = r
      started.current = Date.now()
      setSeconds(0)
      r.start()
      setRecording(true)
    } catch {
      setError('Microphone access was blocked. Allow it in your browser to record voice notes.')
    }
  }

  function stop(): Promise<{ blob: Blob; seconds: number } | null> {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setRecording(false)
      rec.current?.state === 'recording' ? rec.current.stop() : resolve(null)
    })
  }

  return { recording, seconds, error, start, stop, supported: typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices }
}

function VoicePlayer({ src, seconds }: { src: string; seconds: number }) {
  const tr = useT()
  const url = useSrc(src)
  return (
    <span className="voice">
      {url ? <audio controls src={url} preload="metadata" /> : <span className="muted">{tr('Loading…')}</span>}
      <small>{seconds}s</small>
    </span>
  )
}

/* ---------- Composer ---------- */

export function Composer({
  onSend,
  placeholder = 'Write a comment…',
  autoFocus,
  prefix,
  compact,
  onCancel,
  id,
}: {
  onSend: (c: { text: string; voice?: Comment['voice'] }) => void
  placeholder?: string
  autoFocus?: boolean
  /** Extra controls shown above the text box (e.g. slide number). */
  prefix?: ReactNode
  compact?: boolean
  onCancel?: () => void
  id?: string
}) {
  const t = useT()
  const [text, setText] = useState('')
  const [voice, setVoice] = useState<Comment['voice'] | null>(null)
  const r = useRecorder()

  async function toggleRecord() {
    if (r.recording) {
      const res = await r.stop()
      if (res) setVoice({ src: await putBlob(res.blob), seconds: res.seconds })
    } else r.start()
  }

  function send() {
    if (!text.trim() && !voice) return
    onSend({ text: text.trim(), voice: voice ?? undefined })
    setText('')
    setVoice(null)
  }

  return (
    <div className={'composer' + (compact ? ' compact' : '')}>
      {prefix}
      <textarea
        id={id}
        className="input"
        rows={compact ? 1 : 2}
        autoFocus={autoFocus}
        placeholder={r.recording ? '…' : t(placeholder)}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
          if (e.key === 'Escape') onCancel?.()
        }}
      />
      {voice && (
        <span className="voice-draft">
          <VoicePlayer src={voice.src} seconds={voice.seconds} />
          <button className="btn btn-ghost btn-icon" aria-label={t('Remove voice note')} onClick={() => setVoice(null)}><X size={14} /></button>
        </span>
      )}
      {r.error && <p className="error">{r.error}</p>}
      <div className="composer-bar">
        {r.supported && (
          <button type="button" className={'btn btn-sm' + (r.recording ? ' recording' : '')} onClick={toggleRecord} aria-label={r.recording ? t('Stop recording') : t('Record a voice note')}>
            {r.recording ? <><Square size={12} /> {r.seconds}s</> : <><Mic size={14} /> {t('Voice')}</>}
          </button>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {onCancel && <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>{t('Cancel')}</button>}
          <button type="button" className="btn btn-sm" onClick={send} disabled={(!text.trim() && !voice) || r.recording}>
            {compact ? t('Reply') : t('Comment')}
          </button>
        </span>
      </div>
    </div>
  )
}

/* ---------- Thread list ---------- */

export function CommentList({
  comments,
  mode,
  author,
  update,
  where,
  onJump,
  active,
  setActive,
  empty,
}: {
  comments: Comment[]
  mode: 'studio' | 'client'
  author: string
  update: CommentUpdate
  /** Label for where a comment points (pin number, page, time, slide). */
  where?: (c: Comment) => ReactNode
  onJump?: (c: Comment) => void
  active?: string | null
  setActive?: (id: string | null) => void
  empty?: ReactNode
}) {
  const t = useT()
  const undoable = useUndo()
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const top = comments.filter((c) => !c.parentId)
  const replies = (id: string) => comments.filter((c) => c.parentId === id)

  const react = (c: Comment, r: Reaction) =>
    update((list) =>
      list.map((x) => {
        if (x.id !== c.id) return x
        const who = x.reactions?.[r] ?? []
        const next = who.includes(author) ? who.filter((w) => w !== author) : [...who, author]
        return { ...x, reactions: { ...x.reactions, [r]: next } }
      }),
    )

  const one = (c: Comment, isReply = false) => (
    <div
      key={c.id}
      id={'c-' + c.id}
      className={'comment' + (c.resolved ? ' resolved' : '') + (active === c.id ? ' active' : '') + (isReply ? ' reply' : '')}
      onMouseEnter={() => setActive?.(c.id)}
    >
      <span className={'avatar' + (c.fromClient ? ' client' : '')}>{initials(c.author)}</span>
      <div style={{ minWidth: 0 }}>
        <div className="comment-head">
          <b>{c.author}</b>
          <small>{timeAgo(c.at)}</small>
          {where?.(c) && (
            <button className="where" onClick={() => onJump?.(c)} title={t('Show where')}>
              {where(c)}
            </button>
          )}
        </div>
        {c.text && <p>{c.text}</p>}
        {c.voice && <VoicePlayer src={c.voice.src} seconds={c.voice.seconds} />}
        <div className="comment-actions">
          {REACTIONS.map((r) => {
            const who = c.reactions?.[r] ?? []
            if (!who.length) return null
            return (
              <button key={r} className={'reaction' + (who.includes(author) ? ' mine' : '')} onClick={() => react(c, r)} title={who.join(', ')}>
                {r} {who.length}
              </button>
            )
          })}
          <span className="react-add">
            {REACTIONS.map((r) => (
              <button key={r} onClick={() => react(c, r)} aria-label={t('React {r}', { r })}>{r}</button>
            ))}
          </span>
          {!isReply && <button className="link-btn" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>{t('Reply')}</button>}
          {mode === 'studio' && !isReply && (
            <button className="link-btn" onClick={() => update((list) => list.map((x) => (x.id === c.id ? { ...x, resolved: !x.resolved } : x)))}>
              {c.resolved ? t('Reopen') : t('Resolve')}
            </button>
          )}
          {c.author === author && (
            <button className="link-btn" aria-label={t('Delete comment')} onClick={() => undoable(t('Comment deleted'), () => update((list) => list.filter((x) => x.id !== c.id && x.parentId !== c.id)), { undoText: t('Undo') })}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="comments">
      {top.length === 0 && (empty ?? <p className="muted" style={{ fontSize: 13, padding: '0 20px' }}>{t('No comments yet.')}</p>)}
      {top.map((c) => (
        <div key={c.id} className="thread">
          {one(c)}
          {replies(c.id).map((r) => one(r, true))}
          {replyTo === c.id && (
            <div className="reply-box">
              <Composer
                compact
                autoFocus
                placeholder={t('Reply to {x0}…', { x0: c.author.split(' ')[0] })}
                onCancel={() => setReplyTo(null)}
                onSend={({ text, voice }) => {
                  update(
                    (list) => [...list, { id: uid(), parentId: c.id, versionId: c.versionId, author, fromClient: mode === 'client', text, voice, at: now() }],
                    `${author} replied to a comment`,
                  )
                  setReplyTo(null)
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
