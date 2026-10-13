import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Logo } from '../components/ui'
import { useStore } from '../data/store'
import { StatusGrid } from '../app/Workflow'
import { StudioBrand, useBranded } from './ClientPortal'
import { LangProvider, activeLang, dateLocale, useT } from '../data/i18n'
import '../app/app.css'
import './landing.css'
import './portal.css'

/**
 * Read-only status board for a team or partner (e.g. a sales team). Updates live in other tabs on
 * this computer now; across devices once Aftryk has a server.
 */
export default function ShareBoard() {
  const { state } = useStore()
  const owner = state.team.find((m) => m.role === 'Owner') ?? state.team[0]
  return (
    <LangProvider lang={owner?.lang ?? 'en'}>
      <Board />
    </LangProvider>
  )
}

function Board() {
  const { token } = useParams()
  const { state } = useStore()
  const t = useT()
  const valid = !!token && token === state.studio.boardShareToken
  const branded = useBranded()
  useEffect(() => {
    document.title = `${state.studio.name} — ${t('status')}`
  }, [state.studio.name, t])

  if (!valid)
    return (
      <div className="landing portal">
        <header className="l-header"><Logo /></header>
        <main className="portal-main"><h1>{t('This link isn’t active.')}</h1><p className="muted">{t('Ask the studio for a new one.')}</p></main>
      </div>
    )

  return (
    <div className={'cp share-board ' + branded.className} style={branded.style}>
      <header className="cp-head">
        <span className="cp-brand"><StudioBrand /> <span className="muted">· {t('Status')}</span></span>
        <span className="muted" style={{ fontSize: 12 }}>{t('Updated')} {new Date().toLocaleTimeString(dateLocale(activeLang()), { hour: '2-digit', minute: '2-digit' })}</span>
      </header>
      <main className="cp-main">
        <StatusGrid projects={state.projects.filter((p) => !p.archived)} />
      </main>
    </div>
  )
}
