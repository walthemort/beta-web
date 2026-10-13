/**
 * Drawing a design: one artboard and its layers, in the artboard's own pixels. The editor, the
 * thumbnails and the PNG export all use this, so what you see is exactly what you export.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { isImage, resolveSrc, useSrc } from '../../data/blobs'
import { useStore } from '../../data/store'
import type { Artboard, ImageLayer, Layer, Project, ShapeLayer, StudioFile, TextLayer } from '../../data/types'
import { logoTone } from '../logoTone'
import { useLogoMark } from './logoMark'
import { backgroundAt, brandOf, chooseLogo, textColour, wordmarkColour, type Brand } from './model'
import { adjustFilter, duotoneTables, effectFilter, emphasisParts, gradientCss, gradientVector, maskClip, shapePoints } from './look'
import { IconMark } from './icons'
import { STILL, frameAt, travel, type Frame } from './motion'

/** The project's published logo files, each with how light it is (worked out once per image). */
export function useBrandLogos(project: Project) {
  const { state } = useStore()
  const files = state.files.filter((f) => f.projectId === project.id && f.category === 'Logos' && f.published && isImage(f.versions.at(-1)!.mime))
  const [tones, setTones] = useState<Record<string, 'light' | 'dark' | 'mixed'>>({})
  const key = files.map((f) => f.id + f.versions.length).join()
  useEffect(() => {
    let live = true
    for (const f of files) {
      resolveSrc(f.versions.at(-1)!.src).then((url) => {
        if (!url) return
        const img = new Image()
        img.onload = () => live && setTones((t) => ({ ...t, [f.id]: logoTone(img) }))
        img.src = url
      })
    }
    return () => {
      live = false
    }
  }, [key])
  return files.map((f) => ({ file: f, id: f.id, tone: tones[f.id] ?? 'mixed' }))
}
export type BrandLogo = ReturnType<typeof useBrandLogos>[number]

/** Google Fonts for the brand's typefaces, so text looks right on screen and in the PNG. */
export function BrandFonts({ brand }: { brand: Brand }) {
  const families = brand.fonts.filter((f) => !/^(Inter Tight|Helvetica|Arial|Georgia)$/i.test(f)).map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700`).join('&')
  // crossOrigin lets the export read the font rules and put the fonts inside the image.
  return families ? <link rel="stylesheet" crossOrigin="anonymous" href={`https://fonts.googleapis.com/css2?${families}&display=swap`} /> : null
}

/** Where a layer sits and how it looks – at a moment of its animation, when `f` is given. */
export function layerBox(l: Layer, f?: Frame): CSSProperties {
  const moving = f && f !== STILL
  const rotate = (l.rotation ?? 0) + (moving ? f.rotate : 0)
  const scale = moving ? f.scale : 1
  const base = l.rotation || l.flipX || l.flipY || moving
  return {
    position: 'absolute',
    left: l.x,
    top: l.y,
    width: l.w,
    height: l.type === 'text' ? 'auto' : l.h,
    minHeight: l.type === 'text' ? undefined : l.h,
    transform: base ? `${moving ? `translate(${f.tx}px, ${f.ty}px) ` : ''}rotate(${rotate}deg) scale(${(l.flipX ? -1 : 1) * scale}, ${(l.flipY ? -1 : 1) * scale})` : undefined,
    opacity: (l.opacity ?? 1) * (moving ? f.opacity : 1),
    display: l.hidden ? 'none' : undefined,
    filter: [effectFilter(l), moving && f.blur > 0.1 ? `blur(${f.blur}px)` : ''].filter(Boolean).join(' ') || undefined,
    clipPath: moving && f.reveal < 1 ? `inset(0 ${(1 - f.reveal) * 100}% 0 0)` : undefined,
    mixBlendMode: l.blend && l.blend !== 'normal' ? l.blend : undefined,
  }
}

