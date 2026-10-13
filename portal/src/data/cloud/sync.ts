/**
 * Keeping a studio's workspace in step with the cloud.
 *
 * - On start: the cloud's version is loaded, and anything changed here while offline is put back on
 *   top of it and sent.
 * - After every change here: only the items that changed are queued and sent (in a moment, in one
 *   go). The queue survives a reload, so nothing is lost offline.
 * - Changes from teammates arrive live and are applied item by item.
 *
 * Conflicts are settled per item: the last one saved wins. The engine talks to the cloud through
 * `Remote`, so it can be tested without one.
 */
import type { State } from '../types'
import { META, applyRows, diff, fromRows, keyOf, toRows, type Change, type Row } from './records'

export type CloudRow = Row & { updated_at?: string; client?: string | null }

/** What the engine needs from the cloud. */
export interface Remote {
  /** Every row of a studio (without deleted ones). */
  pull(studio: string): Promise<CloudRow[]>
  /** One row, when a live update was too big to carry it. */
  fetchOne(studio: string, coll: string, id: string): Promise<CloudRow | null>
  push(studio: string, rows: Row[], client: string): Promise<void>
  /** Live changes; returns a function that stops them. */
  subscribe(studio: string, onRow: (row: CloudRow) => void, onConnected: (ok: boolean) => void): () => void
}

export type SyncStatus = 'connecting' | 'synced' | 'saving' | 'offline' | 'error'

/** Where the engine keeps its queue between visits (localStorage in the app). */
export interface QueueStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

type Hooks = {
  /** The workspace as it is right now. */
  getState(): State
  /** Puts a workspace in place without it counting as a change made here. */
  replace(state: State): void
  /** Fills in anything missing (data from an older version of the app). */
  normalize?(state: State): State
}

const BACKOFF = [1000, 3000, 8000, 20000, 45000]

export class SyncEngine {
  status: SyncStatus = 'connecting'
  lastSynced: string | null = null
  error: string | null = null

  /** Changes waiting to be sent, by item. Only the keys are kept between visits – the items themselves are in the saved workspace. */
  private queue = new Map<string, Change>()
  /** The last value each item had when it came from the cloud – so it isn't sent straight back. */
  private fromCloud = new Map<string, unknown>()
  private goneInCloud = new Set<string>()
  /** A workspace put in place by the engine itself. */
  private own: State | null = null
  private started = false
  private stopped = false
  private flushing = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0
  private unsubscribe: (() => void) | null = null
  private incoming: CloudRow[] = []
  private incomingTimer: ReturnType<typeof setTimeout> | null = null
  private lastOrd = 0
  private listeners = new Set<() => void>()

  constructor(
    private remote: Remote,
    readonly studio: string,
    private client: string,
    private hooks: Hooks,
    private store: QueueStore,
  ) {}

  private get queueKey() {
    return `formlar:sync-queue:${this.studio}`
  }

