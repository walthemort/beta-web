/**
 * Copied layers, kept so they paste into any artboard or design – also after a reload. The system
 * clipboard gets their text, which is how a paste knows the layers are still what was copied.
 */
import type { Layer } from '../../data/types'

const KEY = 'forme:cm-clipboard'

export type Clip = { layers: Layer[]; board: { width: number; height: number }; text: string; groups?: { id: string; name: string }[] }

let memory: Clip | null = null

/** What goes on the system clipboard: the copied text, or a plain note when there's none. */
export const clipText = (layers: Layer[]) =>
  layers.flatMap((l) => (l.type === 'text' ? [l.text] : [])).join('\n') || `forme: ${layers.map((l) => l.name).join(', ')}`

export function writeClip(clip: Clip) {
  memory = clip
  try {
    localStorage.setItem(KEY, JSON.stringify(clip))
  } catch {
    // Private mode or full storage – copying still works until the page reloads.
  }
}

export function readClip(): Clip | null {
  if (memory) return memory
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}
