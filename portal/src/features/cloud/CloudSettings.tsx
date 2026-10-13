/** Settings → Cloud: sign in, move the workspace to the cloud, see the sync, invite the team. */
import { APP_NAME } from '../../components/brand'
import { useState, type FormEvent } from 'react'
import { Cloud as CloudIcon, CloudOff, Download, Loader2, LogOut, Mail, Trash2, UploadCloud, UserPlus } from 'lucide-react'
import { useStore, timeAgo } from '../../data/store'
import { useT } from '../../data/i18n'
import { useCloud } from '../../data/cloud/CloudProvider'

/** The sync in a word, for the settings page and the sidebar. */
export function useSyncLabel() {
  const tr = useT()
  const cloud = useCloud()
  if (!cloud.configured || !cloud.studio) return null
  const map = {
    off: { tone: 'grey', text: tr('Not connected') },
    connecting: { tone: 'amber', text: tr('Connecting…') },
    saving: { tone: 'amber', text: tr('Saving…') },
    synced: { tone: 'green', text: cloud.lastSynced ? tr('Saved · {when}', { when: timeAgo(cloud.lastSynced) }) : tr('Saved') },
    offline: { tone: 'grey', text: tr('Offline – changes are kept and sent when you’re back') },
    error: { tone: 'red', text: tr('Not saved to the cloud: {error}', { error: cloud.error ?? '' }) },
  } as const
  return map[cloud.status]
}

/** Errors in words people understand. */
const friendly = (e: string) => (/failed to fetch|networkerror|load failed|network request failed/i.test(e) ? 'Could not reach the cloud – check the connection' : e)

