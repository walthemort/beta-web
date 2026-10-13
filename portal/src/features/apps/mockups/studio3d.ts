/**
 * Mockups in 3D: the work on real objects – cards with paper thickness, a framed poster on a
 * plaster wall, a phone and a laptop with lit screens, a mug, a box, a billboard under the sky. Physically based materials, studio reflections, soft shadows
 * and a light of your choice (studio, sunlight, or sun through a plant). Drag to turn the camera.
 *
 * One WebGL renderer is shared by every scene; each scene is built once and then only gets new
 * textures and colours. Units are centimetres.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js'
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js'
import type { Art } from './scenes'

export type Mood = 'studio' | 'sun' | 'plant'
/** How the camera is turned from the scene's own angle: degrees around, degrees up, and zoom. */
export type View = { az: number; el: number; zoom: number }
export const DEFAULT_VIEW: View = { az: 0, el: 0, zoom: 1 }
export type Look = { tint: string; primary: string; accent: string; light: string; dark: string; mood: Mood; view: View }

type Base = { target: [number, number, number]; az: number; el: number; dist: number; fov: number }
type Built = {
  root: THREE.Object3D
  base: Base
  /** How big the scene is – for the light's shadow box. */
  size: number
  /** Soft shadows under objects standing on a floor at y = 0. */
  contact?: { size: number; height: number; opacity?: number }
  outdoor?: boolean
  setArt: (arts: Arts) => void
  setLook: (look: Look) => void
}

/** A side of a product besides its front – the back of a card, the side and lid of a box. */
export type FaceId = 'back' | 'side' | 'top' | 'envelope' | 'card'
export type Face = { id: FaceId; name: string; print?: string; landscape?: boolean }
/** The pictures a scene shows: the front, and any other sides that have their own design. */
export type Arts = { front: Art } & Partial<Record<FaceId, Art>>

/**
 * What the scene shows, as something to make: a print size from the Content Machine's Print tab,
 * or a screen size in pixels – plus its other sides, each its own artboard.
 */
export type Product = { name: string; print?: string; landscape?: boolean; width?: number; height?: number; faces?: Face[]; short?: string }

export type Scene3D = {
  id: string
  name: string
  product: Product
  /** The shape of the art the scene shows best (width / height) – for the logo stand-in. */
  aspect: number
  /** The light it looks best in, until someone picks another. */
  mood?: Mood
  build: () => Built
}

/* ---------- Pictures made on a canvas ---------- */

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** The part of a picture that fills a shape of this aspect, like object-fit: cover. */
function cover(art: Art, aspect: number, max = 2048) {
  const a = art.width / art.height
  const crop = a > aspect ? { x: (art.width - art.height * aspect) / 2, y: 0, w: art.height * aspect, h: art.height } : { x: 0, y: (art.height - art.width / aspect) / 2, w: art.width, h: art.width / aspect }
  const w = Math.min(max, Math.round(aspect >= 1 ? max : max * aspect))
  const h = Math.round(w / aspect)
  const c = canvas(w, h)
  c.getContext('2d')!.drawImage(art, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h)
  return c
}

/** Grey noise, softened by drawing small and scaling up – for bumps, plaster, paper and fabric. */
function noise(size: number, grain: number, seed = 1) {
  let s = seed
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const small = canvas(Math.max(2, Math.round(size / grain)), Math.max(2, Math.round(size / grain)))
  const g = small.getContext('2d')!
  const img = g.createImageData(small.width, small.height)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rand() - 0.5) * 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const c = canvas(size, size)
  const cg = c.getContext('2d')!
  cg.imageSmoothingQuality = 'high'
  cg.drawImage(small, 0, 0, size, size)
  return c
}

/** Several sizes of noise on top of each other – plaster, concrete, paper fibre. */
function layeredNoise(size: number, grains: number[], seed = 3) {
  const c = canvas(size, size)
  const g = c.getContext('2d')!
  g.fillStyle = '#808080'
  g.fillRect(0, 0, size, size)
  grains.forEach((grain, i) => {
    g.globalAlpha = 0.55 / (i + 1) + 0.15
    g.globalCompositeOperation = 'overlay'
    g.drawImage(noise(size, grain, seed + i * 7), 0, 0)
  })
  return c
}

/** Leaves and stems, blurred – a plant's shadow thrown by the sun. White lets light through. */
function leafGobo() {
  const s = 180
  const c = canvas(s, s)
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, s, s)
  g.fillStyle = '#000'
  g.strokeStyle = '#000'
  let seed = 5
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const stems: [number, number, number][] = [[0.05, 0.95, -0.9], [0.2, 1.0, -0.6], [0.95, 0.9, -2.3], [0.7, 1.0, -1.9], [0.4, 0.05, 1.2]]
  for (const [sx, sy, angle] of stems) {
    let x = sx * s
    let y = sy * s
    let a = angle
    g.lineWidth = 1.2
    for (let i = 0; i < 14; i++) {
      const nx = x + Math.cos(a) * 9
      const ny = y + Math.sin(a) * 9
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(nx, ny)
      g.stroke()
      for (const side of [-1, 1]) {
        const la = a + side * (0.9 + rand() * 0.5)
        g.save()
        g.translate(nx + Math.cos(la) * 7, ny + Math.sin(la) * 7)
        g.rotate(la)
        g.beginPath()
        g.ellipse(0, 0, 8 + rand() * 4, 3 + rand() * 1.5, 0, 0, Math.PI * 2)
        g.fill()
        g.restore()
      }
      x = nx
      y = ny
      a += (rand() - 0.5) * 0.5
    }
  }
  const out = canvas(1024, 1024)
  const og = out.getContext('2d')!
  og.fillStyle = '#fff'
  og.fillRect(0, 0, 1024, 1024)
  // Soft round edge, so the spot of light has no hard rim.
  og.drawImage(c, 0, 0, 1024, 1024)
  const edge = og.createRadialGradient(512, 512, 380, 512, 512, 512)
  edge.addColorStop(0, 'rgba(255,255,255,0)')
  edge.addColorStop(1, 'rgba(255,255,255,1)')
  og.globalCompositeOperation = 'lighter'
  og.fillStyle = edge
  og.globalAlpha = 0.25
  og.fillRect(0, 0, 1024, 1024)
  return out
}

/** A laptop keyboard: dark keys in rows. */
function keyboard() {
  const c = canvas(1300, 440)
  const g = c.getContext('2d')!
  g.fillStyle = '#1b1c1f'
  g.fillRect(0, 0, c.width, c.height)
  const rows = [14, 14, 13, 12, 11]
  const key = 80
  rows.forEach((n, r) => {
    const y = 12 + r * 84
    const w = (c.width - 24 - (n - 1) * 8) / n
    for (let i = 0; i < n; i++) {
      g.fillStyle = '#0c0c0e'
      g.beginPath()
      g.roundRect(12 + i * (w + 8), y, w, key - 8, 9)
      g.fill()
    }
  })
  return c
}

