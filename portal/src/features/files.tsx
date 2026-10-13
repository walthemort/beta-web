import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Columns2, Download, Eye, EyeOff, FileText, Film, MessageCircle, RotateCcw, Trash2, Upload } from 'lucide-react'
import { download, formatSize, isImage, putBlob, deleteBlob, useSrc } from '../data/blobs'
import { formatKr, now, today, uid, useStore } from '../data/store'
import { FILE_CATEGORIES, type Comment, type FileCategory, type Project, type StudioFile } from '../data/types'
import { tidyFileName } from './fileHealth'
import { Dropzone, StatusPill } from '../components/kit'
import { useConfirm } from '../components/ui'
import { useUndo } from '../components/Undo'
import { CommentList, Composer, fmtTime, type CommentUpdate } from './comments'
import { DeadlineTag } from './choices'
import { usePdfPages } from './pdf'
import { translate, useT } from '../data/i18n'
import { hasRoom } from '../data/space'
import { storageGb } from '../data/plans'
import { FeedbackToTasks } from './feedbackTasks'

const guessCategory = (f: File): FileCategory =>
  /logo|icon|mark/i.test(f.name) ? 'Logos' : f.type === 'application/pdf' ? 'Presentations' : f.type.startsWith('image/') || f.type.startsWith('video/') ? 'Artwork' : 'Documents'

const MAX_MB = 50
const isVideo = (mime: string) => mime.startsWith('video/')
const isPdf = (mime: string) => mime === 'application/pdf'

export function useUpload(projectId: string, by: 'studio' | 'client' = 'studio') {
  const { state, dispatch } = useStore()
  const [error, setError] = useState<string | null>(null)

  /** Uploads the files and says how many were saved (none when the plan's file space is full). */
  async function upload(files: File[]): Promise<number> {
    setError(null)
    const client = state.clients.find((c) => c.id === state.projects.find((p) => p.id === projectId)?.clientId)
    if (!(await hasRoom(state, files.reduce((n, f) => n + f.size, 0)))) {
      setError(
        by === 'client'
          ? translate('The studio’s file space is full, so this couldn’t be uploaded. Let them know.')
          : translate('Your file space is full ({gb} GB). Add more space or move up a plan in Settings → Plan.', { gb: storageGb(state) }),
      )
      return 0
    }
    let saved = 0
    for (const f of files) {
      if (f.size > MAX_MB * 1024 ** 2) {
        setError(`${f.name} is larger than ${MAX_MB} MB.`)
        continue
      }
      // Tidy names survive every server and every operating system. The studio can turn this off.
      const name = state.studio.tidyNames === false ? f.name : tidyFileName(f.name, { prefix: client?.name })
      const src = await putBlob(f)
      const version = { id: uid(), src, mime: f.type || 'application/octet-stream', size: f.size, createdAt: now() }
      // Same name in the same project = a new version of that file.
      const existing = state.files.find((x) => x.projectId === projectId && x.name === name)
      if (existing) {
        dispatch({
          type: 'update',
          coll: 'files',
          id: existing.id,
          fn: (x) => ({ ...x, versions: [...x.versions, version], status: x.status === 'Not shared' ? x.status : 'In review' }),
          log: {
            text: `Version ${existing.versions.length + 1} of ${name} is ready`,
            projectId,
            notify: existing.status !== 'Not shared',
            link: `/p/${projectId}/review/${existing.id}`,
          },
        })
      } else {
        dispatch({
          type: 'insert',
          coll: 'files',
          item: {
            id: uid(),
            projectId,
            name,
            category: by === 'client' ? 'From client' : guessCategory(f),
            versions: [version],
            status: 'Not shared',
            published: false,
            comments: [],
            roundsUsed: 0,
            uploadedBy: by,
            createdAt: now(),
          },
          log: { text: by === 'client' ? `Client shared ${name}` : `${name} uploaded`, projectId, fromClient: by === 'client', link: `/app/projects/${projectId}/files` },
        })
      }
      saved++
    }
    return saved
  }
  return { upload, error }
}

export function Thumb({ file, size = 56 }: { file: StudioFile; size?: number }) {
  const v = file.versions[file.versions.length - 1]
  const url = useSrc(v?.src)
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      {v && isImage(v.mime) && url ? (
        <img src={url} alt="" />
      ) : v && isVideo(v.mime) ? (
        <Film size={size / 2.6} strokeWidth={1.5} />
      ) : (
        <FileText size={size / 2.6} strokeWidth={1.5} />
      )}
    </span>
  )
}

