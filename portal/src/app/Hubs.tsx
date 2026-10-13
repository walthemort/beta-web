import { Link } from 'react-router-dom'
import { ProjectCover } from '../components/ui'
import { formatDate, formatKr, useStore } from '../data/store'
import { hostingMrr } from '../data/retainers'
import { useT } from '../data/i18n'

export default function Hubs() {
  const tr = useT()
  const { state } = useStore()
  const mrr = hostingMrr(state)
  const hosted = state.projects.filter((p) => p.hubHosting && (!p.hubHosting.endMonth || p.hubHosting.endMonth >= new Date().toISOString().slice(0, 7))).length
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('One home for the finished work')}</span>
          <h1>{tr('Brand hubs')}</h1>
          <p className="muted">{tr('Each project gets a hub your client can open with one link.')}</p>
        </div>
        <div className="hosting-sum card">
          <small className="muted">{tr('Hosting income')}</small>
          <b>{formatKr(mrr)} <small className="muted">{tr('/ month')}</small></b>
          <small className="muted">{hosted === 1 ? tr('1 hub kept live') : tr('{n} hubs kept live', { n: hosted })}</small>
        </div>
      </div>
      {state.projects.length === 0 ? (
        <div className="empty"><p>{tr('Each project gets a brand hub. Create a project to start one.')}</p><Link to="/app/projects?new=1" className="btn">{tr('New project')}</Link></div>
      ) : (
      <div className="grid-cards">
        {state.projects.map((p, i) => {
          const logos = state.files.filter((f) => f.projectId === p.id && f.category === 'Logos' && f.published).length
          const { fonts, colours, updatedAt } = p.hub
          const empty = !logos && !fonts.length && !colours.length
          return (
            <Link key={p.id} to={`/app/projects/${p.id}/hub`} className="card pcard">
              <ProjectCover project={p} number={i + 1} height={170} />
              <div className="pcard-body">
                <b style={{ fontWeight: 500 }}>{p.name} {p.hubHosting && !(p.hubHosting.endMonth && p.hubHosting.endMonth < new Date().toISOString().slice(0, 7)) && <span className="pill pill-green" style={{ marginLeft: 6 }}>{tr('Hosted')}</span>}</b>
                <span className="muted" style={{ fontSize: 13 }}>
                  {empty ? tr('Nothing added yet') : tr('{logos} logos · {length} fonts · {length2} colours · Updated {x3}', { logos, length: fonts.length, length2: colours.length, x3: formatDate(updatedAt) })}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
      )}
    </>
  )
}
