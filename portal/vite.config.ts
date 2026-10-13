import { existsSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((done, fail) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => done(Buffer.concat(chunks)))
    req.on('error', fail)
  })

/**
 * The functions in api/ (AI drafts and images, company lookup, payments) also run under
 * `npm run dev`, with the keys from .env.local – no `vercel dev` needed. Files starting with _
 * are helpers, as on Vercel.
 */
function apiInDev(env: Record<string, string>): Plugin {
  return {
    name: 'aftryk-api-in-dev',
    configureServer(server: ViteDevServer) {
      // Server-side keys (no VITE_ prefix) for the functions, never for the browser bundle.
      for (const [k, v] of Object.entries(env)) if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()
        const file = resolve(__dirname, `.${url.pathname}.ts`)
        if (!file.startsWith(resolve(__dirname, 'api')) || url.pathname.split('/').pop()!.startsWith('_') || !existsSync(file)) return next()
        try {
          const { default: handler } = (await server.ssrLoadModule(file)) as { default: (r: Request) => Promise<Response> }
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const response = await handler(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body }))
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          server.config.logger.error(`api${url.pathname}: ${err instanceof Error ? err.stack : err}`)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'The function crashed – see the terminal' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), apiInDev(loadEnv(mode, process.cwd(), ''))],
}))
