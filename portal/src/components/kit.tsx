import { useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Check, Copy, UploadCloud } from 'lucide-react'
import { useT } from '../data/i18n'

/** Link-based tabs, so each tab has its own URL. */
export function Tabs({ tabs }: { tabs: { to: string; label: string; badge?: ReactNode; end?: boolean }[] }) {
  const tr = useT()
  return (
    <nav className="tabs" aria-label={tr('Sections')}>
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="tab" replace>
          {tr(t.label)}
          {t.badge !== undefined && t.badge !== 0 && <span className="tab-badge">{t.badge}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

const STATUS_CLASS: Record<string, string> = {
  Draft: '',
  'Not shared': '',
  Sent: 'pill-amber',
  Issued: 'pill-amber',
  'In review': 'pill-amber',
  'Changes requested': 'pill-red',
  Declined: 'pill-red',
  Accepted: 'pill-green',
  Approved: 'pill-green',
  Signed: 'pill-green',
  Paid: 'pill-green',
  Submitted: 'pill-green',
  Overdue: 'pill-red',
  'Not started': '',
  'To pay': 'pill-amber',
}

export function StatusPill({ status }: { status: string }) {
  const tr = useT()
  return <span className={'pill ' + (STATUS_CLASS[status] ?? '')}>{tr(status)}</span>
}

export function CopyLink({ url, label = 'Copy client link', className = 'btn' }: { url: string; label?: string; className?: string }) {
  const tr = useT()
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        navigator.clipboard?.writeText(url)
        setDone(true)
        setTimeout(() => setDone(false), 1800)
      }}
    >
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? tr('Copied – no email was sent') : tr(label)}
    </button>
  )
}

export function Dropzone({ onFiles, accept, children }: { onFiles: (files: File[]) => void; accept?: string; children?: ReactNode }) {
  const tr = useT()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      className={'dropzone' + (over ? ' over' : '')}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files])
      }}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
    >
      <UploadCloud size={22} strokeWidth={1.5} />
      {children ?? (
        <span>
          <b>{tr('Drop files here')}</b> {tr('or click to upload')}
        </span>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles([...e.target.files])
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Textarea that grows with its content. */
export function AutoText(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={'input autotext ' + (props.className ?? '')}
      rows={1}
      ref={(el) => {
        if (el) {
          el.style.height = 'auto'
          el.style.height = el.scrollHeight + 2 + 'px'
        }
      }}
      onInput={(e) => {
        const el = e.currentTarget
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 2 + 'px'
        props.onInput?.(e)
      }}
    />
  )
}
