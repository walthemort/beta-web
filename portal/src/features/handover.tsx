/**
 * The handover: when the work is done, the client gets one page with every final file (one ZIP),
 * the brand guidelines and the usage rights – in their own language.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Download, FileText, Gift, Palette, Send } from 'lucide-react'
import { now, formatDateLong, useStore } from '../data/store'
import { download, formatSize, resolveSrc } from '../data/blobs'
import { translateTo, useT } from '../data/i18n'
import type { Project, State, StudioFile } from '../data/types'
import { clientUrl } from './proposals'
import { CopyLink } from '../components/kit'

/** The usage rights, in the client's language. */
const RIGHTS =
  '{studio} transfers the full rights to use the final, approved work in this handover to {client}, once all invoices for the project are paid. ' +
  '{client} may use, change and reproduce the work without limits in time, place or media.\n\n' +
  'Sketches, rejected directions and working files remain {studio}’s. {studio} may show the finished work in its portfolio.\n\n' +
  'Fonts and stock images are licensed separately and follow their own licence terms.'

export const defaultRights = (s: State, p: Project) => {
  const client = s.clients.find((c) => c.id === p.clientId)
  return translateTo(client?.language, RIGHTS, { studio: s.studio.name, client: client?.name ?? translateTo(client?.language, 'the client') })
}

/** The files in the handover: the ones picked, or else everything approved or published by the studio. */
export function handoverFiles(s: State, p: Project): StudioFile[] {
  const files = s.files.filter((f) => f.projectId === p.id && f.uploadedBy !== 'client')
  if (p.handover?.fileIds) return files.filter((f) => p.handover!.fileIds!.includes(f.id))
  return files.filter((f) => f.status === 'Approved' || f.published)
}

/** One ZIP with the latest version of every file, in a folder per category. */
async function downloadZip(files: StudioFile[], name: string) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const f of files) {
    const v = f.versions.at(-1)
    if (!v) continue
    const url = await resolveSrc(v.src)
    if (!url) continue
    const blob = await fetch(url).then((r) => r.blob())
    zip.folder(f.category)!.file(f.name, blob)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(out)
  a.download = `${name.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'final-files'}.zip`
  a.click()
}

/* ---------- Studio: put the handover together ---------- */

