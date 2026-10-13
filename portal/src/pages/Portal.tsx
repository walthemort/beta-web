import { APP_NAME } from '../components/brand'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Logo } from '../components/ui'
import { LangProvider, useT } from '../data/i18n'
import './landing.css'

export default function Portal() {
  const initial = typeof navigator !== 'undefined' && navigator.language.startsWith('da') ? 'da' : 'en'
  return (
    <LangProvider initial={initial}>
      <SignIn />
    </LangProvider>
  )
}

function SignIn() {
  const t = useT()
  useEffect(() => {
    document.title = `${t('Client portal')} — Aftryk`
  }, [t])
  return (
    <div className="landing portal">
      <header className="l-header">
        <Link to="/" aria-label={t('{app} home', { app: APP_NAME })}><Logo /></Link>
      </header>
      <main className="portal-main">
        <span className="eyebrow">{t('Client portal')}</span>
        <h1>
          {t('Your work,')} <span className="serif-accent">{t('together.')}</span>
        </h1>
        <p className="muted">{t('Sign in with the email your studio invited you with.')}</p>
        <Link to="/app" className="btn btn-primary btn-lg">
          {t('Sign in to your client space')} <ArrowUpRight size={18} />
        </Link>
        <small className="muted">{t('Don’t have access? Ask your studio to invite you.')}</small>
      </main>
    </div>
  )
}
