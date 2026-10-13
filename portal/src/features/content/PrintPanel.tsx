/**
 * The Content Machine's Print mode: turn a design into a business card, flyer, poster or roll-up
 * with bleed, check it like a printer would, and export a print-ready PDF.
 */
import { useState } from 'react'
import { Download, FileDown, Printer, ShieldCheck, Wand2 } from 'lucide-react'
import type { Artboard } from '../../data/types'
import { useT } from '../../data/i18n'
import type { Brand, Issue } from './model'
import { PRINT_FORMATS, printsDuller, toCmyk } from './print'
import { IssueList, Section, Toggle } from './panels'

export function PrintPanel({ board, brand, issues, busy, softProof, onSoftProof, onConvert, onFix, onFixAll, onPick, onPdf, onPng }: {
  board: Artboard
  brand: Brand
  issues: Issue[]
  busy: boolean
  softProof: boolean
  onSoftProof: (on: boolean) => void
  onConvert: (formatId: string, landscape: boolean, back: boolean) => void
  onFix: (i: Issue) => void
  onFixAll: () => void
  onPick: (i: Issue) => void
  onPdf: (marks: boolean) => void
  onPng: () => void
}) {
  const tr = useT()
  const [format, setFormat] = useState(PRINT_FORMATS[0].id)
  const [landscape, setLandscape] = useState(board.width >= board.height)
  const [back, setBack] = useState(true)
  const p = board.print
  const f = PRINT_FORMATS.find((x) => x.id === format)!
  const hasBack = format === 'business-card' || format === 'postcard'

  const converter = (
    <div className="cm-print-convert">
      <div className="cm-print-formats">
        {PRINT_FORMATS.map((x) => (
          <button key={x.id} className={'cm-print-format' + (x.id === format ? ' on' : '')} onClick={() => setFormat(x.id)}>
            <span className="cm-print-shape" style={{ aspectRatio: `${x.w} / ${x.h}` }} />
            <span>{tr(x.name)}</span>
            <small>{x.w} × {x.h} mm</small>
          </button>
        ))}
      </div>
      {f.w !== f.h && (
        <div className="seg" role="group" aria-label={tr('Orientation')}>
          <button aria-pressed={!landscape} onClick={() => setLandscape(false)}>{tr('Portrait')}</button>
          <button aria-pressed={landscape} onClick={() => setLandscape(true)}>{tr('Landscape')}</button>
        </div>
      )}
      {hasBack && (
        <label className="cm-toggle-row"><input type="checkbox" checked={back} onChange={(e) => setBack(e.target.checked)} /> <span>{tr('Add a back with the logo')}</span></label>
      )}
      <button className="btn btn-primary btn-sm" onClick={() => onConvert(format, landscape, hasBack && back)}><Printer size={14} /> {tr('Make a print version')}</button>
      <small className="muted">{tr('A new artboard at print resolution, with 3 mm bleed. The design is fitted to the new size.')}</small>
    </div>
  )

  if (!p)
    return (
      <div className="cm-panel">
        <h4>{tr('Print')}</h4>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('This artboard is for screens. Pick a paper size to make a print-ready version of it.')}</p>
        {converter}
      </div>
    )

  const dpi = board.dpi ?? 300
  const fixable = issues.filter((i) => i.fix)
  return (
    <div className="cm-panel">
      <h4>{tr('Print')}</h4>
      <div className="cm-print-spec">
        <span><b>{tr(PRINT_FORMATS.find((x) => x.id === p.format)?.name ?? 'Print')}</b></span>
        <span>{p.trimW} × {p.trimH} mm · {dpi} dpi</span>
        <span className="muted">{tr('{bleed} mm bleed · keep words {safe} mm inside', { bleed: p.bleed, safe: p.safe })}</span>
      </div>
      <p className="cm-print-legend">
        <i className="bleed" /> {tr('Bleed – printed, then cut off')} <i className="trim" /> {tr('Cut line')} <i className="safe" /> {tr('Safe area')}
      </p>

      <Section id="preflight" title={tr('Ready for the printer?')}>
        {issues.length ? (
          <>
            <IssueList issues={issues} onFix={onFix} onPick={onPick} />
            {fixable.length > 1 && <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={onFixAll}><Wand2 size={14} /> {tr('Fix all')}</button>}
          </>
        ) : (
          <p className="cm-ok"><ShieldCheck size={14} /> {tr('Looks ready: bleed, safe area, resolution and text size all check out.')}</p>
        )}
      </Section>

      <Section id="print-export" title={tr('Export for print')}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onPdf(true)}><FileDown size={14} /> {busy ? tr('Saving…') : tr('Print PDF with crop marks')}</button>
        <button className="btn btn-sm" disabled={busy} onClick={() => onPdf(false)}><FileDown size={14} /> {tr('PDF with bleed, no marks')}</button>
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={onPng}><Download size={14} /> {tr('PNG at print resolution')}</button>
        <small className="muted">{tr('The PDF is in RGB colours, which most printers convert themselves. Ask yours if they want CMYK.')}</small>
      </Section>

      <Section id="print-colours" title={tr('Brand colours in print')} defaultOpen={false}>
        <Toggle label={tr('Preview print colours (roughly)')} on={softProof} onChange={onSoftProof} />
        {brand.swatches.filter((c) => c !== '#ffffff' && c !== '#000000').map((c) => {
          const k = toCmyk(c)
          return (
            <div key={c} className="cm-print-colour">
              <span className="cm-swatch" style={{ background: c, cursor: 'default' }} />
              <span>{c.toUpperCase()}</span>
              <small className="muted">C{k.c} M{k.m} Y{k.y} K{k.k}</small>
              {printsDuller(c) && <small className="cm-print-dull">{tr('prints duller')}</small>}
            </div>
          )
        })}
        <small className="muted">{tr('Rough CMYK values worked out from the screen colours. If the brand has its own CMYK or Pantone values, use those.')}</small>
      </Section>

      <Section id="print-another" title={tr('Another print size')} defaultOpen={false}>
        {converter}
      </Section>
    </div>
  )
}