/** A clear sky, pale at the horizon, with a few soft clouds. */
function sky() {
  const c = canvas(1024, 1024)
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 1024)
  grad.addColorStop(0, '#6f9fd6')
  grad.addColorStop(0.55, '#a9c8ea')
  grad.addColorStop(1, '#e6eef5')
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 1024)
  // Clouds: clusters of round puffs, drawn tiny and scaled up so their edges melt.
  const small = canvas(56, 56)
  const sg = small.getContext('2d')!
  sg.fillStyle = '#fff'
  let seed = 17
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (const [cx, cy, n] of [[12, 12, 7], [38, 9, 5], [46, 24, 4], [20, 28, 3]]) {
    for (let i = 0; i < n; i++) {
      sg.globalAlpha = 0.22 + rand() * 0.2
      sg.beginPath()
      sg.arc(cx + (rand() - 0.5) * 9, cy + (rand() - 0.5) * 2.5, 1.6 + rand() * 2.4, 0, Math.PI * 2)
      sg.fill()
    }
  }
  g.drawImage(small, 0, 0, 1024, 1024)
  return c
}

/* ---------- Textures and materials ---------- */

let maxAniso = 8
function texture(c: HTMLCanvasElement, srgb = true, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = maxAniso
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repeat)
  }
  return t
}

const shade = (hex: string, by: number) => {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + by)))
  return c
}

/** A texture swapped for a new one – the old one's memory is let go. */
function swap(mat: THREE.MeshStandardMaterial, key: 'map' | 'emissiveMap', t: THREE.Texture | null) {
  const old = mat[key]
  mat[key] = t
  if (old && old !== t && !(old as { shared?: boolean }).shared) old.dispose()
  mat.needsUpdate = true
}

const shared = <T extends THREE.Texture>(t: T) => Object.assign(t, { shared: true })

/* ---------- Shapes ---------- */

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

/** UVs from 0 to 1 across the geometry's own width and height (for flat shapes). */
function fitUv(g: THREE.BufferGeometry) {
  g.computeBoundingBox()
  const b = g.boundingBox!
  const pos = g.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - b.min.x) / (b.max.x - b.min.x)
    uv[i * 2 + 1] = (pos.getY(i) - b.min.y) / (b.max.y - b.min.y)
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

/** A flat slab with soft, rounded edges, lying on its back (thickness along y). */
function slab(shape: THREE.Shape, depth: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, bevel, 0)
  return g
}

/** A flat face lying on top of something, facing up, with the picture the right way round. */
function face(w: number, h: number, r = 0) {
  const g = r ? fitUv(new THREE.ShapeGeometry(roundedRect(w, h, r), 16)) : new THREE.PlaneGeometry(w, h)
  g.rotateX(-Math.PI / 2)
  return g
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], shadows = true) => {
  const x = new THREE.Mesh(g, m)
  x.castShadow = shadows
  x.receiveShadow = true
  return x
}

function floor(size = 4000) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0 })
  mat.bumpMap = shared(texture(layeredNoise(512, [2, 8, 40]), false, [size / 40, size / 40]))
  mat.bumpMap.minFilter = THREE.LinearMipmapLinearFilter
  mat.bumpScale = 0.4
  const m = mesh(new THREE.PlaneGeometry(size, size), mat, false)
  m.rotation.x = -Math.PI / 2
  m.userData.floor = true
  return { mesh: m, mat }
}

/* ---------- The scenes ---------- */

const CARD_W = 8.5
const CARD_H = 5.5
const CARD_T = 0.05

const cards: Scene3D = {
  id: 'cards', name: 'Business cards', aspect: CARD_W / CARD_H, product: { name: 'Business card', print: 'business-card', landscape: true, faces: [{ id: 'back', name: 'Back§side', print: 'business-card', landscape: true }] },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const paperBump = shared(texture(layeredNoise(256, [1, 3]), false, [2, 2]))
    const front = new THREE.MeshStandardMaterial({ roughness: 0.72, bumpMap: paperBump, bumpScale: 0.15 })
    const back = new THREE.MeshStandardMaterial({ roughness: 0.78, bumpMap: paperBump, bumpScale: 0.15 })
    let hasBack = false
    const edge = new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.9 })
    // Five identical white edges read as one solid block of plastic. Alternating the shade by a
    // hair puts a line between the sheets, the way a real stack of uncoated stock does.
    const edgeAlt = new THREE.MeshStandardMaterial({ color: '#e5e1d9', roughness: 0.94 })
    const card = (top: THREE.Material, bottom: THREE.Material, side: THREE.Material = edge) => {
      const g = new THREE.Group()
      g.add(mesh(new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H), side))
      const t = mesh(face(CARD_W, CARD_H), top, false)
      t.position.y = CARD_T / 2 + 0.002
      const b = mesh(face(CARD_W, CARD_H), bottom, false)
      b.rotation.z = Math.PI
      b.position.y = -CARD_T / 2 - 0.002
      g.add(t, b)
      return g
    }
    // A small stack, face up …
    const stack = new THREE.Group()
    const turns = [0.03, -0.05, 0.02, -0.02, 0]
    turns.forEach((r, i) => {
      const c = card(i === turns.length - 1 ? front : edge, edge, i % 2 ? edgeAlt : edge)
      // A hair of air between sheets, so the stack has lines rather than being one solid lump.
      c.position.set(Math.sin(i * 1.7) * 0.08, CARD_T / 2 + i * CARD_T * 1.15, Math.cos(i * 2.3) * 0.08)
      c.rotation.y = r
      stack.add(c)
    })
    stack.position.set(-2.8, 0, -1.4)
    stack.rotation.y = 0.14
    // … and one turned over, showing the back.
    const single = card(back, front)
    single.position.set(4.6, CARD_T / 2, 3.6)
    single.rotation.y = -0.3
    root.add(stack, single)
    return {
      // The cards sit within about ±9 of the middle, so a 26-wide plane spends its texels on them
      // rather than on empty table, and 0.45 of height is the stack itself – the shadow can fade.
      root, size: 22, contact: { size: 26, height: 0.45, opacity: 0.55 },
      base: { target: [0.8, 0, 1.1], az: 0, el: 46, dist: 30, fov: 30 },
      setArt(arts) {
        swap(front, 'map', texture(cover(arts.front, CARD_W / CARD_H, 2048)))
        hasBack = !!arts.back
        swap(back, 'map', arts.back ? texture(cover(arts.back, CARD_W / CARD_H, 2048)) : null)
      },
      setLook(l) {
        f.mat.color.set(l.tint)
        // Without a design of its own, the back is a second brand colour, so the sides tell apart.
        const same = new THREE.Color(l.accent).getHex() === new THREE.Color(l.primary).getHex()
        back.color.set(hasBack ? '#ffffff' : same ? l.dark : l.accent)
      },
    }
  },
}

