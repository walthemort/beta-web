/**
 * Pages: the list of pages, and the editor – blocks on the left, the page as visitors see it on the
 * right. Pages go online on /site/<slug>.
 */
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, ExternalLink, Globe, ImagePlus, Monitor, Plus, Smartphone, Trash2, X } from 'lucide-react'
import { Modal, useConfirm } from '../../../components/ui'
import { putBlob, useSrc } from '../../../data/blobs'
import { formatDate, now, uid, useStore } from '../../../data/store'
import type { PageBlock, WebPage } from '../../../data/types'
import { useT } from '../../../data/i18n'
import { AppGate } from '../../../app/Apps'
import { BLOCKS, NETWORKS, PAGE_TEMPLATES, freeSlug, newBlock, signupsCsv, slugify, uid as blockId } from './blocks'
import { PageView } from './PageView'
import '../../content/content.css'

export const siteUrl = (slug: string) => `${location.origin}/site/${slug}`

export default function Pages() {
  const { id } = useParams()
  return <AppGate id="pages">{id ? <PageEditor id={id} /> : <PageList />}</AppGate>
}

function PageList() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const { confirm, confirmNode } = useConfirm()
  const [creating, setCreating] = useState(false)
  const list = [...state.webPages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('App')}</span>
          <h1>{tr('Pages')}</h1>
          <p className="muted">{tr('Link-in-bio, coming-soon and campaign pages on the client’s brand')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> {tr('New page')}</button>
      </div>
      {!list.length ? (
        <div className="empty">
          <p>{tr('No pages yet. Pick a client and a template – the brand’s colours, fonts and logo are already on it.')}</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> {tr('New page')}</button>
        </div>
      ) : (
        <div className="card list">
          {list.map((p) => {
            const project = state.projects.find((x) => x.id === p.projectId)
            return (
              <div key={p.id} className="list-item">
                <Link to={`/app/pages/${p.id}`} className="grow cell-title">
                  <b style={{ fontWeight: 500 }}>{p.title}</b>
                  <small>{project?.name} · /site/{p.slug} · {formatDate(p.updatedAt)}</small>
                </Link>
                {!!p.signups?.length && <span className="pill">{p.signups.length === 1 ? tr('1 sign-up') : tr('{n} sign-ups', { n: p.signups.length })}</span>}
                {!!p.views && <span className="muted" style={{ fontSize: 13 }}>{p.views === 1 ? tr('1 view') : tr('{n} views', { n: p.views })}</span>}
                <span className={'pill' + (p.published ? ' pill-green' : '')}>{p.published ? tr('Online') : tr('Draft')}</span>
                <button className="btn btn-ghost btn-icon" title={tr('Delete')} onClick={() => confirm(tr('Delete “{name}”? This can’t be undone.', { name: p.title }), () => dispatch({ type: 'remove', coll: 'webPages', id: p.id }))}><Trash2 size={15} /></button>
              </div>
            )
          })}
        </div>
      )}
      {creating && <NewPage onClose={() => setCreating(false)} onCreate={(page) => {
        dispatch({ type: 'insert', coll: 'webPages', item: page, log: { text: `Page started: ${page.title}`, projectId: page.projectId } })
        navigate(`/app/pages/${page.id}`)
      }} />}
      {confirmNode}
    </>
  )
}

