/**
 * The cloud, for the app: who's signed in, which studio they're in, and the sync between this
 * browser and the studio's workspace. Without the cloud set up (config.ts) it does nothing and the
 * app works as before, in the browser only.
 */
import { APP_NAME } from '../../components/brand'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { changeListeners, useStore } from '../store'
import { normalizeState } from '../defaults'
import { seed } from '../seed'
import { allBlobKeys, connectBlobCloud, getBlob, putBlobAt } from '../blobs'
import type { State } from '../types'
import { cloudConfigured } from './config'
import { fetchSubscription, planPatch } from './plan'
import { SyncEngine, type SyncStatus } from './sync'

type SupabaseModule = typeof import('./supabase')
type Role = 'owner' | 'member'
export type CloudStudio = { id: string; name: string; role: Role }
export type CloudMember = { user_id: string; email: string | null; role: Role }

export type Cloud = {
  configured: boolean
  /** The sign-in has been checked (so "signed out" means signed out). */
  ready: boolean
  user: { id: string; email: string } | null
  studios: CloudStudio[]
  studio: CloudStudio | null
  status: SyncStatus | 'off'
  lastSynced: string | null
  error: string | null
  /** Moving a workspace up: how far it's got. */
  progress: { done: number; total: number } | null
  members: CloudMember[]
  invites: string[]
  /** A copy of what was in this browser before it joined a studio. */
  backupKey: string | null
  signIn(email: string): Promise<string | null>
  signOut(): Promise<void>
  moveToCloud(name: string): Promise<string | null>
  switchStudio(id: string): void
  invite(email: string): Promise<string | null>
  removeMember(userId: string): Promise<void>
  withdrawInvite(email: string): Promise<void>
  downloadBackup(): Promise<void>
}

const OFF: Cloud = {
  configured: false, ready: true, user: null, studios: [], studio: null, status: 'off', lastSynced: null, error: null, progress: null, members: [], invites: [], backupKey: null,
  signIn: async () => 'The cloud isn’t set up', signOut: async () => {}, moveToCloud: async () => 'The cloud isn’t set up', switchStudio: () => {},
  invite: async () => 'The cloud isn’t set up', removeMember: async () => {}, withdrawInvite: async () => {}, downloadBackup: async () => {},
}

const Ctx = createContext<Cloud>(OFF)
export const useCloud = () => useContext(Ctx)

export const STUDIO_KEY = 'formlar:studio'
const JOINED_KEY = 'formlar:joined-studios'
const BACKUP_KEY = 'formlar:backup-before-cloud'
const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* private mode – just not remembered */
  }
}
const redirect = () => `${location.origin}/app/settings/cloud`

export function CloudProvider({ children }: { children: ReactNode }) {
  if (!cloudConfigured()) return <Ctx.Provider value={OFF}>{children}</Ctx.Provider>
  return <Connected>{children}</Connected>
}

