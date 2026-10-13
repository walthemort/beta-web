/** In the hub editor: how ready the logo files are, and the one-click pack for the client. */
import { useState } from 'react'
import { AlertCircle, Check, Package } from 'lucide-react'
import { useStore } from '../data/store'
import { useT } from '../data/i18n'
import { healthScore, logoHealth } from './fileHealth'
import { hasFeature } from '../data/plans'
import { buildLogoPack, packName } from './logoPack'
import type { Project, StudioFile } from '../data/types'

export function LogoTools({ project }: { project: Project }) {
  const tr = useT()
  const { state } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const files = state.files.filter((f) => f.projectId === project.id)
  const logos = files.filter((f) => f.category === 'Logos')
  const checks = logoHealth(files)
  const score = healthScore(checks)
  const client = state.clients.find((c) => c.id === project.clientId)?.name ?? project.name
  // A vector master makes the best pack; otherwise the biggest raster file will do.
  const master =
    logos.find((f) => /\.svg$/i.test(f.name)) ??
    [...logos].sort((a, b) => (b.versions.at(-1)?.size ?? 0) - (a.versions.at(-1)?.size ?? 0))[0]

  async function makePack(file: StudioFile) {
    const version = file.versions.at(-1)
    if (!version) return
    setBusy(file.id)
    setError(null)
    try {
      const zip = await buildLogoPack({ name: file.name, src: version.src, mime: version.mime }, { client, studio: state.studio.name, whiteLabel: hasFeature(state, 'whiteLabel') })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(zip)
      a.download = `${packName(client)}.zip`
      a.click()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card panel">
      <div className="section-head" style={{ margin: 0 }}>
        <h3>{tr('Ready to hand over?')}</h3>
        <span className="muted" style={{ fontSize: 13 }}>{tr('{passed} of {total}', { passed: score.passed, total: score.total })}</span>
      </div>
      <ul className="health">
        {checks.map((c) => (
          <li key={c.id} className={c.ok ? 'ok' : 'todo'}>
            {c.ok ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>
              {tr(c.label)}
              {!c.ok && c.hint && <small>{tr(c.hint)}</small>}
            </span>
          </li>
        ))}
      </ul>
      {master && (
        <>
          <button className="btn" style={{ justifySelf: 'start' }} disabled={!!busy} onClick={() => makePack(master)}>
            <Package size={15} /> {busy ? tr('Building…') : tr('Build the logo pack')}
          </button>
          <small className="muted">
            {tr('PNGs at 1×, 2× and 3×, favicon, app icons and a square social avatar – made from {name}.', { name: master.name })}
          </small>
        </>
      )}
      {error && <small className="error">{error}</small>}
    </section>
  )
}
