/** Writes the logo files in public/brand and the favicon from src/components/brand.tsx: npx tsx scripts/brand-files.mts */
import { readFileSync, writeFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BRAND, Mark, Wordmark } from '../src/components/brand.tsx'
const out = new URL('../public', import.meta.url).pathname
const svg = (el: ReturnType<typeof h>) => '<?xml version="1.0" encoding="UTF-8"?>\n' + renderToStaticMarkup(el).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"').replace(/ style="[^"]*"/, '')
// currentColor becomes a real colour in files that live on their own.
const fix = (s: string, ink: string) => s.replaceAll('currentColor', ink)
writeFileSync(`${out}/brand/aftryk-wordmark.svg`, fix(svg(h(Wordmark, { height: 160 })), BRAND.ink))
writeFileSync(`${out}/brand/aftryk-wordmark-paper.svg`, fix(svg(h(Wordmark, { height: 160 })), BRAND.paper))
writeFileSync(`${out}/brand/aftryk-wordmark-cobalt.svg`, fix(svg(h(Wordmark, { height: 160 })), BRAND.cobalt))
writeFileSync(`${out}/brand/aftryk-mark.svg`, svg(h(Mark, { size: 120 })))
writeFileSync(`${out}/brand/aftryk-icon.svg`, svg(h(Mark, { size: 512, color: BRAND.paper, tile: BRAND.ink })))
writeFileSync(`${out}/favicon.svg`, svg(h(Mark, { size: 120, color: BRAND.paper, tile: BRAND.ink })))
// The loading screen shows the logo before the app (and its fonts) arrive.
const index = new URL('../index.html', import.meta.url)
const html = readFileSync(index, 'utf8')
const boot = renderToStaticMarkup(h(Wordmark, { height: 30 })).replace(/<title>.*?<\/title>/, '').replace('role="img" aria-label="Aftryk"', 'aria-hidden="true"')
writeFileSync(index, html.replace(/<!--logo-->[\s\S]*?<!--\/logo-->/, `<!--logo-->${boot}<!--/logo-->`))
console.log('ok')
