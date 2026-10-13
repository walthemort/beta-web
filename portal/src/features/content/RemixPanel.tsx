/**
 * Remix: the current artboard in other layouts and brand colour schemes, side by side. Pick one
 * to use it, or keep it as a new artboard next to this one.
 */
import { useMemo } from 'react'
import { Plus, Wand2 } from 'lucide-react'
import { Modal } from '../../components/ui'
import type { Artboard, Project } from '../../data/types'
import { useT } from '../../data/i18n'
import { brandOf } from './model'
import { remixes } from './remix'
import { Thumbnail } from './render'

export function RemixPanel({ board, project, onUse, onAdd, onClose }: { board: Artboard; project: Project; onUse: (a: Artboard) => void; onAdd: (a: Artboard) => void; onClose: () => void }) {
  const tr = useT()
  const list = useMemo(() => remixes(board, brandOf(project)), [board, project])
  const width = board.width >= board.height ? 240 : Math.round(240 * (board.width / board.height))
  return (
    <Modal title={tr('Remix')} subtitle={tr('The same words, photo and logo in other layouts and brand colours. Text is always kept readable.')} onClose={onClose}>
      {list.length === 0 ? (
        <p className="muted">{tr('Add some text first – remixing moves the words, photo and logo around.')}</p>
      ) : (
        <div className="cm-remix-grid">
          {list.map((r, i) => (
            <div key={i} className="cm-remix">
              <button className="cm-remix-art" onClick={() => { onUse(r.artboard); onClose() }} title={tr('Use this one')}>
                <Thumbnail artboard={r.artboard} project={project} width={width} />
              </button>
              <div className="cm-remix-foot">
                <button className="btn btn-sm" onClick={() => { onUse(r.artboard); onClose() }}><Wand2 size={13} /> {tr('Use')}</button>
                <button className="btn btn-sm btn-ghost" onClick={() => onAdd(r.artboard)} title={tr('Keep it as a new artboard')}><Plus size={13} /> {tr('As new artboard')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
