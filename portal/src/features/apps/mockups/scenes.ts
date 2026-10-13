/**
 * Mockup scenes, drawn on a canvas: the work on business cards, a poster, a phone, a laptop, a
 * billboard – or on a photo of your own, placed by its four corners with
 * true perspective.
 */

export type Point = [number, number]
export type Art = CanvasImageSource & { width: number; height: number }
export type SceneOptions = { tint: string; accent: string; dark: string; light: string; wordmark: string; font: string; photo?: Art; corners?: Point[]; blend?: boolean }

export type Scene = { id: string; name: string; width: number; height: number; draw: (g: CanvasRenderingContext2D, art: Art, o: SceneOptions) => void }

/* ---------- Perspective ---------- */

/**
 * The mapping from a unit square onto four corners (top-left, top-right, bottom-right,
 * bottom-left) – a projective transform, so straight lines stay straight and far things shrink.
 */
export function squareToQuad(q: Point[]): (u: number, v: number) => Point {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  let g = 0
  let h = 0
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / det
    h = (dx1 * dy3 - dx3 * dy1) / det
  }
  const a = x1 - x0 + g * x1
  const b = x3 - x0 + h * x3
  const d = y1 - y0 + g * y1
  const e = y3 - y0 + h * y3
  return (u, v) => {
    const w = g * u + h * v + 1
    return [(a * u + b * v + x0) / w, (d * u + e * v + y0) / w]
  }
}

/** One triangle of the picture, stretched onto a triangle of the canvas. */
function triangle(g: CanvasRenderingContext2D, img: Art, s: Point[], d: Point[]) {
  const [[sx0, sy0], [sx1, sy1], [sx2, sy2]] = s
  const [[dx0, dy0], [dx1, dy1], [dx2, dy2]] = d
  const den = sx0 * (sy2 - sy1) - sx1 * sy2 + sx2 * sy1 + (sx1 - sx2) * sy0
  if (Math.abs(den) < 1e-9) return
  const a = -(sy0 * (dx2 - dx1) - sy1 * dx2 + sy2 * dx1 + (sy1 - sy2) * dx0) / den
  const b = (sy1 * dy2 + sy0 * (dy1 - dy2) - sy2 * dy1 + (sy2 - sy1) * dy0) / den
  const c = (sx0 * (dx2 - dx1) - sx1 * dx2 + sx2 * dx1 + (sx1 - sx2) * dx0) / den
  const dd = -(sx1 * dy2 + sx0 * (dy1 - dy2) - sx2 * dy1 + (sx2 - sx1) * dy0) / den
  const e = (sx0 * (sy2 * dx1 - sy1 * dx2) + sy0 * (sx1 * dx2 - sx2 * dx1) + (sx2 * sy1 - sx1 * sy2) * dx0) / den
  const f = (sx0 * (sy2 * dy1 - sy1 * dy2) + sy0 * (sx1 * dy2 - sx2 * dy1) + (sx2 * sy1 - sx1 * sy2) * dy0) / den
  g.save()
  // A hair bigger than the triangle, so neighbours meet without a seam.
  const cx = (dx0 + dx1 + dx2) / 3
  const cy = (dy0 + dy1 + dy2) / 3
  const grow = (x: number, y: number): Point => [x + (x - cx) * 0.02 + Math.sign(x - cx) * 0.5, y + (y - cy) * 0.02 + Math.sign(y - cy) * 0.5]
  g.beginPath()
  g.moveTo(...grow(dx0, dy0))
  g.lineTo(...grow(dx1, dy1))
  g.lineTo(...grow(dx2, dy2))
  g.closePath()
  g.clip()
  g.transform(a, b, c, dd, e, f)
  g.drawImage(img, 0, 0)
  g.restore()
}

/** A picture drawn onto four corners in perspective (a grid of small triangles). */
export function drawQuad(g: CanvasRenderingContext2D, img: Art, quad: Point[], crop?: { x: number; y: number; w: number; h: number }, steps = 14) {
  const map = squareToQuad(quad)
  const c = crop ?? { x: 0, y: 0, w: img.width, h: img.height }
  const src = (u: number, v: number): Point => [c.x + u * c.w, c.y + v * c.h]
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < steps; j++) {
      const [u0, u1, v0, v1] = [i / steps, (i + 1) / steps, j / steps, (j + 1) / steps]
      triangle(g, img, [src(u0, v0), src(u1, v0), src(u0, v1)], [map(u0, v0), map(u1, v0), map(u0, v1)])
      triangle(g, img, [src(u1, v0), src(u1, v1), src(u0, v1)], [map(u1, v0), map(u1, v1), map(u0, v1)])
    }
}

