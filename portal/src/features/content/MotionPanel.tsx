/**
 * The Content Machine's Motion mode: how each layer comes in, a timeline to play and scrub, and an
 * MP4 for Reels, Stories and TikTok.
 */
import { APP_NAME } from '../../components/brand'
import { Clapperboard, Film, Pause, Play, Wand2, X } from 'lucide-react'
import type { Artboard, Layer, LayerAnim } from '../../data/types'
import { useT } from '../../data/i18n'
import { ANIMS, LOOPS, durationOf } from './motion'
import { canMakeVideo } from './video'
import { LayerIcon, Section, Slider } from './panels'

const DEFAULT: LayerAnim = { in: 'fade', delay: 0, duration: 0.8 }

export function MotionPanel({ board, layer, progress, onAnim, onBoard, onAuto, onClear, onExport }: {
  board: Artboard
  layer: Layer | null
  /** 0–1 while a video is being made. */
  progress: number | null
  onAnim: (anim: LayerAnim | undefined, record?: boolean) => void
  onBoard: (duration: number | undefined, record?: boolean) => void
  onAuto: () => void
  onClear: () => void
  onExport: () => void
}) {
  const tr = useT()
  const total = durationOf(board)
  const a = layer?.anim ?? { ...DEFAULT, in: 'none' as const }
  const set = (p: Partial<LayerAnim>, record = true) => onAnim({ ...DEFAULT, ...layer?.anim, ...p }, record)
  return (
    <div className="cm-panel">
      <h4>{tr('Motion§mode')}</h4>
      <div className="cm-actions">
        <button className="btn btn-sm" onClick={onAuto}><Wand2 size={14} /> {tr('Animate everything')}</button>
        <button className="btn btn-sm btn-ghost" onClick={onClear}><X size={14} /> {tr('No animation')}</button>
      </div>
      <Slider label={tr('Length')} value={total} min={2} max={15} step={0.5} unit=" s" onChange={(v, r) => onBoard(v, r)} />

      {layer ? (
        <Section id="motion-layer" title={tr('This layer')}>
          <span className="cm-label">{tr('Comes in with')}</span>
          <div className="cm-layouts">
            {ANIMS.filter((x) => x.id !== 'type' || layer.type === 'text').map((x) => (
              <button key={x.id} className={'btn btn-sm' + (a.in === x.id ? ' on' : '')} onClick={() => set({ in: x.id })}>{tr(x.name)}</button>
            ))}
          </div>
          {a.in !== 'none' && (
            <>
              <Slider label={tr('Starts at')} value={a.delay} min={0} max={Math.max(1, total - 0.5)} step={0.1} unit=" s" onChange={(delay, r) => set({ delay }, r)} />
              <Slider label={tr('Takes')} value={a.duration} min={0.2} max={3} step={0.1} unit=" s" onChange={(duration, r) => set({ duration }, r)} />
            </>
          )}
          <label className="cm-field">
            <span className="cm-label">{tr('Then')}</span>
            <select className="input input-sm" value={a.loop ?? 'none'} onChange={(e) => set({ loop: e.target.value as LayerAnim['loop'] })}>
              {LOOPS.map((x) => <option key={x.id} value={x.id}>{tr(x.name)}</option>)}
            </select>
          </label>
        </Section>
      ) : (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('Select a layer to choose how it comes in – or let {app} animate everything.', { app: APP_NAME })}</p>
      )}

      <Section id="motion-export" title={tr('Video')}>
        {canMakeVideo() ? (
          <>
            <button className="btn btn-primary btn-sm" disabled={progress !== null} onClick={onExport}>
              <Film size={14} /> {progress !== null ? tr('Making the video… {n}%', { n: Math.round(progress * 100) }) : tr('Export MP4')}
            </button>
            {progress !== null && <div className="cm-progress"><span style={{ width: `${progress * 100}%` }} /></div>}
            <small className="muted">{tr('30 frames a second, up to 1920 px on the long side – what Reels, Stories and TikTok show.')}</small>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}><Clapperboard size={12} /> {tr('This browser can’t make videos. Use Chrome, Edge or Safari.')}</p>
        )}
      </Section>
    </div>
  )
}

/** Play, scrub, and every animated layer as a bar in time. */
export function Timeline({ board, time, playing, selected, onTime, onPlay, onSelect }: {
  board: Artboard; time: number; playing: boolean; selected: string[]
  onTime: (t: number) => void; onPlay: (on: boolean) => void; onSelect: (id: string) => void
}) {
  const tr = useT()
  const total = durationOf(board)
  const rows = [...board.layers].reverse().filter((l) => !l.hidden)
  return (
    <div className="cm-timeline" data-noexport>
      <div className="cm-timeline-head">
        <button className="btn btn-sm btn-icon" onClick={() => onPlay(!playing)} aria-label={playing ? tr('Pause') : tr('Play')}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <span className="cm-timeline-time">{time.toFixed(1)} / {total.toFixed(1)} s</span>
        <input type="range" min={0} max={total} step={0.01} value={Math.min(time, total)} onChange={(e) => { onPlay(false); onTime(Number(e.target.value)) }} aria-label={tr('Time')} />
      </div>
      <div className="cm-timeline-rows">
        {rows.map((l) => {
          const an = l.anim && l.anim.in !== 'none' ? l.anim : null
          return (
            <button key={l.id} className={'cm-timeline-row' + (selected.includes(l.id) ? ' on' : '')} onClick={() => onSelect(l.id)}>
              <span className="cm-timeline-name"><LayerIcon layer={l} /> {l.type === 'text' ? l.text.slice(0, 18) : tr(l.name)}</span>
              <span className="cm-timeline-track">
                {an && <i style={{ left: `${(an.delay / total) * 100}%`, width: `${(Math.min(an.duration, total - an.delay) / total) * 100}%` }} />}
                {l.anim?.loop && l.anim.loop !== 'none' && <i className="loop" style={{ left: `${(((an ? an.delay + an.duration : 0)) / total) * 100}%`, right: 0 }} />}
                <b style={{ left: `${(Math.min(time, total) / total) * 100}%` }} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
