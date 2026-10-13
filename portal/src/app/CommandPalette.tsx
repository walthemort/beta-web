import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, FolderKanban, Keyboard, Presentation, Receipt, Settings, Users, Plus } from 'lucide-react'
import { useStore } from '../data/store'
import { useT } from '../data/i18n'

type Item = { label: string; hint: string; to: string; icon: typeof FileText }

/** ⌘K / Ctrl+K: jump to any project, client, file or invoice. */
export function CommandPalette({ open, onClose, onShortcuts }: { open: boolean; onClose: () => void; onShortcuts?: () => void }) {
  const tr = useT()
  const { state } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)

  const all = useMemo<Item[]>(
    () => [
      { label: tr('New project'), hint: tr('Action'), to: '/app/projects?new=1', icon: Plus },
      ...state.projects.map((p) => ({ label: p.name, hint: tr('Project'), to: `/app/projects/${p.id}`, icon: FolderKanban })),
      ...state.clients.map((c) => ({ label: c.name, hint: `${tr('Client')} · ${c.contactName}`, to: `/app/projects?client=${c.id}`, icon: Users })),
      ...state.files.map((f) => ({ label: f.name, hint: `${tr('File')} · ${tr(f.status)}`, to: `/app/projects/${f.projectId}/files/${f.id}`, icon: FileText })),
      ...state.decks.map((d) => ({ label: d.title, hint: `${tr('Presentation')} · ${tr(d.status)}`, to: `/app/projects/${d.projectId}/presentations/${d.id}`, icon: Presentation })),
      ...state.invoices.map((i) => ({ label: i.number, hint: `${tr('Invoice')} · ${tr(i.status)}`, to: '/app/invoices', icon: Receipt })),
      { label: tr('Settings'), hint: tr('Page'), to: '/app/settings', icon: Settings },
      { label: tr('Keyboard shortcuts'), hint: tr('Help · press ?'), to: '#shortcuts', icon: Keyboard },
    ],
    [state],
  )
  const results = useMemo(() => {
    const n = q.trim().toLowerCase()
    return (n ? all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(n)) : all).slice(0, 12)
  }, [all, q])

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
    }
  }, [open])
  useEffect(() => setSel(0), [q])

  if (!open) return null
  const go = (i?: Item) => {
    if (!i) return
    onClose()
    if (i.to === '#shortcuts') onShortcuts?.()
    else navigate(i.to)
  }

  return (
    <div className="palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette-box" role="dialog" aria-label={tr('Search')}>
        <input
          autoFocus
          placeholder={tr('Search projects, clients, files…')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
            if (e.key === 'Enter') go(results[sel])
          }}
          aria-label={tr('Search')}
        />
        <div className="palette-list" role="listbox">
          {results.length === 0 && <p className="muted" style={{ padding: 12, fontSize: 14 }}>{tr('No results.')}</p>}
          {results.map((r, i) => (
            <div
              key={r.to + r.label}
              role="option"
              aria-selected={i === sel}
              className={'palette-item' + (i === sel ? ' sel' : '')}
              onMouseEnter={() => setSel(i)}
              onClick={() => go(r)}
            >
              <r.icon size={15} strokeWidth={1.75} className="muted" />
              {r.label}
              <small>{r.hint}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
