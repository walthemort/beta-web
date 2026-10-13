/**
 * Animated artboards as MP4 – made in the browser: each frame is drawn at its moment in time,
 * encoded as H.264 (WebCodecs) and packed into an MP4 file. Works in Chrome, Edge and Safari.
 */

export const canMakeVideo = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window

/** H.264 needs even sizes; long sides above 1920 are made smaller (what social apps show anyway). */
export function videoSize(width: number, height: number) {
  const s = Math.min(1, 1920 / Math.max(width, height))
  const even = (n: number) => Math.max(2, Math.round((n * s) / 2) * 2)
  return { width: even(width), height: even(height) }
}

export async function makeVideo(opts: {
  width: number
  height: number
  duration: number
  fps?: number
  /** Puts the artboard at a moment in time and returns it, drawn and ready. */
  frame: (t: number) => Promise<HTMLElement>
  onProgress?: (share: number) => void
}): Promise<Blob> {
  if (!canMakeVideo()) throw new Error('unsupported')
  const fps = opts.fps ?? 30
  const size = videoSize(opts.width, opts.height)
  const [{ Muxer, ArrayBufferTarget }, { toCanvas, getFontEmbedCSS }] = await Promise.all([import('mp4-muxer'), import('html-to-image')])

  const candidates = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f']
  let codec = ''
  for (const c of candidates) {
    const { supported } = await VideoEncoder.isConfigSupported({ codec: c, width: size.width, height: size.height, bitrate: 8_000_000, framerate: fps })
    if (supported) {
      codec = c
      break
    }
  }
  if (!codec) throw new Error('unsupported')

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({ target, video: { codec: 'avc', width: size.width, height: size.height, frameRate: fps }, fastStart: 'in-memory' })
  let failure: unknown = null
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) })
  encoder.configure({ codec, width: size.width, height: size.height, bitrate: 8_000_000, framerate: fps })

  const first = await opts.frame(0)
  const fontEmbedCSS = await getFontEmbedCSS(first)
  const frames = Math.max(1, Math.round(opts.duration * fps))
  for (let i = 0; i < frames; i++) {
    if (failure) throw failure
    const node = await opts.frame(i / fps)
    const canvas = await toCanvas(node, {
      width: opts.width,
      height: opts.height,
      canvasWidth: size.width,
      canvasHeight: size.height,
      pixelRatio: 1,
      fontEmbedCSS,
      style: { transform: 'none', margin: '0' },
      filter: (n) => !(n instanceof HTMLElement && n.dataset.noexport !== undefined),
    })
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
    frame.close()
    opts.onProgress?.((i + 1) / frames)
    // Don't let the encoder fall far behind.
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 10))
  }
  await encoder.flush()
  if (failure) throw failure
  muxer.finalize()
  return new Blob([target.buffer], { type: 'video/mp4' })
}
