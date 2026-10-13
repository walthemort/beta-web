/**
 * Aftryk's cloud on Supabase: sign-in, the studio's rows (the sync engine's `Remote`) and its
 * files. Loaded only when the cloud is set up (see config.ts), so the app stays small without it.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { BlobCloud } from '../blobs'
import type { Row } from './records'
import type { CloudRow, Remote } from './sync'
import { CLOUD } from './config'

let client: SupabaseClient | null = null

export function supabase() {
  if (!client) client = createClient(CLOUD.url!, CLOUD.key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  return client
}

const COLUMNS = 'coll,id,data,ord,deleted,updated_at,client'

export function supabaseRemote(sb = supabase()): Remote {
  return {
    async pull(studio) {
      const out: CloudRow[] = []
      // A thousand rows at a time – the most the API hands out at once.
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('records').select(COLUMNS).eq('studio_id', studio).eq('deleted', false).order('ord').range(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data as CloudRow[]))
        if (data.length < 1000) break
      }
      return out
    },
    async fetchOne(studio, coll, id) {
      const { data, error } = await sb.from('records').select(COLUMNS).eq('studio_id', studio).eq('coll', coll).eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return data as CloudRow | null
    },
    async push(studio, rows: Row[], clientId) {
      const payload = rows.map((r) => ({ studio_id: studio, coll: r.coll, id: r.id, data: r.data ?? {}, ord: r.ord, deleted: !!r.deleted, client: clientId }))
      const { error } = await sb.from('records').upsert(payload, { onConflict: 'studio_id,coll,id' })
      if (error) throw new Error(error.message)
    },
    subscribe(studio, onRow, onConnected) {
      const channel = sb
        .channel(`records-${studio}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `studio_id=eq.${studio}` }, (payload) => {
          const r = payload.new as Partial<CloudRow> | undefined
          if (!r?.coll || !r.id) return
          onRow({ coll: r.coll, id: r.id, data: r.data, ord: r.ord ?? 0, deleted: r.deleted, client: r.client, updated_at: r.updated_at })
        })
        .subscribe((status) => onConnected(status === 'SUBSCRIBED'))
      return () => {
        void sb.removeChannel(channel)
      }
    },
  }
}

/** The studio's files: <studio id>/<file key> in the private "files" bucket. */
export function supabaseFiles(studio: string, sb = supabase()): BlobCloud {
  return {
    async upload(key, blob) {
      const { error } = await sb.storage.from('files').upload(`${studio}/${key}`, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })
      if (error) throw new Error(error.message)
    },
    async download(key) {
      const { data, error } = await sb.storage.from('files').download(`${studio}/${key}`)
      return error ? null : data
    },
  }
}