/** The part of a picture that fills a shape of this aspect (like object-fit: cover). */
export function coverCrop(img: Art, aspect: number) {
  const a = img.width / img.height
  return a > aspect ? { x: (img.width - img.height * aspect) / 2, y: 0, w: img.height * aspect, h: img.height } : { x: 0, y: (img.height - img.width / aspect) / 2, w: img.width, h: img.width / aspect }
}

/* ---------- Drawing helpers ---------- */

function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}
function shade(hex: string, amount: number) {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount))))
  return `rgb(${n.map(f).join(',')})`
}
function shadow(g: CanvasRenderingContext2D, blur: number, y: number, alpha = 0.28) {
  g.shadowColor = `rgba(0,0,0,${alpha})`
  g.shadowBlur = blur
  g.shadowOffsetY = y
  g.shadowOffsetX = 0
}
const noShadow = (g: CanvasRenderingContext2D) => shadow(g, 0, 0, 0)
/** A rectangle turned and tilted a little, as corners. */
function tilted(cx: number, cy: number, w: number, h: number, deg: number, lean = 0): Point[] {
  const r = (deg * Math.PI) / 180
  const pts: Point[] = [[-w / 2 + lean, -h / 2], [w / 2 - lean, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
  return pts.map(([x, y]) => [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)])
}
function polygon(g: CanvasRenderingContext2D, pts: Point[]) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
}
/** Soft light from the top left over a surface. */
function sheen(g: CanvasRenderingContext2D, pts: Point[], strength = 0.18) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const grad = g.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys))
  grad.addColorStop(0, `rgba(255,255,255,${strength})`)
  grad.addColorStop(0.5, 'rgba(255,255,255,0)')
  grad.addColorStop(1, `rgba(0,0,0,${strength * 0.6})`)
  polygon(g, pts)
  g.fillStyle = grad
  g.fill()
}
function background(g: CanvasRenderingContext2D, W: number, H: number, tint: string) {
  const grad = g.createRadialGradient(W * 0.35, H * 0.3, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.8)
  grad.addColorStop(0, shade(tint, 0.12))
  grad.addColorStop(1, shade(tint, -0.12))
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
}

/* ---------- The scenes ---------- */

