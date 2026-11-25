import { isMacPlatform, keybindingLabel, parseKeybinding, sameStroke, strokeLabel, strokeOf, type KeyEventLike, type Stroke } from './keys.js'
import { evaluateWhen } from './when.js'

type Listener = () => void

/** A small store others can subscribe to, as React's `useSyncExternalStore` expects. */
class Store {
  private listeners = new Set<Listener>()
  /** Counts up with every change. */
  version = 0
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  protected changed() {
    this.version++
    for (const listener of [...this.listeners]) listener()
  }
}

/** Named values that `when` clauses read: what has the focus, what's visible, the active file's language. */
export class ContextKeys extends Store {
  private values = new Map<string, unknown>()

  get = (key: string): unknown => this.values.get(key)

  /** Sets a value; undefined removes it. Listeners hear only real changes. */
  set(key: string, value: unknown): void {
    if (this.values.get(key) === value) return
    if (value === undefined) this.values.delete(key)
    else this.values.set(key, value)
    this.changed()
  }

  /** Sets several at once, with one notice. */
  setAll(values: Record<string, unknown>): void {
    let changed = false
    for (const [key, value] of Object.entries(values)) {
      if (this.values.get(key) === value) continue
      if (value === undefined) this.values.delete(key)
      else this.values.set(key, value)
      changed = true
    }
    if (changed) this.changed()
  }

  /** Whether a `when` clause holds now. */
  matches(when: string | undefined): boolean {
    return evaluateWhen(when, this.get)
  }

  snapshot(): Record<string, unknown> {
    return Object.fromEntries(this.values)
  }
}

/** Something the IDE can do: from a key, a menu, a button or the host app. */
export interface Command {
  /** The id where there's one, such as `workbench.action.toggleSidebarVisibility`. */
  id: string
  title: string
  /** Shown before the title in lists: "View", "Terminal". */
  category?: string
  /** Its key, such as `mod+b` or the chord `mod+k v`. */
  keybinding?: string
  /** Its key on macOS, when it differs. */
  mac?: string
  /** When its key works. */
  when?: string
  run: (...args: unknown[]) => unknown
}

/** A key for a command, added apart from it: a host's own keys, or another key for a built-in command. */
export interface KeybindingRule {
  key: string
  mac?: string
  command: string
  when?: string
  args?: unknown[]
  /** Another key for it, after its own: it doesn't change the key it's shown with. F1 for the command palette. */
  secondary?: boolean
}

interface Binding {
  strokes: Stroke[]
  command: string
  when?: string
  args?: unknown[]
  /** Later bindings win over earlier ones. */
  order: number
}

export interface CommandRegistryOptions {
  /** Whether keys are read as on a Mac. From the browser by default. */
  mac?: boolean
}

/**
 * Every command, with its keys. Registering an id that's there already replaces it until the new one is disposed, so
 * a host can override any built-in command.
 */
export class CommandRegistry extends Store {
  readonly mac: boolean
  private commands = new Map<string, Command[]>()
  private rules: { rule: KeybindingRule; order: number }[] = []
  private order = 0
  private cachedBindings: Binding[] | undefined

  constructor(options: CommandRegistryOptions = {}) {
    super()
    this.mac = options.mac ?? isMacPlatform()
  }

  /** Adds a command, or several. Returns a function that takes them away again. */
  register(...commands: Command[]): () => void {
    for (const command of commands) {
      const stack = this.commands.get(command.id) ?? []
      stack.push(command)
      this.commands.set(command.id, stack)
    }
    this.invalidate()
    return () => {
      for (const command of commands) {
        const stack = this.commands.get(command.id)
        const at = stack?.lastIndexOf(command) ?? -1
        if (!stack || at < 0) continue
        stack.splice(at, 1)
        if (!stack.length) this.commands.delete(command.id)
      }
      this.invalidate()
    }
  }

  /** Adds keys for commands. Returns a function that takes them away again. */
  bind(...rules: KeybindingRule[]): () => void {
    const added = rules.map((rule) => ({ rule, order: ++this.order }))
    this.rules.push(...added)
    this.invalidate()
    return () => {
      this.rules = this.rules.filter((r) => !added.includes(r))
      this.invalidate()
    }
  }

  get(id: string): Command | undefined {
    const stack = this.commands.get(id)
    return stack?.[stack.length - 1]
  }

  has(id: string): boolean {
    return this.commands.has(id)
  }

