import { APP_NAME } from '../components/brand'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FolderOpen, Sparkles } from 'lucide-react'
import { Logo } from '../components/ui'
import { WORKFLOW_PRESETS, workflowFrom } from '../data/workflows'
import { PLANS, isPlanId, type PlanId } from '../data/plans'
import { COUNTRIES, countryOf, guessCountry } from '../data/countries'
import { ACCENT_PAIRS, AccentPairPicker, LogoSlot, PortalPreview, type BrandLook } from '../features/brandKit'
import { useStore } from '../data/store'
import type { Lang } from '../data/types'
import './landing.css'
import './portal.css'
import { LangProvider, LangSwitch, useLang, useT } from '../data/i18n'

/** First-time setup for a new studio. Existing studios never see this. Starts in the browser's language. */
export default function Setup() {
  const [lang, setLang] = useState<Lang>(() => (typeof navigator !== 'undefined' && navigator.language.startsWith('da') ? 'da' : 'en'))
  return (
    <LangProvider lang={lang} onChange={setLang}>
      <SetupSteps />
    </LangProvider>
  )
}

function SetupSteps() {
  const tr = useT()
  const { lang } = useLang()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  // “Start with Pro” on the front page arrives as ?plan=pro.
  const [params] = useSearchParams()
  const plan = isPlanId(params.get('plan')) ? (params.get('plan') as PlanId) : undefined
  const [wasSetUp] = useState(state.studio.setupDone)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState(guessCountry)
  const [look, setLook] = useState<BrandLook>({ accent: ACCENT_PAIRS[0].accent })
  // Studios often do more than one kind of work: each ticked preset becomes a workflow.
  const [picked, setPicked] = useState<string[]>([WORKFLOW_PRESETS[0].id])
  const [other, setOther] = useState<string | null>(null)
  useEffect(() => {
    document.title = tr('Set up your studio — {app}', { app: APP_NAME })
  }, [tr])

  // Arriving already set up: a plan link goes to the plans, anything else to the workspace.
  // (Finishing setup here goes to the workspace – see finish().)
  if (state.studio.setupDone) return <Navigate to={plan && plan !== 'free' && wasSetUp ? `/app/settings/plan?highlight=${plan}` : '/app'} replace />

  const steps = ['Your studio', 'Your look', 'How you work', 'Start']
  const flows = [
    ...WORKFLOW_PRESETS.filter((p) => picked.includes(p.id)).map((p) => ({ ...workflowFrom(p), name: tr(p.name) })),
    ...(other?.trim() ? [workflowFrom({ name: other.trim() })] : []),
  ]
  const canNext = step === 0 ? !!name.trim() && !!owner.trim() : step === 2 ? flows.length > 0 : true
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  function finish(sample: boolean) {
    dispatch({
      type: 'completeSetup',
      sample,
      lang,
      studio: {
        name: name.trim(),
        owner: owner.trim(),
        email: email.trim() || state.studio.email,
        brand: { ...state.studio.brand, ...look },
        workflows: flows,
        country,
      },
    })
    // A plan picked on the front page opens its checkout; everyone else starts on Free.
    navigate(plan && plan !== 'free' ? `/app/settings/plan?checkout=${plan}` : '/app', { replace: true })
  }

  return (
    <div className="cp onboarding setup">
      <header className="cp-head"><Logo /><span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{tr('Takes about a minute')}</span><LangSwitch /></header>
      <ol className="ob-steps">
        {steps.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''}>
            <span>{i < step ? <Check size={12} /> : i + 1}</span> {tr(s)}
          </li>
        ))}
      </ol>
      <main className="ob-main card">
        {step === 0 && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (canNext) setStep(1) }}>
            <h1 className="cp-h1">{tr('Welcome to {app}.', { app: APP_NAME })}</h1>
            <p className="muted">{tr('Let’s set up your studio. You can change everything later in Settings.')}</p>
            <div className="field"><label htmlFor="su-name">{tr('Studio name')}</label><input id="su-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('e.g. Studio Nord')} /></div>
            <div className="form-row">
              <div className="field"><label htmlFor="su-owner">{tr('Your name')}</label><input id="su-owner" className="input" value={owner} onChange={(e) => setOwner(e.target.value)} autoComplete="name" /></div>
              <div className="field"><label htmlFor="su-email">{tr('Studio email')}</label><input id="su-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            </div>
            <div className="field">
              <label htmlFor="su-country">{tr('Where is the studio based?')}</label>
              <select id="su-country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{tr(c.name)}</option>)}
              </select>
              <small>{tr('{app}’s prices are shown in {currency}.', { app: APP_NAME, currency: countryOf(country).currency.toUpperCase() })}</small>
            </div>
            <button type="submit" hidden />
          </form>
        )}

        {step === 1 && (
          <div className="form">
            <h2>{tr('Your look')}</h2>
            <p className="muted">{tr('Clients see your logo and colour in their portal, proposals and brand hubs. Some of them use dark mode, so pick a version for each.')}</p>
            <div className="field">
              <label>{tr('Logo')}</label>
              <div className="brand-grid">
                <LogoSlot tone="light" src={look.logoSrc} onChange={(logoSrc) => setLook({ ...look, logoSrc })} label={tr('On light')} hint={tr('Your main logo')} />
                <LogoSlot tone="dark" src={look.logoDarkSrc} fallback={look.logoSrc} onChange={(logoDarkSrc) => setLook({ ...look, logoDarkSrc })} label={tr('On dark')} hint={tr('Optional – e.g. a white version')} />
              </div>
            </div>
            <div className="field">
              <label>{tr('Accent colour')}</label>
              <AccentPairPicker value={look} onChange={(v) => setLook({ ...look, ...v })} />
            </div>
            <div className="brand-grid">
              <PortalPreview tone="light" look={look} name={name} />
              <PortalPreview tone="dark" look={look} name={name} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form">
            <h2>{tr('How do you work?')}</h2>
            <p className="muted">{tr('Pick everything you do – each becomes a workflow with its own stages, and every project follows one of them. You can rename, recolour and add stages any time.')}</p>
            <div className="preset-list">
              {WORKFLOW_PRESETS.map((p) => {
                const on = picked.includes(p.id)
                return (
                  <button key={p.id} type="button" className={'preset' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggle(p.id)}>
                    <span className="preset-head"><span className={'preset-tick' + (on ? ' on' : '')}>{on && <Check size={12} />}</span><b>{tr(p.studio)}</b><small>{tr(p.hint)}</small></span>
                    <span className="preset-stages">
                      {p.stages.map((s) => <span key={s.id} style={{ background: s.colour }}>{tr(s.name)}</span>)}
                    </span>
                  </button>
                )
              })}
              <div className={'preset' + (other !== null ? ' on' : '')}>
                <button type="button" className="preset-head preset-other" aria-pressed={other !== null} onClick={() => setOther(other === null ? '' : null)}>
                  <span className={'preset-tick' + (other !== null ? ' on' : '')}>{other !== null && <Check size={12} />}</span>
                  <b>{tr('Something else')}</b><small>{tr('Start with simple stages and name them your way')}</small>
                </button>
                {other !== null && (
                  <input className="input" autoFocus placeholder={tr('What do you call this kind of work? E.g. Events, Print, SoMe')} value={other} onChange={(e) => setOther(e.target.value)} />
                )}
              </div>
            </div>
            {flows.length > 1 && <p className="muted" style={{ fontSize: 13 }}>{tr('{n} workflows. You pick one when you create a project.', { n: flows.length })}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="form">
            <h2>{tr('How would you like to start?')}</h2>
            {plan && plan !== 'free' && (
              <p className="muted">{tr('Next, you’ll start {plan}. It’s free while {app} is in beta.', { app: APP_NAME, plan: tr(PLANS.find((p) => p.id === plan)!.name) })}</p>
            )}
            <div className="start-choice">
              <button type="button" className="preset" onClick={() => finish(false)}>
                <FolderOpen size={22} />
                <b>{tr('Empty workspace')}</b>
                <small>{tr('Start with your own clients and projects. Templates are included.')}</small>
              </button>
              <button type="button" className="preset" onClick={() => finish(true)}>
                <Sparkles size={22} />
                <b>{tr('Explore with sample projects')}</b>
                <small>{tr('Three example clients with proposals, files and brand hubs. Remove them anytime in Settings → Data.')}</small>
              </button>
            </div>
          </div>
        )}

        {step < 3 && (
          <div className="ob-nav">
            {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> {tr('Back')}</button> : <span />}
            <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>{tr('Next')} <ArrowRight size={15} /></button>
          </div>
        )}
      </main>
    </div>
  )
}
