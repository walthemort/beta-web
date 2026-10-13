/**
 * Two small things that save a lot of back-and-forth: tidy file names on the way in, and a check
 * that the logo files you're handing over are actually the ones a client needs.
 */
import type { StudioFile } from '../data/types'

/* ---------- Names ---------- */

const ASCII: Record<string, string> = { æ: 'ae', ø: 'oe', å: 'aa', ä: 'ae', ö: 'oe', ü: 'ue', é: 'e', è: 'e', ß: 'ss' }

/**
 * "RAY Logo Primary (FINAL v2).svg" → "ray_logo-primary-final-v2.svg".
 * Lower case, no spaces or accents, so it survives every operating system and web server.
 */
export function tidyFileName(name: string, opts: { prefix?: string } = {}) {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[æøåäöüéèß]/g, (c) => ASCII[c] ?? c)
    .replace(/[^\p{L}\p{N}_]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  const prefix = (opts.prefix ?? '')
    .toLowerCase()
    .replace(/[æøåäöüéèß]/g, (c) => ASCII[c] ?? c)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  const stem = prefix && !base.startsWith(prefix) ? `${prefix}_${base}` : base
  return ext ? `${stem || 'file'}.${ext}` : stem || 'file'
}

/* ---------- Health ---------- */

export type Check = { id: string; ok: boolean; label: string; hint?: string }

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''
const MB = 1024 * 1024

/**
 * Is this set of logo files ready to hand over? Checks the things clients come back about:
 * a vector master, a transparent PNG, sensible names and file sizes.
 */
export function logoHealth(files: StudioFile[]): Check[] {
  const logos = files.filter((f) => f.category === 'Logos')
  const names = logos.map((f) => f.name)
  const kinds = new Set(names.map(ext))
  const latest = (f: StudioFile) => f.versions.at(-1)
  const biggest = Math.max(0, ...logos.map((f) => latest(f)?.size ?? 0))

  return [
    {
      id: 'vector',
      ok: kinds.has('svg') || kinds.has('eps') || kinds.has('pdf'),
      label: 'A vector master (SVG, EPS or PDF)',
      hint: 'Without one the logo can’t be scaled for print or signage.',
    },
    {
      id: 'png',
      ok: kinds.has('png'),
      label: 'A PNG for screens',
      hint: 'Most clients paste a PNG into slides and mail signatures.',
    },
    {
      id: 'transparent',
      ok: !logos.some((f) => ext(f.name) === 'jpg' || ext(f.name) === 'jpeg'),
      label: 'No JPGs among the logos',
      hint: 'JPG can’t hold a transparent background, so the logo sits in a white box.',
    },
    {
      id: 'variants',
      ok: names.length >= 2,
      label: 'More than one version (e.g. light and dark)',
      hint: 'A single file rarely works on every background.',
    },
    {
      id: 'names',
      ok: names.every((n) => n === tidyFileName(n)),
      label: 'Tidy file names',
      hint: 'Spaces, capitals and Danish letters break on some servers.',
    },
    {
      id: 'size',
      ok: biggest < 5 * MB,
      label: 'Nothing over 5 MB',
      hint: 'Huge files bounce off mail servers.',
    },
    {
      id: 'published',
      ok: logos.length > 0 && logos.some((f) => f.published),
      label: 'At least one logo published to the hub',
      hint: 'Published files are the ones the client can download.',
    },
  ]
}

export const healthScore = (checks: Check[]) => ({ passed: checks.filter((c) => c.ok).length, total: checks.length })
