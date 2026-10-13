import { StrictMode, Suspense, lazy, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UndoProvider } from './components/Undo'
import { StoreProvider } from './data/store'
import { CloudProvider } from './data/cloud/CloudProvider'
import Landing from './pages/Landing'
import { BETA_MODE } from './beta/config'
import BetaPortal, { BetaLoading } from './beta/BetaPortal'
import './styles.css'

/*
 * Every page except the landing page is loaded on demand: a client opening a portal link doesn't
 * download the studio workspace, and nobody downloads the PDF tools until they open a PDF.
 */
const named = <T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T) =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType })))

const Portal = lazy(() => import('./pages/Portal'))
const ClientPortal = lazy(() => import('./pages/ClientPortal'))
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'))
const Print = lazy(() => import('./pages/Print'))
const CaseStudy = lazy(() => import('./pages/CaseStudy'))
const EmbedHub = lazy(() => import('./pages/Embed'))
const ShareBoard = lazy(() => import('./pages/ShareBoard'))
const Setup = lazy(() => import('./pages/Setup'))
const Layout = lazy(() => import('./app/Layout'))
const Overview = lazy(() => import('./app/Overview'))
const Projects = lazy(() => import('./app/Projects'))
const ProjectDetail = lazy(() => import('./app/ProjectDetail'))
const Clients = lazy(() => import('./app/Clients'))
const Invoices = lazy(() => import('./app/Invoices'))
const Sales = lazy(() => import('./app/Sales'))
const Hubs = lazy(() => import('./app/Hubs'))
const Content = lazy(() => import('./app/Content'))
const Apps = lazy(() => import('./app/Apps'))
const Mockups = lazy(() => import('./features/apps/mockups/Mockups'))
const Presenter = lazy(() => import('./features/apps/presenter/Presenter'))
const Pages = lazy(() => import('./features/apps/pages/Pages'))
const Site = lazy(() => import('./pages/Site'))
const Assistant = lazy(() => import('./features/apps/assistant/Assistant'))
const AuditPage = lazy(() => import('./features/apps/audit/Audit'))
const StudioTools = lazy(() => import('./beta/StudioTools'))
const Settings = lazy(() => import('./app/Settings'))
const DocumentsPage = named(() => import('./app/Lists'), 'DocumentsPage')
const Board = named(() => import('./app/Workflow'), 'Board')
const CalendarPage = named(() => import('./app/Workflow'), 'CalendarPage')
const Capacity = named(() => import('./app/Workflow'), 'Capacity')
const MyTasks = named(() => import('./app/Workflow'), 'MyTasks')
const Reports = named(() => import('./app/Workflow'), 'Reports')

// Old share links (/hub/:id) keep working.
function HubRedirect() {
  const { id } = useParams()
  return <Navigate to={`/p/${id}/hub`} replace />
}

/** Resets the crash screen when the user navigates somewhere else. */
function Guarded({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

/** Shown for the moment a page is loading. */
export function Loading() {
  return BETA_MODE ? <BetaLoading /> : <div className="page-loading" role="status" aria-label="Loading" />
}

function Deployment({ children }: { children: React.ReactNode }) {
  return BETA_MODE ? <BetaPortal>{children}</BetaPortal> : <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <StoreProvider>
    <CloudProvider>
    <UndoProvider>
      <BrowserRouter>
        <Guarded>
        <Suspense fallback={<Loading />}>
          <Deployment>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/hub/:id" element={<HubRedirect />} />
            <Route path="/p/:pid" element={<ClientPortal />} />
            <Route path="/p/:pid/:section" element={<ClientPortal />} />
            <Route path="/p/:pid/:section/:itemId" element={<ClientPortal />} />
            <Route path="/print/:kind/:id" element={<Print />} />
            <Route path="/case/:id" element={<CaseStudy />} />
            <Route path="/embed/hub/:id" element={<EmbedHub />} />
            <Route path="/c/:cid" element={<ClientDashboard />} />
            <Route path="/share/board/:token" element={<ShareBoard />} />
            <Route path="/site/:slug" element={<Site />} />
            <Route path="/app" element={<Layout />}>
              <Route index element={<Overview />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="projects/:id/files/:fileId" element={<ProjectDetail />} />
              <Route path="projects/:id/presentations/:deckId" element={<ProjectDetail />} />
              <Route path="projects/:id/:tab" element={<ProjectDetail />} />
              <Route path="clients" element={<Clients />} />
              <Route path="documents" element={<DocumentsPage />} />
              {/* The separate process pages became one Documents page; old links still land there. */}
              <Route path="discovery" element={<Navigate to="/app/documents" replace />} />
              <Route path="proposals" element={<Navigate to="/app/documents" replace />} />
              <Route path="contracts" element={<Navigate to="/app/documents" replace />} />
              <Route path="files" element={<Navigate to="/app/documents?view=files" replace />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="sales" element={<Sales />} />
              <Route path="sales/:tab" element={<Sales />} />
              <Route path="hubs" element={<Hubs />} />
              <Route path="content" element={<Content />} />
              <Route path="content/:designId" element={<Content />} />
              <Route path="beta" element={<StudioTools />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/:section" element={<Settings />} />
              <Route path="tasks" element={<MyTasks />} />
              <Route path="board" element={<Board />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="calendar/:view" element={<CalendarPage />} />
              <Route path="apps" element={<Apps />} />
              <Route path="mockups" element={<Mockups />} />
              <Route path="mockups/:id" element={<Mockups />} />
              <Route path="presenter" element={<Presenter />} />
              <Route path="pages" element={<Pages />} />
              <Route path="pages/:id" element={<Pages />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="audit/:id" element={<AuditPage />} />
              <Route path="capacity" element={<Capacity />} />
              <Route path="reports" element={<Reports />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Deployment>
        </Suspense>
        </Guarded>
      </BrowserRouter>
    </UndoProvider>
    </CloudProvider>
    </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
)
