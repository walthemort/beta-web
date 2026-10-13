/** The cloud sync: rows from a workspace and back, and two devices kept in step through a pretend cloud. */
import { describe, expect, it } from 'vitest'
import { seed } from '../data/seed'
import { reducer, type Action } from '../data/store'
import type { State } from '../data/types'
import { applyRows, diff, fromRows, toRows, type Row } from '../data/cloud/records'
import { SyncEngine, type CloudRow, type Remote } from '../data/cloud/sync'

const fresh = (): State => JSON.parse(JSON.stringify(seed))
const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms))
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

/** A cloud in memory: rows, and live updates to everyone listening (like Supabase Realtime). */
class FakeCloud implements Remote {
  rows = new Map<string, CloudRow>()
  listeners = new Set<(r: CloudRow) => void>()
  down = false
  pushed = 0
  async pull() {
    if (this.down) throw new Error('offline')
    return [...this.rows.values()].filter((r) => !r.deleted).map(clone)
  }
  async fetchOne(_s: string, coll: string, id: string) {
    return clone(this.rows.get(`${coll}/${id}`) ?? null)
  }
  async push(_s: string, rows: Row[], client: string) {
    if (this.down) throw new Error('offline')
    this.pushed += rows.length
    for (const r of rows) {
      const key = `${r.coll}/${r.id}`
      const row: CloudRow = { ...clone(r), ord: this.rows.get(key)?.ord ?? r.ord, client }
      this.rows.set(key, row)
      setTimeout(() => this.listeners.forEach((fn) => fn(clone(row))), 0)
    }
  }
  subscribe(_s: string, onRow: (r: CloudRow) => void, onConnected: (ok: boolean) => void) {
    this.listeners.add(onRow)
    onConnected(true)
    return () => this.listeners.delete(onRow)
  }
}

/** A browser with the app open: a workspace, the store's reducer, and a sync engine. */
function device(cloud: FakeCloud, start: State, name: string) {
  let state = start
  const saved = new Map<string, string>()
  const engine = new SyncEngine(cloud, 'studio-1', name, {
    getState: () => state,
    replace: (s) => {
      const prev = state
      state = reducer(state, { type: 'sync', state: s })
      engine.onLocalChange(prev, state)
    },
  }, { get: (k) => saved.get(k) ?? null, set: (k, v) => void saved.set(k, v) })
  return {
    engine,
    saved,
    get state() {
      return state
    },
    act(a: Action) {
      const prev = state
      state = reducer(state, a)
      engine.onLocalChange(prev, state)
    },
  }
}

describe('Rows', () => {
  it('turn a workspace into rows and back, lists in their order', () => {
    const s = fresh()
    const back = fromRows(toRows(s), { ...fresh(), projects: [], activity: [] })
    expect(back.projects.map((p) => p.id)).toEqual(s.projects.map((p) => p.id))
    expect(back.activity.map((a) => a.id)).toEqual(s.activity.map((a) => a.id))
    expect(back.studio).toEqual(s.studio)
    expect(back.nextInvoiceNumber).toBe(s.nextInvoiceNumber)
  })

  it('find exactly the items an action changed', () => {
    const s = fresh()
    const next = reducer(s, { type: 'updateProject', id: s.projects[0].id, patch: { tagline: 'New' } })
    const changes = diff(s, next)
    expect(changes.find((c) => c.coll === 'projects')).toMatchObject({ id: s.projects[0].id })
    expect(changes.filter((c) => c.coll === 'projects')).toHaveLength(1)
    const gone = reducer(s, { type: 'remove', coll: 'clients', id: s.clients[0].id })
    expect(diff(s, gone)).toContainEqual({ coll: 'clients', id: s.clients[0].id, data: null, deleted: true })
  })

  it('apply changes from the cloud in place, new ones where they belong', () => {
    const s = fresh()
    const p = { ...s.projects[1], tagline: 'From the cloud' }
    const a = { id: 'new-activity', text: 'Hi', at: '2026-01-01' }
    const next = applyRows(s, [{ coll: 'projects', id: p.id, data: p, ord: 1 }, { coll: 'activity', id: a.id, data: a, ord: 9 }, { coll: 'clients', id: s.clients[0].id, data: {}, ord: 0, deleted: true }])
    expect(next.projects[1].tagline).toBe('From the cloud')
    expect(next.activity[0].id).toBe('new-activity')
    expect(next.clients.some((c) => c.id === s.clients[0].id)).toBe(false)
  })
})

describe('Two devices, one studio', () => {
  it('moves a workspace up, and a second device gets the same', async () => {
    const cloud = new FakeCloud()
    const a = device(cloud, fresh(), 'a')
    await a.engine.upload(a.state)
    await a.engine.start()
    const b = device(cloud, { ...fresh(), projects: [], clients: [] }, 'b')
    await b.engine.start()
    expect(b.state.projects.map((p) => p.id)).toEqual(a.state.projects.map((p) => p.id))
    expect(b.state.clients.length).toBe(a.state.clients.length)
    a.engine.stop()
    b.engine.stop()
  })

  it('sends a change once, and the other device gets it live – without sending it back', async () => {
    const cloud = new FakeCloud()
    const a = device(cloud, fresh(), 'a')
    await a.engine.upload(a.state)
    await a.engine.start()
    const b = device(cloud, fresh(), 'b')
    await b.engine.start()
    const before = cloud.pushed
    const id = a.state.projects[0].id
    a.act({ type: 'updateProject', id, patch: { tagline: 'Edited on A' } })
    await wait()
    expect(b.state.projects.find((p) => p.id === id)?.tagline).toBe('Edited on A')
    // A's project and its activity line, nothing from B.
    const sent = cloud.pushed - before
    await wait()
    expect(cloud.pushed - before).toBe(sent)
    expect(b.engine.status).toBe('synced')
    a.engine.stop()
    b.engine.stop()
  })

  it('removes things everywhere', async () => {
    const cloud = new FakeCloud()
    const a = device(cloud, fresh(), 'a')
    await a.engine.upload(a.state)
    await a.engine.start()
    const b = device(cloud, fresh(), 'b')
    await b.engine.start()
    const entry = a.state.timeEntries[0]
    expect(b.state.timeEntries.some((t) => t.id === entry.id)).toBe(true)
    a.act({ type: 'remove', coll: 'timeEntries', id: entry.id })
    await wait()
    expect(b.state.timeEntries.some((t) => t.id === entry.id)).toBe(false)
    a.engine.stop()
    b.engine.stop()
  })

  it('keeps work done offline and sends it when back – even after a reload', async () => {
    const cloud = new FakeCloud()
    const a = device(cloud, fresh(), 'a')
    await a.engine.upload(a.state)
    await a.engine.start()
    cloud.down = true
    const id = a.state.clients[0].id
    a.act({ type: 'update', coll: 'clients', id, fn: (c) => ({ ...c, name: 'Renamed offline' }) })
    await wait()
    expect(a.engine.status).toBe('offline')
    expect(a.saved.get('formlar:sync-queue:studio-1')).toContain(id)
    a.engine.stop()
    // The app is closed and opened again, still with the change in its saved workspace.
    cloud.down = false
    const again = device(cloud, a.state, 'a2')
    again.saved.set('formlar:sync-queue:studio-1', a.saved.get('formlar:sync-queue:studio-1')!)
    await again.engine.start()
    await wait()
    expect((cloud.rows.get(`clients/${id}`)?.data as { name: string }).name).toBe('Renamed offline')
    expect(again.state.clients.find((c) => c.id === id)?.name).toBe('Renamed offline')
    again.engine.stop()
  })
})
