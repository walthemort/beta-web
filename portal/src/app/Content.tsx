/**
 * Content Machine: an add-on for making on-brand content for clients – social posts, banners,
 * slides – from their brand hub. Locked until the studio switches it on.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Copy, ImagePlus, Plus, Repeat2, Trash2 } from 'lucide-react'
import { Modal, useConfirm } from '../components/ui'
import { putBlob } from '../data/blobs'
import { formatDate, now, useStore } from '../data/store'
import type { Design, DesignTemplate, Project } from '../data/types'
import { useT } from '../data/i18n'
import { hasApp } from '../data/plans'
import { AppGate } from './Apps'
import { SIZES, TEMPLATES, brandOf, newDesign, rebrand, resizeArtboard, uid, type TemplateId } from '../features/content/model'
import { threads } from '../features/content/comments'
import { StatusPill } from '../components/kit'
import { Thumbnail } from '../features/content/render'
import { DesignEditor } from '../features/content/Editor'
import '../features/content/content.css'

export default function Content() {
  const { designId } = useParams()
  const { state } = useStore()
  if (!hasApp(state, 'contentMachine')) return <AppGate id="contentMachine">{null}</AppGate>
  if (designId) {
    const design = state.designs.find((d) => d.id === designId)
    const project = state.projects.find((p) => p.id === design?.projectId)
    if (!design || !project) return <Missing />
    return <DesignEditor key={design.id} design={design} project={project} />
  }
  return <Designs />
}

function Missing() {
  const tr = useT()
  return (
    <div className="empty">
      <p>{tr('This design doesn’t exist any more.')}</p>
      <Link to="/app/content" className="btn">{tr('Back to all designs')}</Link>
    </div>
  )
}

function Designs() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const { confirm, confirmNode } = useConfirm()
  const [creating, setCreating] = useState(false)
  const [moving, setMoving] = useState<Design | null>(null)
  const [projectId, setProjectId] = useState('')
  const designs = [...state.designs].filter((d) => !projectId || d.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const withDesigns = state.projects.filter((p) => state.designs.some((d) => d.projectId === p.id))

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('Content Machine')}</span>
          <h1>{tr('Content')}</h1>
          <p className="muted">{tr('Posts, banners and slides on your clients’ brands.')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> {tr('New design')}</button>
      </div>
      {withDesigns.length > 1 && (
        <select className="input input-sm" style={{ justifySelf: 'start', width: 'auto' }} value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={tr('Client')}>
          <option value="">{tr('All clients')}</option>
          {withDesigns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {designs.length === 0 ? (
        <div className="empty">
          <p>{tr('No designs yet. Start with a client’s brand and a size – the layout, colours and logo are filled in for you.')}</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> {tr('New design')}</button>
        </div>
      ) : (
        <div className="cm-grid">
          {designs.map((d) => {
            const p = state.projects.find((x) => x.id === d.projectId)
            if (!p) return null
            return (
              <div key={d.id} className="card cm-card">
                <Link to={`/app/content/${d.id}`} className="cm-card-art" aria-label={tr('Open {name}', { name: d.name })}>
                  <Thumbnail artboard={d.artboards[0]} project={p} width={d.artboards[0].width >= d.artboards[0].height ? 220 : 140} />
                </Link>
                <div className="cm-card-body list-item" style={{ padding: '12px 14px' }}>
                  <Link to={`/app/content/${d.id}`} className="grow cell-title">
                    <b style={{ fontWeight: 500 }}>{d.name}</b>
                    <small>{p.name} · {d.artboards.length === 1 ? tr('1 size') : tr('{n} sizes', { n: d.artboards.length })} · {formatDate(d.updatedAt)}</small>
                    {(d.shared || threads(d).some((c) => !c.resolved)) && (
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                        {d.shared && <StatusPill status={d.shared.status} />}
                        {threads(d).some((c) => !c.resolved) && <small className="muted">{tr('{n} open comments', { n: threads(d).filter((c) => !c.resolved).length })}</small>}
                      </span>
                    )}
                  </Link>
                  <button className="btn btn-ghost btn-icon" title={tr('Copy to another client’s brand')} onClick={() => setMoving(d)}>
                    <Repeat2 size={15} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    title={tr('Duplicate')}
                    onClick={() => dispatch({ type: 'insert', coll: 'designs', item: { ...d, id: Math.random().toString(36).slice(2, 10), name: d.name + ' 2', createdAt: now(), updatedAt: now() } })}
                  >
                    <Copy size={15} />
                  </button>
                  <button className="btn btn-ghost btn-icon" title={tr('Delete')} onClick={() => confirm(tr('Delete “{name}”? This can’t be undone.', { name: d.name }), () => dispatch({ type: 'remove', coll: 'designs', id: d.id }))}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {moving && (
        <RebrandModal
          design={moving}
          onClose={() => setMoving(null)}
          onCreate={(d) => { dispatch({ type: 'insert', coll: 'designs', item: d, log: { text: `Design copied onto a new brand: ${d.name}`, projectId: d.projectId } }); navigate(`/app/content/${d.id}`) }}
        />
      )}
      {creating && <NewDesignModal onClose={() => setCreating(false)} onCreate={(d) => { dispatch({ type: 'insert', coll: 'designs', item: d, log: { text: `Design started: ${d.name}`, projectId: d.projectId } }); navigate(`/app/content/${d.id}`) }} />}
      {confirmNode}
    </>
  )
}

/** Pick the client's brand, a size and a starting layout. */
function NewDesignModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: Design) => void }) {
  const tr = useT()
  const { state } = useStore()
  const projects = useMemo(() => [...state.projects].sort((a, b) => Number(!!a.archived) - Number(!!b.archived)), [state.projects])
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [size, setSize] = useState<string>(SIZES[0].id)
  const [template, setTemplate] = useState<TemplateId | `saved:${string}`>('announcement')
  const saved = state.studio.designTemplates ?? []
  const [photo, setPhoto] = useState<{ src: string; ratio: number; name: string } | null>(null)
  const project = projects.find((p) => p.id === projectId)
  const brand = project && brandOf(project)

  async function pick(file?: File) {
    if (!file) return
    const src = await putBlob(file)
    const ratio = await new Promise<number>((r) => {
      const img = new Image()
      img.onload = () => r(img.naturalWidth / img.naturalHeight || 1)
      img.onerror = () => r(1)
      img.src = URL.createObjectURL(file)
    })
    setPhoto({ src, ratio, name: file.name })
    setTemplate('photo')
  }

  if (!projects.length)
    return (
      <Modal title={tr('New design')} onClose={onClose}>
        <p className="muted">{tr('Designs are made on a client’s brand hub. Create a project first.')}</p>
        <div className="modal-actions"><Link to="/app/projects?new=1" className="btn btn-primary">{tr('New project')}</Link></div>
      </Modal>
    )

  return (
    <Modal title={tr('New design')} subtitle={tr('Colours, fonts and logo come from the brand hub you pick.')} onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        if (!project) return
        const t = template.startsWith('saved:') ? saved.find((x) => `saved:${x.id}` === template) : undefined
        onCreate(t ? fromTemplate(project, t, size, state.projects) : newDesign(project, size, template as TemplateId, photo ?? undefined))
      }}>
        <label>
          {tr('Brand')}
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.archived ? ` (${tr('archived')})` : ''}</option>)}
          </select>
        </label>
        {brand && (
          <div className="cm-swatches" aria-hidden="true">
            {brand.swatches.slice(0, 8).map((c) => <span key={c} className="cm-swatch" style={{ background: c, cursor: 'default' }} />)}
            <small className="muted" style={{ alignSelf: 'center' }}>{brand.heading}</small>
          </div>
        )}
        <label>
          {tr('Size')}
          <select className="input" value={size} onChange={(e) => setSize(e.target.value)}>
            {SIZES.map((s) => <option key={s.id} value={s.id}>{tr(s.name)} · {s.width}×{s.height}</option>)}
          </select>
        </label>
        <div className="field">
          <label>{tr('Start from')}</label>
          <div className="seg" role="group" style={{ flexWrap: 'wrap', justifySelf: 'start' }}>
            {TEMPLATES.map((t) => <button key={t.id} type="button" aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>{tr(t.name)}</button>)}
          </div>
          {saved.length > 0 && (
            <>
              <small className="muted">{tr('Your templates – made in this brand’s colours and fonts')}</small>
              <div className="seg" role="group" style={{ flexWrap: 'wrap', justifySelf: 'start' }}>
                {saved.map((t) => <button key={t.id} type="button" aria-pressed={template === `saved:${t.id}`} onClick={() => setTemplate(`saved:${t.id}`)}>{t.name}</button>)}
              </div>
            </>
          )}
        </div>
        <label className="btn btn-sm" style={{ justifySelf: 'start', cursor: 'pointer' }}>
          <ImagePlus size={14} /> {photo ? photo.name : tr('Add a photo (optional)')}
          <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button className="btn btn-primary" disabled={!project}>{tr('Create design')}</button>
        </div>
      </form>
    </Modal>
  )
}

