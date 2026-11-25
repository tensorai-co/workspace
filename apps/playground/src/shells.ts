import type { FileSystem, TerminalHost, TerminalSession } from '@tensorai-workspace/host'

const meta = document.querySelector<HTMLMetaElement>('meta[name=shell-token]')
const token = meta?.content

/** Real shells, when the dev server runs with `npm run playground:shell`. */
class BridgeHost implements TerminalHost {
  open({ cols, rows }: { cols: number; rows: number }): TerminalSession {
    const post = (path: string, body?: BodyInit, signal?: AbortSignal) => fetch(`/__shell/${path}`, { method: 'POST', headers: { 'x-shell-token': token! }, body, signal })
    const id = post(`open?cols=${cols}&rows=${rows}`).then(async (r) => ((await r.json()) as { id: string }).id)
    // One request at a time, so that keys arrive in order.
    let queue: Promise<unknown> = id
    const send = (path: (id: string) => string, body?: BodyInit) => {
      queue = queue.then(async () => post(path(await id), body)).catch(() => {})
    }
    const abort = new AbortController()
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    return {
      name: meta?.dataset.name,
      output: new ReadableStream({
        async pull(controller) {
          try {
            reader ??= (await post(`output?id=${await id}`, undefined, abort.signal)).body!.getReader()
            const { done, value } = await reader.read()
            if (done) controller.close()
            else controller.enqueue(value)
          } catch {
            controller.close()
          }
        },
      }),
      write: (data) => send((id) => `input?id=${id}`, data as BodyInit),
      resize: (cols, rows) => send((id) => `resize?id=${id}&cols=${cols}&rows=${rows}`),
      close: () => {
        send((id) => `close?id=${id}`)
        abort.abort()
      },
      exited: id.then(async (id) => (await (await post(`exit?id=${id}`)).json()) as { code: number | null }),
    }
  }
}

/** A pretend shell over the playground's files: enough to try the terminal with no real one. */
class DemoHost implements TerminalHost {
  constructor(
    private readonly fs: FileSystem,
    private readonly root: string,
  ) {}

