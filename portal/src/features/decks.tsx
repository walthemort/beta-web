import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, ExternalLink, Maximize2, MessageCircle, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { CommentList, Composer, type CommentUpdate } from './comments'
import { RoundsTag, roundsInfo } from './files'
import { DeadlineTag } from './choices'
import { Modal, useConfirm } from '../components/ui'
import { useUndo } from '../components/Undo'
import { CopyLink, StatusPill } from '../components/kit'
import { formatKr, now, timeAgo, today, uid, useStore } from '../data/store'
import { DECK_PURPOSES, type Deck, type DeckPurpose, type Project } from '../data/types'
import { clientUrl } from './proposals'
import { FeedbackToTasks } from './feedbackTasks'
import { useT } from '../data/i18n'

/* ---------- Figma links ---------- */

const FIGMA_KINDS: Record<string, string> = {
  deck: 'Figma Slides',
  slides: 'Figma Slides',
  proto: 'Prototype',
  design: 'Design file',
  file: 'Design file',
  board: 'FigJam board',
}

/** Returns what kind of Figma link this is, or null if it isn't one we can embed. */
export function parseFigma(raw: string): { kind: string; url: string } | null {
  try {
    const u = new URL(raw.trim())
    if (!/(^|\.)figma\.com$/.test(u.hostname)) return null
    const type = u.pathname.split('/')[1]
    if (!FIGMA_KINDS[type]) return null
    return { kind: FIGMA_KINDS[type], url: u.toString() }
  } catch {
    return null
  }
}

/**
 * Figma's embed endpoint: https://embed.figma.com/{design|proto|board|slides|deck}/:key?embed-host=…
 * (the older www.figma.com/embed doesn't support Slides). Keeps params like node-id so the
 * embed opens on the frame the studio linked to. The file must be shared as "Anyone with the link can view".
 */
export function figmaEmbed(url: string) {
  const u = new URL(url)
  const [, type, ...rest] = u.pathname.split('/')
  const e = new URL(`https://embed.figma.com/${type === 'file' ? 'design' : type}/${rest.join('/')}`)
  u.searchParams.forEach((v, k) => e.searchParams.set(k, v))
  e.searchParams.set('embed-host', 'aftryk')
  if (type === 'design' || type === 'file') e.searchParams.set('footer', 'false')
  return e.toString()
}

/* ---------- The 16:9 frame ---------- */

export function DeckFrame({ deck }: { deck: Deck }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="deck-frame-wrap">
      <div className="deck-frame" ref={ref}>
        <iframe src={figmaEmbed(deck.url)} title={deck.title} allowFullScreen loading="lazy" />
      </div>
      <div className="deck-bar">
        <span className="muted">{parseFigma(deck.url)?.kind ?? t('Figma')}</span>
        <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button className="btn btn-sm" onClick={() => ref.current?.requestFullscreen?.()}>
            <Maximize2 size={14} /> {t('Present')}
          </button>
          <a className="btn btn-sm" href={deck.url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> {t('Open in Figma')}
          </a>
        </span>
      </div>
    </div>
  )
}

/* ---------- Studio: list + add ---------- */

