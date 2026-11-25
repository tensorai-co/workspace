import type { TerminalHost, TerminalSession } from '@tensorai-co/workspace/host'

export interface ScriptedTerminalOptions {
  /** What every session prints when it opens: recorded output, for instance. */
  output?: string | Uint8Array
  /** Prints what's typed, with a line break after Return. On by default. */
  echo?: boolean
  name?: string
  /** Called with what's typed, to answer with `session.print`. */
  onInput?: (text: string, session: ScriptedSession) => void
}

/** Terminals that play a script. */
export class ScriptedTerminalHost implements TerminalHost {
  /** Every session opened, in order. */
  readonly sessions: ScriptedSession[] = []

  constructor(private readonly options: ScriptedTerminalOptions = {}) {}

  open(size: { cols: number; rows: number; cwd?: string }): ScriptedSession {
    const session = new ScriptedSession(size, this.options)
    this.sessions.push(session)
    return session
  }
}

const encoder = new TextEncoder()

/** A session of a script: no process, only what it's told. */
export class ScriptedSession implements TerminalSession {
  readonly output: ReadableStream<Uint8Array>
  readonly name: string | undefined
  readonly exited: Promise<{ code: number | null }>
  readonly cwd: string | undefined
  /** Everything written to it, as text. */
  input = ''
  /** Every size it's had. */
  readonly sizes: [cols: number, rows: number][]
  closed = false
  private controller: ReadableStreamDefaultController<Uint8Array> | undefined
  private ended!: (result: { code: number | null }) => void

  constructor(
    size: { cols: number; rows: number; cwd?: string },
    private readonly options: ScriptedTerminalOptions,
  ) {
    this.name = options.name
    this.cwd = size.cwd
    this.sizes = [[size.cols, size.rows]]
    this.exited = new Promise((resolve) => (this.ended = resolve))
    this.output = new ReadableStream({ start: (controller) => void (this.controller = controller) })
    if (options.output) this.print(options.output)
  }

  /** Prints something, as the process would. */
  print(data: string | Uint8Array): void {
    if (!this.closed) this.controller?.enqueue(typeof data === 'string' ? encoder.encode(data) : data)
  }

  /** Ends, as if the process had. */
  exit(code: number | null = 0): void {
    if (this.closed) return
    this.closed = true
    this.controller?.close()
    this.ended({ code })
  }

  write(data: Uint8Array): void {
    const text = new TextDecoder().decode(data)
    this.input += text
    if (this.options.echo ?? true) this.print(text.replace(/\r/g, '\r\n'))
    this.options.onInput?.(text, this)
  }

  resize(cols: number, rows: number): void {
    this.sizes.push([cols, rows])
  }

  close(): void {
    this.exit(null)
  }
}
