/** A page made with Pages, as visitors see it: /site/<slug>. In the language of the client. */
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { now, useStore } from '../data/store'
import { LangProvider } from '../data/i18n'
import { PageView } from '../features/apps/pages/PageView'

export default function Site() {
  const { slug } = useParams()
  const { state, dispatch } = useStore()
  const page = state.webPages.find((p) => p.slug === slug && p.published)
  const project = state.projects.find((p) => p.id === page?.projectId)
  const client = state.clients.find((c) => c.id === project?.clientId)

  useEffect(() => {
    if (!page) return
    document.title = page.title
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = page.description ?? ''
    // One view per visit.
    try {
      const key = `formlar-view-${page.id}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* Private windows can refuse storage – count the view anyway. */
    }
    dispatch({ type: 'update', coll: 'webPages', id: page.id, fn: (p) => ({ ...p, views: (p.views ?? 0) + 1 }) })
  }, [page?.id])

  if (!page || !project)
    return (
      <div className="pg-missing">
        <p>This page isn’t online. · Siden er ikke online.</p>
      </div>
    )
  return (
    <LangProvider lang={client?.language ?? 'en'}>
      <PageView
        page={page}
        project={project}
        onSignup={(email) => dispatch({ type: 'update', coll: 'webPages', id: page.id, fn: (p) => ({ ...p, signups: [...(p.signups ?? []).filter((s) => s.email !== email), { email, at: now() }] }) })}
      />
    </LangProvider>
  )
}
