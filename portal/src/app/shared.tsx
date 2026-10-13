import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { Modal, ProjectCover } from '../components/ui'
import { formatDate, formatHours, initials, stageColour, stageName, stageProgress, today, uid, useStore } from '../data/store'
import { SERVICES, type Member, type Project, type Service, type Workflow } from '../data/types'
import { canAdd } from '../data/plans'
import { LimitNote } from './Plan'
import { projectFromTemplate, proposalFromTemplate } from '../data/templates'
import { useT } from '../data/i18n'

/** A stage label in the stage’s own colour. */
export function StagePill({ stage, project }: { stage: number; project?: Pick<Project, 'workflowId'> }) {
  const tr = useT()
  const { state } = useStore()
  const c = stageColour(state, stage, project)
  return (
    <span className="pill stage-pill" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>
      <i style={{ background: c }} />
      {tr(stageName(state, stage, project))}
    </span>
  )
}

export function MemberAvatar({ member, size = 26 }: { member?: Member; size?: number }) {
  if (!member) return null
  return (
    <span
      className="avatar"
      title={`${member.name} · ${member.role}`}
      style={{ width: size, height: size, background: member.colour, color: '#fff', fontSize: size * 0.38 }}
    >
      {initials(member.name)}
    </span>
  )
}

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const tr = useT()
  const { state } = useStore()
  const members = project.memberIds.map((id) => state.team.find((m) => m.id === id)).filter(Boolean) as Member[]
  return (
    <Link to={`/app/projects/${project.id}`} className="card pcard">
      <ProjectCover project={project} number={index + 1} />
      <div className="pcard-body">
        <div className="pcard-title">
          <b>{project.name}</b>
          <StagePill stage={project.stage} project={project} />
        </div>
        <div className="progress" title={tr('{x0}% through the stages', { x0: stageProgress(project, state) })}>
          <span style={{ width: stageProgress(project, state) + '%' }} />
        </div>
        <div className="pcard-meta">
          <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <Calendar size={13} /> {formatDate(project.due)}
          </span>
          <span className="avatars">
            {members.map((m) => <MemberAvatar key={m.id} member={m} />)}
          </span>
        </div>
      </div>
    </Link>
  )
}

export const COVERS = [
  { bg: '#1a4dff', fg: '#ffffff' },
  { bg: '#141414', fg: '#faf9f6' },
  { bg: '#d9e4a0', fg: '#2f3a1c' },
  { bg: '#eab8a4', fg: '#2a1a14' },
  { bg: '#e9e6dd', fg: '#141414' },
]

/** The workflow that fits a service best, by name (“Web” for web work …), if there is one. */
export function guessWorkflow(flows: Workflow[], service?: string) {
  if (!service) return undefined
  const words: Record<string, string[]> = { Web: ['web', 'digital'], Motion: ['motion', 'film', 'video'], 'Brand identity': ['brand', 'design'], Print: ['print', 'production'], Strategy: ['brand', 'strategy'] }
  return flows.find((w) => (words[service] ?? [service.toLowerCase()]).some((k) => w.name.toLowerCase().includes(k)))
}

