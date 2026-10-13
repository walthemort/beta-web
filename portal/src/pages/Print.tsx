import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { Logo } from '../components/ui'
import { formatDateLong, formatKrExact, useStore } from '../data/store'
import { invoiceVatRate, splitVat, vatNote } from '../data/vat'
import { approvalRecord } from '../data/approvals'
import { ProposalDocument } from '../features/proposals'
import { ContractDocument } from '../features/contracts'
import type { Invoice, Lang, Project } from '../data/types'
import { translateTo } from '../data/i18n'
import { ProjectCover } from '../components/ui'
import { useSrc } from '../data/blobs'
import { formats } from '../features/color'
import { orderedColours } from '../features/palette'
import { readableOn } from '../features/color'
import { LogoRulesView, MoodboardView, ToneView, TypeScaleView } from '../features/hubExtras'
import { Mockups } from '../features/mockups'
import '../features/brand.css'
import '../app/app.css'
import './portal.css'

export default function Print() {
  const { kind, id } = useParams()
  const { state } = useStore()
  const invoice = kind === 'invoice' ? state.invoices.find((i) => i.id === id) : undefined
  const proposal = kind === 'proposal' ? state.proposals.find((p) => p.id === id) : undefined
  const contract = kind === 'contract' ? state.contracts.find((c) => c.id === id) : undefined
  const hubProject = kind === 'hub' ? state.projects.find((p) => p.id === id) : undefined
  const approvalsProject = kind === 'approvals' ? state.projects.find((p) => p.id === id) : undefined

  useEffect(() => {
    document.title = invoice
      ? `${invoice.number} — ${state.studio.name}`
      : hubProject
        ? `${state.clients.find((c) => c.id === hubProject.clientId)?.name ?? hubProject.name} brand guidelines`
        : approvalsProject
          ? `Approval record — ${approvalsProject.name}`
          // The title becomes the file name when a client prints to PDF, so it carries the
          // studio's name, never Aftryk's – some of them pay for exactly that.
          : proposal?.title ?? contract?.title ?? state.studio.name
  }, [invoice, proposal, contract, hubProject, approvalsProject, state])

  return (
    <div className="print-page">
      <div className="print-bar no-print">
        <Logo size={20} />
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print or save as PDF</button>
      </div>
      {invoice && <InvoiceDocument invoice={invoice} />}
      {proposal && <ProposalDocument proposal={proposal} />}
      {contract && <ContractDocument contract={contract} />}
      {hubProject && <BrandGuidelines project={hubProject} />}
      {approvalsProject && <ApprovalDocument project={approvalsProject} />}
      {!invoice && !proposal && !contract && !hubProject && !approvalsProject && <p className="muted">Document not found.</p>}
    </div>
  )
}

/** Danish invoice requirements: sequential number, date, both parties' details, net/VAT/total, reverse-charge note. */
/** Invoice wording in the client's language (the dictionary has the Danish). */
const invoiceText = (lang: Lang) => {
  const t = (k: string, vars?: Record<string, string | number>) => translateTo(lang, k, vars)
  return {
    invoice: t('Invoice'), draft: t('Draft – not sent'), billed: t('Billed to'), dates: t('Dates'), issued: t('Issued§invoice date'), notIssued: t('Not issued yet'), due: t('Due§invoice'),
    services: t('Design services'), subtotal: t('Subtotal excl. VAT'), vat: (r: number) => t('VAT {rate}%', { rate: r }), total: t('Total due'),
    pay: (due: string, bank: string, n: string) => t('Please pay by {due} to {bank}, quoting {number}.', { due, bank, number: n }), online: t('Or pay online:'),
  }
}

