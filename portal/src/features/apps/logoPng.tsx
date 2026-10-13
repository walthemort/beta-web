/**
 * The brand's logo as PNG pictures, one per background colour – recoloured to read on it and
 * trimmed to the logo itself. For files that can't use the hub's SVGs (PowerPoint, Word).
 */
import { useEffect, useRef } from 'react'
import type { Artboard, Project } from '../../data/types'
import { ArtboardView, artboardImage, useBrandLogos } from '../content/render'
import { brandOf, wordmarkColour } from '../content/model'

export type LogoPng = { data: string; aspect: number }

/** Cuts away the empty (transparent) edges of a picture. */
async function trim(blob: Blob): Promise<LogoPng | undefined> {
  const bmp = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const g = c.getContext('2d')!
  g.drawImage(bmp, 0, 0)
  const { data } = g.getImageData(0, 0, c.width, c.height)
  let [x0, y0, x1, y1] = [c.width, c.height, -1, -1]
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) return undefined
  const [w, h] = [x1 - x0 + 1, y1 - y0 + 1]
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(c, x0, y0, w, h, 0, 0, w, h)
  return { data: out.toDataURL('image/png'), aspect: w / h }
}

const board = (project: Project, bg: string): Artboard => {
  const brand = brandOf(project)
  const [W, H] = [1600, 600]
  return {
    id: `logo-${bg}`, name: 'Logo', width: W, height: H, background: 'transparent',
    layers: [{ id: 'logo', type: 'logo', name: 'Logo', fileId: 'auto', colour: wordmarkColour(brand, bg), x: 40, y: 40, w: W - 80, h: H - 80 }],
  }
}

/** Renders off screen and hands back { [background]: logo }. */
export function LogoPngs({ project, backgrounds, onReady }: { project: Project; backgrounds: string[]; onReady: (logos: Record<string, LogoPng | undefined>) => void }) {
  const logos = useBrandLogos(project)
  const ref = useRef<HTMLDivElement>(null)
  const bgs = [...new Set(backgrounds.map((b) => b.toLowerCase()))]
  const key = `${project.id}:${bgs.join()}:${logos.map((l) => l.id).join()}:${project.hub.updatedAt}`
  useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      const nodes = [...(ref.current?.querySelectorAll<HTMLElement>('.cm-board') ?? [])]
      const out: Record<string, LogoPng | undefined> = {}
      for (const [i, node] of nodes.entries()) {
        const a = board(project, bgs[i])
        out[bgs[i]] = await trim(await artboardImage(node, a, 'png')).catch(() => undefined)
      }
      if (live) onReady(out)
    }, 500)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [key])
  return (
    <div ref={ref} className="cm-offscreen" aria-hidden>
      {bgs.map((bg) => <ArtboardView key={bg} artboard={board(project, bg)} project={project} logos={logos} />)}
    </div>
  )
}
