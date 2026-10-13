/**
 * Uploaded files live in IndexedDB (localStorage is too small for images and PDFs).
 * A version's `src` is either 'idb:<key>' (stored here) or a data: URL (built-in samples).
 *
 * With the cloud on (src/data/cloud), every file is also kept in the studio's cloud storage under
 * the same key: new files go up as they're added, and files this browser doesn't have are fetched
 * when they're first needed.
 */
import { useEffect, useState } from 'react'

// Named before the rename, and left that way: moving a database means copying every uploaded file
// out of one and into the other, which for a studio with gigabytes of artwork is slow, can run out
// of space halfway, and gains nothing anyone can see. See the note on STORAGE_KEY in store.tsx.
const DB = 'forme-files'
const STORE = 'blobs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

/** The studio's cloud storage, when there is one. */
export type BlobCloud = { upload(key: string, blob: Blob): Promise<void>; download(key: string): Promise<Blob | null> }
let cloud: BlobCloud | null = null
const PENDING = 'formlar:uploads-pending'

const pendingUploads = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING) ?? '[]')
  } catch {
    return []
  }
}
const setPending = (keys: string[]) => {
  try {
    localStorage.setItem(PENDING, JSON.stringify([...new Set(keys)]))
  } catch {
    /* can't remember – the next "upload everything" catches it */
  }
}

async function send(key: string, blob: Blob) {
  if (!cloud) return
  try {
    await cloud.upload(key, blob)
    setPending(pendingUploads().filter((k) => k !== key))
  } catch {
    setPending([...pendingUploads(), key])
  }
}

/** Connects the cloud (or disconnects it with null), and sends anything that didn't make it last time. */
export function connectBlobCloud(c: BlobCloud | null) {
  cloud = c
  if (!c) return
  // Pictures that couldn't be found before can now come from the cloud.
  window.dispatchEvent(new Event('formlar-blobs'))
  for (const key of pendingUploads()) getBlob(key).then((b) => b && send(key, b))
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>('readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>).catch(() => undefined)
}

/** Every file this browser has – for moving a workspace to the cloud. */
export async function allBlobKeys(): Promise<string[]> {
  return tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((keys) => keys.map(String)).catch(() => [])
}

/** Stores a raw blob under a key (for the backup kept before joining the cloud). */
export const putBlobAt = (key: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, key))

export async function putBlob(blob: Blob): Promise<string> {
  const key = crypto.randomUUID()
  await tx('readwrite', (s) => s.put(blob, key))
  void send(key, blob)
  return 'idb:' + key
}

export const deleteBlob = (src: string) =>
  src.startsWith('idb:') ? tx('readwrite', (s) => s.delete(src.slice(4))).catch(() => undefined) : Promise.resolve()

const cache = new Map<string, string>()

export async function resolveSrc(src: string): Promise<string | null> {
  if (!src.startsWith('idb:')) return src
  if (cache.has(src)) return cache.get(src)!
  const key = src.slice(4)
  let blob = await getBlob(key)
  // Not in this browser: fetch it from the studio's cloud, and keep it here for next time.
  if (!blob && cloud) {
    blob = (await cloud.download(key).catch(() => null)) ?? undefined
    if (blob) await tx('readwrite', (s) => s.put(blob, key)).catch(() => undefined)
  }
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  cache.set(src, url)
  return url
}

/** Resolves a version src to something an <img> / <a download> can use. */
export function useSrc(src?: string) {
  const [url, setUrl] = useState<string | null>(src && !src.startsWith('idb:') ? src : null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    if (!src) return setUrl(null)
    resolveSrc(src).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [src, attempt])
  // Missing here? Try again once the studio's cloud is connected.
  useEffect(() => {
    if (url || !src?.startsWith('idb:')) return
    const retry = () => setAttempt((n) => n + 1)
    window.addEventListener('formlar-blobs', retry)
    return () => window.removeEventListener('formlar-blobs', retry)
  }, [url, src])
  return url
}

export async function download(src: string, name: string) {
  const url = await resolveSrc(src)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

export const isImage = (mime: string) => mime.startsWith('image/')
export const formatSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`