function Connected({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore()
  const stateRef = useRef<State>(state)
  stateRef.current = state
  const [mod, setMod] = useState<SupabaseModule | null>(null)
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<Cloud['user']>(null)
  const [studios, setStudios] = useState<CloudStudio[]>([])
  const [studioId, setStudioId] = useState<string | null>(read(STUDIO_KEY))
  const [sync, setSync] = useState<{ status: SyncStatus | 'off'; lastSynced: string | null; error: string | null }>({ status: 'off', lastSynced: null, error: null })
  const [progress, setProgress] = useState<Cloud['progress']>(null)
  const [members, setMembers] = useState<CloudMember[]>([])
  const [invites, setInvites] = useState<string[]>([])
  const [backupKey, setBackupKey] = useState<string | null>(read(BACKUP_KEY))

  // Load the Supabase client, and follow the sign-in.
  useEffect(() => {
    let live = true
    let stop = () => {}
    import('./supabase').then(async (m) => {
      if (!live) return
      setMod(m)
      const sb = m.supabase()
      const { data } = await sb.auth.getSession()
      const u = data.session?.user
      setUser(u?.email ? { id: u.id, email: u.email } : null)
      setReady(true)
      const sub = sb.auth.onAuthStateChange((_event, session) => {
        const s = session?.user
        setUser(s?.email ? { id: s.id, email: s.email } : null)
      })
      stop = () => sub.data.subscription.unsubscribe()
    })
    return () => {
      live = false
      stop()
    }
  }, [])

  // Signed in: join any studio that invited them, then list their studios.
  const loadStudios = useCallback(async () => {
    if (!mod || !user) return setStudios([])
    const sb = mod.supabase()
    await sb.rpc('accept_invites')
    const { data: rows } = await sb.from('studio_members').select('studio_id, role, studios(id, name)').eq('user_id', user.id)
    const list = ((rows ?? []) as unknown as { role: Role; studios: { id: string; name: string } | null }[])
      .filter((r) => r.studios)
      .map((r) => ({ id: r.studios!.id, name: r.studios!.name, role: r.role }))
    setStudios(list)
    setStudioId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? null))
  }, [mod, user])
  useEffect(() => {
    void loadStudios()
  }, [loadStudios])

  const studio = studios.find((s) => s.id === studioId) ?? null
  useEffect(() => write(STUDIO_KEY, studio?.id ?? null), [studio?.id])

  /*
   * What the studio pays for comes from the server, where only Stripe's webhook can write it –
   * not from this browser's saved state, which anyone can edit. Checked on sign-in and when the
   * studio changes; a studio that has never bought anything is left as it is while Aftryk is in
   * beta (see planPatch).
   */
  useEffect(() => {
    if (!mod || !user || !studio) return
    let live = true
    void fetchSubscription(mod.supabase(), studio.id).then((sub) => {
      if (!live) return
      const patch = planPatch(stateRef.current.studio, sub)
      if (patch) dispatch({ type: 'updateStudio', patch })
    })
    return () => {
      live = false
    }
  }, [mod, user, studio, dispatch])

  // In a studio: keep this browser's workspace in step with the cloud.
  useEffect(() => {
    if (!mod || !user || !studio) return
    let engine: SyncEngine | null = null
    let live = true
    const begin = async () => {
      // The first time this browser joins this studio, keep a copy of what was here.
      const joined = JSON.parse(read(JOINED_KEY) ?? '[]') as string[]
      if (!joined.includes(studio.id)) {
        const key = `backup-${new Date().toISOString().slice(0, 10)}-${studio.id.slice(0, 8)}`
        await putBlobAt(key, new Blob([JSON.stringify(stateRef.current)], { type: 'application/json' })).catch(() => undefined)
        write(BACKUP_KEY, key)
        setBackupKey(key)
        write(JOINED_KEY, JSON.stringify([...joined, studio.id]))
      }
      if (!live) return
      engine = new SyncEngine(mod.supabaseRemote(), studio.id, crypto.randomUUID(), {
        getState: () => stateRef.current,
        replace: (s) => dispatch({ type: 'sync', state: s }),
        normalize: (s) => normalizeState(s as unknown as Parameters<typeof normalizeState>[0], seed),
      }, { get: read, set: (k, v) => write(k, v) })
      const report = () => setSync({ status: engine!.status, lastSynced: engine!.lastSynced, error: engine!.error })
      engine.onStatus(report)
      changeListeners.add(onChange)
      connectBlobCloud(mod.supabaseFiles(studio.id))
      await engine.start()
      report()
      // This person in the team: the member with their email.
      const me = stateRef.current.team.find((m) => m.email?.toLowerCase() === user.email.toLowerCase())
      if (me && me.id !== stateRef.current.currentMemberId) dispatch({ type: 'setCurrentMember', id: me.id })
    }
    const onChange = (prev: State, next: State) => engine?.onLocalChange(prev, next)
    void begin()
    return () => {
      live = false
      changeListeners.delete(onChange)
      engine?.stop()
      connectBlobCloud(null)
      setSync({ status: 'off', lastSynced: null, error: null })
    }
  }, [mod, user?.id, studio?.id])

  // The studio's people and open invitations.
  const loadTeam = useCallback(async () => {
    if (!mod || !studio) return
    const sb = mod.supabase()
    const [{ data: m }, { data: i }] = await Promise.all([
      sb.from('studio_members').select('user_id, email, role').eq('studio_id', studio.id),
      sb.from('invites').select('email').eq('studio_id', studio.id),
    ])
    setMembers((m ?? []) as CloudMember[])
    setInvites(((i ?? []) as { email: string }[]).map((x) => x.email))
  }, [mod, studio?.id])
  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  const value: Cloud = {
    configured: true,
    ready,
    user,
    studios,
    studio,
    ...sync,
    progress,
    members,
    invites,
    backupKey,
    async signIn(email) {
      if (!mod) return 'Still connecting – try again in a moment'
      const { error } = await mod.supabase().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: redirect(), shouldCreateUser: true } })
      return error ? error.message : null
    },
    async signOut() {
      await mod?.supabase().auth.signOut()
      setStudios([])
      setUser(null)
    },
    async moveToCloud(name) {
      if (!mod || !user) return 'Sign in first'
      const sb = mod.supabase()
      const { data: id, error } = await sb.rpc('create_studio', { p_name: name.trim() || 'Studio' })
      if (error || !id) return error?.message ?? 'The studio couldn’t be made'
      const sid = id as string
      try {
        // Everything in this browser goes up: the workspace, then its files.
        const engine = new SyncEngine(mod.supabaseRemote(), sid, crypto.randomUUID(), { getState: () => stateRef.current, replace: () => {} }, { get: read, set: (k, v) => write(k, v) })
        const keys = (await allBlobKeys()).filter((k) => /^[0-9a-f-]{36}$/i.test(k))
        const total = 1 + keys.length
        setProgress({ done: 0, total })
        await engine.upload(stateRef.current)
        const files = mod.supabaseFiles(sid)
        let done = 1
        for (const key of keys) {
          const blob = await getBlob(key)
          if (blob) await files.upload(key, blob)
          setProgress({ done: ++done, total })
        }
        // This browser already has it all – no copy needed when it joins.
        const joined = JSON.parse(read(JOINED_KEY) ?? '[]') as string[]
        write(JOINED_KEY, JSON.stringify([...joined, sid]))
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      } finally {
        setProgress(null)
      }
      await loadStudios()
      setStudioId(sid)
      return null
    },
    switchStudio(id) {
      setStudioId(id)
    },
    async invite(email) {
      if (!mod || !studio) return 'Join a studio first'
      const mail = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return 'That doesn’t look like an email address'
      const sb = mod.supabase()
      const { error } = await sb.from('invites').insert({ studio_id: studio.id, email: mail })
      if (error && !/duplicate/i.test(error.message)) return error.message
      // Their sign-in link doubles as the invitation.
      const sent = await sb.auth.signInWithOtp({ email: mail, options: { emailRedirectTo: redirect(), shouldCreateUser: true } })
      await loadTeam()
      return sent.error ? sent.error.message : null
    },
    async removeMember(userId) {
      if (!mod || !studio) return
      await mod.supabase().from('studio_members').delete().eq('studio_id', studio.id).eq('user_id', userId)
      await loadTeam()
    },
    async withdrawInvite(email) {
      if (!mod || !studio) return
      await mod.supabase().from('invites').delete().eq('studio_id', studio.id).eq('email', email)
      await loadTeam()
    },
    async downloadBackup() {
      if (!backupKey) return
      const blob = await getBlob(backupKey)
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${APP_NAME.toLowerCase()}-before-cloud-${backupKey.slice(7, 17)}.json`
      a.click()
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
