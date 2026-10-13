import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../data/store'
import type { State } from '../data/types'
import { translate } from '../data/i18n'

/*
 * Delete now, undo for a few seconds – instead of asking “Are you sure?” first.
 * The change is recorded as a before/after pair of the whole state; Undo reverts just that change
 * (see revertChange), so anything else that happened meanwhile is kept.
 */

const SECONDS = 7

type Options = {
  /** Runs once the change can no longer be undone – e.g. deleting the uploaded file itself. */
  onExpire?: () => void
  /** Translated button text for the client portal. */
  undoText?: string
}
type Pending = Options & { id: number; label: string; before: State; after?: State }
type Undoable = (label: string, run: () => void, options?: Options) => void

const Ctx = createContext<Undoable | null>(null)

export function UndoProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore()
  const stateRef = useRef(state)
  const pendingRef = useRef<Pending | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [paused, setPaused] = useState(false)

  // The state right after the change is the first one we render with.
  useEffect(() => {
    stateRef.current = state
    const p = pendingRef.current
    if (p && !p.after && state !== p.before) p.after = state
  }, [state])

  const finish = useCallback(() => {
    pendingRef.current?.onExpire?.()
    pendingRef.current = null
    setPending(null)
    setPaused(false)
  }, [])

  const undoable = useCallback<Undoable>(
    (label, run, options = {}) => {
      finish() // A new delete makes the previous one final.
      const p: Pending = { ...options, id: Date.now(), label, before: stateRef.current }
      pendingRef.current = p
      run()
      setPending(p)
    },
    [finish],
  )

  const undo = useCallback(() => {
    const p = pendingRef.current
    if (!p) return
    if (p.after) dispatch({ type: 'revert', before: p.before, after: p.after })
    pendingRef.current = null // Undone: onExpire must not run.
    setPending(null)
    setPaused(false)
  }, [dispatch])

  // Expire after a few seconds (paused while the pointer is on the toast), and when the page is closed.
  const left = useRef(0)
  useEffect(() => {
    left.current = SECONDS * 1000
  }, [pending])
  useEffect(() => {
    if (!pending || paused) return
    const started = Date.now()
    const t = setTimeout(finish, left.current)
    return () => {
      clearTimeout(t)
      left.current -= Date.now() - started
    }
  }, [pending, paused, finish])
  useEffect(() => {
    window.addEventListener('pagehide', finish)
    return () => window.removeEventListener('pagehide', finish)
  }, [finish])

  // Cmd/Ctrl+Z undoes while the toast is showing (but not while typing).
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, undo])

  return (
    <Ctx.Provider value={undoable}>
      {children}
      <div className="undo-region" role="status" aria-live="polite">
        {pending && (
          <div className="undo-toast" key={pending.id} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <span>{pending.label}</span>
            <button onClick={undo}>{pending.undoText ?? translate('Undo')}</button>
            <i style={{ animationDuration: `${SECONDS}s`, animationPlayState: paused ? 'paused' : 'running' }} aria-hidden="true" />
          </div>
        )}
      </div>
    </Ctx.Provider>
  )
}

export function useUndo() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUndo must be used inside UndoProvider')
  return ctx
}
