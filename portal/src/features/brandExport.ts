/**
 * Brand exports: colour files for designers (#9) and the full brand kit as a ZIP (#7).
 */
import { resolveSrc } from '../data/blobs'
import type { BrandColour, Project, State } from '../data/types'
import { formats, hexToRgb } from './color'
import { orderedColours } from './palette'

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'colour'

/* ---------- Colour formats ---------- */

export function cssVariables(colours: BrandColour[]) {
  return `:root {\n${colours.map((c) => `  --${slug(c.name)}: ${c.hex.toUpperCase()};`).join('\n')}\n}\n`
}

export function tailwindConfig(colours: BrandColour[]) {
  return `// tailwind.config.js → theme.extend.colors\nexport default {\n  theme: {\n    extend: {\n      colors: {\n${colours.map((c) => `        '${slug(c.name)}': '${c.hex.toUpperCase()}',`).join('\n')}\n      },\n    },\n  },\n}\n`
}

/** W3C Design Tokens format – imports into Figma variables via Tokens Studio or similar plugins. */
export function designTokens(project: Project) {
  const color: Record<string, unknown> = {}
  for (const c of project.hub.colours) color[slug(c.name)] = { $type: 'color', $value: c.hex.toUpperCase(), $description: c.role ?? '' }
  const font: Record<string, unknown> = {}
  for (const f of project.hub.fonts) font[slug(f.usage || f.name)] = { $type: 'fontFamily', $value: f.name }
  return JSON.stringify({ color, font }, null, 2)
}

/**
 * Adobe Swatch Exchange (.ase) – opens in Illustrator, InDesign and Photoshop.
 * Format: "ASEF", version 1.0, block count, then one colour entry block per swatch (RGB floats).
 */
export function aseFile(colours: BrandColour[], groupName: string): Blob {
  const chunks: ArrayBuffer[] = []
  const u16 = (n: number) => { const b = new ArrayBuffer(2); new DataView(b).setUint16(0, n); return b }
  const u32 = (n: number) => { const b = new ArrayBuffer(4); new DataView(b).setUint32(0, n); return b }
  const f32 = (n: number) => { const b = new ArrayBuffer(4); new DataView(b).setFloat32(0, n); return b }
  const name = (s: string) => {
    const b = new ArrayBuffer(2 + (s.length + 1) * 2)
    const v = new DataView(b)
    v.setUint16(0, s.length + 1)
    for (let i = 0; i < s.length; i++) v.setUint16(2 + i * 2, s.charCodeAt(i))
    return b
  }
  const size = (parts: ArrayBuffer[]) => parts.reduce((n, p) => n + p.byteLength, 0)
  const block = (type: number, parts: ArrayBuffer[]) => [u16(type), u32(size(parts)), ...parts]

  const entries = colours.map((c) => {
    const [r, g, b] = hexToRgb(c.hex).map((x) => x / 255)
    return block(0x0001, [name(c.name), new TextEncoder().encode('RGB ').buffer as ArrayBuffer, f32(r), f32(g), f32(b), u16(2)])
  })
  const blocks = [block(0xc001, [name(groupName)]), ...entries, block(0xc002, [])]
  chunks.push(new TextEncoder().encode('ASEF').buffer as ArrayBuffer, u16(1), u16(0), u32(blocks.length))
  blocks.forEach((b) => chunks.push(...b))
  return new Blob(chunks, { type: 'application/octet-stream' })
}

export function coloursText(colours: BrandColour[]) {
  return colours
    .map((c) => `${c.name}${c.role ? ` (${c.role}${c.usage ? `, ${c.usage}%` : ''})` : ''}\n${formats(c.hex).map((f) => `  ${f.label.padEnd(5)} ${f.value}`).join('\n')}`)
    .join('\n\n')
}

export function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export const saveText = (text: string, filename: string, type = 'text/plain') => saveBlob(new Blob([text], { type }), filename)

/* ---------- The brand kit ZIP ---------- */

export async function downloadBrandKit(state: State, project: Project) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const client = state.clients.find((c) => c.id === project.clientId)
  const name = client?.name ?? project.name
  const colours = orderedColours(project.hub.colours)

  const logos = zip.folder('Logos')!
  const files = state.files.filter((f) => f.projectId === project.id && f.published)
  for (const f of files) {
    const v = f.versions.at(-1)!
    const url = await resolveSrc(v.src)
    if (!url) continue
    const blob = await fetch(url).then((r) => r.blob())
    ;(f.category === 'Logos' ? logos : zip.folder(f.category)!).file(f.name, blob)
  }

  if (colours.length) {
    const c = zip.folder('Colours')!
    c.file(`${slug(name)}-colours.ase`, aseFile(colours, name))
    c.file('colours.css', cssVariables(colours))
    c.file('tailwind.config.js', tailwindConfig(colours))
    c.file('design-tokens.json', designTokens(project))
    c.file('colours.txt', coloursText(colours))
  }

  if (project.hub.fonts.length) {
    zip.folder('Fonts')!.file(
      'fonts.txt',
      project.hub.fonts
        .map((f) => `${f.name} — ${f.usage}\nhttps://fonts.google.com/specimen/${f.name.replace(/ /g, '+')}`)
        .join('\n\n') + '\n\nFonts are licensed separately. Google Fonts are free for commercial use.\n',
    )
  }

  zip.file(
    'README.txt',
    `${name} brand kit\nPrepared by ${state.studio.name} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n` +
      `Logos/    Logo files approved for use\nColours/  .ase for Adobe apps, CSS, Tailwind and design tokens (Figma via Tokens Studio)\nFonts/    Where to get the typefaces\n\n` +
      `Full guidelines: ${location.origin}/p/${project.id}/hub\n`,
  )

  const blob = await zip.generateAsync({ type: 'blob' })
  saveBlob(blob, `${slug(name)}-brand-kit.zip`)
}
