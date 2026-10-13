/**
 * “Many from a sheet”: paste rows from a spreadsheet and get one artboard per row – the same
 * design with each row's words. See merge.ts.
 */
import { useMemo, useState } from 'react'
import { Table } from 'lucide-react'
import { Modal } from '../../components/ui'
import type { Artboard } from '../../data/types'
import { useT } from '../../data/i18n'
import { guessMapping, looksLikeHeaders, mergeFields, mergeRow, parseTable } from './merge'
import { uid } from './model'

const MAX = 200

export function BulkCreate({ board, onCreate, onClose }: { board: Artboard; onCreate: (boards: Artboard[]) => void; onClose: () => void }) {
  const tr = useT()
  const [text, setText] = useState('')
  const [headersOn, setHeadersOn] = useState<boolean | null>(null)
  const [mapping, setMapping] = useState<Record<string, number> | null>(null)
  const rows = useMemo(() => parseTable(text), [text])
  const hasHeaders = headersOn ?? looksLikeHeaders(rows)
  const cols = Math.max(0, ...rows.map((r) => r.length))
  const headers = hasHeaders && rows[0] ? rows[0] : Array.from({ length: cols }, (_, i) => tr('Column {n}', { n: i + 1 }))
  const body = (hasHeaders ? rows.slice(1) : rows).slice(0, MAX)
  const fields = mergeFields(board)
  const map = mapping ?? guessMapping(board, headers)

  return (
    <Modal title={tr('Many posts from a spreadsheet')} subtitle={tr('Paste rows from Excel, Numbers or Google Sheets. Each row becomes an artboard: this design, with that row’s words.')} onClose={onClose}>
      <div className="form cm-bulk">
        <textarea
          className="input"
          rows={6}
          autoFocus
          value={text}
          onChange={(e) => { setText(e.target.value); setMapping(null) }}
          placeholder={'Headline\tText\nAutumn menu is here\tFrom 1 October\nNew opening hours\tMonday to Saturday'}
          aria-label={tr('Rows from a spreadsheet')}
        />
        {rows.length > 0 && (
          <>
            <label className="cm-toggle-row">
              <input type="checkbox" checked={hasHeaders} onChange={(e) => { setHeadersOn(e.target.checked); setMapping(null) }} />
              <span>{tr('The first row is column names')}</span>
            </label>
            <div className="cm-bulk-table">
              <table>
                <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>{body.slice(0, 4).map((r, i) => <tr key={i}>{headers.map((_, j) => <td key={j}>{r[j]}</td>)}</tr>)}</tbody>
              </table>
              {body.length > 4 && <small className="muted">{tr('…and {n} more rows', { n: body.length - 4 })}</small>}
            </div>
            <h4>{tr('Which column goes where')}</h4>
            {fields.length === 0 && <p className="muted">{tr('This artboard has no text to fill in yet.')}</p>}
            {fields.map((f) => (
              <label key={f.id} className="cm-bulk-map">
                <span>“{f.label}”{f.placeholders.length > 0 && <small className="muted"> · {f.placeholders.map((p) => `{{${p}}}`).join(' ')}</small>}</span>
                <select className="input input-sm" value={map[f.id] ?? -1} onChange={(e) => setMapping({ ...map, [f.id]: Number(e.target.value) })}>
                  <option value={-1}>{tr('Keep as it is')}</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
            ))}
            <small className="muted">{tr('Tip: write {{Column name}} in a text to put the words exactly there, e.g. “Open from {{Date}}”.')}</small>
          </>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button className="btn btn-primary" disabled={!body.length || !fields.length} onClick={() => { onCreate(body.map((r) => mergeRow(board, headers, r, map, uid))); onClose() }}>
            <Table size={15} /> {body.length === 1 ? tr('Make 1 artboard') : tr('Make {n} artboards', { n: body.length })}
          </button>
        </div>
      </div>
    </Modal>
  )
}