function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const { state } = useStore()
  const { studio } = state
  const client = state.clients.find((c) => c.id === invoice.clientId)
  const project = state.projects.find((p) => p.id === invoice.projectId)
  const lang = client?.language === 'da' ? 'da' : 'en'
  const t = invoiceText(lang)
  const rate = invoiceVatRate(state, invoice)
  const { net, vat } = splitVat(invoice.amount, rate)
  const note = rate === 0 ? vatNote(client?.vat, lang) : undefined
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(lang === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')

  return (
    <article className="doc" lang={lang}>
      <header className="doc-head" style={{ gridTemplateColumns: '1fr auto', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <span className="eyebrow">{t.invoice}</span>
          <h1 style={{ fontFamily: 'var(--mono)', fontSize: 32, letterSpacing: 0 }}>{invoice.number}</h1>
          {invoice.status === 'Draft' && <span className="pill" style={{ justifySelf: 'start' }}>{t.draft}</span>}
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          <b>{studio.name}</b><br />
          {studio.address}<br />
          CVR {studio.cvr}<br />
          {studio.email}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, fontSize: 14 }}>
        <div>
          <span className="eyebrow">{t.billed}</span>
          <p style={{ marginTop: 6, whiteSpace: 'pre-line' }}>
            <b>{client?.name}</b><br />
            {client?.address && <>{client.address}<br /></>}
            {client?.cvr && <>{client.vat === 'dk' || !client.vat ? 'CVR' : translateTo(lang, 'VAT no.')} {client.cvr}<br /></>}
            {client?.contactName}<br />{client?.contactEmail}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="eyebrow">{t.dates}</span>
          <p style={{ marginTop: 6 }}>
            {invoice.issuedAt ? `${t.issued} ${date(invoice.issuedAt)}` : t.notIssued}<br />
            <b>{t.due} {date(invoice.due)}</b>
          </p>
        </div>
      </div>

      <table className="doc-table">
        <tbody>
          <tr>
            <td>{invoice.description ?? project?.name ?? t.services}</td>
            <td className="num">{formatKrExact(net)}</td>
          </tr>
          <tr className="sub"><td>{t.subtotal}</td><td className="num">{formatKrExact(net)}</td></tr>
          <tr className="sub"><td>{t.vat(Math.round(rate * 100))}</td><td className="num">{formatKrExact(vat)}</td></tr>
          <tr className="total"><td>{t.total}</td><td className="num">{formatKrExact(invoice.amount)}</td></tr>
        </tbody>
      </table>

      {note && <p style={{ fontSize: 13 }}><b>{note}</b></p>}
      <p style={{ fontSize: 13 }} className="muted">{t.pay(date(invoice.due), studio.bank, invoice.number)}</p>
      {invoice.paymentLink && (
        <p style={{ fontSize: 13 }}>
          {t.online} <a href={invoice.paymentLink} style={{ color: 'var(--blue)' }}>{invoice.paymentLink}</a>
        </p>
      )}
    </article>
  )
}

/** Approval record wording in the client's language. */
const approvalText = (lang: Lang) => {
  const t = (k: string, vars?: Record<string, string | number>) => translateTo(lang, k, vars)
  return {
    title: t('Approval record'), intro: (studio: string, client: string) => t('Every decision on this project, as recorded in {studio}’s client portal with {client}.', { studio, client }),
    when: t('Date and time'), what: t('What'), action: t('Decision'), by: t('By§approved by'), details: t('Details'), none: t('No decisions recorded yet.'),
    printed: t('Printed'), times: t('Times are local time for the studio.'),
    actions: {
      Approved: t('Approved'), 'Changes requested': t('Changes requested'), Chose: t('Chose'), Accepted: t('Accepted'), Declined: t('Declined'), Signed: t('Signed'), Submitted: t('Submitted'),
    } as Record<string, string>,
    kinds: { File: t('File'), Presentation: t('Presentation'), Route: t('Route'), Proposal: t('Proposal'), Contract: t('Contract'), Questionnaire: t('Questionnaire') } as Record<string, string>,
  }
}