/** Revision rounds: how many change requests the client has left (#23). */
export function roundsInfo(file: { roundsUsed: number }, project?: Project) {
  const included = project?.roundsIncluded ?? 2
  const left = Math.max(0, included - file.roundsUsed)
  return { included, used: file.roundsUsed, left, extra: file.roundsUsed > included }
}

export function RoundsTag({ file, project }: { file: { roundsUsed: number }; project?: Project }) {
  const tr = useT()
  const r = roundsInfo(file, project)
  if (!r.included) return null
  return (
    <span className={'pill ' + (r.extra ? 'pill-red' : r.left === 0 ? 'pill-amber' : '')} title={tr('{used} of {included} revision rounds used', { used: r.used, included: r.included })}>
      {r.extra ? tr('Extra round {x0}', { x0: r.used - r.included }) : tr('Round {x0} of {included}', { x0: Math.min(r.used + 1, r.included), included: r.included })}
    </span>
  )
}

/** File list for one project (studio side). */
export function ProjectFiles({ projectId }: { projectId: string }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const { upload, error } = useUpload(projectId)
  const undoable = useUndo()
  const project = state.projects.find((p) => p.id === projectId)
  const files = state.files.filter((f) => f.projectId === projectId)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Dropzone onFiles={upload}>
        <span>
          <b>{tr('Drop files here')}</b> {tr('or click to upload — images, PDFs and videos. Uploading a file with the same name adds a new version.')}
        </span>
      </Dropzone>
      {error && <p className="error">{error}</p>}
      {files.length === 0 && <p className="muted">{tr('No files yet.')}</p>}
      {FILE_CATEGORIES.map((cat) => {
        const list = files.filter((f) => f.category === cat)
        if (!list.length) return null
        return (
          <section key={cat}>
            <div className="section-head"><h2 style={{ fontSize: 16 }}>{cat} <span className="count">{list.length}</span></h2></div>
            <div className="card">
              {list.map((f) => {
                const open = f.comments.filter((c) => !c.resolved && !c.parentId).length
                return (
                  <div key={f.id} className="file-row">
                    <Link to={`/app/projects/${projectId}/files/${f.id}`} className="file-main">
                      <Thumb file={f} />
                      <span className="cell-title">
                        <b style={{ fontWeight: 500 }}>{f.name}</b>
                        <small>
                          {f.uploadedBy === 'client' ? tr('From the client · ') : ''}{tr('Version')} {f.versions.length} · {formatSize(f.versions[f.versions.length - 1].size)}
                          {open > 0 && <> · <MessageCircle size={11} style={{ verticalAlign: -1 }} /> {open} {tr('open')}</>}
                        </small>
                      </span>
                    </Link>
                    {f.status === 'In review' && <DeadlineTag date={f.reviewBy} />}
                    {f.uploadedBy !== 'client' && <StatusPill status={f.status} />}
                    <select
                      className="input input-sm"
                      aria-label={tr('Category of {name}', { name: f.name })}
                      value={f.category}
                      onChange={(e) => dispatch({ type: 'update', coll: 'files', id: f.id, fn: (x) => ({ ...x, category: e.target.value as FileCategory }) })}
                    >
                      {FILE_CATEGORIES.map((c) => <option key={c} value={c}>{tr(c)}</option>)}
                    </select>
                    <button
                      className={'btn btn-ghost btn-icon' + (f.published ? ' on' : '')}
                      aria-label={f.published ? tr('Unpublish {name} from the client hub', { name: f.name }) : tr('Publish {name} to the client hub', { name: f.name })}
                      title={f.published ? tr('Published to the client hub') : tr('Not in the client hub')}
                      onClick={() => dispatch({ type: 'update', coll: 'files', id: f.id, fn: (x) => ({ ...x, published: !x.published }) })}
                    >
                      {f.published ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      aria-label={tr('Delete {name}', { name: f.name })}
                      onClick={() =>
                        // The uploads themselves are only deleted once Undo is no longer possible.
                        undoable(tr('{name} deleted', { name: f.name }), () => dispatch({ type: 'remove', coll: 'files', id: f.id }), {
                          onExpire: () => f.versions.forEach((v) => deleteBlob(v.src)),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      {project && project.roundsIncluded > 0 && (
        <p className="muted" style={{ fontSize: 12 }}>
          {project.roundsIncluded} {tr('revision rounds are included per file. Clients see how many they have left, and are told before an extra round (billed at')} {formatKr(state.studio.hourlyRate)}{tr('/hour).')}
        </p>
      )}
    </div>
  )
}

/* ---------- Pinnable surfaces ---------- */

type Pin = { x: number; y: number; page?: number }

/** An image (or PDF page) you can click to pin a comment on. */
function PinSurface({
  src,
  alt,
  pins,
  draft,
  active,
  onPlace,
  onPinClick,
  children,
  interactive,
}: {
  src: string
  alt: string
  pins: { c: Comment; n: number }[]
  draft: Pin | null
  active: string | null
  onPlace: (x: number, y: number) => void
  onPinClick: (c: Comment) => void
  children?: ReactNode
  interactive: boolean
}) {
  function click(e: MouseEvent<HTMLDivElement>) {
    if (!interactive || (e.target as HTMLElement).closest('.pin-pop, .pin')) return
    const r = e.currentTarget.getBoundingClientRect()
    onPlace(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100)
  }
  return (
    <div className="review-canvas" onClick={click} style={{ cursor: interactive ? 'crosshair' : 'default' }}>
      <img src={src} alt={alt} draggable={false} />
      {pins.map(({ c, n }) => (
        <span
          key={c.id}
          className={'pin' + (c.resolved ? ' resolved' : '') + (active === c.id ? ' active' : '')}
          style={{ left: c.x + '%', top: c.y + '%' }}
          onClick={(e) => {
            e.stopPropagation()
            onPinClick(c)
          }}
          title={c.text}
        >
          {n}
        </span>
      ))}
      {draft && <span className="pin new" style={{ left: draft.x + '%', top: draft.y + '%' }}>{pins.length + 1}</span>}
      {children}
    </div>
  )
}

function PinPopover({ pin, onSend, onCancel }: { pin: Pin; onSend: (c: { text: string; voice?: Comment['voice'] }) => void; onCancel: () => void }) {
  const tr = useT()
  return (
    <div
      className="pin-pop"
      style={{
        left: `clamp(8px, calc(${pin.x}% - 140px), calc(100% - 288px))`,
        top: pin.y > 60 ? undefined : `calc(${pin.y}% + 20px)`,
        bottom: pin.y > 60 ? `calc(${100 - pin.y}% + 20px)` : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Composer autoFocus placeholder={tr('What should change here?')} onSend={onSend} onCancel={onCancel} />
    </div>
  )
}

/** Drag the handle to compare two versions (#18). */
function CompareSlider({ a, b, labelA, labelB }: { a: string; b: string; labelA: string; labelB: string }) {
  const tr = useT()
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  const move = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }
  return (
    <div
      className="compare"
      ref={ref}
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        move(e.clientX)
      }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}
    >
      <img src={b} alt={labelB} draggable={false} />
      <div className="compare-a" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={a} alt={labelA} draggable={false} />
      </div>
      <span className="compare-line" style={{ left: pos + '%' }}><i /></span>
      <span className="compare-label left">{labelA}</span>
      <span className="compare-label right">{labelB}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={tr('Compare versions')}
        className="compare-range"
      />
    </div>
  )
}

function PdfPages({ url, name, comments, draft, active, interactive, onPlace, onPinClick, popover }: {
  url: string
  name: string
  comments: Comment[]
  draft: Pin | null
  active: string | null
  interactive: boolean
  onPlace: (p: Pin) => void
  onPinClick: (c: Comment) => void
  popover: ReactNode
}) {
  const tr = useT()
  const { pages, error } = usePdfPages(url)
  if (error) return <iframe className="review-pdf" src={url} title={name} />
  if (!pages) return <div className="review-canvas empty-preview"><span className="muted">{tr('Preparing pages…')}</span></div>
  const pinned = comments.filter((c) => c.x !== undefined && !c.parentId)
  return (
    <div className="pdf-pages">
      {pages.map((pg, i) => {
        const page = i + 1
        const pins = pinned.map((c, n) => ({ c, n: n + 1 })).filter(({ c }) => (c.page ?? 1) === page)
        return (
          <div key={page} id={`page-${page}`} className="pdf-page">
            <PinSurface
              src={pg.src}
              alt={tr('{name}, page {page}', { name, page })}
              pins={pins}
              draft={draft?.page === page ? draft : null}
              active={active}
              interactive={interactive}
              onPlace={(x, y) => onPlace({ x, y, page })}
              onPinClick={onPinClick}
            >
              {draft?.page === page && popover}
            </PinSurface>
            <span className="pdf-num">{tr('Page')} {page} {tr('of')} {pages.length}</span>
          </div>
        )
      })}
    </div>
  )
}

function VideoReview({ url, comments, active, onJump, onComment, videoRef }: {
  url: string
  comments: Comment[]
  active: string | null
  onJump: (c: Comment) => void
  onComment: (time: number) => void
  videoRef: React.RefObject<HTMLVideoElement | null>
}) {
  const t = useT()
  const [duration, setDuration] = useState(0)
  const timed = comments.filter((c) => c.time !== undefined && !c.parentId)
  return (
    <div className="video-review">
      <video ref={videoRef} src={url} controls playsInline onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} />
      <div className="video-markers" aria-label={t('Comments on the timeline')}>
        {duration > 0 &&
          timed.map((c) => (
            <button
              key={c.id}
              className={'vmark' + (active === c.id ? ' active' : '') + (c.resolved ? ' resolved' : '')}
              style={{ left: (c.time! / duration) * 100 + '%' }}
              onClick={() => onJump(c)}
              title={`${fmtTime(c.time!)} · ${c.text}`}
            />
          ))}
      </div>
      <button
        className="btn btn-sm"
        onClick={() => {
          const v = videoRef.current
          if (!v) return
          v.pause()
          onComment(v.currentTime)
        }}
      >
        <MessageCircle size={14} /> {t('Comment at this moment')}
      </button>
    </div>
  )
}

/* ---------- Review screen: shared by the studio and the client portal ---------- */

export function FileReview({ fileId, mode }: { fileId: string; mode: 'studio' | 'client' }) {
  const { state, dispatch } = useStore()
  const { confirm, confirmNode } = useConfirm()
  const file = state.files.find((f) => f.id === fileId)
  const project = state.projects.find((p) => p.id === file?.projectId)
  const client = state.clients.find((c) => c.id === project?.clientId)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [compare, setCompare] = useState(false)
  const [pin, setPin] = useState<Pin | null>(null)
  const [atTime, setAtTime] = useState<number | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [needComment, setNeedComment] = useState(false)
  const [reviewBy, setReviewBy] = useState(() => new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10))
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const { upload } = useUpload(file?.projectId ?? '')
  const t = useT()

  const version = useMemo(() => file?.versions.find((v) => v.id === versionId) ?? file?.versions.at(-1), [file, versionId])
  const prev = file && version ? file.versions[file.versions.findIndex((v) => v.id === version.id) - 1] : undefined
  const url = useSrc(version?.src)
  const prevUrl = useSrc(compare ? prev?.src : undefined)
  if (!file || !version || !project) return <p className="muted">{t('File not found.')}</p>

  const latest = version.id === file.versions.at(-1)!.id
  const author = mode === 'client' ? client?.contactName || client?.name || 'Client' : state.studio.owner
  const comments = file.comments.filter((c) => c.versionId === version.id)
  const pinned = comments.filter((c) => c.x !== undefined && !c.parentId)
  const rounds = roundsInfo(file, project)
  const vIndex = file.versions.findIndex((v) => v.id === version.id) + 1

  const update = (fn: (f: StudioFile) => StudioFile, log?: string, extra?: { notify?: boolean; link?: string }) =>
    dispatch({
      type: 'update',
      coll: 'files',
      id: file.id,
      fn,
      log: log ? { text: log, projectId: project.id, fromClient: mode === 'client', link: mode === 'client' ? `/app/projects/${project.id}/files/${file.id}` : extra?.link, notify: extra?.notify } : undefined,
    })
  const updateComments: CommentUpdate = (fn, log) => update((f) => ({ ...f, comments: fn(f.comments) }), log)

  const addComment = (c: { text: string; voice?: Comment['voice'] }, where: Partial<Comment> = {}) => {
    updateComments((list) => [...list, { id: uid(), versionId: version.id, author, fromClient: mode === 'client', at: now(), ...c, ...where }], `${author} commented on ${file.name}`)
    setNeedComment(false)
  }

  const jump = (c: Comment) => {
    setActive(c.id)
    if (c.time !== undefined && videoRef.current) {
      videoRef.current.currentTime = c.time
      videoRef.current.pause()
    }
    if (c.page) document.getElementById(`page-${c.page}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    document.getElementById('c-' + c.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const where = (c: Comment) =>
    c.x !== undefined ? `${c.page ? `p. ${c.page} · ` : ''}#${pinned.indexOf(c) + 1}` : c.time !== undefined ? fmtTime(c.time) : null

  const popover = pin && (
    <PinPopover
      pin={pin}
      onCancel={() => setPin(null)}
      onSend={(c) => {
        addComment(c, { x: pin.x, y: pin.y, page: pin.page })
        setPin(null)
      }}
    />
  )

  const canDecide = mode === 'client' && latest && file.status === 'In review'
  function requestChanges() {
    const hasFeedback = file!.comments.some((c) => c.versionId === version!.id && c.fromClient && !c.resolved)
    if (!hasFeedback) {
      setNeedComment(true)
      document.getElementById('file-comment')?.focus()
      return
    }
    const go = () =>
      update((f) => ({ ...f, status: 'Changes requested', changesRequestedBy: author, roundsUsed: f.roundsUsed + 1 }), `${author} requested changes to ${file!.name}${rounds.left === 0 ? ' (extra round)' : ''}`)
    if (rounds.included && rounds.left === 0)
      confirm(
        t('You’ve used all {included} included revision rounds for this file. Another round is billed at {x1} per hour. Request changes anyway?', { included: rounds.included, x1: formatKr(state.studio.hourlyRate) }),
        go,
        'Request changes',
      )
    else go()
  }

  const media = isImage(version.mime) ? (
    compare && prevUrl && url ? (
      <CompareSlider a={prevUrl} b={url} labelA={`Version ${vIndex - 1}`} labelB={`Version ${vIndex}`} />
    ) : url ? (
      <PinSurface
        src={url}
        alt={file.name}
        pins={pinned.map((c, n) => ({ c, n: n + 1 }))}
        draft={pin}
        active={active}
        interactive={latest}
        onPlace={(x, y) => setPin({ x, y })}
        onPinClick={jump}
      >
        {popover}
      </PinSurface>
    ) : null
  ) : isPdf(version.mime) && url ? (
    <PdfPages url={url} name={file.name} comments={comments} draft={pin} active={active} interactive={latest} onPlace={setPin} onPinClick={jump} popover={popover} />
  ) : isVideo(version.mime) && url ? (
    <VideoReview url={url} comments={comments} active={active} onJump={jump} onComment={setAtTime} videoRef={videoRef} />
  ) : (
    <div className="review-canvas empty-preview"><FileText size={40} strokeWidth={1} /><span>{t('No preview for this file type')}</span></div>
  )

  return (
    <div className="review">
      <div className="review-stage">
        <div className="review-toolbar">
          <select className="input input-sm" value={version.id} onChange={(e) => { setVersionId(e.target.value); setCompare(false); setPin(null) }} aria-label={t('Version')}>
            {file.versions.map((v, i) => (
              <option key={v.id} value={v.id}>{t('Version')} {i + 1}{i === file.versions.length - 1 ? t(' (latest)') : ''}</option>
            ))}
          </select>
          {prev && isImage(version.mime) && isImage(prev.mime) && (
            <button className={'btn btn-sm' + (compare ? ' btn-primary' : '')} onClick={() => { setCompare(!compare); setPin(null) }} aria-pressed={compare}>
              <Columns2 size={14} /> {t('Compare with V')}{vIndex - 1}
            </button>
          )}
          {version.note && <span className="muted" style={{ fontSize: 13 }}>{version.note}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => download(version.src, file.name)}><Download size={14} /> {t('Download')}</button>
            {mode === 'studio' && (
              <label className="btn btn-sm">
                <Upload size={14} /> {t('New version')}
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) upload([new File([f], file.name, { type: f.type })]).then(() => setVersionId(null))
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </span>
        </div>
        {media}
        {latest && !compare && (isImage(version.mime) || isPdf(version.mime)) && (
          <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{t(isPdf(version.mime) ? 'Click on the page to pin a comment to that spot.' : 'Click on the image to pin a comment to that spot.')}</p>
        )}
      </div>

      <aside className="review-side card">
        <div className="panel" style={{ gap: 10 }}>
          <div className="section-head" style={{ margin: 0 }}>
            <h3 style={{ overflowWrap: 'anywhere' }}>{file.name}</h3>
            {file.uploadedBy !== 'client' && <StatusPill status={file.status} />}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {file.uploadedBy !== 'client' && <RoundsTag file={file} project={project} />}
            {file.status === 'In review' && <DeadlineTag date={file.reviewBy} />}
          </div>
          {file.status === 'Approved' && file.approvedBy && (
            <p className="muted" style={{ fontSize: 13 }}><Check size={13} style={{ verticalAlign: -2 }} /> {t('Approved by')} {file.approvedBy}</p>
          )}

          {mode === 'studio' && file.uploadedBy !== 'client' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {file.status === 'Not shared' || file.status === 'Changes requested' ? (
                <div className="share-row">
                  <label className="muted" style={{ fontSize: 12 }}>
                    {t('Reply by')}
                    <input type="date" className="input input-sm" value={reviewBy} min={today()} onChange={(e) => setReviewBy(e.target.value)} />
                  </label>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      update((f) => ({ ...f, status: 'In review', reviewBy: reviewBy || undefined }), `${file.name} is ready for your review`, {
                        notify: true,
                        link: `/p/${project.id}/review/${file.id}`,
                      })
                    }
                  >
                    {t('Share for review')}
                  </button>
                </div>
              ) : file.status === 'In review' ? (
                <button className="btn btn-sm" onClick={() => update((f) => ({ ...f, status: 'Not shared', reviewBy: undefined }))}>
                  <RotateCcw size={14} /> {t('Withdraw from review')}
                </button>
              ) : null}
              <button className="btn btn-sm" onClick={() => update((f) => ({ ...f, published: !f.published }))}>
                {file.published ? <EyeOff size={14} /> : <Eye size={14} />} {file.published ? t('Unpublish from hub') : t('Publish to hub')}
              </button>
              <FeedbackToTasks project={project} comments={file.comments} source={file.name} />
              {rounds.extra && <p className="error" style={{ fontSize: 12 }}>{t('This file is past its included rounds — remember to invoice the extra work.')}</p>}
            </div>
          )}

          {canDecide && (
            <>
              <div className="decide">
                <button
                  className="btn btn-primary"
                  onClick={() => update((f) => ({ ...f, status: 'Approved', approvedBy: author, approvedAt: now(), published: f.category === 'Logos' ? true : f.published }), `${author} approved ${file.name}`)}
                >
                  <Check size={16} /> {t('Approve')}
                </button>
                <button className="btn" onClick={requestChanges}>{t('Request changes')}</button>
              </div>
              {rounds.included > 0 && (
                <p className="muted" style={{ fontSize: 12 }}>
                  {rounds.left > 0
                    ? rounds.left === 1 ? t('1 revision round left for this file.') : t('{n} revision rounds left for this file.', { n: rounds.left })
                    : t('All {included} included rounds are used. More changes are billed at {x1}/hour.', { included: rounds.included, x1: formatKr(state.studio.hourlyRate) })}
                </p>
              )}
            </>
          )}
          {mode === 'client' && !latest && <p className="muted" style={{ fontSize: 13 }}>{t('You’re looking at an older version.')}</p>}
        </div>

        <CommentList
          comments={comments}
          mode={mode}
          author={author}
          update={updateComments}
          where={where}
          onJump={jump}
          active={active}
          setActive={setActive}
          empty={<p className="muted" style={{ fontSize: 13, padding: '0 20px' }}>{t('No comments on this version yet.')}</p>}
        />

        {latest && (
          <div className="comment-form">
            {needComment && <p className="error">{t('Add a comment first, so the studio knows what to change.')}</p>}
            <Composer
              id="file-comment"
              prefix={atTime !== null ? <span className="pill pill-blue" style={{ justifySelf: 'start' }}>{t('At')} {fmtTime(atTime)} <button className="link-btn" onClick={() => setAtTime(null)}>{t('remove')}</button></span> : undefined}
              placeholder={atTime !== null ? t('What should change at this moment?') : t('Write a general comment…')}
              onSend={(c) => {
                addComment(c, atTime !== null ? { time: atTime } : {})
                setAtTime(null)
              }}
            />
          </div>
        )}
      </aside>
      {confirmNode}
    </div>
  )
}