const poster: Scene3D = {
  id: 'poster', name: 'Poster on a wall', aspect: 0.75, mood: 'plant', product: { name: 'Poster (A3)', print: 'poster-a3' },
  build() {
    const root = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.97 })
    wallMat.bumpMap = shared(texture(layeredNoise(1024, [2, 6, 30, 120], 9), false, [5, 3]))
    wallMat.bumpScale = 1.2
    const wall = mesh(new THREE.PlaneGeometry(900, 500), wallMat, false)
    wall.position.set(0, 250, 0)
    const f = floor(900)
    f.mesh.position.z = 0
    const skirting = mesh(new THREE.BoxGeometry(900, 9, 1.6), new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.6 }))
    skirting.position.set(0, 4.5, 0.8)
    const frameMat = new THREE.MeshStandardMaterial({ color: '#1c1c1d', roughness: 0.45, metalness: 0.3 })
    const art = new THREE.MeshPhysicalMaterial({ roughness: 0.62, clearcoat: 1, clearcoatRoughness: 0.06 })
    const matBoard = new THREE.MeshStandardMaterial({ color: '#f6f5f1', roughness: 0.9 })
    const frame = new THREE.Group()
    frame.position.set(0, 150, 0)
    root.add(wall, f.mesh, skirting, frame)
    const layout = (aspect: number) => {
      frame.clear()
      const a = Math.max(0.6, Math.min(1.6, aspect))
      const [w, h] = a >= 1 ? [96, 96 / a] : [70 * a, 70]
      const m = 5 // the white mat around the print
      const b = 2.4 // the frame's width
      const d = 3 // its depth
      const W = w + m * 2 + b * 2
      const H = h + m * 2 + b * 2
      const bar = (bw: number, bh: number, x: number, y: number) => {
        const x3 = mesh(new THREE.BoxGeometry(bw, bh, d), frameMat)
        x3.position.set(x, y, d / 2)
        frame.add(x3)
      }
      bar(W, b, 0, H / 2 - b / 2)
      bar(W, b, 0, -H / 2 + b / 2)
      bar(b, H - b * 2, -W / 2 + b / 2, 0)
      bar(b, H - b * 2, W / 2 - b / 2, 0)
      const board = mesh(new THREE.PlaneGeometry(w + m * 2, h + m * 2), matBoard, false)
      board.position.z = 0.6
      const print = mesh(new THREE.PlaneGeometry(w, h), art, false)
      print.position.z = 0.65
      frame.add(board, print)
    }
    layout(0.75)
    return {
      root, size: 260,
      base: { target: [0, 150, 0], az: -16, el: 3, dist: 215, fov: 32 },
      setArt({ front: image }) {
        layout(image.width / image.height)
        swap(art, 'map', texture(cover(image, Math.max(0.6, Math.min(1.6, image.width / image.height)), 2048)))
      },
      setLook(l) {
        wallMat.color.set(l.tint)
        f.mat.color.copy(shade(l.tint, -0.18))
      },
    }
  },
}

/** A phone or laptop screen: the picture edge to edge, lit, under glass. */
function screenMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: '#000', roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#ffffff', emissiveIntensity: 0.62 })
}

function phoneScreen(art: Art) {
  const [w, h] = [1170, 2532]
  const c = canvas(w, h)
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  g.drawImage(cover(art, w / h, 1400), 0, 0, w, h)
  // The island and the status bar, as on the real thing.
  g.fillStyle = '#000'
  g.beginPath()
  g.roundRect(w / 2 - 190, 36, 380, 110, 55)
  g.fill()
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.font = '600 50px -apple-system, "SF Pro Text", Inter, sans-serif'
  g.fillText('9:41', 120, 112)
  g.fillRect(w - 230, 78, 90, 40)
  g.fillRect(w - 138, 90, 8, 16)
  return c
}

const phone: Scene3D = {
  id: 'phone', name: 'Phone', aspect: 1170 / 2532, product: { name: 'Phone screen', width: 1170, height: 2532 },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const body = new THREE.MeshStandardMaterial({ color: '#2f3033', metalness: 1, roughness: 0.3 })
    const glass = screenMaterial()
    const [W, H, D, bevel] = [7.1, 14.6, 0.62, 0.09]
    const device = new THREE.Group()
    device.add(mesh(slab(roundedRect(W, H, 1.05), D, bevel), body))
    const screen = mesh(face(W - 0.2, H - 0.2, 0.95), glass, false)
    screen.position.y = D + bevel * 2 + 0.003
    device.add(screen)
    for (const [z, len] of [[-3.6, 1.6], [-1.6, 1.1], [0.2, 1.1]] as const) {
      const b = mesh(new THREE.BoxGeometry(0.12, 0.3, len), body)
      b.position.set(z === -3.6 ? W / 2 + bevel + 0.02 : -W / 2 - bevel - 0.02, D / 2 + bevel, z)
      device.add(b)
    }
    device.rotation.y = -0.3
    root.add(device)
    return {
      root, size: 26, contact: { size: 40, height: 2 },
      base: { target: [0, 0.6, 0], az: 0, el: 60, dist: 40, fov: 30 },
      setArt({ front: art }) {
        const t = texture(phoneScreen(art))
        swap(glass, 'map', t)
        glass.emissiveMap = t
      },
      setLook(l) {
        f.mat.color.set(l.tint)
      },
    }
  },
}

function laptopScreen(art: Art) {
  const [w, h] = [2560, 1664]
  const c = canvas(w, h)
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  const inset = 26
  g.drawImage(cover(art, (w - inset * 2) / (h - inset * 2), 2048), inset, inset, w - inset * 2, h - inset * 2)
  g.fillStyle = '#000'
  g.beginPath()
  g.roundRect(w / 2 - 110, 0, 220, 58, 18)
  g.fill()
  return c
}

const laptop: Scene3D = {
  id: 'laptop', name: 'Laptop', aspect: 16 / 10, product: { name: 'Laptop screen', width: 2560, height: 1664 },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const alu = new THREE.MeshStandardMaterial({ color: '#c8c9cc', metalness: 1, roughness: 0.34 })
    const [W, H] = [30.4, 21.2]
    const base = mesh(slab(roundedRect(W, H, 1.1), 0.95, 0.12), alu)
    const top = 0.95 + 0.24
    const keys = mesh(face(26.4, 9.6), new THREE.MeshStandardMaterial({ map: shared(texture(keyboard())), roughness: 0.7 }), false)
    keys.position.set(0, top + 0.003, -2.9)
    const pad = mesh(face(12.6, 7.8, 0.6), new THREE.MeshStandardMaterial({ color: '#bfc0c3', metalness: 0.9, roughness: 0.22 }), false)
    pad.position.set(0, top + 0.003, 5.6)
    // The lid: hinged at the back edge, leaning back a little.
    const lid = new THREE.Group()
    lid.position.set(0, top, -H / 2 + 0.3)
    lid.rotation.x = -0.26
    const shell = mesh(new THREE.ExtrudeGeometry(roundedRect(W, H, 1.1), { depth: 0.42, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 20 }), alu)
    shell.position.set(0, H / 2, -0.5)
    const bezel = mesh(new THREE.PlaneGeometry(W - 0.5, H - 0.5), new THREE.MeshStandardMaterial({ color: '#070708', roughness: 0.2 }), false)
    bezel.position.set(0, H / 2, 0.01)
    const glass = screenMaterial()
    const screen = mesh(new THREE.PlaneGeometry(W - 1.6, (W - 1.6) / (2560 / 1664)), glass, false)
    screen.position.set(0, H / 2 + 0.3, 0.02)
    lid.add(shell, bezel, screen)
    root.add(base, keys, pad, lid)
    return {
      root, size: 60, contact: { size: 80, height: 26 },
      base: { target: [0, 9, -1], az: -24, el: 17, dist: 80, fov: 30 },
      setArt({ front: art }) {
        const t = texture(laptopScreen(art))
        swap(glass, 'map', t)
        glass.emissiveMap = t
      },
      setLook(l) {
        f.mat.color.set(l.tint)
      },
    }
  },
}