export function ProjectDecks({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const [adding, setAdding] = useState(false)
  const decks = state.decks.filter((d) => d.projectId === project.id)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="section-head" style={{ margin: 0 }}>
        <p className="muted" style={{ fontSize: 14, maxWidth: 560 }}>
          {tr('Link a Figma Slides deck, prototype or design file. Your client sees it as a 16:9 presentation, comments per slide and approves the direction.')}
        </p>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> {tr('Add presentation')}</button>
      </div>

      {decks.length === 0 ? (
        <div className="empty">
          <p>{tr('No presentations yet.')}</p>
          <p style={{ fontSize: 13 }}>{tr('Tip: use a 16:9 frame in Figma, e.g. 1920 × 1080.')}</p>
        </div>
      ) : (
        <div className="card">
          {decks.map((d) => {
            const open = d.comments.filter((c) => c.fromClient && !c.resolved).length
            return (
              <div key={d.id} className="file-row">
                <Link to={`/app/projects/${project.id}/presentations/${d.id}`} className="file-main">
                  <span className="deck-thumb">16:9</span>
                  <span className="cell-title">
                    <b style={{ fontWeight: 500 }}>{d.title}</b>
                    <small>
                      {tr(d.purpose)} · {tr(parseFigma(d.url)?.kind ?? '')}
                      {open > 0 && <> · <MessageCircle size={11} style={{ verticalAlign: -1 }} /> {open} {tr('open')}</>}
                    </small>
                  </span>
                </Link>
                <StatusPill status={d.status} />
                <button
                  className="btn btn-ghost btn-icon"
                  aria-label={tr('Delete {title}', { title: d.title })}
                  onClick={() => undoable(tr('“{title}” removed (the Figma file isn’t touched)', { title: d.title }), () => dispatch({ type: 'remove', coll: 'decks', id: d.id }))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}
      {adding && <AddDeckModal project={project} onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddDeckModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const tr = useT()
  const { dispatch } = useStore()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState<DeckPurpose>('Direction')
  const parsed = parseFigma(url)
  const showError = url.trim().length > 8 && !parsed

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!parsed) return
    const t = now()
    dispatch({
      type: 'insert',
      coll: 'decks',
      item: {
        id: uid(),
        projectId: project.id,
        title: title.trim() || (purpose === 'Proposal' ? 'Proposal presentation' : purpose === 'Direction' ? 'Creative direction' : 'Presentation'),
        url: parsed.url,
        purpose,
        status: 'Not shared',
        comments: [],
        roundsUsed: 0,
        createdAt: t,
        updatedAt: t,
      },
      log: { text: 'Presentation added', projectId: project.id },
    })
    onClose()
  }

  return (
    <Modal title={tr('Add a presentation')} subtitle={tr('Paste the share link from Figma.')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="dk-url">{tr('Figma link')}</label>
          <input id="dk-url" className="input" placeholder={tr('https://www.figma.com/deck/…')} value={url} onChange={(e) => setUrl(e.target.value)} required />
          {parsed ? (
            <small style={{ color: 'var(--green)' }}><Check size={12} style={{ verticalAlign: -2 }} /> {parsed.kind}</small>
          ) : showError ? (
            <small className="error">{tr('That doesn’t look like a Figma file, prototype or Slides link.')}</small>
          ) : (
            <small>{tr('In Figma: Share → set to “Anyone with the link can view” → Copy link.')}</small>
          )}
        </div>
        <div className="field">
          <label htmlFor="dk-purpose">{tr('What is it for?')}</label>
          <select id="dk-purpose" className="input" value={purpose} onChange={(e) => setPurpose(e.target.value as DeckPurpose)}>
            {DECK_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p === 'Proposal' ? tr('Proposal – shown above the proposal') : p === 'Direction' ? tr('Direction – creative direction to approve') : tr('Presentation – anything else')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dk-title">{tr('Title')} <span style={{ color: 'var(--faint)' }}>{tr('(optional)')}</span></label>
          <input id="dk-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('e.g. Round 1 – two creative routes')} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={!parsed}>{tr('Add presentation')}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Review: shared by studio and client ---------- */

export function DeckReview({ deckId, mode }: { deckId: string; mode: 'studio' | 'client' }) {
  const { state, dispatch } = useStore()
  const { confirm, confirmNode } = useConfirm()
  const deck = state.decks.find((d) => d.id === deckId)
  const project = state.projects.find((p) => p.id === deck?.projectId)
  const client = state.clients.find((c) => c.id === project?.clientId)
  const t = useT()
  const [slide, setSlide] = useState('')
  const [needComment, setNeedComment] = useState(false)
  const [reviewBy, setReviewBy] = useState(() => new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10))
  if (!deck || !project) return <p className="muted">{t('Presentation not found.')}</p>

  const author = mode === 'client' ? client?.contactName || client?.name || 'Client' : state.studio.owner
  const rounds = roundsInfo(deck, project)
  const update = (fn: (d: Deck) => Deck, log?: string, extra?: { notify?: boolean; link?: string }) =>
    dispatch({
      type: 'update',
      coll: 'decks',
      id: deck.id,
      fn: (d) => ({ ...fn(d), updatedAt: now() }),
      log: log ? { text: log, projectId: project.id, fromClient: mode === 'client', link: mode === 'client' ? `/app/projects/${project.id}/presentations/${deck.id}` : extra?.link, notify: extra?.notify } : undefined,
    })
  const updateComments: CommentUpdate = (fn, log) => update((d) => ({ ...d, comments: fn(d.comments) }), log)

  const comments = [...deck.comments].sort((a, b) => (a.slide ?? 999) - (b.slide ?? 999) || a.at.localeCompare(b.at))
  const canDecide = mode === 'client' && deck.status === 'In review'

  function requestChanges() {
    if (!deck!.comments.some((c) => c.fromClient && !c.resolved)) {
      setNeedComment(true)
      document.getElementById('deck-comment')?.focus()
      return
    }
    const go = () => update((d) => ({ ...d, status: 'Changes requested', changesRequestedBy: author, roundsUsed: d.roundsUsed + 1 }), `${author} requested changes to ${deck!.title}`)
    if (rounds.included && rounds.left === 0)
      confirm(t('All {included} included revision rounds are used. Another round is billed at {x1} per hour. Request changes anyway?', { included: rounds.included, x1: formatKr(state.studio.hourlyRate) }), go, 'Request changes')
    else go()
  }

  return (
    <div className="review deck-review">
      <div className="review-stage">
        <div className="section-head" style={{ margin: 0 }}>
          <div className="cell-title">
            <span className="eyebrow">{t(deck.purpose)}</span>
            <h2 style={{ fontSize: 22 }}>{deck.title}</h2>
          </div>
        </div>
        <DeckFrame deck={deck} />
      </div>

      <aside className="review-side card">
        <div className="panel" style={{ gap: 10 }}>
          <div className="section-head" style={{ margin: 0 }}>
            <h3>{mode === 'client' ? t('Your feedback') : t('Feedback')}</h3>
            <StatusPill status={deck.status} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <RoundsTag file={deck} project={project} />
            {deck.status === 'In review' && <DeadlineTag date={deck.reviewBy} />}
          </div>
          {deck.status === 'Approved' && deck.approvedBy && (
            <p className="muted" style={{ fontSize: 13 }}><Check size={13} style={{ verticalAlign: -2 }} /> {t('Approved by')} {deck.approvedBy} · {timeAgo(deck.approvedAt!)}</p>
          )}

          {mode === 'studio' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {deck.status === 'Not shared' || deck.status === 'Changes requested' ? (
                <div className="share-row">
                  <label className="muted" style={{ fontSize: 12 }}>
                    {t('Reply by')}
                    <input type="date" className="input input-sm" value={reviewBy} min={today()} onChange={(e) => setReviewBy(e.target.value)} />
                  </label>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      update((d) => ({ ...d, status: 'In review', reviewBy: reviewBy || undefined }), `${deck.title} is ready for you`, { notify: true, link: `/p/${project.id}/presentations/${deck.id}` })
                    }
                  >
                    {t('Share with client')}
                  </button>
                </div>
              ) : deck.status === 'In review' ? (
                <button className="btn btn-sm" onClick={() => update((d) => ({ ...d, status: 'Not shared', reviewBy: undefined }))}>
                  <RotateCcw size={14} /> {t('Withdraw')}
                </button>
              ) : null}
              {deck.status !== 'Not shared' && <CopyLink url={clientUrl(`/p/${project.id}/presentations/${deck.id}`)} className="btn btn-sm" />}
              <Link className="btn btn-sm" to={`/p/${project.id}/presentations/${deck.id}`} target="_blank">{t('Preview as client')} <ArrowUpRight size={14} /></Link>
              <FeedbackToTasks project={project} comments={deck.comments} source={deck.title} />
            </div>
          )}

          {canDecide && (
            <>
              <div className="decide">
                <button className="btn btn-primary" onClick={() => update((d) => ({ ...d, status: 'Approved', approvedBy: author, approvedAt: now() }), `${author} approved ${deck.title}`)}>
                  <Check size={16} /> {t('Approve')}
                </button>
                <button className="btn" onClick={requestChanges}>{t('Request changes')}</button>
              </div>
              {rounds.included > 0 && (
                <p className="muted" style={{ fontSize: 12 }}>
                  {rounds.left > 0 ? rounds.left === 1 ? t('1 revision round left.') : t('{n} revision rounds left.', { n: rounds.left }) : t('All included rounds are used. More changes are billed at {x0}/hour.', { x0: formatKr(state.studio.hourlyRate) })}
                </p>
              )}
            </>
          )}
        </div>

        <CommentList
          comments={comments}
          mode={mode}
          author={author}
          update={updateComments}
          where={(c) => (c.slide ? `Slide ${c.slide}` : null)}
          empty={
            <p className="muted" style={{ fontSize: 13, padding: '0 20px' }}>
              {mode === 'client' ? t('Tell us what you think. Add a slide number to point at something specific.') : t('No comments yet.')}
            </p>
          }
        />

        <div className="comment-form">
          {needComment && <p className="error">{t('Add a comment first, so the studio knows what to change.')}</p>}
          <Composer
            id="deck-comment"
            prefix={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input input-sm" style={{ width: 84 }} type="number" min="1" placeholder={t('Slide')} aria-label={t('Slide number (optional)')} value={slide} onChange={(e) => setSlide(e.target.value)} />
                <span className="muted" style={{ fontSize: 12 }}>{t('optional')}</span>
              </div>
            }
            onSend={({ text, voice }) => {
              const n = parseInt(slide, 10)
              updateComments((list) => [...list, { id: uid(), author, fromClient: mode === 'client', text, voice, slide: n > 0 ? n : undefined, at: now() }], `${author} commented on ${deck.title}`)
              setSlide('')
              setNeedComment(false)
            }}
          />
        </div>
      </aside>
      {confirmNode}
    </div>
  )
}