export function HandoverEditor({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const h = project.handover
  const all = state.files.filter((f) => f.projectId === project.id && f.uploadedBy !== 'client')
  const [message, setMessage] = useState(h?.message ?? '')
  const [rights, setRights] = useState(h?.rights ?? defaultRights(state, project))
  const [picked, setPicked] = useState<string[]>(h?.fileIds ?? handoverFiles(state, project).map((f) => f.id))
  const [saved, setSaved] = useState(false)
  const url = clientUrl(`/p/${project.id}/handover`)

  function save(share?: boolean) {
    dispatch({
      type: 'updateProject',
      id: project.id,
      patch: { handover: { message: message.trim() || undefined, rights, fileIds: picked, sharedAt: share === undefined ? h?.sharedAt : share ? h?.sharedAt ?? now() : undefined } },
      log: share && !h?.sharedAt ? { text: 'Final files handed over', projectId: project.id, notify: true, link: `/p/${project.id}/handover` } : undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="split">
      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <section className="card panel">
          <h3><Gift size={16} style={{ verticalAlign: -2 }} /> {tr('Handover')}</h3>
          <p className="muted" style={{ fontSize: 13 }}>{tr('When the work is done, your client gets one page with the final files (as one ZIP), the brand guidelines and the usage rights.')}</p>
          <div className="field">
            <label htmlFor="ho-msg">{tr('A few words to the client')} <span className="muted">{tr('(optional)')}</span></label>
            <textarea id="ho-msg" className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={tr('Thank you for a great collaboration! Here is everything you need…')} />
          </div>
        </section>
        <section className="card panel">
          <h3>{tr('Final files')}</h3>
          {all.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>{tr('No files yet. Upload the final files in the Files tab.')}</p>
          ) : (
            <div className="list">
              {all.map((f) => (
                <label key={f.id} className="list-item toggle-row" style={{ margin: 0 }}>
                  <input type="checkbox" checked={picked.includes(f.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, f.id] : picked.filter((x) => x !== f.id))} />
                  <span className="grow"><span>{f.name}</span><small>{tr(f.category)} · {tr(f.status)}</small></span>
                </label>
              ))}
            </div>
          )}
        </section>
        <section className="card panel">
          <h3>{tr('Usage rights')}</h3>
          <textarea className="input" rows={9} value={rights} onChange={(e) => setRights(e.target.value)} aria-label={tr('Usage rights')} />
          <small className="muted">{tr('A starting point, not legal advice. It’s written in the client’s language.')}</small>
        </section>
      </div>
      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <section className="card panel">
          <h3>{h?.sharedAt ? tr('Handed over') : tr('Ready to hand over?')}</h3>
          {h?.sharedAt ? (
            <p className="muted" style={{ fontSize: 13 }}>{tr('Shared with the client on {date}. Changes you save show up for them straight away.', { date: formatDateLong(h.sharedAt) })}</p>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>{tr('The client gets an email and sees “Final files” in their portal.')}</p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!h?.sharedAt && <button className="btn btn-primary" disabled={!picked.length} onClick={() => save(true)}><Send size={15} /> {tr('Hand over to the client')}</button>}
            <button className="btn" onClick={() => save()}>{saved ? <><Check size={15} /> {tr('Saved')}</> : tr('Save')}</button>
            {h?.sharedAt && <Link className="btn btn-ghost" to={`/p/${project.id}/handover`} target="_blank">{tr('Preview as client')} <ArrowUpRight size={14} /></Link>}
          </div>
          {h?.sharedAt && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <CopyLink url={url} label={tr('Copy client link')} className="btn btn-sm" />
              <button className="btn btn-ghost btn-sm" onClick={() => save(false)}>{tr('Hide from the client')}</button>
            </div>
          )}
        </section>
        <section className="card panel">
          <h3>{tr('Also included')}</h3>
          <div className="list">
            <Link className="list-item" to={`/print/hub/${project.id}`} target="_blank"><FileText size={15} /><span className="grow">{tr('Brand guidelines (PDF)')}</span><ArrowUpRight size={14} /></Link>
            <Link className="list-item" to={`/app/projects/${project.id}/hub`}><Palette size={15} /><span className="grow">{tr('Brand hub with colours, fonts and logos')}</span><ArrowUpRight size={14} /></Link>
          </div>
        </section>
      </div>
    </div>
  )
}

/* ---------- Client: the handover page ---------- */

export function HandoverPage({ project }: { project: Project }) {
  const t = useT()
  const { state } = useStore()
  const [zipping, setZipping] = useState(false)
  const h = project.handover
  if (!h?.sharedAt) return <div className="empty"><p>{t('The final files aren’t ready yet.')}</p></div>
  const files = handoverFiles(state, project)
  const client = state.clients.find((c) => c.id === project.clientId)
  const size = files.reduce((n, f) => n + (f.versions.at(-1)?.size ?? 0), 0)

  async function zipAll() {
    setZipping(true)
    try {
      await downloadZip(files, `${client?.name ?? project.name} – ${t('final files')}`)
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="handover">
      <div>
        <span className="eyebrow">{project.name}</span>
        <h1 className="cp-h1">{t('Your final files')}</h1>
        {h.message && <p className="ob-lead" style={{ whiteSpace: 'pre-line' }}>{h.message}</p>}
      </div>
      <section className="card panel handover-files">
        <div className="section-head" style={{ margin: 0 }}>
          <h3 style={{ margin: 0 }}>{t('Files')} <span className="muted">· {files.length} · {formatSize(size)}</span></h3>
          <button className="btn btn-primary" disabled={!files.length || zipping} onClick={zipAll}>
            <Download size={15} /> {zipping ? t('Packing…') : t('Download everything (.zip)')}
          </button>
        </div>
        <div className="list">
          {files.map((f) => {
            const v = f.versions.at(-1)!
            return (
              <div key={f.id} className="list-item">
                <span className="grow"><span>{f.name}</span><small>{t(f.category)} · {formatSize(v.size)}</small></span>
                <button className="btn btn-ghost btn-icon" aria-label={`${t('Download')} ${f.name}`} onClick={() => download(v.src, f.name)}><Download size={15} /></button>
              </div>
            )
          })}
        </div>
      </section>
      <div className="split">
        <section className="card panel">
          <h3>{t('Brand guidelines')}</h3>
          <p className="muted" style={{ fontSize: 14 }}>{t('Colours, fonts, logo rules and tone of voice – to share with printers, agencies and colleagues.')}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" to={`/print/hub/${project.id}`} target="_blank"><FileText size={15} /> {t('Guidelines (PDF)')}</Link>
            <Link className="btn btn-ghost" to={`/p/${project.id}/hub`}>{t('Brand hub')} <ArrowUpRight size={14} /></Link>
          </div>
        </section>
        <section className="card panel">
          <h3>{t('Usage rights')}</h3>
          <p style={{ whiteSpace: 'pre-line', fontSize: 14, lineHeight: 1.55 }}>{h.rights}</p>
        </section>
      </div>
    </div>
  )
}