function NewPage({ onClose, onCreate }: { onClose: () => void; onCreate: (p: WebPage) => void }) {
  const tr = useT()
  const { state } = useStore()
  const projects = state.projects.filter((p) => !p.archived)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [template, setTemplate] = useState(PAGE_TEMPLATES[0].id)
  return (
    <Modal title={tr('New page')} onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        const project = projects.find((p) => p.id === projectId)
        const t = PAGE_TEMPLATES.find((x) => x.id === template)!
        if (!project) return
        const client = state.clients.find((c) => c.id === project.clientId)
        const name = client?.name ?? project.name
        const at = now()
        onCreate({
          id: uid(), projectId, title: t.id === 'bio' ? name : `${name} – ${tr(t.name)}`,
          slug: freeSlug(t.id === 'bio' ? name : `${name} ${tr(t.name)}`, state.webPages.map((p) => p.slug)),
          theme: t.theme, blocks: t.blocks.map((b) => newBlock(b, tr)), published: false, createdAt: at, updatedAt: at,
        })
      }}>
        <label>{tr('Client')}
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="field">
          <label>{tr('Template')}</label>
          <div className="pg-templates">
            {PAGE_TEMPLATES.map((t) => (
              <button key={t.id} type="button" className={'pg-template' + (t.id === template ? ' on' : '')} onClick={() => setTemplate(t.id)}>
                <b>{tr(t.name)}</b>
                <small className="muted">{tr(t.about)}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button className="btn btn-primary" disabled={!projectId}>{tr('Create page')}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- The editor ---------- */

function PageEditor({ id }: { id: string }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const page = state.webPages.find((p) => p.id === id)
  const project = state.projects.find((p) => p.id === page?.projectId)
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone')
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!page || !project) return <p className="muted">{tr('This page doesn’t exist any more.')}</p>

  const update = (patch: Partial<WebPage>) => dispatch({ type: 'update', coll: 'webPages', id: page.id, fn: (p) => ({ ...p, ...patch, updatedAt: now() }) })
  const setBlock = (bid: string, patch: Partial<PageBlock>) => update({ blocks: page.blocks.map((b) => (b.id === bid ? ({ ...b, ...patch } as PageBlock) : b)) })
  const move = (i: number, by: number) => {
    const blocks = [...page.blocks]
    const [b] = blocks.splice(i, 1)
    blocks.splice(Math.max(0, Math.min(blocks.length, i + by)), 0, b)
    update({ blocks })
  }
  const url = siteUrl(page.slug)
  const taken = state.webPages.filter((p) => p.id !== page.id).map((p) => p.slug)

  return (
    <div className="pg-editor">
      <div className="mk-head">
        <Link to="/app/pages" className="btn btn-ghost btn-icon" aria-label={tr('Back')}><ArrowLeft size={16} /></Link>
        <input className="cm-name" value={page.title} onChange={(e) => update({ title: e.target.value })} aria-label={tr('Name')} />
        <span style={{ flex: 1 }} />
        {page.published && <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {tr('Open page')}</a>}
        <button className={'btn btn-sm' + (page.published ? '' : ' btn-primary')} onClick={() => update({ published: !page.published })}>
          <Globe size={14} /> {page.published ? tr('Take offline') : tr('Put online')}
        </button>
      </div>
      <div className="pg-edit-body">
        <div className="pg-side">
          <section className="card pg-settings">
            <label className="field">
              <span className="cm-label">{tr('Address')}</span>
              <div className="pg-slug">
                <span className="muted">/site/</span>
                <input className="input input-sm" value={page.slug} onChange={(e) => update({ slug: slugify(e.target.value) })} onBlur={() => update({ slug: freeSlug(page.slug, taken) })} />
                <button className="btn btn-ghost btn-icon btn-sm" title={tr('Copy link')} onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}><Copy size={14} /></button>
              </div>
              {copied && <small className="muted">{tr('Link copied')}</small>}
              {taken.includes(page.slug) && <small className="muted">{tr('Another page has that address – a number is added.')}</small>}
            </label>
            <div className="field">
              <span className="cm-label">{tr('Colours')}</span>
              <div className="seg" role="group">
                {(['light', 'dark', 'brand'] as const).map((t) => <button key={t} aria-pressed={page.theme === t} onClick={() => update({ theme: t })}>{tr(t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'Brand colour')}</button>)}
              </div>
            </div>
            <label className="field">
              <span className="cm-label">{tr('Description for Google and link previews')}</span>
              <input className="input input-sm" value={page.description ?? ''} maxLength={160} onChange={(e) => update({ description: e.target.value })} />
            </label>
          </section>

          {page.blocks.map((b, i) => (
            <section key={b.id} className="card pg-block-edit">
              <div className="pg-block-head">
                <b>{tr(BLOCKS.find((x) => x.type === b.type)!.name)}</b>
                <span style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tr('Move up')}><ArrowUp size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" disabled={i === page.blocks.length - 1} onClick={() => move(i, 1)} aria-label={tr('Move down')}><ArrowDown size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => update({ blocks: page.blocks.filter((x) => x.id !== b.id) })} aria-label={tr('Delete')}><Trash2 size={14} /></button>
              </div>
              <BlockFields block={b} set={(patch) => setBlock(b.id, patch)} />
            </section>
          ))}

          {adding ? (
            <section className="card pg-add">
              {BLOCKS.map((x) => <button key={x.type} className="btn btn-sm" onClick={() => { update({ blocks: [...page.blocks, newBlock(x.type, tr)] }); setAdding(false) }}>{tr(x.name)}</button>)}
              <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}><X size={14} /></button>
            </section>
          ) : (
            <button className="btn" onClick={() => setAdding(true)}><Plus size={15} /> {tr('Add a block')}</button>
          )}

          {!!page.signups?.length && (
            <section className="card pg-settings">
              <div className="pg-block-head">
                <b>{tr('Sign-ups')} ({page.signups.length})</b>
                <span style={{ flex: 1 }} />
                <button className="btn btn-sm" onClick={() => {
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob([signupsCsv(page)], { type: 'text/csv' }))
                  a.download = `${page.slug}-signups.csv`
                  a.click()
                }}><Download size={14} /> CSV</button>
              </div>
              <ul className="pg-signups">
                {page.signups.slice(-8).reverse().map((s) => <li key={s.email + s.at}><span>{s.email}</span><small className="muted">{formatDate(s.at)}</small></li>)}
              </ul>
            </section>
          )}
        </div>

        <div className="pg-preview-wrap">
          <div className="seg" role="group" style={{ justifySelf: 'center' }}>
            <button aria-pressed={device === 'phone'} onClick={() => setDevice('phone')} aria-label={tr('Phone')}><Smartphone size={14} /></button>
            <button aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} aria-label={tr('Computer')}><Monitor size={14} /></button>
          </div>
          <div className={'pg-preview ' + device}>
            <PageView page={page} project={project} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- The fields for each kind of block ---------- */