/** A photo as it's shown: filled or fitted, its crop, its light and colour, a brand duotone. */
function ImageFill({ layer: l }: { layer: ImageLayer }) {
  const url = useSrc(l.src)
  if (!url) return null
  const tables = l.duotone && duotoneTables(l.duotone[0], l.duotone[1])
  const id = `cm-dt-${l.id}`
  const filter = [tables && `url(#${id})`, adjustFilter(l.adjust)].filter(Boolean).join(' ') || undefined
  return (
    <div style={{ width: '100%', height: '100%', clipPath: maskClip(l.mask) }}>
      {tables && (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <filter id={id} colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="table" tableValues={tables.r} />
              <feFuncG type="table" tableValues={tables.g} />
              <feFuncB type="table" tableValues={tables.b} />
            </feComponentTransfer>
          </filter>
        </svg>
      )}
      <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: l.fit, objectPosition: l.focus ? `${l.focus.x}% ${l.focus.y}%` : undefined, display: 'block', filter }} />
    </div>
  )
}

/** A logo file as a mark: its background removed and, unless it keeps its own colours, recoloured. */
function LogoImage({ file, colour }: { file: StudioFile; colour?: string }) {
  const v = file.versions.at(-1)!
  const url = useLogoMark(v.src, v.mime, colour)
  return url ? <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : null
}

/** How a text layer's letters look – shared by the text itself and the editor while typing. */
export const textStyle = (l: TextLayer, colour = l.colour === 'auto' ? undefined : l.colour): CSSProperties => ({
  fontFamily: `'${l.font}', 'Inter Tight', sans-serif`, fontSize: l.size, fontWeight: l.weight, color: colour, textAlign: l.align,
  lineHeight: l.lineHeight, letterSpacing: `${l.letterSpacing}em`, textTransform: l.uppercase ? 'uppercase' : undefined, whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
  fontStyle: l.italic ? 'italic' : undefined,
  textDecoration: l.underline ? 'underline' : undefined,
  textDecorationThickness: l.underline ? '0.06em' : undefined,
  textUnderlineOffset: l.underline ? '0.12em' : undefined,
  WebkitTextStroke: l.stroke?.width ? `${l.stroke.width}px ${l.stroke.colour}` : undefined,
  paintOrder: l.stroke?.width ? 'stroke fill' : undefined,
  ...(l.gradient ? { backgroundImage: gradientCss(l.gradient), WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}),
})

