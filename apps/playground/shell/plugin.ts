import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const PATH = '/__shell'

interface Session {
  child: ChildProcess
  /** What came before anyone read it. */
  early: Buffer[]
  reader: ServerResponse | undefined
  exit: Promise<number | null>
}

/**
 * Real shells for the playground, over plain HTTP. Only in development, only when asked for (WORKSPACE_SHELL=1), and
 * only for this page: every request needs a token that's made anew each run and is in the page alone, so other sites
 * and other pages can't reach it.
 */
export function shell(): Plugin {
  const token = randomBytes(32).toString('hex')
  const sessions = new Map<string, Session>()
  const enabled = process.env.WORKSPACE_SHELL === '1'

  const allowed = (req: IncomingMessage) => {
    const given = Buffer.from(String(req.headers['x-shell-token'] ?? ''))
    const wanted = Buffer.from(token)
    const host = (req.headers.host ?? '').replace(/:\d+$/, '')
    return given.length === wanted.length && timingSafeEqual(given, wanted) && ['localhost', '127.0.0.1', '[::1]'].includes(host)
  }

  const frame = (kind: string, payload: Buffer) => {
    const head = Buffer.alloc(5)
    head.write(kind, 0, 'latin1')
    head.writeUInt32BE(payload.length, 1)
    return Buffer.concat([head, payload])
  }

  const body = async (req: IncomingMessage) => {
    const parts: Buffer[] = []
    for await (const part of req) parts.push(part as Buffer)
    return Buffer.concat(parts)
  }

  const open = (cols: number, rows: number) => {
    const child = spawn('python3', ['-I', join(here, 'bridge.py'), String(cols), String(rows), join(here, '../../..')], { stdio: ['pipe', 'pipe', 'inherit'] })
    const id = randomBytes(8).toString('hex')
    const session: Session = { child, early: [], reader: undefined, exit: new Promise((resolve) => child.on('exit', (code) => resolve(code))) }
    child.stdout!.on('data', (data: Buffer) => (session.reader ? session.reader.write(data) : session.early.push(data)))
    child.stdin!.on('error', () => {})
    void session.exit.then(() => {
      session.reader?.end()
      setTimeout(() => sessions.delete(id), 5000)
    })
    sessions.set(id, session)
    return id
  }

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const number = (name: string) => Math.max(1, Math.min(1000, Number(url.searchParams.get(name)) || 1))
    if (url.pathname === `${PATH}/open`) return res.end(JSON.stringify({ id: open(number('cols'), number('rows')) }))
    const session = sessions.get(url.searchParams.get('id') ?? '')
    if (!session) return void res.writeHead(404).end()
    switch (url.pathname.slice(PATH.length)) {
      case '/output':
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' })
        for (const data of session.early.splice(0)) res.write(data)
        session.reader = res
        // The page went away: so does the shell.
        res.on('close', () => session.child.stdin!.end())
        if (session.child.exitCode !== null) res.end()
        return
      case '/input':
        session.child.stdin!.write(frame('i', await body(req)))
        return res.end()
      case '/resize': {
        const size = Buffer.alloc(4)
        size.writeUInt16BE(number('cols'), 0)
        size.writeUInt16BE(number('rows'), 2)
        session.child.stdin!.write(frame('r', size))
        return res.end()
      }
      case '/exit':
        return res.end(JSON.stringify({ code: await session.exit }))
      case '/close':
        session.child.stdin!.end()
        return res.end()
    }
    res.writeHead(404).end()
  }

  return {
    name: 'playground-shell',
    apply: 'serve',
    configureServer(server) {
      if (!enabled) return
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(`${PATH}/`)) return next()
        if (req.method !== 'POST' || !allowed(req)) return void res.writeHead(403).end()
        handle(req, res).catch(() => res.writeHead(500).end())
      })
      const end = () => {
        for (const { child } of sessions.values()) child.stdin?.end()
      }
      server.httpServer?.on('close', end)
      process.on('exit', end)
    },
    transformIndexHtml: () => (enabled ? [{ tag: 'meta', attrs: { name: 'shell-token', content: token, 'data-name': basename(process.env.SHELL ?? 'sh') }, injectTo: 'head' as const }] : []),
  }
}