const MUG_R = 4.1
const MUG_H = 9.6

function mugWrap(art: Art) {
  const around = 2 * Math.PI * MUG_R
  const w = 2048
  const h = Math.round((w * MUG_H) / around)
  const c = canvas(w, h)
  const g = c.getContext('2d')!
  g.fillStyle = '#fbfaf7'
  g.fillRect(0, 0, w, h)
  // A design made as a mug wrap goes all the way round; anything else is printed on the front.
  if (art.width / art.height > 2) {
    g.drawImage(cover(art, w / h, 2048), 0, 0, w, h)
    return c
  }
  const ph = h * 0.74
  const pw = Math.min(w * 0.42, (ph * art.width) / art.height)
  const img = cover(art, pw / ph, 1400)
  g.drawImage(img, w / 2 - pw / 2, (h - ph) / 2, pw, ph)
  return c
}

const mug: Scene3D = {
  id: 'mug', name: 'Mug', aspect: 1.3, product: { name: 'Mug wrap (11 oz)', print: 'mug-wrap', landscape: true },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const ceramic = new THREE.MeshPhysicalMaterial({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 })
    const white = new THREE.MeshPhysicalMaterial({ color: '#fbfaf7', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 })
    const cup = new THREE.Group()
    const outer = mesh(new THREE.CylinderGeometry(MUG_R, MUG_R * 0.97, MUG_H, 96, 1, true), ceramic)
    outer.rotation.y = Math.PI
    const inside = mesh(new THREE.CylinderGeometry(MUG_R - 0.3, MUG_R - 0.35, MUG_H - 0.3, 96, 1, true), new THREE.MeshPhysicalMaterial({ color: '#fbfaf7', roughness: 0.2, clearcoat: 1, side: THREE.BackSide }), false)
    inside.position.y = 0.15
    const rim = mesh(new THREE.TorusGeometry(MUG_R - 0.15, 0.16, 16, 96).rotateX(Math.PI / 2), white)
    rim.position.y = MUG_H / 2
    const bottom = mesh(new THREE.CircleGeometry(MUG_R * 0.97, 64).rotateX(Math.PI / 2), white)
    bottom.position.y = -MUG_H / 2
    const coffee = mesh(new THREE.CircleGeometry(MUG_R - 0.32, 64).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#2a170c', roughness: 0.08, clearcoat: 1 }), false)
    coffee.position.y = MUG_H / 2 - 1.4
    const handle = mesh(new THREE.TorusGeometry(2.3, 0.5, 20, 48, Math.PI).rotateZ(-Math.PI / 2), white)
    handle.position.set(MUG_R - 0.1, 0.4, 0)
    handle.scale.z = 0.8
    cup.add(outer, inside, rim, bottom, coffee, handle)
    cup.position.y = MUG_H / 2
    root.add(cup)
    return {
      root, size: 30, contact: { size: 34, height: 12 },
      base: { target: [0, 5, 0], az: -16, el: 16, dist: 36, fov: 30 },
      setArt({ front: art }) {
        swap(ceramic, 'map', texture(mugWrap(art)))
      },
      setLook(l) {
        f.mat.color.set(l.tint)
      },
    }
  },
}

const BOX = { w: 16, h: 22, d: 7 }

const box: Scene3D = {
  id: 'box', name: 'Packaging', aspect: BOX.w / BOX.h, product: { name: 'Box front (16 × 22 cm)', short: 'Box', print: 'box-front', faces: [{ id: 'side', name: 'Side', print: 'box-side' }, { id: 'top', name: 'Lid', print: 'box-top', landscape: true }] },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const board = shared(texture(layeredNoise(256, [1, 4]), false, [2, 2]))
    const front = new THREE.MeshStandardMaterial({ roughness: 0.55, bumpMap: board, bumpScale: 0.1 })
    const side = new THREE.MeshStandardMaterial({ roughness: 0.6, bumpMap: board, bumpScale: 0.1 })
    const lid = new THREE.MeshStandardMaterial({ roughness: 0.6, bumpMap: board, bumpScale: 0.1 })
    const plain = new THREE.MeshStandardMaterial({ roughness: 0.6, bumpMap: board, bumpScale: 0.1 })
    let own = { side: false, top: false }
    const g = new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d)
    // Faces: right, left, top, bottom, front, back. Both sides get the side's design.
    const b = mesh(g, [side, side, lid, plain, front, plain])
    b.position.y = BOX.h / 2
    b.rotation.y = 0.12
    root.add(b)
    return {
      root, size: 50, contact: { size: 60, height: 24 },
      base: { target: [0, 10, 0], az: -30, el: 15, dist: 72, fov: 30 },
      setArt(arts) {
        swap(front, 'map', texture(cover(arts.front, BOX.w / BOX.h, 2048)))
        own = { side: !!arts.side, top: !!arts.top }
        swap(side, 'map', arts.side ? texture(cover(arts.side, BOX.d / BOX.h, 1024)) : null)
        swap(lid, 'map', arts.top ? texture(cover(arts.top, BOX.w / BOX.d, 1536)) : null)
      },
      setLook(l) {
        f.mat.color.set(l.tint)
        plain.color.set(l.primary)
        side.color.set(own.side ? '#ffffff' : l.primary)
        lid.color.set(own.top ? '#ffffff' : l.primary)
      },
    }
  },
}

