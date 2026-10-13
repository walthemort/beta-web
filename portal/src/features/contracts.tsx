import { Link } from 'react-router-dom'
import { ArrowUpRight, FileSignature, Printer, Send, Trash2 } from 'lucide-react'
import { AutoText, CopyLink, StatusPill } from '../components/kit'
import { useUndo } from '../components/Undo'
import { DEFAULT_CONTRACT } from '../data/seed'
import { formatDateLong, now, uid, useStore } from '../data/store'
import type { Contract, Project } from '../data/types'
import { clientUrl } from './proposals'
import { useT, activeLang, dateLocale } from '../data/i18n'

export function ProjectContract({ project }: { project: Project }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const client = state.clients.find((c) => c.id === project.clientId)
  const contract = state.contracts.find((c) => c.projectId === project.id)

  if (!contract)
    return (
      <div className="empty">
        <p>{tr('No contract yet. It’s easiest to create one from an accepted proposal, but you can start from the template.')}</p>
        <button
          className="btn btn-primary"
          onClick={() =>
            dispatch({
              type: 'insert',
              coll: 'contracts',
              item: { id: uid(), projectId: project.id, title: `${tr('Project agreement')} – ${client?.name ?? project.name}`, body: tr(DEFAULT_CONTRACT), status: 'Draft', createdAt: now() },
              log: { text: 'Contract drafted', projectId: project.id },
            })
          }
        >
          <FileSignature size={16} /> {tr('Start from template')}
        </button>
      </div>
    )

  const locked = contract.status === 'Signed'
  const set = (fn: (c: Contract) => Contract, log?: string) =>
    dispatch({ type: 'update', coll: 'contracts', id: contract.id, fn, log: log ? { text: log, projectId: project.id } : undefined })
  const link = `/p/${project.id}/contract`

  return (
    <div className="split split-aside">
      <div className="doc-editor">
        {locked && (
          <p className="pill pill-green" style={{ justifySelf: 'start', height: 'auto', padding: '6px 12px' }}>
            {tr('Signed by')} {contract.signedBy} {tr('on')} {formatDateLong(contract.signedAt)} {tr('— locked for editing.')}
          </p>
        )}
        <input className="input title" disabled={locked} value={contract.title} onChange={(e) => set((c) => ({ ...c, title: e.target.value }))} aria-label={tr('Contract title')} />
        <AutoText disabled={locked} value={contract.body} onChange={(e) => set((c) => ({ ...c, body: e.target.value }))} aria-label={tr('Contract terms')} style={{ fontSize: 14 }} />
        <p className="muted" style={{ fontSize: 12 }}>{tr('This is a simple template, not legal advice. Have a lawyer check your terms before you use them with clients.')}</p>
      </div>
      <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 72, alignContent: 'start' }}>
        <section className="card panel">
          <div className="section-head" style={{ margin: 0 }}>
            <h3>{tr('Status')}</h3>
            <StatusPill status={contract.status} />
          </div>
          {contract.status === 'Draft' && (
            <button className="btn btn-primary" onClick={() => set((c) => ({ ...c, status: 'Sent' }), 'Contract sent for signature')}>
              <Send size={15} /> {tr('Mark as sent')}
            </button>
          )}
          {contract.status !== 'Draft' && <CopyLink url={clientUrl(link)} label={tr('Copy signing link')} />}
          <Link className="btn" to={link} target="_blank">{tr('Preview as client')} <ArrowUpRight size={15} /></Link>
          <Link className="btn" to={`/print/contract/${contract.id}`} target="_blank"><Printer size={15} /> {tr('Print / PDF')}</Link>
        </section>
        {!locked && (
          <button
            className="btn btn-ghost btn-danger"
            style={{ justifySelf: 'start' }}
            onClick={() => undoable(tr('Contract deleted'), () => dispatch({ type: 'remove', coll: 'contracts', id: contract.id }))}
          >
            <Trash2 size={15} /> {tr('Delete contract')}
          </button>
        )}
      </aside>
    </div>
  )
}

/** “Chrome on macOS” instead of the full user-agent string. */
function shortAgent(ua: string) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} on ${os}` : browser
}

export function ContractDocument({ contract }: { contract: Contract }) {
  const tr = useT()
  const { state } = useStore()
  const project = state.projects.find((p) => p.id === contract.projectId)
  const client = state.clients.find((c) => c.id === project?.clientId)
  return (
    <article className="doc">
      <header className="doc-head">
        <span className="eyebrow">{state.studio.name} × {client?.name}</span>
        <h1>{tr(contract.title)}</h1>
        <p className="muted">
          {tr('Between {studio} (CVR {cvr}) and {client}. Project: {project}.', { studio: state.studio.name, cvr: state.studio.cvr, client: client?.name, project: project?.name })}
        </p>
      </header>
      <div className="doc-body">{tr(contract.body)}</div>
      <div className="signatures">
        <div>
          <span className="sig">{state.studio.owner}</span>
          <small>{state.studio.name} · {formatDateLong(contract.createdAt)}</small>
        </div>
        <div>
          {contract.signature ? <img className="sig-img" src={contract.signature} alt={tr('Signature of {signedBy}', { signedBy: contract.signedBy })} /> : <span className="sig">{contract.signedBy ?? ' '}</span>}
          <small>{contract.signedBy ? `${contract.signedBy}, ` : ''}{client?.name}{contract.signedAt ? ` · ${formatDateLong(contract.signedAt)}` : tr(' · Awaiting signature')}</small>
        </div>
      </div>
      {contract.signedAt && (
        <p className="sig-meta">
          {tr('Signed electronically')} {new Date(contract.signedAt).toLocaleString(dateLocale(activeLang()), { dateStyle: 'long', timeStyle: 'medium' })}
          {contract.signedMeta && <> · {contract.signedMeta.timezone}{contract.signedMeta.ip ? tr(' · IP {ip}', { ip: contract.signedMeta.ip }) : ''} · {shortAgent(contract.signedMeta.userAgent)}</>}
        </p>
      )}
    </article>
  )
}