  open(size: { cols: number; rows: number }): TerminalSession {
    const { fs, root } = this
    const encoder = new TextEncoder()
    let controller!: ReadableStreamDefaultController<Uint8Array>
    let end!: (result: { code: number | null }) => void
    let cwd = root
    let line = ''
    let { cols } = size
    const history: string[] = []
    let at = 0
    let open = true
    const print = (text: string) => open && controller.enqueue(encoder.encode(text))
    const prompt = () => print(`\x1b[32mplayground\x1b[0m \x1b[1;34m${cwd}\x1b[0m $ `)
    const exit = (code: number | null) => {
      if (!open) return
      open = false
      controller.close()
      end({ code })
    }
    const resolve = (path = '') => {
      const parts = (path.startsWith('/') ? path : `${cwd}/${path}`).split('/')
      const out: string[] = []
      for (const part of parts) if (part === '..') out.pop()
        else if (part && part !== '.') out.push(part)
      return `/${out.join('/')}`
    }
    const run = async (text: string) => {
      const [command, ...args] = text.trim().split(/\s+/)
      switch (command) {
        case '':
        case undefined:
          break
        case 'help':
          print('help, ls, cd, pwd, cat, echo, clear, colors, styles, box, links, size, flood, exit\r\n')
          break
        case 'ls': {
          const entries = await fs.list(resolve(args[0]))
          print(`${entries.map((e) => (e.kind === 'dir' ? `\x1b[1;34m${e.name}\x1b[0m` : e.name)).join('  ')}\r\n`)
          break
        }
        case 'cd':
          await fs.list(resolve(args[0] ?? root))
          cwd = args[0] ? resolve(args[0]) : root
          break
        case 'pwd':
          print(`${cwd}\r\n`)
          break
        case 'cat':
          print(new TextDecoder().decode(await fs.read(resolve(args[0]))).replace(/\n/g, '\r\n'))
          break
        case 'echo':
          print(`${args.join(' ')}\r\n`)
          break
        case 'clear':
          print('\x1b[H\x1b[2J\x1b[3J')
          break
        case 'colors':
          for (let row = 0; row < 2; row++) print(`${Array.from({ length: 8 }, (_, i) => `\x1b[${(row ? 90 : 30) + i}m color${i + row * 8} \x1b[0m`).join('')}\r\n`)
          for (let row = 0; row < 2; row++) print(`${Array.from({ length: 8 }, (_, i) => `\x1b[${(row ? 100 : 40) + i}m      \x1b[0m`).join('')}\r\n`)
          for (let n = 16; n < 232; n++) print(`\x1b[48;5;${n}m  \x1b[0m${(n - 15) % 36 === 0 ? '\r\n' : ''}`)
          for (let n = 232; n < 256; n++) print(`\x1b[48;5;${n}m  \x1b[0m`)
          print('\r\n')
          for (let x = 0; x < Math.min(72, cols); x++) print(`\x1b[48;2;${Math.round((x * 255) / 72)};${Math.round(128 - x)};${Math.round(255 - (x * 255) / 72)}m \x1b[0m`)
          print('\r\n')
          break
        case 'styles':
          print('\x1b[1mbold\x1b[0m \x1b[2mdim\x1b[0m \x1b[3mitalic\x1b[0m \x1b[4munderline\x1b[0m \x1b[4:2mdouble\x1b[0m \x1b[4:3;58;5;1mcurly\x1b[0m \x1b[4:4mdotted\x1b[0m \x1b[4:5mdashed\x1b[0m \x1b[7minverse\x1b[0m \x1b[9mstrike\x1b[0m \x1b[53moverline\x1b[0m \x1b[5mblink\x1b[0m\r\n你好，世界  한국어  日本語  😀👍  café  é  →←↑↓ ✓ ✗\r\n')
          break
        case 'box':
          print('┌──────┬──────┐  ╔══════╦══════╗  ╭──────╮  ┏━━━┓  ▁▂▃▄▅▆▇█\r\n│ one  │ two  │  ║ one  ║ two  ║  │ arcs │  ┃ h ┃  ▏▎▍▌▋▊▉█\r\n├──────┼──────┤  ╠══════╬══════╣  ╰──────╯  ┗━━━┛  ░▒▓█ ▖▗▘▙▚▛▜▝▞▟\r\n└──────┴──────┘  ╚══════╩══════╝  ╒══╕ ╓──╖  ┄┄┄ ┅┅┅ ╱╲╳\r\n')
          break
        case 'links':
          print('A URL: https://example.com/a(b)c?d=e. And a \x1b]8;;https://example.com/marked\x1b\\marked link\x1b]8;;\x1b\\.\r\n')
          break
        case 'size':
          print(`${cols} columns\r\n`)
          break
        case 'flood':
          for (let i = 0; i < 5000; i++) print(`\x1b[3${i % 8}mline ${i}\x1b[0m ${'lorem ipsum dolor sit amet '.repeat(3)}\r\n`)
          break
        case 'exit':
          exit(Number(args[0] ?? 0))
          return
        default:
          print(`\x1b[31m${command}: not found\x1b[0m (try help)\r\n`)
      }
    }
    let busy = Promise.resolve()
    const key = (text: string) => {
      for (const part of text.match(/\x1b\[200~[\s\S]*?\x1b\[201~|\x1b\[[0-9;]*[A-Za-z~]|\x1bO.|\x1b.|[\s\S]/g) ?? []) {
        if (part === '\r') {
          print('\r\n')
          const command = line
          if (command) history.push(command)
          at = history.length
          line = ''
          busy = busy.then(() => run(command)).catch((e: Error) => print(`\x1b[31m${e.message}\x1b[0m\r\n`)).then(() => void (open && prompt()))
        } else if (part === '\x7f') {
          if (line) print('\b \b')
          line = line.slice(0, -1)
        } else if (part === '\x03') {
          print('^C\r\n')
          line = ''
          prompt()
        } else if (part === '\x04') {
          if (!line) exit(0)
        } else if (part === '\x1b[A' || part === '\x1b[B') {
          at = Math.max(0, Math.min(history.length, at + (part === '\x1b[A' ? -1 : 1)))
          print('\b \b'.repeat(line.length))
          line = history[at] ?? ''
          print(line)
        } else if (part >= ' ' && part[0] !== '\x1b') {
          line += part
          print(part)
        }
      }
    }
    const session: TerminalSession = {
      name: 'demo',
      output: new ReadableStream({ start: (c) => void (controller = c) }),
      write: (data) => key(new TextDecoder().decode(data)),
      resize: (c) => void (cols = c),
      close: () => exit(null),
      exited: new Promise((r) => (end = r)),
    }
    print('A pretend shell over the playground’s files. Type \x1b[1mhelp\x1b[0m.\r\n')
    prompt()
    return session
  }
}

/** Real shells where there are some, and pretend ones otherwise. */
export const shells = (fs: FileSystem, root: string): TerminalHost => (token ? new BridgeHost() : new DemoHost(fs, root))