  /** Every command, in the order they were first added. */
  list(): Command[] {
    return [...this.commands.values()].map((stack) => stack[stack.length - 1]!)
  }

  /** Runs a command. Throws for an id that isn't registered. */
  execute(id: string, ...args: unknown[]): unknown {
    const command = this.get(id)
    if (!command) throw new Error(`No command "${id}"`)
    return command.run(...args)
  }

  /** Every key, newest first. */
  bindings(): readonly Binding[] {
    if (this.cachedBindings) return this.cachedBindings
    const out: Binding[] = []
    const read = (text: string, command: string) => {
      try {
        return parseKeybinding(text, this.mac)
      } catch (e) {
        console.warn(`Ignoring the key of "${command}": ${(e as Error).message}`)
        return undefined
      }
    }
    let i = 0
    for (const command of this.list()) {
      const text = (this.mac && command.mac) || command.keybinding
      const strokes = text && read(text, command.id)
      if (strokes) out.push({ strokes, command: command.id, when: command.when, order: i++ - 1e9 })
    }
    for (const { rule, order } of this.rules) {
      const text = (this.mac && rule.mac) || rule.key
      const strokes = text && read(text, rule.command)
      if (strokes) out.push({ strokes, command: rule.command, when: rule.when, args: rule.args, order: rule.secondary ? order - 2e9 : order })
    }
    this.cachedBindings = out.sort((a, b) => b.order - a.order)
    return this.cachedBindings
  }

  /** A command's key ("⇧⌘E"), or undefined when it has none. */
  keyLabel(id: string): string | undefined {
    const binding = this.bindings().find((b) => b.command === id)
    return binding && keybindingLabel(binding.strokes, this.mac)
  }

  /** A command's title with its key, for a tooltip: "Toggle Panel (⌘J)". */
  tooltip(id: string, title = this.get(id)?.title ?? id): string {
    const key = this.keyLabel(id)
    return key ? `${title} (${key})` : title
  }

  private invalidate() {
    this.cachedBindings = undefined
    this.changed()
  }
}

/** What a key did. */
export type KeyResult =
  | { kind: 'none' }
  /** The first key of a chord: the next key finishes it. */
  | { kind: 'chord'; label: string }
  | { kind: 'command'; id: string }
  /** The second key of a chord that isn't bound to anything. */
  | { kind: 'unbound'; label: string }

/**
 * Turns keys into commands, chords included. A key that starts a chord waits for the next one, and a
 * binding only counts while its `when` clause holds, so keys a command doesn't want go on to whatever has the focus.
 */
export class Keybindings extends Store {
  private pending: Stroke | undefined

  constructor(
    readonly commands: CommandRegistry,
    readonly context: ContextKeys,
  ) {
    super()
  }

  /** The first key of a chord being waited on, as shown: "⌘K". */
  get chord(): string | undefined {
    return this.pending && strokeLabel(this.pending, this.commands.mac)
  }

  /** Reads a key. Runs the command it's bound to, if any. */
  handle(e: KeyEventLike): KeyResult {
    const stroke = strokeOf(e)
    if (!stroke) return { kind: 'none' }
    const live = this.commands.bindings().filter((b) => this.commands.has(b.command) && this.context.matches(b.when))

    if (this.pending) {
      const first = this.pending
      this.setPending(undefined)
      const label = `${strokeLabel(first, this.commands.mac)} ${strokeLabel(stroke, this.commands.mac)}`
      const hit = live.find((b) => b.strokes.length === 2 && sameStroke(b.strokes[0]!, first) && sameStroke(b.strokes[1]!, stroke))
      if (!hit) return { kind: 'unbound', label }
      this.commands.execute(hit.command, ...(hit.args ?? []))
      return { kind: 'command', id: hit.command }
    }

    if (live.some((b) => b.strokes.length === 2 && sameStroke(b.strokes[0]!, stroke))) {
      this.setPending(stroke)
      return { kind: 'chord', label: strokeLabel(stroke, this.commands.mac) }
    }
    const hit = live.find((b) => b.strokes.length === 1 && sameStroke(b.strokes[0]!, stroke))
    if (!hit) return { kind: 'none' }
    this.commands.execute(hit.command, ...(hit.args ?? []))
    return { kind: 'command', id: hit.command }
  }

  /** Forgets the first key of a chord, as when the focus moves. */
  cancel(): void {
    this.setPending(undefined)
  }

  private setPending(stroke: Stroke | undefined) {
    if (this.pending === stroke) return
    this.pending = stroke
    this.changed()
  }
}
