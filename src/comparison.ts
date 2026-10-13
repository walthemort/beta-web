export type ComparisonOptions = {
 initial?: number
 label: string
 valueText?: (value: number) => string
 onChange?: (value: number) => void
}
/** Shared case/portal control. Pointer capture keeps a drag attached outside the image. */
export function initializeComparison(frame: HTMLElement, options: ComparisonOptions) {
 const handle = frame.querySelector<HTMLButtonElement>('[data-comparison-handle]')
 if (!handle) throw new Error('Comparison handle is missing')
 let value = Math.max(0, Math.min(100, options.initial ?? 50))
 let pointer: number | null = null, offset = 0, startingValue = value
 let bounds: DOMRect | null = null
 let ignoreClick = false, clickTimer: ReturnType<typeof setTimeout> | undefined
 const setValue = (next: number) => {
  if (!Number.isFinite(next)) return
  value = Math.round(Math.max(0, Math.min(100, next)))
  frame.style.setProperty('--split', `${value}%`)
  handle.setAttribute('aria-valuenow', String(value))
  handle.setAttribute('aria-valuetext', options.valueText?.(value) ?? `${value}%`)
  options.onChange?.(value)
 }
 const fromPointer = (x: number) => { if (bounds?.width) setValue((x - bounds.left - offset) / bounds.width * 100) }
 const down = (event: PointerEvent) => {
  if (!event.isPrimary || event.button !== 0 || pointer !== null) return
  event.preventDefault()
  clearTimeout(clickTimer); ignoreClick = true
  bounds = frame.getBoundingClientRect(); startingValue = value
  offset = event.clientX - bounds.left - bounds.width * value / 100
  pointer = event.pointerId
  frame.setPointerCapture(pointer)
  frame.classList.add('is-dragging')
  handle.focus({preventScroll: true})
 }
 const move = (event: PointerEvent) => { if (event.pointerId === pointer) fromPointer(event.clientX) }
 const finish = () => {
  const id = pointer; pointer = null; bounds = null
  frame.classList.remove('is-dragging')
  clickTimer = setTimeout(() => { ignoreClick = false }, 0)
  if (id !== null && frame.hasPointerCapture(id)) frame.releasePointerCapture(id)
 }
 const up = (event: PointerEvent) => { if (event.pointerId === pointer) { fromPointer(event.clientX); finish() } }
 const cancel = (event: PointerEvent) => { if (event.pointerId === pointer) { setValue(startingValue); finish() } }
 const lost = (event: PointerEvent) => { if (event.pointerId === pointer) finish() }
 const click = (event: MouseEvent) => {
  if (ignoreClick) { ignoreClick = false; return }
  if (event.target instanceof Element && event.target.closest('[data-comparison-handle]')) return
  if (event.detail === 0) return
  bounds = frame.getBoundingClientRect(); offset = 0; fromPointer(event.clientX); bounds = null
  handle.focus({preventScroll: true})
 }
 const key = (event: KeyboardEvent) => {
  const step = event.shiftKey ? 10 : 1
  const changes: Record<string, number> = {ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -10, PageUp: 10}
  if (event.key === 'Escape' && pointer !== null) { event.preventDefault(); setValue(startingValue); finish(); return }
  if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setValue(event.key === 'Home' ? 0 : 100) }
  else if (Object.hasOwn(changes, event.key)) { event.preventDefault(); setValue(value + changes[event.key]) }
 }
 const resize = () => { if (pointer !== null) bounds = frame.getBoundingClientRect() }
 handle.hidden = false; handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', options.label)
 handle.setAttribute('aria-valuemin', '0'); handle.setAttribute('aria-valuemax', '100'); handle.setAttribute('aria-orientation', 'horizontal')
 handle.addEventListener('pointerdown', down); handle.addEventListener('keydown', key)
 frame.addEventListener('pointermove', move); frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', cancel)
 frame.addEventListener('lostpointercapture', lost); frame.addEventListener('click', click); window.addEventListener('resize', resize)
 frame.classList.add('is-interactive'); setValue(value)
 return {setValue, destroy: () => {
  finish(); clearTimeout(clickTimer); handle.removeEventListener('pointerdown', down); handle.removeEventListener('keydown', key)
  frame.removeEventListener('pointermove', move); frame.removeEventListener('pointerup', up); frame.removeEventListener('pointercancel', cancel)
  frame.removeEventListener('lostpointercapture', lost); frame.removeEventListener('click', click); window.removeEventListener('resize', resize)
  frame.classList.remove('is-interactive'); handle.hidden = true
 }}
}
