import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { formatDate, stageProgress, stagesOf, taskCount, useStore, workflowOf } from '../data/store'
import { SERVICES } from '../data/types'
import { NewProjectModal, ProjectCard, StagePill } from './shared'
import { useT } from '../data/i18n'

export default function Projects() {
  const tr = useT()
  const { state } = useStore()
  const navigate = useNavigate()
  // Filters live in the URL so a filtered view can be shared or bookmarked.
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  // "New project" from ⌘K arrives as ?new=1.
  useEffect(() => {
    if (params.get('new') === '1') {
      setCreating(true)
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }, [params, setParams])
  const [showFilters, setShowFilters] = useState(false)
  const q = params.get('q') ?? ''
  const client = params.get('client') ?? ''
  const service = params.get('service') ?? ''
  const flows = state.studio.workflows
  // With one workflow the stage filter is always there; with several, pick a workflow first.
  const workflow = flows.length > 1 ? params.get('workflow') ?? '' : flows[0].id
  const stage = workflow ? params.get('stage') ?? '' : ''
  const view = params.get('view') ?? 'cards'
  const sort = params.get('sort') ?? 'updated'
  const archived = params.get('archived') === '1'

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    v ? next.set(k, v) : next.delete(k)
    setParams(next, { replace: true })
  }

  const projects = useMemo(() => {
    const needle = q.toLowerCase()
    return state.projects
      .filter((p) => {
        const c = state.clients.find((x) => x.id === p.clientId)
        const hay = `${p.name} ${p.tagline} ${c?.name} ${c?.contactName}`.toLowerCase()
        return (
          !!p.archived === archived &&
          (!needle || hay.includes(needle)) &&
          (!client || p.clientId === client) &&
          (!service || p.service === service) &&
          (!workflow || workflowOf(state, p).id === workflow) &&
          (!stage || String(p.stage) === stage)
        )
      })
      .sort((a, b) =>
        sort === 'due' ? (a.due ?? '9999').localeCompare(b.due ?? '9999') : sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt),
      )
  }, [state, q, client, service, workflow, stage, sort, archived])

  const activeFilters = [client, service, flows.length > 1 && workflow, stage].filter(Boolean).length

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('From first idea to final file')}</span>
          <h1>{tr('Projects')}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> {tr('New project')}</button>
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={16} />
          <input className="input" placeholder={tr('Search projects, clients or contacts')} value={q} onChange={(e) => set('q', e.target.value)} aria-label={tr('Search projects')} />
        </label>
        <button className="btn filters-toggle" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
          <SlidersHorizontal size={15} /> {tr('Filters')} {activeFilters > 0 && <span className="count">{activeFilters}</span>}
        </button>
        <div className={'filter-set' + (showFilters ? ' show' : '')}>
          <select className="input" value={client} onChange={(e) => set('client', e.target.value)} aria-label={tr('Client')}>
            <option value="">{tr('All clients')}</option>
            {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={service} onChange={(e) => set('service', e.target.value)} aria-label={tr('Service')}>
            <option value="">{tr('All services')}</option>
            {SERVICES.map((s) => <option key={s} value={s}>{tr(s)}</option>)}
          </select>
          {flows.length > 1 && (
            <select
              className="input"
              value={workflow}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                e.target.value ? next.set('workflow', e.target.value) : next.delete('workflow')
                next.delete('stage')
                setParams(next, { replace: true })
              }}
              aria-label={tr('Workflow')}
            >
              <option value="">{tr('All workflows')}</option>
              {flows.map((w) => <option key={w.id} value={w.id}>{tr(w.name)}</option>)}
            </select>
          )}
          {workflow && (
            <select className="input" value={stage} onChange={(e) => set('stage', e.target.value)} aria-label={tr('Stage')}>
              <option value="">{tr('All stages')}</option>
              {stagesOf(state, { workflowId: workflow }).map((s, i) => <option key={s.id} value={i}>{tr(s.name)}</option>)}
            </select>
          )}
          <select className="input" value={sort} onChange={(e) => set('sort', e.target.value)} aria-label={tr('Sort by')}>
            <option value="updated">{tr('Recently updated')}</option>
            <option value="due">{tr('Due date')}</option>
            <option value="name">{tr('Name A–Z')}</option>
          </select>
        </div>
        <div className="seg" role="group" aria-label={tr('View')}>
          <button aria-pressed={view === 'cards'} onClick={() => set('view', '')}><LayoutGrid size={14} /> {tr('Cards')}</button>
          <button aria-pressed={view === 'table'} onClick={() => set('view', 'table')}><List size={14} /> {tr('Table')}</button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: -16 }}>
        {projects.length} {tr('of')} {state.projects.filter((p) => !!p.archived === archived).length} {archived ? tr('archived ') : ''}{tr('projects ·')}{' '}
        <button className="link-btn" onClick={() => set('archived', archived ? '' : '1')}>
          {archived ? tr('Back to active projects') : tr('Show archived ({length})', { length: state.projects.filter((p) => p.archived).length })}
        </button>
      </p>

      {projects.length === 0 ? (
        <div className="empty">
          <p>{tr('No projects match these filters.')}</p>
          <button className="btn" onClick={() => setParams({}, { replace: true })}>{tr('Clear filters')}</button>
        </div>
      ) : view === 'cards' ? (
        <div className="grid-cards">
          {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table stack">
            <thead>
              <tr>
                <th>{tr('Project')}</th><th>{tr('Client')}</th><th>{tr('Stage')}</th><th>{tr('Service')}</th><th>{tr('Due')}</th><th>{tr('Progress')}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const c = state.clients.find((x) => x.id === p.clientId)
                return (
                  <tr key={p.id} onClick={() => navigate(`/app/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="wide">
                      <Link to={`/app/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="cell-title">
                        <b style={{ fontWeight: 500 }}>{p.name}</b>
                        {p.tagline && <small>{p.tagline}</small>}
                      </Link>
                    </td>
                    <td data-label={tr('Client')}>{c?.name}</td>
                    <td><StagePill stage={p.stage} project={p} /></td>
                    <td data-label={tr('Service')}>{tr(p.service)}</td>
                    <td data-label={tr('Due')}>{formatDate(p.due)}</td>
                    <td className="wide">
                      <div className="cell-progress">
                        <div className="progress"><span style={{ width: stageProgress(p, state) + '%' }} /></div>
                        <span>{stageProgress(p, state)}% · {taskCount(p)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </>
  )
}
