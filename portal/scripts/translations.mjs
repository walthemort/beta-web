/**
 * The Danish translation sheet.
 *
 *   npm run translations:export            → translations/aftryk-danish.xlsx (every Danish text in Aftryk)
 *   npm run translations:import <file>     → reads "Your Danish" back into src/data/da-custom.ts
 *
 * Your wording lives in its own file and wins over every other dictionary, so importing never
 * edits the originals and can be run again with a newer sheet.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { runnerImport } from 'vite'
import ExcelJS from 'exceljs'

const root = new URL('..', import.meta.url).pathname
const CUSTOM = join(root, 'src/data/da-custom.ts')
const COLUMNS = { nr: 1, area: 2, english: 3, now: 4, yours: 5, usedIn: 6, key: 7 }

async function dictionaries() {
  const { module } = await runnerImport(join(root, 'src/data/i18n.tsx'))
  return module.DANISH_SOURCES
}

/** Every single-quoted string in the source, and the files it appears in. */
function usage() {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) name !== '__tests__' && walk(path)
      else if (/\.(ts|tsx)$/.test(name) && !/^da-/.test(name) && name !== 'i18n.tsx') files.push(path)
    }
  }
  walk(join(root, 'src'))
  const where = new Map()
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) {
      const text = m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\\\/g, '\\')
      const list = where.get(text) ?? new Set()
      list.add(relative(root, file).replace(/^src\//, ''))
      where.set(text, list)
    }
  }
  return where
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const shown = (key) => (key.includes('§') ? `${key.slice(0, key.indexOf('§'))}   (${key.slice(key.indexOf('§') + 1)})` : key)

async function exportSheet(out) {
  const sources = await dictionaries()
  const where = usage()
  // The text actually on screen for each key: the last dictionary to define it wins.
  const rows = new Map()
  // Your own wording keeps the row where it was, so the sheet looks the same after an import.
  for (const src of sources)
    for (const [key, da] of Object.entries(src.entries)) rows.set(key, { key, da, area: src.area === 'Your wording' ? rows.get(key)?.area ?? 'Studio app' : src.area })
  const order = ['Client pages', 'Emails & documents', 'Studio app']
  const list = [...rows.values()].sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area))

  const book = new ExcelJS.Workbook()
  book.creator = 'Aftryk'
  const sheet = book.addWorksheet('Danish', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: '#', width: 6 },
    { header: 'Where it shows', width: 18 },
    { header: 'English', width: 50 },
    { header: 'Danish now', width: 50 },
    { header: 'Your Danish (leave empty to keep)', width: 50 },
    { header: 'Used in', width: 34 },
    { header: 'Key (don’t edit)', width: 12, hidden: true },
  ]
  list.forEach((r, i) => {
    const files = [...(where.get(r.key) ?? [])].sort()
    sheet.addRow([i + 1, r.area, shown(r.key), r.da, '', files.length ? files.join(', ') : '(not found in code – may be unused)', r.key])
  })
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEBE4' } }
  sheet.autoFilter = { from: 'A1', to: 'F1' }
  sheet.eachRow((row, n) => {
    row.alignment = { vertical: 'top', wrapText: true }
    if (n > 1) row.getCell(COLUMNS.yours).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6D5' } }
  })
  sheet.getColumn(COLUMNS.usedIn).font = { color: { argb: 'FF8A8984' }, size: 9 }

  const help = book.addWorksheet('How to')
  help.getColumn(1).width = 110
  ;[
    'How to translate Aftryk',
    '',
    '1. Go through the "Danish" sheet. Only fill in the yellow column, "Your Danish", where you want different wording.',
    '   Rows you leave empty keep their current Danish.',
    '2. Keep everything in {curly brackets} exactly as it is – e.g. {name} or {n}. Aftryk fills those in (a name, a number …).',
    '   You can move them around in the sentence.',
    '3. Keep line breaks in the long texts (emails, usage rights). In Excel: Alt+Enter (Mac: Ctrl+Option+Enter) for a new line in a cell.',
    '4. "Where it shows": Client pages and Emails & documents are what your clients see – start there.',
    '5. Text in (brackets) after the English, e.g. "Due   (invoice)", tells you where that version is used.',
    '6. Don’t add or delete rows, and don’t touch the hidden Key column. Filter and sort as much as you like.',
    '',
    'When you’re done, send the file back as .xlsx.',
  ].forEach((line, i) => {
    const row = help.addRow([line])
    if (i === 0) row.font = { bold: true, size: 14 }
  })

  mkdirSync(join(root, 'translations'), { recursive: true })
  await book.xlsx.writeFile(out)
  console.log(`Wrote ${list.length} texts to ${relative(root, out)}`)
}

async function importSheet(file) {
  const sources = await dictionaries()
  const current = new Map()
  for (const src of sources) for (const [key, da] of Object.entries(src.entries)) current.set(key, da)
  const custom = Object.fromEntries(sources.filter((s) => s.file.endsWith('da-custom.ts')).flatMap((s) => Object.entries(s.entries)))

  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(file)
  const sheet = book.getWorksheet('Danish')
  if (!sheet) throw new Error('No sheet called "Danish" in that file.')
  const text = (cell) => {
    const v = cell.value
    if (v == null) return ''
    if (typeof v === 'object' && 'richText' in v) return v.richText.map((t) => t.text).join('')
    return String(v)
  }

  let changed = 0
  const problems = []
  sheet.eachRow((row, n) => {
    if (n === 1) return
    const key = text(row.getCell(COLUMNS.key))
    const yours = text(row.getCell(COLUMNS.yours)).replace(/\r\n/g, '\n').trim()
    if (!key || !yours) return
    if (!current.has(key)) return problems.push(`Row ${n}: this text no longer exists in Aftryk – skipped.`)
    if (placeholders(yours) !== placeholders(key)) {
      return problems.push(`Row ${n}: "${yours.slice(0, 60)}" must keep ${placeholders(key) ? '{' + placeholders(key).split(',').join('}, {') + '}' : 'no {placeholders}'} – skipped.`)
    }
    if (yours === current.get(key)) return
    custom[key] = yours
    changed++
  })

  const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
  const body = Object.entries(custom).map(([k, v]) => `  ${q(k)}: ${q(v)},`).join('\n')
  writeFileSync(
    CUSTOM,
    `/**\n * Your own Danish wording, imported from the translation sheet (npm run translations:import).\n * Wins over every other dictionary. Generated – edit the sheet and import again rather than this file.\n */\nexport const daCustom: Record<string, string> = {\n${body}\n}\n`,
  )
  console.log(`Imported ${changed} new translation${changed === 1 ? '' : 's'} (${Object.keys(custom).length} in total) into ${relative(root, CUSTOM)}`)
  if (problems.length) console.log(`\n${problems.length} row${problems.length === 1 ? '' : 's'} skipped:\n` + problems.join('\n'))
}

const [command, arg] = process.argv.slice(2)
if (command === 'export') await exportSheet(arg ?? join(root, 'translations/aftryk-danish.xlsx'))
else if (command === 'import' && arg) await importSheet(arg)
else console.log('Usage: node scripts/translations.mjs export [out.xlsx] | import <sheet.xlsx>')
process.exit(0)
