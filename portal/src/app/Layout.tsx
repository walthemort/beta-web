import { APP_NAME } from '../components/brand'
import { Fragment, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { Inbox, FolderKanban, Users, Wallet, Palette, PanelLeft, Settings, Search, Keyboard, Languages, ChevronsUpDown, SunMoon, Sun, Moon, Monitor, Blocks, ChevronDown, Plus } from 'lucide-react'
import { useTheme } from '../data/theme'
import { Logo } from '../components/ui'
import { Tabs } from '../components/kit'
import { useStore, useCurrentMember, today, initials, backupReminder, useDownloadBackup } from '../data/store'
import type { AppId, State } from '../data/types'
import { APPS } from '../data/apps'
import { AppIcon } from './appIcons'
import { useSyncLabel } from '../features/cloud/CloudSettings'
import { hasApp } from '../data/plans'
import { inboxItems } from './inbox'
import { PlanBadge } from './Plan'
import { MemberAvatar } from './shared'
import { TimerWidget } from '../features/time'
import { NotificationBell } from './Notifications'
import { CommandPalette } from './CommandPalette'
import { ShortcutsHelp, shortcutFor, useShortcuts } from './Shortcuts'
import { ErrorBoundary } from '../components/ErrorBoundary'
import './app.css'
import { LangProvider, LangSwitch, useT } from '../data/i18n'

type Tab = { to: string; label: string; badge?: number; end?: boolean }
type Section = { to: string; label: string; icon: typeof Settings; count?: number; hot?: boolean; match: (path: string) => boolean; tabs?: Tab[] }
type Counts = { inbox: number; myOverdue: number; live: number; needsReview: number; openLeads: number; openInvoices: number; apps: AppId[] }

const under = (...prefixes: string[]) => (path: string) => prefixes.some((x) => path === x || path.startsWith(x + '/'))

/**
 * Five places to go. Each one groups the pages that belong together as tabs, so the sidebar
 * stays short and related views (a list, its board, its calendar) sit side by side.
 */
export const SECTIONS = (c: Counts): Section[] => [
  {
    to: '/app', label: 'Home', icon: Inbox, count: c.inbox, hot: c.inbox > 0, match: (p) => p === '/app' || p === '/app/' || p === '/app/tasks',
    tabs: [{ to: '/app', label: 'Inbox', end: true, badge: c.inbox }, { to: '/app/tasks', label: 'My tasks', badge: c.myOverdue }],
  },
  {
    to: '/app/projects', label: 'Projects', icon: FolderKanban, count: c.live, match: under('/app/projects', '/app/board', '/app/calendar', '/app/documents'),
    tabs: [
      { to: '/app/projects', label: 'All projects' },
      { to: '/app/board', label: 'Board' },
      { to: '/app/calendar', label: 'Calendar', end: true },
      ...(c.apps.includes('socialPlanner') ? [{ to: '/app/calendar/social', label: 'Content plan' }] : []),
      { to: '/app/documents', label: 'Documents & review', badge: c.needsReview },
    ],
  },
  {
    to: '/app/clients', label: 'Clients', icon: Users, count: c.openLeads, match: under('/app/clients', '/app/sales'),
    tabs: [
      { to: '/app/clients', label: 'Clients' },
      { to: '/app/sales', label: 'Pipeline', end: true, badge: c.openLeads },
      { to: '/app/sales/find', label: 'Find leads' },
    ],
  },
  {
    to: '/app/invoices', label: 'Money & time', icon: Wallet, count: c.openInvoices, match: under('/app/invoices', '/app/reports', '/app/capacity'),
    tabs: [
      { to: '/app/invoices', label: 'Invoices', badge: c.openInvoices },
      { to: '/app/reports', label: 'Reports' },
      { to: '/app/capacity', label: 'Capacity' },
    ],
  },
  { to: '/app/hubs', label: 'Brand hubs', icon: Palette, match: under('/app/hubs') },
  {
    to: '/app/apps', label: 'Apps', icon: Blocks, match: under('/app/apps', ...APPS.filter((a) => a.id !== 'socialPlanner').map((a) => a.to)),
    tabs: [
      { to: '/app/apps', label: 'All apps' },
      // The Social Planner lives in the calendar (Projects → Content plan).
      ...APPS.filter((a) => c.apps.includes(a.id) && a.id !== 'socialPlanner').map((a) => ({ to: a.to, label: a.name })),
    ],
  },
  { to: '/app/settings', label: 'Settings', icon: Settings, match: under('/app/settings') },
]

/** The shape of a page while its code loads, so the screen never flashes empty. */
function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <div className="page-loading" />
      <i style={{ width: 120, height: 10 }} />
      <i style={{ width: '40%', height: 34 }} />
      <i style={{ height: 110 }} />
      <i style={{ height: 220 }} />
    </div>
  )
}

