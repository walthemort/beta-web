/**
 * Apps: extra tools that run on a client's brand hub. Pro picks three, Studio has them all. This
 * page is laid out like an app store – a featured app, the apps by what they're for, a sheet with
 * the details – and switches them on and off. AppGate stands in front of an app that isn't on.
 */
import { APP_NAME } from '../components/brand'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Blocks, Check, Lock, Sparkles } from 'lucide-react'
import { APP_COLOURS, AppIcon } from './appIcons'
import { Modal } from '../components/ui'
import { useStore } from '../data/store'
import type { AppId } from '../data/types'
import { useT } from '../data/i18n'
import { APPS, APP_CATEGORIES, appInfo, type AppInfo } from '../data/apps'
import { appSlots, hasApp, planOf } from '../data/plans'
import './app.css'

/** Switching apps on and off, within the plan's slots. */
export function useApps() {
  const { state, dispatch } = useStore()
  const slots = appSlots(state)
  const plan = planOf(state)
  const set = (apps: AppId[]) => dispatch({ type: 'updateStudio', patch: { apps } })
  return {
    slots,
    plan,
    on: (id: AppId) => hasApp(state, id),
    canTurnOn: (id: AppId) => !hasApp(state, id) && slots.left > 0,
    turnOn: (id: AppId) => {
      if (hasApp(state, id) || slots.left <= 0) return
      set([...slots.on, id])
      dispatch({ type: 'log', log: { text: `App turned on: ${appInfo(id).name}` } })
    },
    turnOff: (id: AppId) => set(slots.on.filter((x) => x !== id)),
  }
}

export default function Apps() {
  const tr = useT()
  const { slots, plan } = useApps()
  const [open, setOpen] = useState<AppId | null>(null)
  const all = slots.limit === Infinity
  const featured = appInfo('mockups')
  return (
    <div className="store">
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('Apps')}</span>
          <h1>{tr('Apps for your clients’ brands')}</h1>
        </div>
        <span className="store-plan">
          {all ? <><Check size={14} /> {tr('Every app is included in {plan}', { plan: tr(plan.name) })}</> : slots.limit === 0 ? <Link to="/app/settings/plan?highlight=pro"><Sparkles size={14} /> {tr('Apps come with Pro and Studio')}</Link> : <>{tr('{used} of {limit} apps chosen', { used: slots.on.length, limit: slots.limit })} · <Link to="/app/settings/plan?highlight=studio">{tr('Studio has every app')}</Link></>}
        </span>
      </div>

      <button className="store-feature" onClick={() => setOpen(featured.id)} style={{ background: `linear-gradient(120deg, ${APP_COLOURS.mockups[0]}, ${APP_COLOURS.mockups[1]} 55%, #7a2e1a)` }}>
        <span className="store-feature-text">
          <span className="store-feature-tag">{tr('New')}</span>
          <strong>{tr('Mockups in 3D')}</strong>
          <span>{tr('Business cards, posters, phones and mugs you can turn in your hand – then design them in the right size.')}</span>
        </span>
        <AppIcon id="mockups" size={96} />
      </button>

      {APP_CATEGORIES.map((c) => (
        <section key={c.id} className="store-section">
          <h2>{tr(c.name)}</h2>
          <div className="store-list">
            {APPS.filter((a) => a.category === c.id).map((a) => <AppRow key={a.id} app={a} onOpen={() => setOpen(a.id)} />)}
          </div>
        </section>
      ))}

      {open && <AppSheet app={appInfo(open)} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** The round button an app gets: Open when it's on, Get when there's room, a lock when there isn't. */
function AppButton({ app, big }: { app: AppInfo; big?: boolean }) {
  const tr = useT()
  const { slots, on, turnOn } = useApps()
  if (on(app.id)) return <Link className={'store-get on' + (big ? ' big' : '')} to={app.to} onClick={(e) => e.stopPropagation()}>{tr('Open')}</Link>
  if (slots.left > 0)
    return <button className={'store-get' + (big ? ' big' : '')} onClick={(e) => { e.stopPropagation(); turnOn(app.id) }}>{tr('Get')}</button>
  return <Link className={'store-get locked' + (big ? ' big' : '')} to={`/app/settings/plan?highlight=${slots.limit === 0 ? 'pro' : 'studio'}`} onClick={(e) => e.stopPropagation()}><Lock size={12} /> {slots.limit === 0 ? 'Pro' : 'Studio'}</Link>
}

function AppRow({ app, onOpen }: { app: AppInfo; onOpen: () => void }) {
  const tr = useT()
  return (
    <div className="store-row" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}>
      <AppIcon id={app.id} />
      <span className="store-row-text">
        <b>{tr(app.name)}</b>
        <small>{tr(app.tagline)}</small>
      </span>
      <AppButton app={app} />
    </div>
  )
}

/** The product page: the icon, what it does, and the button. */
function AppSheet({ app, onClose }: { app: AppInfo; onClose: () => void }) {
  const tr = useT()
  const { slots, on, turnOff } = useApps()
  const chosen = slots.on.includes(app.id)
  return (
    <Modal title={tr(app.name)} onClose={onClose}>
      <div className="store-sheet">
        <div className="store-sheet-head">
          <AppIcon id={app.id} size={84} />
          <div>
            <span className="eyebrow">{tr(APP_CATEGORIES.find((c) => c.id === app.category)!.name)}</span>
            <p>{tr(app.tagline)}</p>
            <AppButton app={app} big />
          </div>
        </div>
        <ul>
          {app.points.map((p) => <li key={p}><Check size={16} /> {tr(p)}</li>)}
        </ul>
        {on(app.id) && chosen && slots.limit !== Infinity && <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => { turnOff(app.id); onClose() }}>{tr('Turn off')}</button>}
      </div>
    </Modal>
  )
}

/** In front of an app that isn't on: what it does, and how to get it. */
export function AppGate({ id, children }: { id: AppId; children: ReactNode }) {
  const tr = useT()
  const { on, slots, turnOn } = useApps()
  if (on(id)) return <>{children}</>
  const a = appInfo(id)
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('App')}</span>
          <h1>{tr(a.name)}</h1>
          <p className="muted">{tr(a.tagline)}</p>
        </div>
      </div>
      <section className="card app-gate">
        <AppIcon id={id} size={72} />
        <ul>
          {a.points.map((p) => <li key={p}><Check size={16} /> {tr(p)}</li>)}
        </ul>
        <div className="app-gate-actions">
          {slots.left > 0 ? (
            <>
              <button className="btn btn-primary" onClick={() => turnOn(id)}><Blocks size={16} /> {tr('Turn on {app}', { app: tr(a.name) })}</button>
              <small className="muted">{slots.limit === Infinity ? '' : tr('Uses 1 of your {n} app slots – {left} left.', { n: slots.limit, left: slots.left })}</small>
            </>
          ) : slots.limit === 0 ? (
            <>
              <Link className="btn btn-primary" to="/app/settings/plan?highlight=pro"><Sparkles size={16} /> {tr('Get apps with Pro')}</Link>
              <small className="muted">{tr('Pro: pick 3 apps. Studio: every app. Free to try while {app} is in beta.', { app: APP_NAME })}</small>
            </>
          ) : (
            <>
              <Link className="btn btn-primary" to="/app/apps">{tr('Choose your apps')}</Link>
              <small className="muted">{tr('Your {n} app slots are in use. Turn one off, or move to Studio for every app.', { n: slots.limit })}</small>
            </>
          )}
        </div>
      </section>
    </>
  )
}
