import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Logo } from '../components/ui'
import { useStore } from '../data/store'
import { useBranded } from '../data/theme'
import { hasFeature } from '../data/plans'
import { HubView } from '../features/hub'
import { HubGate } from '../features/hubExtras'
import { LangProvider, useT } from '../data/i18n'
import type { Client, Project } from '../data/types'
import './landing.css'
import './portal.css'

/** Bare brand hub for iframes on the client's intranet, Notion or website (#17). In the client's language. */
export default function EmbedHub() {
  const { id } = useParams()
  const { state } = useStore()
  const project = state.projects.find((p) => p.id === id)
  const client = state.clients.find((c) => c.id === project?.clientId)
  return (
    <LangProvider initial={client?.language ?? 'en'}>
      <Embedded project={project} client={client} studio={state.studio.name} />
    </LangProvider>
  )
}

function Embedded({ project, client, studio }: { project?: Project; client?: Client; studio: string }) {
  const t = useT()
  const { state } = useStore()
  const whiteLabel = hasFeature(state, 'whiteLabel')
  const name = client?.name ?? project?.name ?? 'Brand'
  const branded = useBranded(project?.hub.theme)
  useEffect(() => {
    document.title = `${name} ${t('brand hub')}`
  }, [name, t])

  if (!project) return <p className="muted" style={{ padding: 24 }}>{t('Brand hub not found.')}</p>
  return (
    <div className={'embed ' + branded.className} style={branded.style}>
      <HubGate project={project}>
        <h1 className="cp-h1" style={{ marginBottom: 32 }}>{client?.name} {t('brand hub')}</h1>
        <HubView project={project} />
        {!whiteLabel && <p className="embed-foot">{t('Made with')} <Logo size={13} /> {t('by')} {studio}</p>}
      </HubGate>
    </div>
  )
}
