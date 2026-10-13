import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Mail } from 'lucide-react'
import { timeAgo, useStore } from '../data/store'
import { useT } from '../data/i18n'

/** Studio notifications: everything clients do (comments, approvals, signatures, choices…). */
export function NotificationBell() {
  const tr = useT()
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const list = state.notifications.filter((n) => n.audience === 'studio')
  const unread = list.filter((n) => !n.read).length
  const queued = state.outbox.filter((e) => e.status === 'Queued').length

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="bell" ref={ref}>
      <button className="btn btn-ghost btn-icon" aria-label={unread ? tr('Notifications, {n} unread', { n: unread }) : tr('Notifications')} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={17} />
        {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-pop card" role="dialog" aria-label={tr('Notifications')}>
          <div className="section-head" style={{ margin: 0, padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
            <b style={{ fontWeight: 500 }}>{tr('Notifications')}</b>
            {unread > 0 && <button className="link-btn" onClick={() => dispatch({ type: 'markNotificationsRead', audience: 'studio' })}>{tr('Mark all as read')}</button>}
          </div>
          <div className="bell-list">
            {list.length === 0 && <p className="muted" style={{ padding: 16, fontSize: 14 }}>{tr('Nothing yet. You’ll see client comments, approvals and signatures here.')}</p>}
            {list.slice(0, 30).map((n) => {
              const p = state.projects.find((x) => x.id === n.projectId)
              return (
                <Link
                  key={n.id}
                  to={n.link ?? '/app'}
                  className={'bell-item' + (n.read ? '' : ' unread')}
                  onClick={() => {
                    setOpen(false)
                    dispatch({ type: 'readNotification', id: n.id })
                  }}
                >
                  <span>{n.text}</span>
                  <small>{p?.name} · {timeAgo(n.at)}</small>
                </Link>
              )
            })}
          </div>
          <Link to="/app/settings/emails" className="bell-foot" onClick={() => setOpen(false)}>
            <Mail size={14} /> {tr('Email outbox')} {queued > 0 && <span className="count">{queued} {tr('to send')}</span>}
          </Link>
        </div>
      )}
    </div>
  )
}