function Picture({ src, onChange, label }: { src?: string; onChange: (src: string | undefined) => void; label: string }) {
  const tr = useT()
  const url = useSrc(src || undefined)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="pg-picture">
      {url ? <img src={url} alt="" /> : null}
      <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}><ImagePlus size={14} /> {url ? tr('Another picture') : label}</button>
      {url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(undefined)}>{tr('Remove')}</button>}
      <input ref={input} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await putBlob(f)); e.target.value = '' }} />
    </div>
  )
}

function GalleryThumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  const url = useSrc(src)
  return <span className="pg-thumb">{url && <img src={url} alt="" />}<button type="button" onClick={onRemove} aria-label="Remove"><X size={12} /></button></span>
}

function BlockFields({ block: b, set }: { block: PageBlock; set: (patch: Partial<PageBlock>) => void }) {
  const tr = useT()
  const gallery = useRef<HTMLInputElement>(null)
  switch (b.type) {
    case 'hero':
      return (
        <div className="form">
          <input className="input" value={b.heading} onChange={(e) => set({ heading: e.target.value })} aria-label={tr('Headline')} />
          <textarea className="input" rows={2} value={b.text} onChange={(e) => set({ text: e.target.value })} aria-label={tr('Text')} />
          <Picture src={b.image} onChange={(image) => set({ image })} label={tr('Add a picture')} />
          <div className="form-row">
            <input className="input input-sm" placeholder={tr('Button text')} value={b.button?.label ?? ''} onChange={(e) => set({ button: { label: e.target.value, url: b.button?.url ?? '' } })} />
            <input className="input input-sm" placeholder={tr('Button link')} value={b.button?.url ?? ''} onChange={(e) => set({ button: { label: b.button?.label ?? '', url: e.target.value } })} />
          </div>
        </div>
      )
    case 'links':
      return (
        <div className="form">
          {b.items.map((l, i) => (
            <div key={l.id} className="pg-row">
              <input className="input input-sm" placeholder={tr('Text')} value={l.label} onChange={(e) => set({ items: b.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <input className="input input-sm" placeholder="https://" value={l.url} onChange={(e) => set({ items: b.items.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => set({ items: b.items.filter((x) => x.id !== l.id) })} aria-label={tr('Delete')}><X size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ items: [...b.items, { id: blockId(), label: '', url: 'https://' }] })}><Plus size={14} /> {tr('Add a link')}</button>
        </div>
      )
    case 'text':
      return (
        <div className="form">
          <input className="input" value={b.heading ?? ''} placeholder={tr('Heading')} onChange={(e) => set({ heading: e.target.value })} />
          <textarea className="input" rows={4} value={b.body} onChange={(e) => set({ body: e.target.value })} aria-label={tr('Text')} />
        </div>
      )
    case 'image':
      return (
        <div className="form">
          <Picture src={b.src} onChange={(src) => set({ src: src ?? '' })} label={tr('Add a picture')} />
          <input className="input input-sm" placeholder={tr('Caption')} value={b.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} />
        </div>
      )
    case 'gallery':
      return (
        <div className="form">
          <div className="pg-thumbs">
            {b.images.map((src) => <GalleryThumb key={src} src={src} onRemove={() => set({ images: b.images.filter((x) => x !== src) })} />)}
          </div>
          <button type="button" className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => gallery.current?.click()}><ImagePlus size={14} /> {tr('Add pictures')}</button>
          <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={async (e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            const srcs = await Promise.all(files.map((f) => putBlob(f)))
            set({ images: [...b.images, ...srcs] })
          }} />
        </div>
      )
    case 'countdown': {
      const local = (() => {
        const d = new Date(b.date)
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      })()
      return (
        <div className="form">
          <input className="input" value={b.label} onChange={(e) => set({ label: e.target.value })} aria-label={tr('Text')} />
          <input className="input" type="datetime-local" value={local} onChange={(e) => e.target.value && set({ date: new Date(e.target.value).toISOString() })} aria-label={tr('Date')} />
        </div>
      )
    }
    case 'signup':
      return (
        <div className="form">
          <input className="input" value={b.heading} onChange={(e) => set({ heading: e.target.value })} aria-label={tr('Heading')} />
          <input className="input input-sm" value={b.button} onChange={(e) => set({ button: e.target.value })} aria-label={tr('Button text')} />
          <small className="muted">{tr('The emails show up here, under Sign-ups.')}</small>
        </div>
      )
    case 'contact':
      return (
        <div className="form">
          <input className="input input-sm" placeholder={tr('Email')} value={b.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
          <input className="input input-sm" placeholder={tr('Phone')} value={b.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
          <input className="input input-sm" placeholder={tr('Address')} value={b.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
        </div>
      )
    case 'social':
      return (
        <div className="form">
          {b.links.map((l, i) => (
            <div key={i} className="pg-row">
              <select className="input input-sm" value={l.network} onChange={(e) => set({ links: b.links.map((x, j) => (j === i ? { ...x, network: e.target.value } : x)) })}>
                {NETWORKS.map((n) => <option key={n}>{n}</option>)}
              </select>
              <input className="input input-sm" placeholder="https://" value={l.url} onChange={(e) => set({ links: b.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => set({ links: b.links.filter((_, j) => j !== i) })} aria-label={tr('Delete')}><X size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ links: [...b.links, { network: NETWORKS.find((n) => !b.links.some((l) => l.network === n)) ?? 'Instagram', url: '' }] })}><Plus size={14} /> {tr('Add a profile')}</button>
        </div>
      )
  }
}