export function CloudSettings() {
  const tr = useT()
  const { state } = useStore()
  const cloud = useCloud()
  const label = useSyncLabel()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(state.studio.name)
  const [invite, setInvite] = useState('')

  const run = async (fn: () => Promise<string | null | void>) => {
    setBusy(true)
    setError(null)
    const e = await fn()
    setBusy(false)
    if (e) setError(tr(friendly(e)))
    return !e
  }

  if (!cloud.configured)
    return (
      <section className="card cloud-card">
        <CloudOff size={28} className="muted" />
        <h3>{tr('Everything is saved in this browser')}</h3>
        <p className="muted">{tr('With {app}’s cloud your team shares one workspace on every device, live – and it’s safe if this browser is cleared.', { app: APP_NAME })}</p>
        <p className="muted" style={{ fontSize: 13 }}>{tr('Whoever runs {app} switches it on – the steps are in docs/BACKEND.md.', { app: APP_NAME })}</p>
      </section>
    )

  if (!cloud.ready) return <section className="card cloud-card"><Loader2 size={20} className="spin" /></section>

  if (!cloud.user)
    return (
      <section className="card cloud-card">
        <CloudIcon size={28} style={{ color: 'var(--blue)' }} />
        <h3>{tr('Sign in to the cloud')}</h3>
        <p className="muted">{tr('We email you a link – no password. Your team shares one workspace, live, on every device.')}</p>
        {sent ? (
          <p className="cloud-sent"><Mail size={16} /> {tr('Check your inbox – the link signs you in here.')}</p>
        ) : (
          <form className="cloud-row" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => { const err = await cloud.signIn(email); if (!err) setSent(true); return err }) }}>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr('you@studio.dk')} aria-label={tr('Email')} />
            <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Mail size={15} />} {tr('Send me a sign-in link')}</button>
          </form>
        )}
        {error && <p className="cloud-error" role="alert">{error}</p>}
      </section>
    )

  if (!cloud.studio)
    return (
      <section className="card cloud-card">
        <UploadCloud size={28} style={{ color: 'var(--blue)' }} />
        <h3>{tr('Move this workspace to the cloud')}</h3>
        <p className="muted">{tr('Everything in this browser – projects, clients, designs and files – goes up. Then your team can join it.')}</p>
        <form className="cloud-row" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(() => cloud.moveToCloud(name)) }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label={tr('Studio name')} />
          <button className="btn btn-primary" disabled={busy || !!cloud.progress}>{busy ? <Loader2 size={15} className="spin" /> : <UploadCloud size={15} />} {tr('Move to the cloud')}</button>
        </form>
        {cloud.progress && (
          <div className="cloud-progress" role="progressbar" aria-valuemin={0} aria-valuemax={cloud.progress.total} aria-valuenow={cloud.progress.done}>
            <span style={{ width: `${(cloud.progress.done / Math.max(1, cloud.progress.total)) * 100}%` }} />
            <small className="muted">{tr('{done} of {total} uploaded', { done: cloud.progress.done, total: cloud.progress.total })}</small>
          </div>
        )}
        <p className="muted" style={{ fontSize: 13 }}>{tr('Joining a studio that’s already there? Ask it to invite {email}.', { email: cloud.user.email })}</p>
        {error && <p className="cloud-error" role="alert">{error}</p>}
        <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => cloud.signOut()}><LogOut size={14} /> {tr('Sign out')}</button>
      </section>
    )

  const owner = cloud.studio.role === 'owner'
  return (
    <div className="cloud-grid">
      <section className="card cloud-card">
        <div className="cloud-head">
          <CloudIcon size={22} style={{ color: 'var(--blue)' }} />
          <div>
            <h3>{cloud.studio.name}</h3>
            <small className="muted">{tr('Signed in as {email}', { email: cloud.user.email })}</small>
          </div>
        </div>
        {label && <p className={'cloud-status ' + label.tone}><i /> {label.text}</p>}
        {cloud.studios.length > 1 && (
          <label className="field">
            <span className="muted" style={{ fontSize: 13 }}>{tr('Studio')}</span>
            <select className="input" value={cloud.studio.id} onChange={(e) => cloud.switchStudio(e.target.value)}>
              {cloud.studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        {cloud.backupKey && (
          <p className="muted" style={{ fontSize: 13 }}>
            {tr('What was in this browser before it joined is kept.')} <button className="btn btn-ghost btn-sm" onClick={() => cloud.downloadBackup()}><Download size={13} /> {tr('Download it')}</button>
          </p>
        )}
        <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => cloud.signOut()}><LogOut size={14} /> {tr('Sign out')}</button>
      </section>

      <section className="card cloud-card">
        <h3>{tr('Who’s in the studio')}</h3>
        <ul className="cloud-people">
          {cloud.members.map((m) => (
            <li key={m.user_id}>
              <span>{m.email ?? m.user_id}</span>
              <small className="muted">{m.role === 'owner' ? tr('Owner') : tr('Member')}</small>
              {owner && m.user_id !== cloud.user!.id && <button className="btn btn-ghost btn-icon btn-sm" title={tr('Remove')} onClick={() => cloud.removeMember(m.user_id)}><Trash2 size={13} /></button>}
            </li>
          ))}
          {cloud.invites.map((email) => (
            <li key={email} className="invited">
              <span>{email}</span>
              <small className="muted">{tr('Invited')}</small>
              {owner && <button className="btn btn-ghost btn-icon btn-sm" title={tr('Withdraw')} onClick={() => cloud.withdrawInvite(email)}><Trash2 size={13} /></button>}
            </li>
          ))}
        </ul>
        {owner && (
          <form className="cloud-row" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => { const err = await cloud.invite(invite); if (!err) setInvite(''); return err }) }}>
            <input className="input" type="email" required value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={tr('colleague@studio.dk')} aria-label={tr('Email')} />
            <button className="btn" disabled={busy}><UserPlus size={15} /> {tr('Invite')}</button>
          </form>
        )}
        <p className="muted" style={{ fontSize: 13 }}>{tr('They get a sign-in link by email, and join the studio when they use it.')}</p>
        {error && <p className="cloud-error" role="alert">{error}</p>}
      </section>
    </div>
  )
}
