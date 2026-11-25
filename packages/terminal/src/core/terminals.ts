import type { TerminalHost, TerminalSession } from '@tensorai-workspace/host'
import { Emitter } from './events.js'
import { Screen } from './screen.js'

/** Output is taken in pieces this size, so that the page stays responsive however much there is. */
const CHUNK = 65_536
/** How long taking output may go on before the page gets a turn. */
const BUDGET_MS = 12

const encoder = new TextEncoder()

export interface TerminalInstanceOptions {
  cwd?: string
  scrollback?: number
}

/** A terminal: a screen, and the session that fills it once the size is known. */
export class TerminalInstance {
  readonly screen: Screen
  /** The name, the title or the state changed. */
  readonly onChange = new Emitter<void>()
  /** The process ended. */
  readonly onExit = new Emitter<number | null>()
  status: 'waiting' | 'running' | 'exited' = 'waiting'
  exitCode: number | null | undefined
  private session: TerminalSession | undefined
  private disposed = false

  constructor(
    readonly id: string,
    private readonly host: TerminalHost,
    private readonly options: TerminalInstanceOptions = {},
  ) {
    this.screen = new Screen({ scrollback: options.scrollback })
    this.screen.onTitle.listen(() => this.onChange.emit())
  }

  /** The process's name. */
  get name(): string {
    return this.session?.name ?? 'terminal'
  }

  /** What to call it: the title a program gave, or the process. */
  get title(): string {
    return this.screen.title || this.name
  }

  /** Starts the session, the first time; later it's the new size. */
  resize(cols: number, rows: number): void {
    if (this.disposed) return
    if (!this.session) this.open(cols, rows)
    else if (this.status === 'running') this.session.resize(cols, rows)
  }

  /** What's typed, for the process. */
  write(data: Uint8Array): void {
    if (this.status === 'running') this.session?.write(data)
  }

  /** Types text. */
  type(text: string): void {
    this.write(encoder.encode(text))
  }

  /** Ends the process. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.status === 'running') this.session?.close()
  }

  private open(cols: number, rows: number) {
    try {
      this.session = this.host.open({ cols, rows, cwd: this.options.cwd })
    } catch (error) {
      this.ended(null, error)
      return
    }
    this.status = 'running'
    this.onChange.emit()
    const { session } = this
    const done = this.pump(session.output)
    void session.exited.then(
      // After the last of its output.
      ({ code }) => done.then(() => this.ended(code)),
      (error: unknown) => this.ended(null, error),
    )
  }

  private async pump(output: ReadableStream<Uint8Array>) {
    const reader = output.getReader()
    let started = performance.now()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done || this.disposed) break
        for (let at = 0; at < value.length; at += CHUNK) {
          this.screen.write(value.subarray(at, at + CHUNK))
          if (performance.now() - started < BUDGET_MS) continue
          await new Promise((resolve) => setTimeout(resolve))
          started = performance.now()
        }
      }
    } catch {
      // The stream broke: the session's end says what happened.
    }
  }

  private ended(code: number | null, error?: unknown) {
    if (this.status === 'exited') return
    this.status = 'exited'
    this.exitCode = code
    const why = error instanceof Error ? error.message : error ? String(error) : code ? `The process exited with code ${code}` : undefined
    if (why && !this.disposed) this.screen.write(`\r\n\x1b[2m[${why.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ')}]\x1b[0m\r\n`)
    this.onChange.emit()
    this.onExit.emit(code)
  }
}

/** A list of terminals, one of them active, with no DOM. */
export class Terminals {
  /** Increases with every change. */
  version = 0
  private items: TerminalInstance[] = []
  private activeId: string | undefined
  private recent: string[] = []
  private next = 1
  private readonly listeners = new Set<() => void>()

  constructor(
    readonly host: TerminalHost,
    private readonly options: TerminalInstanceOptions = {},
  ) {}

  get list(): readonly TerminalInstance[] {
    return this.items
  }

  get active(): TerminalInstance | undefined {
    return this.items.find((t) => t.id === this.activeId)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Adds a terminal and makes it the active one. Its session starts when it's first shown. */
  create(options: TerminalInstanceOptions = {}): TerminalInstance {
    const terminal = new TerminalInstance(`terminal-${this.next++}`, this.host, { ...this.options, ...options })
    terminal.onChange.listen(() => this.changed())
    // A process that ended well takes its terminal with it. One that didn't stays, so it can be read.
    terminal.onExit.listen((code) => {
      if (code === 0) this.close(terminal.id)
    })
    this.items = [...this.items, terminal]
    this.use(terminal.id)
    this.changed()
    return terminal
  }

  activate(id: string): void {
    if (id === this.activeId || !this.items.some((t) => t.id === id)) return
    this.use(id)
    this.changed()
  }

  /** Activates the terminal `by` places along, going round the ends. */
  cycle(by: number): void {
    const { length } = this.items
    if (!length) return
    const at = this.items.findIndex((t) => t.id === this.activeId)
    this.activate(this.items[(((at + by) % length) + length) % length]!.id)
  }

  /** Ends a terminal's process and takes it off the list. */
  close(id: string): void {
    const terminal = this.items.find((t) => t.id === id)
    if (!terminal) return
    this.items = this.items.filter((t) => t !== terminal)
    this.recent = this.recent.filter((r) => r !== id)
    if (this.activeId === id) this.activeId = this.recent[0]
    terminal.dispose()
    this.changed()
  }

  /** Ends every terminal. */
  dispose(): void {
    for (const terminal of [...this.items]) this.close(terminal.id)
  }

  private use(id: string) {
    this.activeId = id
    this.recent = [id, ...this.recent.filter((r) => r !== id)]
  }

  private changed() {
    this.version++
    for (const listener of [...this.listeners]) listener()
  }
}