const billboard: Scene3D = {
  id: 'billboard', name: 'Billboard', aspect: 2, product: { name: 'Billboard (6 × 3 m)', width: 3000, height: 1500 },
  build() {
    const root = new THREE.Group()
    const ground = mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: '#8f957f', roughness: 1 }), false)
    ground.rotation.x = -Math.PI / 2
    const steel = new THREE.MeshStandardMaterial({ color: '#3b3e43', metalness: 0.6, roughness: 0.55 })
    const [W, H, lift] = [640, 320, 520]
    const board = new THREE.Group()
    board.position.y = lift + H / 2
    const back = mesh(new THREE.BoxGeometry(W + 24, H + 24, 30), steel)
    back.position.z = -16
    const art = new THREE.MeshStandardMaterial({ roughness: 0.75 })
    const face3 = mesh(new THREE.PlaneGeometry(W, H), art, false)
    face3.position.z = 0.5
    board.add(back, face3)
    const walk = mesh(new THREE.BoxGeometry(W, 4, 70), steel)
    walk.position.set(0, lift - 4, 20)
    for (const x of [-W * 0.28, W * 0.28]) {
      const pole = mesh(new THREE.CylinderGeometry(20, 24, lift + H / 2, 24), steel)
      pole.position.set(x, (lift + H / 2) / 2, -34)
      root.add(pole)
    }
    for (const x of [-W * 0.33, 0, W * 0.33]) {
      const lamp = mesh(new THREE.BoxGeometry(34, 10, 20), steel)
      lamp.position.set(x, lift + H + 34, 40)
      const arm = mesh(new THREE.BoxGeometry(5, 5, 60), steel)
      arm.position.set(x, lift + H + 28, 12)
      root.add(lamp, arm)
    }
    root.add(ground, board, walk)
    return {
      root, size: 900, outdoor: true,
      base: { target: [0, 600, 0], az: 24, el: -2, dist: 1700, fov: 32 },
      setArt({ front: image }) {
        swap(art, 'map', texture(cover(image, W / H, 2048)))
      },
      setLook() {},
    }
  },
}


/* ---------- Stationery, notebook, bag, can, roll-up, tablet ---------- */

/** A flat sheet lying face up: a thin block of paper with the picture on top. */
function sheet(w: number, h: number, t: number, top: THREE.Material, edge: THREE.Material) {
  const g = new THREE.Group()
  const body = mesh(new THREE.BoxGeometry(w, t, h), edge)
  body.position.y = t / 2
  const face3 = mesh(face(w, h), top, false)
  face3.position.y = t + 0.003
  g.add(body, face3)
  return g
}

const A4 = { w: 21, h: 29.7 }
const DL = { w: 22, h: 11 }

const stationery: Scene3D = {
  id: 'stationery', name: 'Stationery', aspect: A4.w / A4.h,
  product: {
    name: 'Letterhead (A4)', short: 'Stationery', print: 'letter-a4',
    faces: [{ id: 'envelope', name: 'Envelope', print: 'envelope-dl', landscape: true }, { id: 'card', name: 'Business card', print: 'business-card', landscape: true }],
  },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const tooth = shared(texture(layeredNoise(256, [1, 3]), false, [3, 3]))
    const paper = (roughness = 0.82) => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness, bumpMap: tooth, bumpScale: 0.12 })
    const edge = new THREE.MeshStandardMaterial({ color: '#f6f4ef', roughness: 0.9 })
    const letter = paper()
    const envelope = paper(0.86)
    const card = paper(0.75)
    const own = { envelope: false, card: false }
    const l = sheet(A4.w, A4.h, 0.02, letter, edge)
    l.position.set(-6, 0, -1)
    l.rotation.y = 0.07
    const e = sheet(DL.w, DL.h, 0.3, envelope, edge)
    e.position.set(11.5, 0, 8)
    e.rotation.y = -0.16
    const c = sheet(CARD_W, CARD_H, CARD_T, card, edge)
    c.position.set(13, 0.3, -4.5)
    c.rotation.y = 0.28
    const pen = mesh(new THREE.CylinderGeometry(0.42, 0.42, 14, 32), new THREE.MeshStandardMaterial({ color: '#1d1e22', metalness: 0.7, roughness: 0.3 }))
    pen.rotation.set(0, -0.5, Math.PI / 2)
    pen.position.set(3.5, 0.42, 13.5)
    const tip = mesh(new THREE.ConeGeometry(0.42, 1.2, 32), new THREE.MeshStandardMaterial({ color: '#c9b37e', metalness: 1, roughness: 0.25 }))
    tip.position.set(0, 7.6, 0)
    pen.add(tip)
    root.add(l, e, c, pen)
    return {
      root, size: 45, contact: { size: 90, height: 2 },
      base: { target: [2.5, 0, 2.5], az: 0, el: 64, dist: 90, fov: 30 },
      setArt(arts) {
        swap(letter, 'map', texture(cover(arts.front, A4.w / A4.h, 2048)))
        own.envelope = !!arts.envelope
        own.card = !!arts.card
        swap(envelope, 'map', arts.envelope ? texture(cover(arts.envelope, DL.w / DL.h, 2048)) : null)
        swap(card, 'map', arts.card ? texture(cover(arts.card, CARD_W / CARD_H, 1536)) : null)
      },
      setLook(look) {
        f.mat.color.set(look.tint)
        envelope.color.set('#ffffff')
        card.color.set(own.card ? '#ffffff' : look.primary)
      },
    }
  },
}

const NB = { w: 14.8, h: 21, t: 1.7 }

const notebook: Scene3D = {
  id: 'notebook', name: 'Notebook', aspect: NB.w / NB.h,
  product: { name: 'Notebook cover (A5)', short: 'Notebook', print: 'notebook-a5' },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const cloth = shared(texture(layeredNoise(256, [1, 2, 6]), false, [4, 4]))
    const coverMat = new THREE.MeshStandardMaterial({ roughness: 0.85, bumpMap: cloth, bumpScale: 0.25 })
    const art = new THREE.MeshStandardMaterial({ roughness: 0.7, bumpMap: cloth, bumpScale: 0.2 })
    const pagesTex = (() => {
      const c = canvas(64, 512)
      const g = c.getContext('2d')!
      g.fillStyle = '#f3efe6'
      g.fillRect(0, 0, 64, 512)
      for (let y = 0; y < 512; y += 3) {
        g.fillStyle = `rgba(0,0,0,${0.04 + (y % 9 === 0 ? 0.05 : 0)})`
        g.fillRect(0, y, 64, 1)
      }
      return shared(texture(c, true))
    })()
    const pages = new THREE.MeshStandardMaterial({ map: pagesTex, roughness: 0.95 })
    const book = new THREE.Group()
    const board = 0.28
    const back = mesh(new THREE.BoxGeometry(NB.w, board, NB.h), coverMat)
    back.position.y = board / 2
    const block = mesh(new THREE.BoxGeometry(NB.w - 0.5, NB.t - board * 2, NB.h - 0.5), pages)
    block.position.set(0.1, NB.t / 2, 0)
    const spine = mesh(new THREE.BoxGeometry(0.4, NB.t, NB.h), coverMat)
    spine.position.set(-NB.w / 2 + 0.2, NB.t / 2, 0)
    const top = sheet(NB.w, NB.h, board, art, coverMat)
    top.position.y = NB.t - board
    const band = mesh(new THREE.BoxGeometry(0.55, NB.t + 0.08, NB.h + 0.08), new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.6 }))
    band.position.set(NB.w / 2 - 2, NB.t / 2, 0)
    book.add(back, block, spine, top, band)
    book.rotation.y = 0.22
    root.add(book)
    return {
      root, size: 32, contact: { size: 50, height: 3 },
      base: { target: [0, 1, 0.5], az: 0, el: 56, dist: 50, fov: 30 },
      setArt({ front: image }) {
        swap(art, 'map', texture(cover(image, NB.w / NB.h, 2048)))
      },
      setLook(look) {
        f.mat.color.set(look.tint)
        coverMat.color.set(look.primary)
      },
    }
  },
}