  onStatus(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(status: SyncStatus, error: string | null = null) {
    this.status = status
    this.error = error
    if (status === 'synced') this.lastSynced = new Date().toISOString()
    this.listeners.forEach((fn) => fn())
  }

  private saveQueue() {
    try {
      this.store.set(this.queueKey, JSON.stringify([...this.queue.values()].map(({ coll, id, deleted }) => ({ coll, id, deleted }))))
    } catch {
      /* no room to remember the queue – it's still sent while the app is open */
    }
  }

  /** Puts a workspace in place and remembers which items in it came from the cloud. */
  private put(raw: State, rows: Row[], gone: string[] = []) {
    const state = this.hooks.normalize ? this.hooks.normalize(raw) : raw
    // The items as they are in the workspace now (normalising may have made new objects).
    const index = new Map<string, Map<string, unknown>>()
    const itemAt = (coll: string, id: string): unknown => {
      if (coll === META) return state[id as keyof State]
      if (!index.has(coll)) index.set(coll, new Map(((state as unknown as Record<string, { id: string }[]>)[coll] ?? []).map((x) => [x.id, x])))
      return index.get(coll)!.get(id)
    }
    for (const r of rows) {
      const key = keyOf(r.coll, r.id)
      if (r.deleted) this.goneInCloud.add(key)
      else this.fromCloud.set(key, itemAt(r.coll, r.id))
    }
    for (const key of gone) this.goneInCloud.add(key)
    this.own = state
    this.hooks.replace(state)
  }

  /** Loads the cloud's workspace, puts back what changed here while offline, and starts listening. */
  async start() {
    this.set('connecting')
    const local = this.hooks.getState()
    // What was waiting to be sent last time: the items as they are in the saved workspace.
    let waiting: { coll: string; id: string; deleted?: boolean }[] = []
    try {
      waiting = JSON.parse(this.store.get(this.queueKey) ?? '[]')
    } catch {
      waiting = []
    }
    let rows: CloudRow[]
    try {
      rows = await this.remote.pull(this.studio)
    } catch (err) {
      this.set('offline', err instanceof Error ? err.message : String(err))
      this.retryStart()
      return
    }
    if (this.stopped) return
    let state = fromRows(rows, local)
    const pending: Row[] = []
    for (const w of waiting) {
      const item = w.coll === META ? local[w.id as keyof State] : (local as unknown as Record<string, { id: string }[]>)[w.coll]?.find((x) => x.id === w.id)
      const change: Change = item === undefined || w.deleted ? { coll: w.coll, id: w.id, data: null, deleted: true } : { coll: w.coll, id: w.id, data: item }
      this.queue.set(keyOf(w.coll, w.id), change)
      pending.push({ coll: w.coll, id: w.id, data: change.data, ord: this.nextOrd(), deleted: change.deleted })
    }
    state = applyRows(state, pending)
    // Everything that's here but not in the cloud (and not waiting to go) is gone.
    const inCloud = new Set(rows.map((r) => keyOf(r.coll, r.id)))
    const gone = toRows(local).map((r) => keyOf(r.coll, r.id)).filter((k) => !inCloud.has(k) && !this.queue.has(k))
    this.put(state, rows, gone)
    this.started = true
    this.unsubscribe = this.remote.subscribe(this.studio, (row) => this.receive(row), (ok) => {
      if (!ok && this.status !== 'error') this.set('offline')
      else if (ok && this.status === 'offline') this.flushSoon(0)
    })
    if (this.queue.size) this.flushSoon(0)
    else this.set('synced')
  }

  private retryStart() {
    if (this.stopped) return
    const wait = BACKOFF[Math.min(this.attempt++, BACKOFF.length - 1)]
    this.timer = setTimeout(() => this.start(), wait)
  }

  /** Moves a whole workspace to an empty studio – the first time a studio goes to the cloud. */
  async upload(state: State, onProgress?: (done: number, total: number) => void) {
    const rows = toRows(state)
    for (let i = 0; i < rows.length; i += 250) {
      await this.remote.push(this.studio, rows.slice(i, i + 250), this.client)
      onProgress?.(Math.min(rows.length, i + 250), rows.length)
    }
  }

  /** Called by the store after every change. */
  onLocalChange(prev: State, next: State) {
    if (!this.started || this.stopped) return
    if (next === this.own) {
      this.own = null
      return
    }
    const changes = diff(prev, next, (key, value) => this.fromCloud.get(key) === value, this.goneInCloud)
    if (!changes.length) return
    for (const c of changes) {
      const key = keyOf(c.coll, c.id)
      this.queue.set(key, c)
      this.fromCloud.delete(key)
      this.goneInCloud.delete(key)
    }
    this.saveQueue()
    this.flushSoon()
  }

  private nextOrd() {
    // Increasing, so new items keep their place (newest-first lists sort the other way round).
    this.lastOrd = Math.max(Date.now(), this.lastOrd + 1)
    return this.lastOrd
  }

  private flushSoon(wait = 400) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), wait)
  }

  /** Sends what's waiting, in one go. */
  async flush() {
    if (this.flushing || this.stopped || !this.queue.size) return
    this.flushing = true
    this.set('saving')
    const batch = [...this.queue.entries()]
    const rows: Row[] = batch.map(([, c]) => ({ coll: c.coll, id: c.id, data: c.deleted ? {} : c.data, ord: this.nextOrd(), deleted: !!c.deleted }))
    try {
      for (let i = 0; i < rows.length; i += 250) await this.remote.push(this.studio, rows.slice(i, i + 250), this.client)
      // Only what hasn't changed again since it was sent leaves the queue.
      for (const [key, c] of batch) if (this.queue.get(key) === c) this.queue.delete(key)
      this.saveQueue()
      this.attempt = 0
      this.flushing = false
      if (this.queue.size) this.flushSoon(0)
      else this.set('synced')
    } catch (err) {
      this.flushing = false
      const message = err instanceof Error ? err.message : String(err)
      // Refused (not just unreachable): tell the user rather than retrying for ever.
      if (/permission|denied|violates|forbidden|401|403/i.test(message)) return this.set('error', message)
      this.set('offline', message)
      this.flushSoon(BACKOFF[Math.min(this.attempt++, BACKOFF.length - 1)])
    }
  }

  /** A change from someone else – collected for a moment, then applied together. */
  private receive(row: CloudRow) {
    if (row.client && row.client === this.client) return
    this.incoming.push(row)
    if (this.incomingTimer) return
    this.incomingTimer = setTimeout(() => this.applyIncoming(), 60)
  }

  private async applyIncoming() {
    this.incomingTimer = null
    const rows = this.incoming.splice(0)
    // Big items arrive without their content – fetch those.
    const full = await Promise.all(rows.map(async (r) => (r.data === undefined && !r.deleted ? (await this.remote.fetchOne(this.studio, r.coll, r.id).catch(() => null)) ?? r : r)))
    // Something changed here and not yet sent wins over the cloud's older version.
    const apply = full.filter((r) => r.data !== undefined || r.deleted).filter((r) => !this.queue.has(keyOf(r.coll, r.id)))
    if (!apply.length || this.stopped) return
    const state = applyRows(this.hooks.getState(), apply)
    this.put(state, apply)
    this.set('synced')
  }

  stop() {
    this.stopped = true
    this.unsubscribe?.()
    if (this.timer) clearTimeout(this.timer)
    if (this.incomingTimer) clearTimeout(this.incomingTimer)
  }
}
