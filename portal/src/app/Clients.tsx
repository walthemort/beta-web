import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Pencil, Plus, Trash2 } from 'lucide-react'
import { Modal } from '../components/ui'
import { useUndo } from '../components/Undo'
import { initials, uid, useStore, isComplete } from '../data/store'
import { CopyLink } from '../components/kit'
import { clientUrl } from '../features/proposals'
import type { Client, Lang, VatTreatment } from '../data/types'
import { VAT_TREATMENTS } from '../data/vat'
import { useT } from '../data/i18n'

export default function Clients() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const undoable = useUndo()
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const clients = [...state.clients].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('Good work starts together')}</span>
          <h1>{tr('Clients')}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> {tr('Add client')}</button>
      </div>

      {clients.length === 0 ? (
        <div className="empty"><p>{tr('No clients yet. Add one here, or create a project and add the client there.')}</p></div>
      ) : (
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table stack">
          <thead>
            <tr><th>{tr('Client')}</th><th>{tr('Contact')}</th><th>{tr('Projects')}</th><th>{tr('Portal language')}</th><th /></tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const projects = state.projects.filter((p) => p.clientId === c.id)
              const active = projects.filter((p) => !isComplete(state, p)).length
              return (
                <tr key={c.id}>
                  <td className="wide">
                    <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span className="studio-mark" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>{initials(c.name)}</span>
                      <span className="cell-title">
                        <b style={{ fontWeight: 500 }}>{c.name}</b>
                        {c.sample ? <small>{tr('Sample client')}</small> : c.vat && c.vat !== 'dk' ? <small>{tr(VAT_TREATMENTS.find((v) => v.id === c.vat)?.label ?? '')}</small> : c.cvr ? <small>{tr('CVR')} {c.cvr}</small> : null}
                      </span>
                    </span>
                  </td>
                  <td data-label={tr('Contact')}>
                    <span className="cell-title">
                      <span>{c.contactName || '—'}</span>
                      {c.contactEmail && (
                        <a href={`mailto:${c.contactEmail}`} className="muted" style={{ fontSize: 12, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <Mail size={12} /> {c.contactEmail}
                        </a>
                      )}
                    </span>
                  </td>
                  <td data-label={tr('Projects')}>
                    {projects.length ? (
                      <Link to={`/app/projects?client=${c.id}`} className="link-arrow">{active} {tr('active ·')} {projects.length} {tr('total')}</Link>
                    ) : (
                      <span className="muted">{tr('None yet')}</span>
                    )}
                  </td>
                  <td data-label={tr('Language')}>
                    <select
                      className="input input-sm"
                      value={c.language}
                      aria-label={tr('Portal language for {name}', { name: c.name })}
                      onChange={(e) => dispatch({ type: 'update', coll: 'clients', id: c.id, fn: (x) => ({ ...x, language: e.target.value as Lang }) })}
                    >
                      <option value="en">{tr('English')}</option>
                      <option value="da">{tr('Dansk')}</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <CopyLink url={clientUrl(`/c/${c.id}`)} label={tr('Dashboard link')} className="btn btn-sm btn-ghost" />
                    <button className="btn btn-ghost btn-icon" aria-label={tr('Edit {name}', { name: c.name })} onClick={() => setEditing(c)}>
                      <Pencil size={15} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      aria-label={tr('Delete {name}', { name: c.name })}
                      disabled={projects.length > 0}
                      title={projects.length ? tr('Delete this client’s projects first') : undefined}
                      onClick={() => undoable(tr('{name} deleted', { name: c.name }), () => dispatch({ type: 'deleteClient', id: c.id }))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {editing && <ClientModal client={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

/** Add or edit a client, including what the invoices need. */
function ClientModal({ client, onClose }: { client?: Client; onClose: () => void }) {
  const tr = useT()
  const { dispatch } = useStore()
  const [vat, setVat] = useState<VatTreatment>(client?.vat ?? 'dk')

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const fields = {
      name: d.name.trim(), contactName: d.contactName.trim(), contactEmail: d.contactEmail.trim(),
      address: d.address.trim() || undefined, cvr: d.cvr.trim() || undefined, vat,
    }
    if (client) dispatch({ type: 'update', coll: 'clients', id: client.id, fn: (c) => ({ ...c, ...fields }) })
    else dispatch({ type: 'addClient', client: { id: uid(), contacts: [], language: 'en', ...fields } })
    onClose()
  }

  return (
    <Modal title={client ? tr('Edit {name}', { name: client.name }) : tr('Add client')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="ac-name">{tr('Company name')}</label>
          <input id="ac-name" name="name" className="input" defaultValue={client?.name} required />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ac-contact">{tr('Contact person')}</label>
            <input id="ac-contact" name="contactName" className="input" defaultValue={client?.contactName} />
          </div>
          <div className="field">
            <label htmlFor="ac-email">{tr('Contact email')}</label>
            <input id="ac-email" name="contactEmail" type="email" className="input" defaultValue={client?.contactEmail} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ac-address">{tr('Address')} <span className="muted">{tr('(shown on invoices)')}</span></label>
          <textarea id="ac-address" name="address" className="input" rows={2} defaultValue={client?.address} placeholder={tr('Street 1\n1000 København K')} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ac-cvr">{vat === 'dk' ? tr('CVR number') : tr('VAT number')}</label>
            <input id="ac-cvr" name="cvr" className="input" defaultValue={client?.cvr} placeholder={vat === 'eu' ? tr('e.g. SE556677889901') : undefined} />
          </div>
          <div className="field">
            <label htmlFor="ac-vat">{tr('VAT')}</label>
            <select id="ac-vat" className="input" value={vat} onChange={(e) => setVat(e.target.value as VatTreatment)}>
              {VAT_TREATMENTS.map((v) => <option key={v.id} value={v.id}>{tr(v.label)}</option>)}
            </select>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: -4 }}>
          {tr(VAT_TREATMENTS.find((v) => v.id === vat)?.hint ?? '')}.
          {vat === 'eu' && tr(' Their VAT number must be on the invoice – check it in the EU’s VIES register.')}
          {client && tr(' Existing invoices keep the VAT they were created with.')}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" className="btn btn-primary">{client ? tr('Save') : tr('Add client')}</button>
        </div>
      </form>
    </Modal>
  )
}