export function NewProjectModal({ onClose, clientId: presetClient }: { onClose: () => void; clientId?: string }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [cover, setCover] = useState(0)
  const [newClient, setNewClient] = useState(state.clients.length === 0)
  const [templateId, setTemplateId] = useState(state.projectTemplates[0]?.id ?? '')
  const [members, setMembers] = useState<string[]>([state.currentMemberId])
  const tpl = state.projectTemplates.find((t) => t.id === templateId)
  const flows = state.studio.workflows
  const [flowId, setFlowId] = useState<string | null>(null)
  // Until someone picks one, the workflow follows the template's service (a web template → the web workflow).
  const flow = flows.find((w) => w.id === flowId) ?? guessWorkflow(flows, tpl?.service) ?? flows[0]

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    let clientId = d.clientId
    if (newClient) {
      clientId = uid()
      dispatch({
        type: 'addClient',
        client: { id: clientId, name: d.clientName, contactName: d.contactName || '', contactEmail: d.contactEmail || '', contacts: [], language: d.language === 'da' ? 'da' : 'en' },
      })
    }
    const clientName = newClient ? d.clientName : state.clients.find((c) => c.id === clientId)?.name ?? ''
    const project = projectFromTemplate(tpl, {
      name: d.name,
      clientId,
      service: (tpl?.service ?? d.service) as Service,
      startDate: d.startDate || today(),
      due: d.due || undefined,
      cover: { ...COVERS[cover], wordmark: clientName || d.name },
      memberIds: members,
    })
    dispatch({ type: 'addProject', project: { ...project, workflowId: flow.id } })
    // A template with a proposal template gets its proposal drafted straight away.
    const pt = state.proposalTemplates.find((p) => p.id === tpl?.proposalTemplateId)
    if (pt) dispatch({ type: 'insert', coll: 'proposals', item: proposalFromTemplate(pt, project.id, clientName) })
    onClose()
    navigate(`/app/projects/${project.id}`)
  }

  if (!canAdd(state, 'activeProjects'))
    return (
      <Modal title={tr('New project')} onClose={onClose}>
        <LimitNote what="activeProjects" />
      </Modal>
    )

  return (
    <Modal title={tr('New project')} subtitle={tr('You can change all of this later.')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label>{tr('Start from')}</label>
          <div className="tpl-pick">
            {state.projectTemplates.map((t) => (
              <button type="button" key={t.id} className={'tpl' + (t.id === templateId ? ' on' : '')} onClick={() => setTemplateId(t.id)} aria-pressed={t.id === templateId}>
                <b>{t.name}</b>
                <small>{t.tasks.length} {tr('tasks ·')} {formatHours(t.budgetHours ?? 0)}</small>
              </button>
            ))}
            <button type="button" className={'tpl' + (!templateId ? ' on' : '')} onClick={() => setTemplateId('')} aria-pressed={!templateId}>
              <b>{tr('Blank')}</b>
              <small>{tr('Start from scratch')}</small>
            </button>
          </div>
          {tpl && <small>{tpl.description} {tr('Includes tasks with dates, a discovery questionnaire')}{tpl.proposalTemplateId ? tr(' and a draft proposal') : ''}.</small>}
        </div>
        {flows.length > 1 && (
          <div className="field">
            <label htmlFor="np-flow">{tr('Workflow')}</label>
            <select id="np-flow" className="input" value={flow.id} onChange={(e) => setFlowId(e.target.value)}>
              {flows.map((w) => <option key={w.id} value={w.id}>{tr(w.name)} – {w.stages.map((st) => tr(st.name)).join(' → ')}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="np-name">{tr('Project name')}</label>
          <input id="np-name" name="name" className="input" required placeholder={tr('e.g. NORD – Brand identity')} />
        </div>
        {newClient ? (
          <>
            <div className="field">
              <label htmlFor="np-client">{tr('Client name')}</label>
              <input id="np-client" name="clientName" className="input" required />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="np-contact">{tr('Contact person')}</label>
                <input id="np-contact" name="contactName" className="input" />
              </div>
              <div className="field">
                <label htmlFor="np-email">{tr('Contact email')}</label>
                <input id="np-email" name="contactEmail" type="email" className="input" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="np-lang">{tr('Client’s language')}</label>
              <select id="np-lang" name="language" className="input">
                <option value="en">{tr('English')}</option>
                <option value="da">{tr('Dansk')}</option>
              </select>
            </div>
          </>
        ) : (
          <div className="field">
            <label htmlFor="np-clientid">{tr('Client')}</label>
            <select id="np-clientid" name="clientId" className="input" defaultValue={presetClient}>
              {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start', marginTop: -8 }} onClick={() => setNewClient(!newClient)}>
          {newClient ? tr('Choose an existing client') : tr('+ New client')}
        </button>
        {!tpl && (
          <div className="field">
            <label htmlFor="np-service">{tr('Service')}</label>
            <select id="np-service" name="service" className="input">
              {SERVICES.map((s) => <option key={s} value={s}>{tr(s)}</option>)}
            </select>
          </div>
        )}
        <div className="form-row">
          <div className="field">
            <label htmlFor="np-start">{tr('Start date')}</label>
            <input id="np-start" name="startDate" type="date" className="input" defaultValue={today()} />
          </div>
          <div className="field">
            <label htmlFor="np-due">{tr('Due date')} <span style={{ color: 'var(--faint)' }}>{tr('(optional)')}</span></label>
            <input id="np-due" name="due" type="date" className="input" />
          </div>
        </div>
        <div className="field">
          <label>{tr('Team')}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {state.team.map((m) => {
              const on = members.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  className={'chip' + (on ? ' on' : '')}
                  aria-pressed={on}
                  onClick={() => setMembers(on ? members.filter((x) => x !== m.id) : [...members, m.id])}
                >
                  <MemberAvatar member={m} size={20} /> {m.name.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </div>
        <div className="field">
          <label>{tr('Cover colour')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {COVERS.map((c, i) => (
              <button
                key={c.bg}
                type="button"
                aria-label={tr('Cover colour {bg}', { bg: c.bg })}
                aria-pressed={cover === i}
                onClick={() => setCover(i)}
                style={{
                  width: 32, height: 32, borderRadius: 8, background: c.bg, border: '1px solid var(--line)',
                  outline: cover === i ? '2px solid var(--blue)' : 'none', outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" className="btn btn-primary">{tr('Create project')}</button>
        </div>
      </form>
    </Modal>
  )
}
