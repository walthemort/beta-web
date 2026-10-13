import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Modal } from '../components/ui'
import { clientUpdateEmail } from '../data/emails'
import { useStore } from '../data/store'
import type { Project } from '../data/types'
import { useT } from '../data/i18n'

/** Writes this week's client update from the project's data; the studio edits it and sends. */
export function ClientUpdateModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT()
  const { state, dispatch } = useStore()
  const [draft] = useState(() => clientUpdateEmail(state, project))
  const [to, setTo] = useState(draft?.to ?? '')
  const [subject, setSubject] = useState(draft?.subject ?? '')
  const [body, setBody] = useState(draft?.body ?? '')
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  function log() {
    dispatch({ type: 'log', log: { text: 'Weekly update sent to the client', projectId: project.id } })
  }

  return (
    <Modal title={t('Client update')} subtitle={t('Written from this week’s approvals, reviews and next tasks. Change anything before you send it.')} onClose={onClose}>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label>{t('To')}<input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label>{t('Subject')}<input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
        <label>{t('Message')}<textarea className="input" rows={14} value={body} onChange={(e) => setBody(e.target.value)} style={{ fontFamily: 'inherit', lineHeight: 1.5 }} /></label>
      </form>
      <div className="modal-actions">
        <button
          className="btn"
          disabled={!to}
          onClick={() => {
            dispatch({ type: 'queueEmail', email: { to, subject, body, kind: 'digest', projectId: project.id } })
            log()
            onClose()
          }}
        >
          {t('Add to outbox')}
        </button>
        <a
          className="btn btn-primary"
          href={mailto}
          onClick={() => {
            log()
            onClose()
          }}
        >
          <Mail size={15} /> {t('Open in Mail')}
        </a>
      </div>
    </Modal>
  )
}