/** Who approved what and when – for when a decision is questioned later. */
function ApprovalDocument({ project }: { project: Project }) {
  const { state } = useStore()
  const client = state.clients.find((c) => c.id === project.clientId)
  const lang = client?.language === 'da' ? 'da' : 'en'
  const t = approvalText(lang)
  const rows = approvalRecord(state, project.id)
  const stamp = (iso: string) => new Date(iso).toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <article className="doc" lang={lang}>
      <header className="doc-head" style={{ gridTemplateColumns: '1fr auto', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <span className="eyebrow">{t.title}</span>
          <h1>{project.name}</h1>
          <p className="muted" style={{ fontSize: 14 }}>{t.intro(state.studio.name, client?.name ?? '')}</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.6 }}>
          <b>{state.studio.name}</b><br />
          CVR {state.studio.cvr}<br />
          {t.printed} {stamp(new Date().toISOString())}
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="muted">{t.none}</p>
      ) : (
        <table className="doc-table approvals-table">
          <thead>
            <tr><th>{t.when}</th><th>{t.what}</th><th>{t.action}</th><th>{t.by}</th><th>{t.details}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{stamp(r.at)}</td>
                <td><small className="muted">{t.kinds[r.kind]}</small><br />{r.item}</td>
                <td><b>{t.actions[r.action]}</b></td>
                <td>{r.by}</td>
                <td className="muted">{r.detail ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted" style={{ fontSize: 12 }}>{t.times}</p>
    </article>
  )
}

function PrintLogo({ src, name }: { src: string; name: string }) {
  const url = useSrc(src)
  return url ? <img src={url} alt={name} /> : null
}

/** Brand guidelines as a printable document (#6): one section per page. */
function BrandGuidelines({ project }: { project: Project }) {
  const { state } = useStore()
  const client = state.clients.find((c) => c.id === project.clientId)
  const logos = state.files.filter((f) => f.projectId === project.id && f.category === 'Logos' && f.published)
  const colours = orderedColours(project.hub.colours)
  const fonts = project.hub.fonts.map((f) => `family=${encodeURIComponent(f.name)}`).join('&')
  const sections = ['Logo', 'Logo rules', 'Colour', 'Typography', 'Tone of voice', 'Imagery', 'In use']
  const Page = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <section className="gl-page">
      <header className="gl-head"><span className="eyebrow">{String(n).padStart(2, '0')} / {title}</span><span className="eyebrow">{client?.name}</span></header>
      <h2 className="gl-title">{title}</h2>
      {children}
    </section>
  )
  return (
    <article className="guidelines">
      {fonts && <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${fonts}&display=swap`} />}
      <section className="gl-cover">
        <ProjectCover project={project} height={520} />
        <div className="gl-cover-text">
          <h1>{client?.name ?? project.name}</h1>
          <p>Brand guidelines</p>
          <small className="muted">{state.studio.name} · {formatDateLong(new Date().toISOString())}</small>
        </div>
        <ol className="gl-toc">{sections.map((s, i) => <li key={s}><span>{String(i + 1).padStart(2, '0')}</span> {s}</li>)}</ol>
      </section>
      <Page n={1} title="Logo">
        <div className="gl-logos">
          {logos.length ? logos.map((f) => <figure key={f.id}><PrintLogo src={f.versions.at(-1)!.src} name={f.name} /><figcaption>{f.name}</figcaption></figure>) : <p className="muted">No logos published yet.</p>}
        </div>
      </Page>
      <Page n={2} title="Logo rules"><LogoRulesView project={project} /></Page>
      <Page n={3} title="Colour">
        <div className="gl-colours">
          {colours.map((c) => (
            <div key={c.id} className="gl-colour">
              <div className="gl-swatch" style={{ background: c.hex, color: readableOn(c.hex) }}>
                <b>{c.name}</b>
                <small>{c.role ?? ''}{c.usage ? ` · ${Math.round(c.share)}%` : ''}</small>
              </div>
              <dl>{formats(c.hex).map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
            </div>
          ))}
        </div>
      </Page>
      <Page n={4} title="Typography">
        <div className="gl-fonts">{project.hub.fonts.map((f) => <div key={f.id}><span style={{ fontFamily: `'${f.name}', var(--sans)` }}>Aa</span><b>{f.name}</b><small>{f.usage}</small></div>)}</div>
        <TypeScaleView project={project} />
      </Page>
      <Page n={5} title="Tone of voice"><ToneView project={project} /></Page>
      <Page n={6} title="Imagery"><MoodboardView project={project} /></Page>
      <Page n={7} title="In use"><Mockups project={project} /></Page>
    </article>
  )
}
