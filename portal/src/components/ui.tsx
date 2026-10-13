import { Wordmark } from './brand'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Project } from '../data/types'
import { useT } from '../data/i18n'

/** Aftryk's wordmark, sized like text of `size` px (see components/brand.tsx). */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <Wordmark height={Math.round(size * 0.76)} />
    </span>
  )
}

export function Modal({ title, onClose, children, subtitle, wide }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const tr = useT()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.modal-close)')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' modal-wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <button className="btn btn-ghost btn-icon modal-close" onClick={onClose} aria-label={tr('Close')}>
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {subtitle && <p className="muted" style={{ marginBottom: 20 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

/** Confirmation dialog. Destructive actions (the default "Delete") get a red button. */
export function useConfirm() {
  const tr = useT()
  const [pending, setPending] = useState<{ message: string; onYes: () => void; label: string } | null>(null)
  const danger = pending?.label === 'Delete'
  const node = pending ? (
    <Modal title={tr('Are you sure?')} onClose={() => setPending(null)} subtitle={pending.message}>
      <div className="modal-actions">
        <button className="btn" onClick={() => setPending(null)}>{tr('Cancel')}</button>
        <button
          className="btn btn-primary"
          style={danger ? { background: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}
          onClick={() => {
            pending.onYes()
            setPending(null)
          }}
        >
          {pending.label}
        </button>
      </div>
    </Modal>
  ) : null
  return { confirm: (message: string, onYes: () => void, label = 'Delete') => setPending({ message, onYes, label }), confirmNode: node }
}

export function ProjectCover({ project, height = 200, number }: { project: Project; height?: number; number?: number }) {
  const tr = useT()
  const { bg, fg, wordmark, serif } = project.cover
  return (
    <div className="cover" style={{ background: bg, color: fg, height }}>
      <div className="cover-top">
        <span>{project.sample ? tr('Sample project') : tr('Work in progress')}</span>
        {number !== undefined && <span>{String(number).padStart(2, '0')}</span>}
      </div>
      <div className={'cover-mark' + (serif ? ' serif' : '')}>{wordmark}</div>
      <div className="cover-top">
        <span>{project.tagline || ' '}</span>
      </div>
    </div>
  )
}
