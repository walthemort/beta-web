/**
 * File space. Uploads live in this browser's storage until Aftryk is online; the plan (plus any
 * extra packs) sets how much a studio may use, and uploads stop at the limit.
 */
import { storageGb } from './plans'
import type { State } from './types'

/** Roughly how much this studio's files take up now (null if the browser won't say). */
export async function bytesUsed(): Promise<number | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    return e?.usage ?? null
  } catch {
    return null
  }
}

/** Is there room for this many more bytes on the studio's plan? Unknown usage counts as room. */
export async function hasRoom(s: Pick<State, 'studio'>, bytes: number) {
  const used = await bytesUsed()
  return used === null || used + bytes <= storageGb(s) * 1024 ** 3
}
