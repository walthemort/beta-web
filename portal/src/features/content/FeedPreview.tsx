/**
 * The post where people will see it: on a phone, in a feed, as a full-screen story or among the
 * other posts in a profile grid – with the client's name and a caption. A neutral mock-up, not any
 * one app's look.
 */
import { useState } from 'react'
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react'
import { Modal } from '../../components/ui'
import type { Artboard, Design, Project } from '../../data/types'
import { useStore } from '../../data/store'
import { useT } from '../../data/i18n'
import { brandOf } from './model'
import { ArtboardView, useBrandLogos } from './render'

const PHONE = 320

function Scaled({ artboard, project, width }: { artboard: Artboard; project: Project; width: number }) {
  const logos = useBrandLogos(project)
  const s = width / artboard.width
  return (
    <div style={{ width, height: artboard.height * s, overflow: 'hidden', position: 'relative' }}>
      <div style={{ transform: `scale(${s})`, transformOrigin: '0 0', width: artboard.width, height: artboard.height }}>
        <ArtboardView artboard={artboard} project={project} logos={logos} />
      </div>
    </div>
  )
}

export function FeedPreview({ design, project, start, onClose }: { design: Design; project: Project; start: string; onClose: () => void }) {
  const tr = useT()
  const { state } = useStore()
  const client = state.clients.find((c) => c.id === project.clientId)
  const brand = brandOf(project)
  const [id, setId] = useState(start)
  const [mode, setMode] = useState<'feed' | 'story' | 'grid'>(() => {
    const a = design.artboards.find((x) => x.id === start)
    return a && a.height / a.width > 1.6 ? 'story' : 'feed'
  })
  const [dark, setDark] = useState(false)
  const [caption, setCaption] = useState('')
  const board = design.artboards.find((a) => a.id === id) ?? design.artboards[0]
  const name = (client?.name ?? project.name).toLowerCase().replace(/[^a-z0-9æøå]+/g, '')
  const avatar = <span className="fp-avatar" style={{ background: brand.primary, color: brand.light }}>{(client?.name ?? project.name).slice(0, 1)}</span>

  return (
    <Modal title={tr('Preview on a phone')} onClose={onClose}>
      <div className="fp-controls">
        <div className="seg" role="group" aria-label={tr('Where')}>
          <button aria-pressed={mode === 'feed'} onClick={() => setMode('feed')}>{tr('In the feed')}</button>
          <button aria-pressed={mode === 'story'} onClick={() => setMode('story')}>{tr('Story')}</button>
          <button aria-pressed={mode === 'grid'} onClick={() => setMode('grid')}>{tr('Profile grid')}</button>
        </div>
        {design.artboards.length > 1 && (
          <select className="input input-sm" value={board.id} onChange={(e) => setId(e.target.value)} aria-label={tr('Artboard')}>
            {design.artboards.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        <label className="cm-toggle-row"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> <span>{tr('Dark mode')}</span></label>
      </div>
      <div className="fp-stage">
        <div className={'fp-phone' + (dark ? ' dark' : '') + (mode === 'story' ? ' story' : '')}>
          {mode === 'feed' && (
            <div className="fp-feed">
              <div className="fp-post-head">{avatar}<b>{name}</b><MoreHorizontal size={16} style={{ marginLeft: 'auto' }} /></div>
              <Scaled artboard={board} project={project} width={PHONE} />
              <div className="fp-actions"><Heart size={20} /><MessageCircle size={20} /><Send size={20} /><Bookmark size={20} style={{ marginLeft: 'auto' }} /></div>
              <div className="fp-caption"><b>{name}</b> {caption || <span className="muted">{tr('Your caption shows here')}</span>}</div>
              <div className="fp-ghost" />
            </div>
          )}
          {mode === 'story' && (
            <div className="fp-story">
              <div className="fp-story-media">
                <Scaled artboard={board} project={project} width={PHONE} />
              </div>
              <div className="fp-story-top"><div className="fp-bars"><span /><span /></div><div className="fp-post-head light">{avatar}<b>{name}</b></div></div>
              <div className="fp-story-bottom"><span className="fp-reply">{tr('Send message')}</span><Heart size={20} /><Send size={20} /></div>
            </div>
          )}
          {mode === 'grid' && (
            <div className="fp-grid-wrap">
              <div className="fp-profile">{avatar}<div><b>{client?.name ?? project.name}</b><small className="muted">{tr('{n} posts', { n: 12 + design.artboards.length })}</small></div></div>
              <div className="fp-grid">
                {Array.from({ length: 9 }, (_, i) => {
                  const cell = PHONE / 3 - 1
                  const a = design.artboards[i]
                  return (
                    <div key={i} className="fp-cell" style={{ width: cell, height: cell * (4 / 3) }}>
                      {a ? (
                        // The grid shows a 3:4 crop from the middle of each post.
                        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                          <Scaled artboard={a} project={project} width={Math.max(cell, (cell * (4 / 3) * a.width) / a.height)} />
                        </div>
                      ) : (
                        <span style={{ background: [brand.light, brand.primary, brand.dark, brand.accent][i % 4] }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        {mode === 'feed' && (
          <label className="cm-field fp-caption-field">
            <span className="cm-label">{tr('Caption')}</span>
            <textarea className="input" rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={tr('Try the caption next to the post.')} />
          </label>
        )}
      </div>
    </Modal>
  )
}
