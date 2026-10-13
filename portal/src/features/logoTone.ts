import { useEffect, useState } from 'react'

/**
 * Is a logo mostly light or mostly dark? Looks at the visible pixels only (transparent ones are
 * the background), so a white wordmark on a transparent PNG/SVG counts as light. A light logo
 * needs a dark tile and the other way round; logos with both read fine on either.
 */
export function logoTone(img: HTMLImageElement): 'light' | 'dark' | 'mixed' {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 'mixed'
  ctx.drawImage(img, 0, 0, size, size)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    return 'mixed' // A cross-origin image we're not allowed to read.
  }
  let sum = 0
  let weight = 0
  let transparent = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255
    if (a < 0.5) {
      transparent++
      continue
    }
    sum += ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255) * a
    weight += a
  }
  // A logo with its own solid background (a JPG, a filled square) brings its backdrop along.
  if (!weight || transparent < (data.length / 4) * 0.05) return 'mixed'
  const avg = sum / weight
  return avg > 0.7 ? 'light' : avg < 0.3 ? 'dark' : 'mixed'
}

/** The tile a logo should sit on, worked out once its image has loaded. */
export function useLogoTone(url?: string | null) {
  const [tone, setTone] = useState<'light' | 'dark' | 'mixed'>('mixed')
  useEffect(() => {
    if (!url) return
    let live = true
    const img = new Image()
    img.onload = () => live && setTone(logoTone(img))
    img.src = url
    return () => {
      live = false
    }
  }, [url])
  return tone
}