export const SCENES: Scene[] = [
  {
    id: 'cards', name: 'Business cards', width: 1600, height: 1200,
    draw(g, art, o) {
      background(g, 1600, 1200, o.tint)
      const w = 700
      const h = w * (55 / 85)
      // The back of a card underneath: the brand colour and the name.
      const back = tilted(930, 520, w, h, 9)
      shadow(g, 40, 22)
      polygon(g, back)
      g.fillStyle = o.accent
      g.fill()
      noShadow(g)
      g.save()
      g.translate(930, 520)
      g.rotate((9 * Math.PI) / 180)
      g.fillStyle = o.light
      g.font = `700 64px ${o.font}, Helvetica, Arial, sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(o.wordmark, 0, 0)
      g.restore()
      sheen(g, back, 0.12)
      // The front on top, with the design.
      const front = tilted(680, 680, w, h, -7)
      shadow(g, 50, 30, 0.32)
      polygon(g, front)
      g.fillStyle = '#fff'
      g.fill()
      noShadow(g)
      drawQuad(g, art, front, coverCrop(art, 85 / 55))
      sheen(g, front)
    },
  },
  {
    id: 'poster', name: 'Poster on a wall', width: 1600, height: 1200,
    draw(g, art, o) {
      background(g, 1600, 1200, o.tint)
      // A floor line and a soft pool of light.
      g.fillStyle = shade(o.tint, -0.18)
      g.fillRect(0, 1030, 1600, 170)
      const aspect = Math.max(0.6, Math.min(1.4, art.width / art.height))
      const h = aspect < 1 ? 820 : 620
      const w = h * aspect
      const x = 800 - w / 2
      const y = 520 - h / 2
      const pts: Point[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
      shadow(g, 45, 26, 0.3)
      polygon(g, pts)
      g.fillStyle = '#fff'
      g.fill()
      noShadow(g)
      drawQuad(g, art, pts, coverCrop(art, aspect))
      sheen(g, pts, 0.1)
    },
  },
  {
    id: 'phone', name: 'Phone', width: 1600, height: 1200,
    draw(g, art, o) {
      background(g, 1600, 1200, o.tint)
      const [w, h] = [470, 960]
      const [x, y] = [800 - w / 2, 600 - h / 2]
      shadow(g, 60, 36, 0.35)
      rounded(g, x, y, w, h, 72)
      g.fillStyle = '#111'
      g.fill()
      noShadow(g)
      const inset = 22
      g.save()
      rounded(g, x + inset, y + inset, w - inset * 2, h - inset * 2, 54)
      g.clip()
      g.fillStyle = '#000'
      g.fillRect(x, y, w, h)
      const sw = w - inset * 2
      const sh = h - inset * 2
      const c = coverCrop(art, sw / sh)
      g.drawImage(art, c.x, c.y, c.w, c.h, x + inset, y + inset, sw, sh)
      g.restore()
      rounded(g, 800 - 60, y + inset + 16, 120, 34, 17)
      g.fillStyle = '#000'
      g.fill()
      sheen(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 0.08)
    },
  },
  {
    id: 'laptop', name: 'Laptop', width: 1600, height: 1200,
    draw(g, art, o) {
      background(g, 1600, 1200, o.tint)
      const [w, h] = [1040, 660]
      const [x, y] = [800 - w / 2, 190]
      shadow(g, 50, 30, 0.3)
      rounded(g, x, y, w, h, 28)
      g.fillStyle = '#1b1b1d'
      g.fill()
      noShadow(g)
      const i = 30
      const c = coverCrop(art, (w - i * 2) / (h - i * 2))
      g.drawImage(art, c.x, c.y, c.w, c.h, x + i, y + i, w - i * 2, h - i * 2)
      // The base.
      g.beginPath()
      g.moveTo(x - 90, y + h + 10)
      g.lineTo(x + w + 90, y + h + 10)
      g.lineTo(x + w + 40, y + h + 52)
      g.lineTo(x - 40, y + h + 52)
      g.closePath()
      const base = g.createLinearGradient(0, y + h + 10, 0, y + h + 52)
      base.addColorStop(0, '#d9dade')
      base.addColorStop(1, '#9fa1a6')
      g.fillStyle = base
      shadow(g, 30, 16, 0.25)
      g.fill()
      noShadow(g)
      rounded(g, 800 - 90, y + h + 10, 180, 12, 6)
      g.fillStyle = '#8d8f94'
      g.fill()
    },
  },
  {
    id: 'billboard', name: 'Billboard', width: 1600, height: 1200,
    draw(g, art) {
      const sky = g.createLinearGradient(0, 0, 0, 900)
      sky.addColorStop(0, '#8cb8e8')
      sky.addColorStop(1, '#dfeaf5')
      g.fillStyle = sky
      g.fillRect(0, 0, 1600, 1200)
      g.fillStyle = '#9aa38c'
      g.fillRect(0, 930, 1600, 270)
      g.fillStyle = '#4a4d52'
      g.fillRect(760, 620, 36, 330)
      g.fillRect(860, 620, 36, 330)
      const panel: Point[] = [[300, 180], [1330, 230], [1330, 650], [300, 660]]
      polygon(g, [[290, 170], [1340, 222], [1340, 660], [290, 672]])
      g.fillStyle = '#2b2d31'
      g.fill()
      drawQuad(g, art, panel, coverCrop(art, 1030 / 450))
      sheen(g, panel, 0.12)
    },
  },
  {
    id: 'photo', name: 'Your own photo', width: 1600, height: 1200,
    draw(g, art, o) {
      if (!o.photo) {
        background(g, 1600, 1200, o.tint)
        return
      }
      const pc = coverCrop(o.photo, 4 / 3)
      g.drawImage(o.photo, pc.x, pc.y, pc.w, pc.h, 0, 0, 1600, 1200)
      const corners = (o.corners ?? DEFAULT_CORNERS).map(([x, y]) => [x * 1600, y * 1200] as Point)
      drawQuad(g, art, corners)
      // The photo's own light and texture over the design.
      if (o.blend !== false) {
        g.save()
        polygon(g, corners)
        g.clip()
        g.globalCompositeOperation = 'multiply'
        g.globalAlpha = 0.35
        g.drawImage(o.photo, pc.x, pc.y, pc.w, pc.h, 0, 0, 1600, 1200)
        g.restore()
      }
    },
  },
]

export const DEFAULT_CORNERS: Point[] = [[0.3, 0.25], [0.7, 0.25], [0.7, 0.75], [0.3, 0.75]]
export const sceneOf = (id: string) => SCENES.find((s) => s.id === id) ?? SCENES[0]