/** A design from a saved template: on this project's brand, at the chosen size. */
function fromTemplate(project: Project, t: DesignTemplate, sizeId: string, projects: Project[]): Design {
  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0]
  const from = projects.find((p) => p.id === t.projectId)
  const onBrand = from && from.id !== project.id ? rebrand(t.artboard, brandOf(from), brandOf(project)) : t.artboard
  const at = now()
  return { id: uid(), projectId: project.id, name: `${project.name} – ${t.name}`, artboards: [resizeArtboard(onBrand, size)], createdAt: at, updatedAt: at }
}

/** The same design for another client: colours, fonts and logo swapped for theirs. */
function RebrandModal({ design, onClose, onCreate }: { design: Design; onClose: () => void; onCreate: (d: Design) => void }) {
  const tr = useT()
  const { state } = useStore()
  const from = state.projects.find((p) => p.id === design.projectId)
  const others = state.projects.filter((p) => p.id !== design.projectId && !p.archived)
  const [to, setTo] = useState(others[0]?.id ?? '')
  const target = others.find((p) => p.id === to)
  return (
    <Modal title={tr('Copy to another client’s brand')} subtitle={tr('The layout stays; colours swap role for role, fonts heading for heading, and the logo becomes theirs.')} onClose={onClose}>
      {!others.length ? (
        <p className="muted">{tr('There’s no other client to copy it to yet.')}</p>
      ) : (
        <form className="form" onSubmit={(e) => {
          e.preventDefault()
          if (!from || !target) return
          const at = now()
          onCreate({ id: uid(), projectId: target.id, name: `${design.name} – ${target.name}`, artboards: design.artboards.map((a) => ({ ...rebrand(resizeArtboard(a, a), brandOf(from), brandOf(target)), name: a.name })), createdAt: at, updatedAt: at })
        }}>
          <label>
            {tr('Brand')}
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {target && (
            <div className="cm-swatches" aria-hidden="true">
              {brandOf(target).swatches.slice(0, 8).map((c) => <span key={c} className="cm-swatch" style={{ background: c, cursor: 'default' }} />)}
              <small className="muted" style={{ alignSelf: 'center' }}>{brandOf(target).heading}</small>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
            <button className="btn btn-primary" disabled={!target}><Repeat2 size={15} /> {tr('Make the copy')}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
