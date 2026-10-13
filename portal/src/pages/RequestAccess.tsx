import { useState, type FormEvent } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { Modal } from '../components/ui'

const STUDIO_TYPES = ['Full-service studio', 'Brand & identity', 'Motion', 'Web & digital', 'Freelancer']

export function RequestAccess({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null)

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    // No backend yet: keep requests locally until Supabase is connected.
    try {
      const list = JSON.parse(localStorage.getItem('forme:requests') || '[]')
      localStorage.setItem('forme:requests', JSON.stringify([...list, { ...data, at: new Date().toISOString() }]))
    } catch {
      /* ignore */
    }
    setSent({ name: data.name.split(' ')[0], email: data.email })
  }

  if (sent)
    return (
      <Modal title={`Thanks, ${sent.name}.`} onClose={onClose}>
        <div className="form">
          <span className="pill pill-green" style={{ justifySelf: 'start' }}><Check size={13} /> Request received</span>
          <p className="muted">
            We review requests within 2 working days and will email you at <b style={{ color: 'var(--ink)' }}>{sent.email}</b>{' '}
            when your studio space is ready.
          </p>
          <button className="btn btn-lg" onClick={onClose}>Back to the site</button>
        </div>
      </Modal>
    )

  return (
    <Modal title="Make room for your studio." subtitle="Tell us a little about your studio. Access is by approval." onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="ra-name">Your name</label>
          <input id="ra-name" name="name" className="input" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="ra-studio">Studio name</label>
          <input id="ra-studio" name="studio" className="input" required autoComplete="organization" />
        </div>
        <div className="field">
          <label htmlFor="ra-email">Email for access</label>
          <input id="ra-email" name="email" type="email" className="input" required autoComplete="email" />
          <small>Use the email you’ll sign in with.</small>
        </div>
        <div className="field">
          <label htmlFor="ra-type">Studio type</label>
          <select id="ra-type" name="type" className="input">
            {STUDIO_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-lg" type="submit">
          Request access <ArrowUpRight size={18} />
        </button>
        <small className="muted" style={{ textAlign: 'center', fontSize: 12 }}>
          No payment. No newsletter. Just your access request.
        </small>
      </form>
    </Modal>
  )
}
