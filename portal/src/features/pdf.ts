/** Renders PDF pages to images so comments can be pinned on them (#20). */
import { useEffect, useState } from 'react'

/** pdf.js is large, so it is only downloaded the first time someone opens a PDF. */
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
  return pdfjs
}

export type PdfPage = { src: string; width: number; height: number }

const cache = new Map<string, Promise<PdfPage[]>>()
const MAX_PAGES = 40

function render(url: string): Promise<PdfPage[]> {
  if (!cache.has(url)) {
    cache.set(
      url,
      (async () => {
        const pdfjs = await loadPdfjs()
        const doc = await pdfjs.getDocument({ url }).promise
        const pages: PdfPage[] = []
        for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
          const page = await doc.getPage(i)
          const viewport = page.getViewport({ scale: 1.6 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
          pages.push({ src: canvas.toDataURL('image/jpeg', 0.85), width: viewport.width, height: viewport.height })
        }
        return pages
      })(),
    )
  }
  return cache.get(url)!
}

export function usePdfPages(url: string | null) {
  const [pages, setPages] = useState<PdfPage[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let live = true
    setPages(null)
    setError(false)
    if (!url) return
    render(url)
      .then((p) => live && setPages(p))
      .catch(() => {
        cache.delete(url)
        if (live) setError(true)
      })
    return () => {
      live = false
    }
  }, [url])
  return { pages, error }
}
