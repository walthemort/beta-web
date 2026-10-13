/**
 * Many posts from a spreadsheet: paste rows from Excel, Numbers or Google Sheets, say which column
 * goes in which text, and get one artboard per row – the same design, different words.
 *
 * A text can say exactly where the words go with {{column name}}; otherwise the whole text is
 * replaced by the column's value.
 */
import type { Artboard, TextLayer } from '../../data/types'

/** Rows and columns from pasted text: tabs (from a spreadsheet), semicolons or commas, with "quotes". */
export function parseTable(text: string): string[][] {
  const src = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  if (!src.trim()) return []
  const first = src.split('\n')[0]
  const sep = first.includes('\t') ? '\t' : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') (cell += '"'), i++
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) row.push(cell), (cell = '')
    else if (ch === '\n') row.push(cell), rows.push(row), (row = []), (cell = '')
    else cell += ch
  }
  row.push(cell)
  rows.push(row)
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean))
}

const PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** The texts on an artboard that rows can fill, with any {{placeholders}} they have. */
export function mergeFields(a: Artboard) {
  return a.layers
    .filter((l): l is TextLayer => l.type === 'text')
    .map((l) => ({ id: l.id, label: l.text.split('\n')[0].slice(0, 40) || l.name, placeholders: [...l.text.matchAll(PLACEHOLDER)].map((m) => m[1]) }))
}

/**
 * Which column fills which text, guessed from the headers: a text's {{placeholder}}, its layer name,
 * or – when nothing matches – the columns in the order of the texts from the top.
 */
export function guessMapping(a: Artboard, headers: string[]): Record<string, number> {
  const fields = mergeFields(a)
  const idx = (name: string) => headers.findIndex((h) => norm(h) === norm(name))
  const out: Record<string, number> = {}
  for (const f of fields) {
    const layer = a.layers.find((l) => l.id === f.id)!
    const byPlaceholder = f.placeholders.map(idx).find((i) => i >= 0)
    const byName = idx(layer.name)
    out[f.id] = byPlaceholder ?? (byName >= 0 ? byName : -1)
  }
  if (Object.values(out).every((i) => i < 0)) {
    const top = [...fields].sort((x, y) => a.layers.find((l) => l.id === x.id)!.y - a.layers.find((l) => l.id === y.id)!.y)
    top.forEach((f, i) => (out[f.id] = i < headers.length ? i : -1))
  }
  return out
}

/** One row's artboard: the texts filled in, everything else as designed. */
export function mergeRow(a: Artboard, headers: string[], row: string[], mapping: Record<string, number>, newId: () => string): Artboard {
  const value = (i: number) => (i >= 0 ? row[i] ?? '' : '')
  const layers = a.layers.map((l) => {
    if (l.type !== 'text' || !(l.id in mapping)) return { ...l, id: newId() }
    const col = mapping[l.id]
    const hasPlaceholders = PLACEHOLDER.test(l.text)
    PLACEHOLDER.lastIndex = 0
    const text = hasPlaceholders
      ? l.text.replace(PLACEHOLDER, (m, name: string) => {
          const i = headers.findIndex((h) => norm(h) === norm(name))
          return i >= 0 ? value(i) : m
        })
      : col >= 0
        ? value(col)
        : l.text
    return { ...l, id: newId(), text, name: text.slice(0, 24) || l.name }
  })
  const title = row.find((c) => c.trim())?.slice(0, 30) ?? a.name
  return { ...a, id: newId(), name: `${a.name} – ${title}`, layers, groups: a.groups?.map((g) => ({ ...g })) }
}

/** Whether the first row looks like column names rather than content. */
export const looksLikeHeaders = (rows: string[][]) => rows.length > 1 && rows[0].every((c) => c.length > 0 && c.length < 40)