/** The last breadcrumb on pages that aren't a tab, e.g. a project's name. */
function crumbFor(path: string, s: State) {
  const project = path.match(/^\/app\/projects\/([^/]+)/)?.[1]
  if (project) return s.projects.find((p) => p.id === project)?.name ?? 'Project'
  return ''
}

const THEME_LABEL = { auto: 'Same as my device', light: 'Light', dark: 'Dark' } as const

/** Who you are, your language and the shortcuts – tucked into one menu at the bottom of the sidebar. */
function ProfileMenu({ onShortcuts }: { onShortcuts: () => void }) {
  const tr = useT()
  const { state, dispatch } = useStore()
  const me = useCurrentMember()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div className="profile" ref={ref}>
      {open && (
        <div className="profile-pop card" role="menu">
          <label className="profile-row">
            <span className="muted">{tr('Signed in as')}</span>
            <select className="input input-sm" value={me.id} onChange={(e) => dispatch({ type: 'setCurrentMember', id: e.target.value })} aria-label={tr('Switch team member')}>
              {state.team.map((m) => <option key={m.id} value={m.id}>{m.name} · {tr(m.role)}</option>)}
            </select>
          </label>
          <div className="profile-row side-lang">
            <Languages size={16} strokeWidth={1.75} /> <span>{tr('Language')}</span>
            <LangSwitch />
          </div>
          <div className="profile-row side-lang">
            <SunMoon size={16} strokeWidth={1.75} /> <span>{tr('Theme')}</span>
            <div className="seg" role="group" aria-label={tr('Theme')}>
              {(['auto', 'light', 'dark'] as const).map((th) => (
                <button key={th} aria-pressed={(me.theme ?? 'auto') === th} onClick={() => dispatch({ type: 'update', coll: 'team', id: me.id, fn: (m) => ({ ...m, theme: th }) })} title={tr(THEME_LABEL[th])}>
                  {th === 'auto' ? <Monitor size={12} /> : th === 'light' ? <Sun size={12} /> : <Moon size={12} />}
                </button>
              ))}
            </div>
          </div>
          <button className="side-link side-shortcuts" onClick={() => { setOpen(false); onShortcuts() }}>
            <Keyboard size={16} strokeWidth={1.75} /> <span>{tr('Shortcuts')}</span> <kbd>?</kbd>
          </button>
        </div>
      )}
      <button className="me" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <MemberAvatar member={me} />
        <span><b>{me.name}</b><small>{tr(me.role)}</small></span>
        <ChevronsUpDown size={14} className="muted" style={{ marginLeft: 'auto' }} />
      </button>
    </div>
  )
}

