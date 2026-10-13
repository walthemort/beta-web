import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { useT } from '../data/i18n'

/** Draw a signature with mouse, finger or pen. Calls onChange with a PNG data URL (or null when cleared). */
export function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  // A ref (not just state) so a quick stroke is never missed between renders.
  const hasInk = useRef(false)
  const [empty, setEmpty] = useState(true)
  const t = useT()

  useEffect(() => {
    const c = canvas.current!
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio
    c.height = c.offsetHeight * ratio
    const g = c.getContext('2d')!
    g.scale(ratio, ratio)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.lineWidth = 2.2
    g.strokeStyle = '#141414'
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function clear() {
    const c = canvas.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    hasInk.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="sigpad">
      <canvas
        ref={canvas}
        aria-label={t('Signature – draw with your mouse or finger')}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = true
          last.current = point(e)
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return
          const p = point(e)
          const g = canvas.current!.getContext('2d')!
          g.beginPath()
          g.moveTo(last.current.x, last.current.y)
          g.lineTo(p.x, p.y)
          g.stroke()
          last.current = p
          if (!hasInk.current) {
            hasInk.current = true
            setEmpty(false)
          }
        }}
        onPointerUp={() => {
          drawing.current = false
          last.current = null
          if (hasInk.current) onChange(canvas.current!.toDataURL('image/png'))
        }}
      />
      {empty ? <span className="sigpad-hint">{t('Sign here')}</span> : (
        <button type="button" className="btn btn-ghost btn-sm sigpad-clear" onClick={clear}><Eraser size={13} /> {t('Clear')}</button>
      )}
      <i className="sigpad-line" />
    </div>
  )
}