const BAG = { w: 24, h: 30, d: 10 }

const bag: Scene3D = {
  id: 'bag', name: 'Shopping bag', aspect: BAG.w / BAG.h,
  product: { name: 'Shopping bag (24 × 30 cm)', short: 'Shopping bag', print: 'bag-front' },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const fibre = shared(texture(layeredNoise(256, [1, 3, 9]), false, [3, 3]))
    const art = new THREE.MeshStandardMaterial({ roughness: 0.78, bumpMap: fibre, bumpScale: 0.2 })
    const side = new THREE.MeshStandardMaterial({ roughness: 0.82, bumpMap: fibre, bumpScale: 0.2 })
    const inside = new THREE.MeshStandardMaterial({ roughness: 0.95 })
    const body = mesh(new THREE.BoxGeometry(BAG.w, BAG.h, BAG.d), [side, side, inside, side, art, art])
    body.position.y = BAG.h / 2
    const rope = new THREE.MeshStandardMaterial({ roughness: 0.7 })
    const handle = (z: number) => {
      const pts = [[-4.8, 0], [-4.6, 5], [-2.4, 8.4], [2.4, 8.4], [4.6, 5], [4.8, 0]].map(([x, y]) => new THREE.Vector3(x, BAG.h + y - 0.4, z))
      return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.32, 10, false), rope)
    }
    const g = new THREE.Group()
    g.add(body, handle(BAG.d / 2 - 0.5), handle(-BAG.d / 2 + 0.5))
    g.rotation.y = 0.28
    root.add(g)
    return {
      root, size: 50, contact: { size: 70, height: 34 },
      base: { target: [0, 17, 0], az: -24, el: 13, dist: 100, fov: 30 },
      setArt({ front: image }) {
        swap(art, 'map', texture(cover(image, BAG.w / BAG.h, 2048)))
      },
      setLook(look) {
        f.mat.color.set(look.tint)
        side.color.set(look.primary)
        inside.color.copy(shade(look.primary, -0.25))
        rope.color.set(look.dark)
      },
    }
  },
}

const CAN = { r: 3.3, h: 11.6, body: 9.5 }

function canWrap(art: Art) {
  const around = 2 * Math.PI * CAN.r
  const w = 2048
  const h = Math.round((w * CAN.body) / around)
  const c = canvas(w, h)
  const g = c.getContext('2d')!
  g.fillStyle = '#f4f4f2'
  g.fillRect(0, 0, w, h)
  // A label made for the can goes all the way round; anything else is printed on the front.
  if (art.width / art.height > 1.6) {
    g.drawImage(cover(art, w / h, 2048), 0, 0, w, h)
    return c
  }
  const ph = h * 0.8
  const pw = Math.min(w * 0.38, (ph * art.width) / art.height)
  g.drawImage(cover(art, pw / ph, 1400), w / 2 - pw / 2, (h - ph) / 2, pw, ph)
  return c
}

const can: Scene3D = {
  id: 'can', name: 'Can', aspect: 205 / 95,
  product: { name: 'Can label (330 ml)', short: 'Can', print: 'can-wrap', landscape: true },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const print = new THREE.MeshStandardMaterial({ metalness: 0.45, roughness: 0.3 })
    const alu = new THREE.MeshStandardMaterial({ color: '#d7d9dc', metalness: 1, roughness: 0.22 })
    const tin = new THREE.Group()
    const label = mesh(new THREE.CylinderGeometry(CAN.r, CAN.r, CAN.body, 96, 1, true), print)
    label.rotation.y = Math.PI
    label.position.y = 0.7 + CAN.body / 2
    const lower = mesh(new THREE.CylinderGeometry(CAN.r, CAN.r * 0.84, 0.7, 96, 1, true), alu)
    lower.position.y = 0.35
    const shoulder = mesh(new THREE.CylinderGeometry(CAN.r * 0.84, CAN.r, 1.1, 96, 1, true), alu)
    shoulder.position.y = 0.7 + CAN.body + 0.55
    const lid = mesh(new THREE.CircleGeometry(CAN.r * 0.84, 64).rotateX(-Math.PI / 2), alu, false)
    lid.position.y = CAN.h - 0.1
    const rim = mesh(new THREE.TorusGeometry(CAN.r * 0.84, 0.13, 12, 96).rotateX(Math.PI / 2), alu)
    rim.position.y = CAN.h
    const tab = mesh(new THREE.BoxGeometry(1.1, 0.06, 1.9), alu)
    tab.position.set(0, CAN.h - 0.02, 0.6)
    const bottom = mesh(new THREE.CircleGeometry(CAN.r * 0.84, 64).rotateX(Math.PI / 2), alu)
    tin.add(label, lower, shoulder, lid, rim, tab, bottom)
    root.add(tin)
    return {
      root, size: 24, contact: { size: 26, height: 13 },
      base: { target: [0, 6, 0], az: -14, el: 10, dist: 40, fov: 30 },
      setArt({ front: image }) {
        swap(print, 'map', texture(canWrap(image)))
      },
      setLook(look) {
        f.mat.color.set(look.tint)
      },
    }
  },
}

const ROLL = { w: 85, h: 200 }

