/**
 * The workspace as rows for the cloud: one row per item (a client, a project, a design …) and one
 * per single value (the studio's settings, the next invoice number). What changed between two
 * states is worked out from the objects themselves – the store makes a new object only for the
 * items an action touches – so only those rows are sent.
 */
import type { State } from '../types'

/** The lists that sync item by item. */
export const COLLECTIONS = [
  'team', 'clients', 'projects', 'projectTemplates', 'proposalTemplates', 'files', 'decks', 'choices', 'proposals', 'contracts', 'invoices',
  'timeEntries', 'hubVersions', 'approvals', 'timeOff', 'expenses', 'leads', 'leadLists', 'activity', 'notifications', 'outbox',
  'designs', 'mockups', 'posts', 'webPages', 'audits',
] as const satisfies readonly (keyof State)[]
export type CollName = (typeof COLLECTIONS)[number]

/** Lists kept newest first (the rest grow at the end). */
export const NEWEST_FIRST: ReadonlySet<string> = new Set(['activity', 'notifications', 'outbox'])

/** Single values, one row each under the `_meta` collection. */
export const SINGLES = ['studio', 'nextInvoiceNumber'] as const satisfies readonly (keyof State)[]
export const META = '_meta'

export type Row = { coll: string; id: string; data: unknown; ord: number; deleted?: boolean }
export type Change = { coll: string; id: string; data: unknown; deleted?: boolean }

export const keyOf = (coll: string, id: string) => `${coll}/${id}`

type Item = { id: string }
const list = (s: State, coll: CollName) => (s[coll] as unknown as Item[]) ?? []

/** The whole workspace as rows – for moving it to the cloud the first time. */
export function toRows(s: State): Row[] {
  const rows: Row[] = []
  for (const coll of COLLECTIONS) {
    const items = list(s, coll)
    // Order from the list itself: newest-first lists count down, so later items still come first.
    items.forEach((item, i) => rows.push({ coll, id: item.id, data: item, ord: NEWEST_FIRST.has(coll) ? items.length - i : i }))
  }
  for (const k of SINGLES) rows.push({ coll: META, id: k, data: s[k], ord: 0 })
  return rows
}

/**
 * A workspace from rows: the lists in their order, the single values – and what isn't shared
 * (who's using this browser) kept from `local`.
 */
export function fromRows(rows: Row[], local: State): State {
  const next = { ...local } as Record<string, unknown>
  const byColl = new Map<string, Row[]>()
  for (const r of rows) {
    if (r.deleted) continue
    if (!byColl.has(r.coll)) byColl.set(r.coll, [])
    byColl.get(r.coll)!.push(r)
  }
  for (const coll of COLLECTIONS) {
    const rs = byColl.get(coll) ?? []
    rs.sort((a, b) => (NEWEST_FIRST.has(coll) ? b.ord - a.ord : a.ord - b.ord))
    next[coll] = rs.map((r) => r.data)
  }
  for (const r of byColl.get(META) ?? []) if ((SINGLES as readonly string[]).includes(r.id)) next[r.id] = r.data
  return next as unknown as State
}

/**
 * What changed from `prev` to `next`, item by item. `fromCloud` says whether a value is one that
 * just arrived from the cloud (so it isn't sent straight back); `goneInCloud` the same for items
 * removed there.
 */
export function diff(prev: State, next: State, fromCloud: (key: string, value: unknown) => boolean = () => false, goneInCloud: ReadonlySet<string> = new Set()): Change[] {
  if (prev === next) return []
  const out: Change[] = []
  for (const coll of COLLECTIONS) {
    const a = list(prev, coll)
    const b = list(next, coll)
    if (a === b) continue
    const before = new Map(a.map((x) => [x.id, x]))
    for (const item of b) {
      const old = before.get(item.id)
      before.delete(item.id)
      if (old !== item && !fromCloud(keyOf(coll, item.id), item)) out.push({ coll, id: item.id, data: item })
    }
    for (const id of before.keys()) if (!goneInCloud.has(keyOf(coll, id))) out.push({ coll, id, data: null, deleted: true })
  }
  for (const k of SINGLES) {
    if (prev[k] !== next[k] && !fromCloud(keyOf(META, k), next[k])) out.push({ coll: META, id: k, data: next[k] })
  }
  return out
}

/** Changes from the cloud, applied to a workspace: items replaced where they are, new ones added in their place, removed ones gone. */
export function applyRows(s: State, rows: Row[]): State {
  if (!rows.length) return s
  const next = { ...s } as Record<string, unknown>
  const copied = new Set<string>()
  for (const r of rows) {
    if (r.coll === META) {
      if ((SINGLES as readonly string[]).includes(r.id) && !r.deleted) next[r.id] = r.data
      continue
    }
    if (!(COLLECTIONS as readonly string[]).includes(r.coll)) continue
    if (!copied.has(r.coll)) {
      next[r.coll] = [...((next[r.coll] as Item[]) ?? [])]
      copied.add(r.coll)
    }
    const items = next[r.coll] as Item[]
    const i = items.findIndex((x) => x.id === r.id)
    if (r.deleted) {
      if (i >= 0) items.splice(i, 1)
    } else if (i >= 0) items[i] = r.data as Item
    else if (NEWEST_FIRST.has(r.coll)) items.unshift(r.data as Item)
    else items.push(r.data as Item)
  }
  return next as unknown as State
}