/** The studio app in each member's own language (switch in the sidebar). */
/** The apps that are on, each in its own colour – and a way to get more. */
function SideApps({ apps, path }: { apps: AppId[]; path: string }) {
  const tr = useT()
  return (
    <div className="side-apps">
      <Link to="/app/apps" className={'side-app more' + (path === '/app/apps' ? ' active' : '')} aria-current={path === '/app/apps' ? 'page' : undefined}>
        <span className="side-app-more"><Plus size={12} strokeWidth={2.2} /></span>
        <span>{tr('Get more apps')}</span>
      </Link>
      {APPS.filter((a) => apps.includes(a.id)).map((a) => {
        const active = path === a.to || path.startsWith(a.to + '/')
        return (
          <Link key={a.id} to={a.to} className={'side-app' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined}>
            <AppIcon id={a.id} size={20} />
            <span>{tr(a.name)}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default function Layout() {
  const { dispatch } = useStore()
  const me = useCurrentMember()
  return (
    <LangProvider lang={me?.lang ?? 'en'} onChange={(lang) => me && dispatch({ type: 'update', coll: 'team', id: me.id, fn: (m) => ({ ...m, lang }) })}>
      <Workspace />
    </LangProvider>
  )
}

function Workspace() {
  const tr = useT()
  const { state, dispatch, storage } = useStore()
  const me = useCurrentMember()
  useTheme(me?.theme, { remember: true })
  const storageFull = storage.bytes / storage.limit
  const backupDays = backupReminder(state)
  const downloadBackup = useDownloadBackup()
  const [open, setOpen] = useState(false)
  // The apps under "Apps" in the sidebar: open unless someone folded them away (remembered here).
  const [appsOpen, setAppsOpen] = useState(() => {
    try {
      return localStorage.getItem('formlar:side-apps') !== 'closed'
    } catch {
      return true
    }
  })
  const toggleApps = () =>
    setAppsOpen((o) => {
      try {
        localStorage.setItem('formlar:side-apps', o ? 'closed' : 'open')
      } catch {
        /* private windows can refuse – it just won't be remembered */
      }
      return !o
    })
  const [palette, setPalette] = useState(false)
  const loc = useLocation()
  const shortcuts = useShortcuts()
  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // New studios go through the first-time setup before the workspace.
  if (!state.studio.setupDone) return <Navigate to="/setup" replace />

  const needsReview = [...state.files, ...state.decks].filter((x) => x.status === 'Changes requested' || x.comments.some((c) => c.fromClient && !c.resolved)).length
  const openInvoices = state.invoices.filter((i) => i.status === 'Issued').length
  const openLeads = state.leads.filter((l) => l.stage !== 'Won' && l.stage !== 'Lost').length
  const myOverdue = state.projects.filter((p) => !p.archived).flatMap((p) => p.tasks).filter((t) => !t.done && t.assigneeId === me.id && t.due && t.due < today()).length
  const live = state.projects.filter((p) => !p.archived)
  const inbox = inboxItems(state, me).length

  const installed = APPS.map((a) => a.id).filter((id) => hasApp(state, id))
  const sync = useSyncLabel()
  const sections = SECTIONS({ inbox, myOverdue, live: live.length, needsReview, openLeads, openInvoices, apps: installed })
  const section = sections.find((x) => x.match(loc.pathname))
  const tab = section?.tabs?.find((t) => loc.pathname === t.to)
  // Second breadcrumb: the tab, or e.g. the project's name. Settings pages have their own tabs.
  const last = section && section.to !== loc.pathname ? (tab ? tr(tab.label) : crumbFor(loc.pathname, state)) : ''

  return (
    <div className={'shell' + (open ? ' nav-open' : '')}>
      <aside className="side" aria-label={tr('Workspace navigation')}>
        <div className="side-top">
          <Link to="/" aria-label={tr('{app} home', { app: APP_NAME })}><Logo size={24} /></Link>
        </div>
        <div className="studio-chip">
          <span className="studio-mark">{initials(state.studio.name)}</span>
          <span><b>{state.studio.name}</b><small>{tr('Studio workspace')}</small></span>
          {sync && <Link to="/app/settings/cloud" className={'sync-dot ' + sync.tone} title={sync.text} aria-label={sync.text} />}
          <PlanBadge />
        </div>
        <nav className="side-nav">
          {sections.filter((x) => x.to !== '/app/settings').map(({ to, label, icon: Icon, count, hot, match }) =>
            // "Apps" folds its list of apps open and shut; the store is inside, under "Get more apps".
            to === '/app/apps' ? (
              <Fragment key={to}>
                <button className={'side-link side-link-fold' + (match(loc.pathname) && !appsOpen ? ' active' : '')} aria-expanded={appsOpen} onClick={toggleApps}>
                  <Icon size={16} strokeWidth={1.75} />
                  <span>{tr(label)}</span>
                  <ChevronDown size={14} className="side-fold" />
                </button>
                {appsOpen && <SideApps apps={installed} path={loc.pathname} />}
              </Fragment>
            ) : (
              <Link key={to} to={to} className={'side-link' + (match(loc.pathname) ? ' active' : '')} aria-current={match(loc.pathname) ? 'page' : undefined} title={shortcutFor(to) && `${tr(label)} (${shortcutFor(to)})`}>
                <Icon size={16} strokeWidth={1.75} />
                <span>{tr(label)}</span>
                {count ? <span className="count" style={hot ? { background: 'var(--blue)', color: '#fff' } : undefined}>{count}</span> : null}
              </Link>
            ),
          )}
        </nav>
        <div className="side-foot">
          <NavLink to="/app/beta" className="side-link"><span>Beta client workflows ↗</span></NavLink>
          <NavLink to="/app/settings" className="side-link">
            <Settings size={16} strokeWidth={1.75} /> <span>{tr('Settings')}</span>
          </NavLink>
          <ProfileMenu onShortcuts={shortcuts.openHelp} />
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon nav-toggle" aria-label={tr('Open navigation')} onClick={() => setOpen(true)}>
            <PanelLeft size={18} />
          </button>
          <nav className="crumbs" aria-label={tr('Breadcrumb')}>
            {last ? <Link to={section!.to}>{tr(section!.label)}</Link> : <b>{tr(section?.label ?? 'Home')}</b>}
            {last && <><span>/</span><b>{last}</b></>}
          </nav>
          <button className="search-trigger" style={{ marginLeft: 'auto' }} onClick={() => setPalette(true)} aria-label={tr('Search')}>
            <Search size={14} /> <span className="label">{tr('Search')}</span> <kbd>⌘K</kbd>
          </button>
          <TimerWidget />
          <NotificationBell />
        </header>
        <main className="page">
          {storage.error ? (
            <div className="banner banner-danger" role="alert">
              <b>{tr('Your latest changes aren’t being saved')}</b> {tr('— this browser’s storage for {app} is full.', { app: APP_NAME })}
              <Link className="btn btn-sm" to="/app/settings/data">{tr('Free up space')}</Link>
            </div>
          ) : storageFull > 0.8 ? (
            <div className="banner banner-warn" role="status">
              {tr('{app} is using {pct}% of this browser’s storage.', { app: APP_NAME, pct: Math.round(storageFull * 100) })}
              <Link className="btn btn-sm" to="/app/settings/data">{tr('See storage')}</Link>
            </div>
          ) : backupDays !== null ? (
            <div className="banner" role="status">
              <span>
                <b>{tr('Time for a backup.')}</b> {tr('It’s been {n} days — your work only lives in this browser, so a backup keeps it safe.', { n: backupDays })}
              </span>
              <button className="btn btn-sm btn-primary" onClick={downloadBackup}>{tr('Download backup')}</button>
              <button
                className="btn btn-sm btn-ghost"
                style={{ marginLeft: 0 }}
                onClick={() => dispatch({ type: 'updateStudio', patch: { backupSnoozeUntil: new Date(Date.now() + 3 * 864e5).toISOString() } })}
              >
                {tr('Remind me later')}
              </button>
            </div>
          ) : null}
          {section?.tabs && tab && <Tabs tabs={section.tabs} />}
          {/* The sidebar stays put while the next page loads. */}
          <ErrorBoundary resetKey={loc.pathname}>
            <Suspense fallback={<PageSkeleton label={tr('Loading')} />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onShortcuts={shortcuts.openHelp} />
      {shortcuts.help && <ShortcutsHelp onClose={shortcuts.closeHelp} />}
    </div>
  )
}