const rollup: Scene3D = {
  id: 'rollup', name: 'Roll-up banner', aspect: ROLL.w / ROLL.h,
  product: { name: 'Roll-up banner (85 × 200 cm)', short: 'Roll-up banner', print: 'rollup' },
  build() {
    const root = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.97 })
    wallMat.bumpMap = shared(texture(layeredNoise(1024, [2, 6, 30, 120], 9), false, [5, 3]))
    wallMat.bumpScale = 1.2
    const wall = mesh(new THREE.PlaneGeometry(900, 500), wallMat, false)
    wall.position.set(0, 250, -70)
    const f = floor(900)
    const alu = new THREE.MeshStandardMaterial({ color: '#c3c5c9', metalness: 1, roughness: 0.3 })
    const baseBox = mesh(new THREE.BoxGeometry(ROLL.w + 4, 9, 20), alu)
    baseBox.position.set(0, 4.5, 0)
    const art = new THREE.MeshStandardMaterial({ roughness: 0.6 })
    const banner = mesh(new THREE.PlaneGeometry(ROLL.w, ROLL.h), art, true)
    banner.position.set(0, 9 + ROLL.h / 2, 0.2)
    const back = mesh(new THREE.PlaneGeometry(ROLL.w, ROLL.h), new THREE.MeshStandardMaterial({ color: '#e9e9e9', roughness: 0.8 }), false)
    back.rotation.y = Math.PI
    back.position.copy(banner.position)
    const bar = mesh(new THREE.CylinderGeometry(0.9, 0.9, ROLL.w + 2, 24), alu)
    bar.rotation.z = Math.PI / 2
    bar.position.set(0, 9 + ROLL.h, 0.4)
    const pole = mesh(new THREE.CylinderGeometry(0.8, 0.8, ROLL.h, 16), alu)
    pole.position.set(0, 9 + ROLL.h / 2, -3)
    root.add(wall, f.mesh, baseBox, banner, back, bar, pole)
    return {
      root, size: 160, contact: { size: 150, height: 14 },
      base: { target: [0, 112, 0], az: -18, el: 4, dist: 470, fov: 32 },
      setArt({ front: image }) {
        swap(art, 'map', texture(cover(image, ROLL.w / ROLL.h, 2048)))
      },
      setLook(look) {
        wallMat.color.set(look.tint)
        f.mat.color.copy(shade(look.tint, -0.18))
      },
    }
  },
}

function tabletScreen(art: Art) {
  const [w, h] = [2360, 1640]
  const c = canvas(w, h)
  c.getContext('2d')!.drawImage(cover(art, w / h, 2048), 0, 0, w, h)
  return c
}

const tablet: Scene3D = {
  id: 'tablet', name: 'Tablet', aspect: 2360 / 1640,
  product: { name: 'Tablet screen', width: 2360, height: 1640 },
  build() {
    const root = new THREE.Group()
    const f = floor()
    root.add(f.mesh)
    const body = new THREE.MeshStandardMaterial({ color: '#b9bbbf', metalness: 1, roughness: 0.32 })
    const glass = screenMaterial()
    const [W, H, D, bevel] = [24.8, 17.9, 0.52, 0.08]
    const device = new THREE.Group()
    device.add(mesh(slab(roundedRect(W, H, 1.3), D, bevel), body))
    const bezel = mesh(face(W - 0.2, H - 0.2, 1.2), new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.1 }), false)
    bezel.position.y = D + bevel * 2 + 0.002
    const screen = mesh(face(W - 1.8, H - 1.8, 0.5), glass, false)
    screen.position.y = D + bevel * 2 + 0.004
    device.add(bezel, screen)
    device.rotation.y = -0.2
    root.add(device)
    return {
      root, size: 40, contact: { size: 60, height: 2 },
      base: { target: [0, 0.5, 0], az: 0, el: 58, dist: 62, fov: 30 },
      setArt({ front: image }) {
        const t = texture(tabletScreen(image))
        swap(glass, 'map', t)
        glass.emissiveMap = t
      },
      setLook(look) {
        f.mat.color.set(look.tint)
      },
    }
  },
}

export const SCENES_3D: Scene3D[] = [cards, stationery, poster, notebook, phone, tablet, laptop, mug, can, box, bag, rollup, billboard]
export const scene3dOf = (id: string) => SCENES_3D.find((s) => s.id === id)

/* ---------- Soft shadows where things touch the floor ---------- */

/**
 * Renders the scene's depth from just under the floor, blurs it, and lays it on the floor – after
 * three.js' contact-shadow example, but for things that stand on the floor rather than float.
 */
class ContactShadow {
  group = new THREE.Group()
  private rt: THREE.WebGLRenderTarget
  private rtBlur: THREE.WebGLRenderTarget
  private plane: THREE.Mesh
  private blurPlane: THREE.Mesh
  private cam: THREE.OrthographicCamera
  private depth: THREE.MeshDepthMaterial
  private h = new THREE.ShaderMaterial(HorizontalBlurShader)
  private v = new THREE.ShaderMaterial(VerticalBlurShader)

  constructor(size: number, height: number, opacity = 0.7) {
    // 1024 rather than 512: a business card is a small part of the plane, and at half this the
    // shadow under it is a handful of texels smeared into a blob.
    this.rt = new THREE.WebGLRenderTarget(1024, 1024)
    this.rt.texture.generateMipmaps = false
    this.rtBlur = new THREE.WebGLRenderTarget(1024, 1024)
    this.rtBlur.texture.generateMipmaps = false
    const g = new THREE.PlaneGeometry(size, size).rotateX(Math.PI / 2)
    this.plane = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.rt.texture, opacity, transparent: true, depthWrite: false }))
    this.plane.renderOrder = 1
    this.plane.scale.y = -1
    this.blurPlane = new THREE.Mesh(g)
    this.blurPlane.visible = false
    // Just below the floor, looking up: what touches the floor is nearest, and darkest.
    // How far below decides the gradient. A fixed 0.4 suits a mug, but for something as thin as a
    // business card it puts the whole card in the darkest part of the range, so the shadow comes
    // out as a flat silhouette instead of fading as the card lifts off the table.
    const below = Math.min(0.4, Math.max(0.02, height * 0.3))
    this.cam = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0, height + below)
    this.cam.rotation.x = Math.PI / 2
    this.cam.position.y = -below
    this.group.add(this.plane, this.blurPlane, this.cam)
    this.group.position.y = 0.02
    this.depth = new THREE.MeshDepthMaterial()
    const darkness = { value: 1.4 }
    this.depth.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = darkness
      shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );')}`
    }
    this.depth.side = THREE.DoubleSide
    this.h.depthTest = false
    this.v.depthTest = false
  }

  private blur(renderer: THREE.WebGLRenderer, amount: number) {
    this.blurPlane.visible = true
    this.blurPlane.material = this.h
    this.h.uniforms.tDiffuse.value = this.rt.texture
    this.h.uniforms.h.value = amount / 256
    renderer.setRenderTarget(this.rtBlur)
    renderer.render(this.blurPlane, this.cam)
    this.blurPlane.material = this.v
    this.v.uniforms.tDiffuse.value = this.rtBlur.texture
    this.v.uniforms.v.value = amount / 256
    renderer.setRenderTarget(this.rt)
    renderer.render(this.blurPlane, this.cam)
    this.blurPlane.visible = false
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    const bg = scene.background
    scene.background = null
    const fog = scene.fog
    scene.fog = null
    const floors: THREE.Object3D[] = []
    scene.traverse((o) => {
      if (o.userData.floor && o.visible) floors.push(o)
    })
    floors.forEach((o) => (o.visible = false))
    this.plane.visible = false
    scene.overrideMaterial = this.depth
    const alpha = renderer.getClearAlpha()
    renderer.setClearAlpha(0)
    renderer.setRenderTarget(this.rt)
    renderer.clear()
    renderer.render(scene, this.cam)
    scene.overrideMaterial = null
    this.blur(renderer, 2.2)
    this.blur(renderer, 0.9)
    renderer.setRenderTarget(null)
    renderer.setClearAlpha(alpha)
    scene.background = bg
    scene.fog = fog
    floors.forEach((o) => (o.visible = true))
    this.plane.visible = true
  }
}