function TextContent({ layer: l, artboard, brand, chars = 1 }: { layer: TextLayer; artboard: Artboard; brand: Brand; chars?: number }) {
  const colour = textColour(l, artboard, brand)
  let parts = l.emphasis ? emphasisParts(l.text) : [{ text: l.text, em: false }]
  // Typewriter: only the first letters so far.
  if (chars < 1) {
    let left = Math.round(parts.reduce((n, p) => n + p.text.length, 0) * chars)
    parts = parts.map((p) => {
      const t = p.text.slice(0, Math.max(0, left))
      left -= p.text.length
      return { ...p, text: t }
    })
  }
  const words = parts.map((p, i) => (p.em ? <span key={i} style={{ color: l.emphasis, WebkitTextFillColor: l.emphasis }}>{p.text}</span> : <span key={i}>{p.text}</span>))
  const style = textStyle(l, colour)
  if (!l.highlight) return <div style={style}>{l.text ? words : ' '}</div>
  // A box behind each line, like a marker – it breaks with the lines.
  const pad = `${l.highlight.padding * 0.5}em ${l.highlight.padding}em`
  return (
    <div style={{ ...style, padding: `0 ${l.highlight.padding}em` }}>
      <span style={{ background: l.highlight.colour, padding: pad, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{l.text ? words : ' '}</span>
    </div>
  )
}

/** Shapes: boxes and circles as boxes; the rest drawn as SVG that stretches with the layer. */
function ShapeContent({ layer: l }: { layer: ShapeLayer }) {
  const fill = l.gradient ? gradientCss(l.gradient) : l.fill
  if (l.shape === 'rect' || l.shape === 'ellipse')
    return (
      <div
        style={{
          width: '100%', height: '100%', background: fill, boxSizing: 'border-box',
          borderRadius: l.shape === 'ellipse' ? '50%' : l.radius,
          border: l.stroke?.width ? `${l.stroke.width}px ${l.stroke.dash ? 'dashed' : 'solid'} ${l.stroke.colour}` : undefined,
        }}
      />
    )
  const id = `cm-g-${l.id}`
  const gradient = l.gradient && (
    <defs>
      {l.gradient.type === 'radial' ? (
        <radialGradient id={id}><stop offset="0" stopColor={l.gradient.stops[0]} /><stop offset="1" stopColor={l.gradient.stops[1]} /></radialGradient>
      ) : (
        <linearGradient id={id} {...gradientVector(l.gradient.angle)}><stop offset="0" stopColor={l.gradient.stops[0]} /><stop offset="1" stopColor={l.gradient.stops[1]} /></linearGradient>
      )}
    </defs>
  )
  const paint = l.gradient ? `url(#${id})` : l.fill
  const stroke = l.stroke?.width ? { stroke: l.stroke.colour, strokeWidth: l.stroke.width, strokeDasharray: l.stroke.dash ? `${l.stroke.width * 3} ${l.stroke.width * 2}` : undefined } : {}
  if (l.shape === 'line' || l.shape === 'arrow') {
    const sw = l.stroke?.width || Math.max(2, l.h * 0.2)
    const colour = l.stroke?.colour ?? l.fill
    const head = l.shape === 'arrow' ? Math.min(l.w * 0.45, Math.max(sw * 3.2, l.h * 0.8)) : 0
    const half = Math.min(l.h / 2, Math.max(sw * 1.6, head * 0.55))
    const y = l.h / 2
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${l.w} ${l.h}`} style={{ display: 'block', overflow: 'visible' }}>
        <line x1={sw / 2} y1={y} x2={l.w - (head ? head * 0.9 : sw / 2)} y2={y} stroke={colour} strokeWidth={sw} strokeLinecap="round" strokeDasharray={l.stroke?.dash ? `${sw * 3} ${sw * 2}` : undefined} />
        {head > 0 && <polygon points={`${l.w - head},${y - half} ${l.w},${y} ${l.w - head},${y + half}`} fill={colour} strokeLinejoin="round" />}
      </svg>
    )
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      {gradient}
      <polygon points={shapePoints(l.shape, l.sides) ?? ''} fill={paint} vectorEffect="non-scaling-stroke" strokeLinejoin="round" {...stroke} />
    </svg>
  )
}

/** The inside of a layer. */
export function LayerContent({ layer: l, artboard, brand, logos, chars }: { layer: Layer; artboard: Artboard; brand: Brand; logos: BrandLogo[]; chars?: number }) {
  if (l.type === 'text') return <TextContent layer={l} artboard={artboard} brand={brand} chars={chars} />
  if (l.type === 'image') return <ImageFill layer={l} />
  if (l.type === 'shape') return <ShapeContent layer={l} />
  if (l.type === 'icon') return <IconMark name={l.icon} colour={l.colour} strokeWidth={l.strokeWidth} />
  // A logo: the chosen file (or, in its own colours, the version that reads on what's behind it),
  // recoloured to read on the background – or the wordmark when the hub has no logo files.
  const bg = backgroundAt(artboard, l, l.x + l.w / 2, l.y + l.h / 2)
  const mode = l.colour ?? 'auto'
  const colour = mode === 'auto' ? wordmarkColour(brand, bg) : mode === 'original' ? undefined : mode
  const id = l.fileId !== 'auto' ? l.fileId : mode === 'original' ? chooseLogo(logos, bg) : logos[0]?.id
  const file = logos.find((x) => x.id === id)?.file
  if (file) return <LogoImage file={file} colour={colour} />
  return <Wordmark text={brand.wordmark} font={brand.heading} w={l.w} h={l.h} colour={colour ?? wordmarkColour(brand, bg)} centred={l.centred} />
}

/** How wide a line of text is at 100px – measured, so a long name can be made to fit its box. */
function textWidth(text: string, font: string) {
  const g = document.createElement('canvas').getContext('2d')
  if (!g) return text.length * 55
  g.font = `700 100px '${font}', 'Inter Tight', sans-serif`
  return g.measureText(text).width - text.length * 4 // the -0.04em letter spacing
}

/** The brand's name standing in for a logo: as big as the box allows, never wider than it. */
function Wordmark({ text, font, w, h, colour, centred }: { text: string; font: string; w: number; h: number; colour: string; centred?: boolean }) {
  const [width, setWidth] = useState(() => textWidth(text, font))
  useEffect(() => {
    let live = true
    const measure = () => live && setWidth(textWidth(text, font))
    measure()
    // The brand font may still be on its way – measure again once it's in.
    document.fonts?.load(`700 100px '${font}'`).then(measure, () => {})
    document.fonts?.ready.then(measure)
    return () => {
      live = false
    }
  }, [text, font])
  const size = Math.max(4, Math.min(h * 0.62, ((w * 0.98) / Math.max(1, width)) * 100))
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: centred ? 'center' : 'center start', fontFamily: `'${font}', 'Inter Tight', sans-serif`, fontWeight: 700, fontSize: size, letterSpacing: '-0.04em', color: colour, whiteSpace: 'nowrap', lineHeight: 1, overflow: 'hidden' }}>
      {text}
    </div>
  )
}

/** A whole artboard at its real size – at a moment of its animation, when `time` is given. Scale it from outside with a transform. */
export function ArtboardView({ artboard, project, logos, children, renderLayer, time }: {
  artboard: Artboard
  project: Project
  logos: BrandLogo[]
  children?: ReactNode
  /** Lets the editor wrap each layer with selection handles. */
  renderLayer?: (l: Layer, content: ReactNode, frame?: Frame) => ReactNode
  time?: number
}) {
  const brand = brandOf(project)
  const dist = travel(artboard)
  return (
    <div className="cm-board" style={{ width: artboard.width, height: artboard.height, background: artboard.backgroundGradient ? gradientCss(artboard.backgroundGradient) : artboard.background, isolation: 'isolate' }}>
      {artboard.layers.map((l) => {
        const frame = time === undefined ? undefined : frameAt(l.anim, time, dist)
        const content = <LayerContent layer={l} artboard={artboard} brand={brand} logos={logos} chars={frame?.chars} />
        return renderLayer ? renderLayer(l, content, frame) : <div key={l.id} style={layerBox(l, frame)}>{content}</div>
      })}
      {children}
    </div>
  )
}

/** A small, static picture of an artboard – for the list of designs. */
export function Thumbnail({ artboard, project, width = 260 }: { artboard: Artboard; project: Project; width?: number }) {
  const logos = useBrandLogos(project)
  const scale = width / artboard.width
  return (
    <div className="cm-thumb" style={{ width, height: artboard.height * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        <ArtboardView artboard={artboard} project={project} logos={logos} />
      </div>
    </div>
  )
}

export type ExportFormat = 'png' | 'jpg' | 'pdf'

/** The artboard as an image at its real size (or `scale` times it). What's marked data-noexport stays out. */
export async function artboardImage(node: HTMLElement, a: Artboard, format: 'png' | 'jpg' = 'png', scale = 1): Promise<Blob> {
  const { toCanvas } = await import('html-to-image')
  const canvas = await toCanvas(node, {
    width: a.width,
    height: a.height,
    pixelRatio: scale,
    // No cacheBust: it adds ?123 to every image address, and uploaded photos (blob: addresses) then fail to load.
    backgroundColor: format === 'jpg' ? '#ffffff' : undefined,
    style: { transform: 'none', margin: '0' },
    filter: (n) => !(n instanceof HTMLElement && n.dataset.noexport !== undefined) && !(n instanceof SVGElement && n.dataset.noexport !== undefined),
  })
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92))
  if (!blob) throw new Error('The artboard could not be saved as an image.')
  return blob
}

/** The artboard as a PNG, at its real size. */
export const artboardPng = (node: HTMLElement, a: Artboard) => artboardImage(node, a, 'png')
