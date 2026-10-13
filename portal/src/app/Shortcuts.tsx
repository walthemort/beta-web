import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/ui'
import { useT } from '../data/i18n'

/*
 * Keyboard shortcuts. Pages are two keys, Linear-style: G then the page's letter.
 * Nothing fires while typing in a field or while a dialog is open.
 */

const PAGES: { key: string; label: string; to: string }[] = [
  { key: 'o', label: 'Home', to: '/app' },
  { key: 't', label: 'My tasks', to: '/app/tasks' },
  { key: 'p', label: 'Projects', to: '/app/projects' },
  { key: 'c', label: 'Clients', to: '/app/clients' },
  { key: 'b', label: 'Board', to: '/app/board' },
  { key: 'l', label: 'Calendar', to: '/app/calendar' },
  { key: 'd', label: 'Documents & review', to: '/app/documents' },
  { key: 'h', label: 'Brand hubs', to: '/app/hubs' },
  { key: 'i', label: 'Invoices', to: '/app/invoices' },
  { key: 'r', label: 'Reports', to: '/app/reports' },
  { key: 'a', label: 'Pipeline', to: '/app/sales' },
  { key: 's', label: 'Settings', to: '/app/settings' },
]

/** “G P” for a page, shown as a hint on the sidebar links. */
export const shortcutFor = (to: string) => {
  const p = PAGES.find((x) => x.to === to)
  return p ? `G ${p.key.toUpperCase()}` : undefined
}

const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

const ACTIONS: { keys: string[]; label: string }[] = [
  { keys: [mod, 'K'], label: 'Search and jump anywhere' },
  { keys: ['N'], label: 'New project' },
  { keys: [mod, 'Z'], label: 'Undo a delete (while the “Undo” message shows)' },
  { keys: ['Esc'], label: 'Close a dialog' },
  { keys: ['?'], label: 'Show these shortcuts' },
]

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest('input, textarea, select, [contenteditable="true"]')

export function useShortcuts() {
  const navigate = useNavigate()
  const [help, setHelp] = useState(false)
  const pendingG = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return
      // Dialogs and the design editor (which has its own keys) turn the page shortcuts off.
      if (document.querySelector('.modal, .palette, [data-shortcuts-off]')) return
      const key = e.key.toLowerCase()
      if (e.key === '?') {
        e.preventDefault()
        setHelp(true)
        return
      }
      if (Date.now() - pendingG.current < 1200) {
        pendingG.current = 0
        const page = PAGES.find((p) => p.key === key)
        if (page) {
          e.preventDefault()
          navigate(page.to)
        }
        return
      }
      if (key === 'g') pendingG.current = Date.now()
      else if (key === 'n') {
        e.preventDefault()
        navigate('/app/projects?new=1')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return { help, openHelp: () => setHelp(true), closeHelp: () => setHelp(false) }
}

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const tr = useT()
  return (
    <Modal title={tr('Keyboard shortcuts')} onClose={onClose}>
      <div className="shortcuts">
        <section>
          <h3>{tr('Go to')}</h3>
          {PAGES.map((p) => (
            <div key={p.key} className="shortcut">
              <span>{tr(p.label)}</span>
              <span><kbd>G</kbd> <kbd>{p.key.toUpperCase()}</kbd></span>
            </div>
          ))}
        </section>
        <section>
          <h3>{tr('Actions')}</h3>
          {ACTIONS.map((a) => (
            <div key={a.label} className="shortcut">
              <span>{tr(a.label)}</span>
              <span>{a.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
            </div>
          ))}
        </section>
      </div>
    </Modal>
  )
}