/* ---------- The stage: one renderer, the light, the camera ---------- */

type Entry = {
  scene: THREE.Scene
  built: Built
  camera: THREE.PerspectiveCamera
  key: THREE.DirectionalLight
  spot: THREE.SpotLight
  contact?: ContactShadow
  arts?: Arts
}

let stage: { renderer: THREE.WebGLRenderer; env: THREE.Texture; gobo: THREE.Texture; entries: Map<string, Entry> } | null = null

export function supports3D() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

function getStage() {
  if (stage) return stage
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  // Soft PCF: the plain kind leaves a stepped edge on a shadow this close to what casts it.
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  maxAniso = renderer.capabilities.getMaxAnisotropy()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  const gobo = texture(leafGobo(), false)
  stage = { renderer, env, gobo, entries: new Map() }
  return stage
}

function create(id: string): Entry {
  const st = getStage()
  const def = scene3dOf(id) ?? cards
  const built = def.build()
  const scene = new THREE.Scene()
  scene.environment = st.env
  if (built.outdoor) {
    const t = texture(sky())
    scene.background = t
    scene.fog = new THREE.Fog('#dfe8f0', 3000, 9000)
  } else scene.background = new THREE.Color('#e9e6e0')
  scene.add(built.root)
  const key = new THREE.DirectionalLight('#ffffff', 2)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  const s = built.size
  Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: s * 8 })
  key.shadow.camera.updateProjectionMatrix()
  const spot = new THREE.SpotLight('#fff4e2', 0, 0, 0.55, 0.7, 0)
  spot.castShadow = true
  spot.shadow.mapSize.set(1024, 1024)
  spot.shadow.bias = -0.0004
  spot.map = st.gobo
  scene.add(key, key.target, spot, spot.target)
  const camera = new THREE.PerspectiveCamera(built.base.fov, 4 / 3, 0.5, 20000)
  let contact: ContactShadow | undefined
  if (built.contact) {
    contact = new ContactShadow(built.contact.size, built.contact.height, built.contact.opacity)
    scene.add(contact.group)
  }
  const entry = { scene, built, camera, key, spot, contact }
  st.entries.set(id, entry)
  return entry
}

/**
 * Where the light comes from, and how it feels. Directions are measured from the scene's own camera
 * angle – from the front-left, so shadows fall to the side where the camera sees them, rather
 * than hiding behind things.
 */
function light(e: Entry, mood: Mood) {
  const { built, key, spot, scene } = e
  const t = new THREE.Vector3(...built.base.target)
  const far = built.size * 3
  const from = (azOffset: number, elevation: number) => {
    const az = THREE.MathUtils.degToRad(built.base.az + azOffset)
    const el = THREE.MathUtils.degToRad(elevation)
    return t.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(far))
  }
  key.target.position.copy(t)
  spot.target.position.copy(t)
  if (built.outdoor) {
    key.position.copy(from(55, 40))
    key.color.set('#fff3e0')
    key.intensity = 3
    key.shadow.radius = 2
    scene.environmentIntensity = 0.9
    spot.intensity = 0
    return
  }
  if (mood === 'studio') {
    key.position.copy(from(-62, 48))
    key.color.set('#ffffff')
    key.intensity = 2.4
    key.shadow.radius = 9
    scene.environmentIntensity = 0.62
    spot.intensity = 0
  } else if (mood === 'sun') {
    key.position.copy(from(-78, 27))
    key.color.set('#ffefd6')
    key.intensity = 3.4
    key.shadow.radius = 2.5
    scene.environmentIntensity = 0.55
    spot.intensity = 0
  } else {
    // Sun through a plant: soft daylight, and a warm spot throwing leaf shadows.
    key.position.copy(from(-62, 48))
    key.color.set('#ffffff')
    key.intensity = 0.55
    key.shadow.radius = 9
    scene.environmentIntensity = 0.4
    spot.position.copy(from(-58, 34))
    spot.distance = 0
    spot.angle = Math.atan((built.size * 0.9) / far)
    spot.intensity = 6.5
    spot.shadow.radius = 3
    spot.shadow.camera.near = far * 0.3
    spot.shadow.camera.far = far * 2
    spot.shadow.camera.updateProjectionMatrix()
  }
}

function place(e: Entry, view: View, aspect: number) {
  const b = e.built.base
  const az = THREE.MathUtils.degToRad(b.az + view.az)
  const el = THREE.MathUtils.degToRad(Math.max(-8, Math.min(88, b.el + view.el)))
  const dist = b.dist / Math.max(0.5, Math.min(2.5, view.zoom))
  const t = new THREE.Vector3(...b.target)
  e.camera.aspect = aspect
  e.camera.fov = b.fov
  e.camera.position.set(t.x + Math.sin(az) * Math.cos(el) * dist, t.y + Math.sin(el) * dist, t.z + Math.cos(az) * Math.cos(el) * dist)
  e.camera.lookAt(t)
  e.camera.updateProjectionMatrix()
}

let grainTile: HTMLCanvasElement | null = null
/** A touch of film grain and a soft vignette – what makes a render read as a photo. */
function finish(g: CanvasRenderingContext2D, w: number, h: number) {
  if (!grainTile) grainTile = noise(256, 1, 42)
  g.save()
  g.globalCompositeOperation = 'overlay'
  g.globalAlpha = 0.07
  g.fillStyle = g.createPattern(grainTile, 'repeat')!
  g.fillRect(0, 0, w, h)
  g.globalCompositeOperation = 'source-over'
  g.globalAlpha = 1
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.62)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.13)')
  g.fillStyle = v
  g.fillRect(0, 0, w, h)
  g.restore()
}

/**
 * Draws a scene onto `out`. `quality` 2 renders at twice the size and scales down (smooth edges,
 * for the finished picture); 1 is for turning the camera.
 */
export function render3D(id: string, arts: Arts, look: Look, out: HTMLCanvasElement, quality: 1 | 2 = 2) {
  const st = getStage()
  const e = st.entries.get(id) ?? create(id)
  if (e.arts !== arts) {
    e.built.setArt(arts)
    e.arts = arts
  }
  e.built.setLook(look)
  if (!e.built.outdoor) {
    ;(e.scene.background as THREE.Color).set(look.tint)
    const d = e.built.base.dist / Math.max(0.5, look.view.zoom)
    e.scene.fog = new THREE.Fog(look.tint, d * 1.6, d * 4.5)
  }
  light(e, look.mood)
  place(e, look.view, out.width / out.height)
  const r = st.renderer
  r.setPixelRatio(quality)
  r.setSize(out.width, out.height, false)
  e.contact?.render(r, e.scene)
  r.render(e.scene, e.camera)
  const g = out.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(r.domElement, 0, 0, out.width, out.height)
  finish(g, out.width, out.height)
}
