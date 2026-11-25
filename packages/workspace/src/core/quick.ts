import { fuzzyScore } from '@tensorai-workspace/editor/core'
import type { DocumentSymbol, Storage, SymbolKind } from '@tensorai-workspace/host'
import type { CodiconName } from '@tensorai-workspace/icons'
import type { CommandRegistry } from './commands.js'
import { matchesCommand, scoreFile, type Match } from './match.js'

/** One row of the quick input: a command, a file, a line to go to, or a message. */
export interface QuickItem {
  id: string
  label: string
  /** Shown after the label, fainter: a file's folder. */
  description?: string
  /** The key that runs it, as shown: "⇧⌘P", "⌘K ⌘0". */
  keybinding?: string
  /** A file, for its icon. */
  file?: string
  /** A codicon before the label, in a color: a symbol's kind. */
  icon?: { name: CodiconName; color?: string }
  highlights?: { label?: Match[]; description?: Match[] }
  /** The name of the group it starts, shown at its right: "recently used". */
  separator?: string
  /** It starts a group after another: a line above it. */
  border?: boolean
  /** A message, not something to pick. */
  disabled?: boolean
  run?: () => void
}

/** The keys of a label: each modifier and the key in its own cap, chords apart. */
export function keyCaps(label: string, mac: boolean): string[][] {
  return label.split(' ').map((chord) => (mac ? [...chord.match(/^[⌃⌥⇧⌘]*/)![0]].concat(chord.replace(/^[⌃⌥⇧⌘]*/, '') || []) : chord.split('+')))
}

/** The commands run lately, newest first, kept in storage. */
export class CommandHistory {
  private ids: string[]

  constructor(
    private readonly storage?: Storage,
    private readonly key = 'commandHistory',
  ) {
    let saved: unknown = []
    try {
      saved = JSON.parse(storage?.getItem(key) ?? '[]')
    } catch {
      // Not ours: start afresh.
    }
    this.ids = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
  }

  get recent(): readonly string[] {
    return this.ids
  }

  add(id: string): void {
    this.ids = [id, ...this.ids.filter((x) => x !== id)].slice(0, 50)
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.ids))
    } catch {
      // Nowhere to keep it.
    }
  }
}

/**
 * The command palette's rows: every command with a title whose `when` holds, as
 * "Category: Title", matched by substring or word starts; the recently used first, then the rest by label.
 */
export function commandItems(commands: CommandRegistry, context: { matches(when: string | undefined): boolean }, history: CommandHistory, filter: string, run: (id: string) => void): QuickItem[] {
  const recent = new Map(history.recent.map((id, i) => [id, i]))
  const rows: (QuickItem & { recent?: number })[] = []
  for (const c of commands.list()) {
    if (!c.title || !context.matches(c.when)) continue
    const label = c.category ? `${c.category}: ${c.title}` : c.title
    const highlights = filter ? matchesCommand(filter, label) : []
    if (!highlights) continue
    rows.push({ id: c.id, label, keybinding: commands.keyLabel(c.id), highlights: { label: highlights }, recent: recent.get(c.id), run: () => run(c.id) })
  }
  const used = rows.filter((r) => r.recent !== undefined).sort((a, b) => a.recent! - b.recent!)
  const others = rows.filter((r) => r.recent === undefined).sort((a, b) => a.label.localeCompare(b.label))
  if (used.length) used[0]!.separator = 'recently used'
  if (used.length && others[0]) Object.assign(others[0], { separator: 'other commands', border: true })
  const items = [...used, ...others].map(({ recent: _, ...item }) => item)
  return items.length ? items : [{ id: 'none', label: 'No matching commands', disabled: true }]
}

/**
 * Quick Open's rows: files matched fuzzily by name and folder, the best first. Without a query, the files open
 * lately come first, as "recently opened".
 */
export function fileItems(files: readonly string[], root: string, filter: string, recent: readonly string[], open: (path: string) => void, limit = 200): QuickItem[] {
  const relative = (path: string) => (path.startsWith(root + '/') ? path.slice(root.length + 1) : path)
  const item = (path: string, score?: ReturnType<typeof scoreFile>): QuickItem => {
    const rel = relative(path)
    const cut = rel.lastIndexOf('/')
    return {
      id: path,
      label: rel.slice(cut + 1),
      description: cut < 0 ? undefined : rel.slice(0, cut),
      file: path,
      highlights: score ? { label: score.name, description: score.folder } : undefined,
      run: () => open(path),
    }
  }
  if (!filter.trim()) {
    const recentItems = recent.filter((p) => files.includes(p)).map((p) => item(p))
    if (recentItems[0]) recentItems[0].separator = 'recently opened'
    const rest = files.filter((p) => !recent.includes(p)).slice(0, limit).map((p) => item(p))
    if (recentItems.length && rest[0]) Object.assign(rest[0], { separator: 'files', border: true })
    return [...recentItems, ...rest]
  }
  const scored: { path: string; score: NonNullable<ReturnType<typeof scoreFile>> }[] = []
  for (const path of files) {
    const rel = relative(path)
    const cut = rel.lastIndexOf('/')
    const score = scoreFile(filter, rel.slice(cut + 1), cut < 0 ? '' : rel.slice(0, cut))
    if (score) scored.push({ path, score })
  }
  scored.sort((a, b) => b.score.score - a.score.score || a.path.localeCompare(b.path))
  const items = scored.slice(0, limit).map((s) => item(s.path, s.score))
  return items.length ? items : [{ id: 'none', label: 'No matching results', disabled: true }]
}

/** "Go to line": what `:12` or `:12:5` says, and where it goes. */
export function lineItems(filter: string, lines: number | undefined, current: { line: number; column: number } | undefined, go: (line: number, column: number) => void): QuickItem[] {
  if (lines === undefined) return [{ id: 'none', label: 'Open a text editor first to go to a line.', disabled: true }]
  const m = /^\s*(\d+)?\s*(?:[:,]\s*(\d+))?\s*$/.exec(filter)
  if (!m || !m[1]) {
    const where = current ? `Current Line: ${current.line}, Character: ${current.column}. ` : ''
    return [{ id: 'none', label: `${where}Type a line number between 1 and ${lines} to navigate to.`, disabled: true }]
  }
  const line = Math.max(1, Math.min(lines, Number(m[1])))
  const column = m[2] ? Math.max(1, Number(m[2])) : 1
  return [{ id: `line:${line}:${column}`, label: m[2] ? `Go to line ${line}, character ${column}.` : `Go to line ${line}.`, run: () => go(line, column) }]
}

/** Each symbol kind's icon and its color token `SymbolKinds`. */
const SYMBOL_ICONS: Record<SymbolKind, [CodiconName, string]> = {
  file: ['symbol-file', 'file'],
  module: ['symbol-namespace', 'module'],
  namespace: ['symbol-namespace', 'namespace'],
  package: ['symbol-namespace', 'package'],
  class: ['symbol-class', 'class'],
  method: ['symbol-method', 'method'],
  property: ['symbol-property', 'property'],
  field: ['symbol-field', 'field'],
  constructor: ['symbol-method', 'constructor'],
  enum: ['symbol-enum', 'enumerator'],
  interface: ['symbol-interface', 'interface'],
  function: ['symbol-method', 'function'],
  variable: ['symbol-variable', 'variable'],
  constant: ['symbol-constant', 'constant'],
  string: ['symbol-string', 'string'],
  number: ['symbol-numeric', 'number'],
  boolean: ['symbol-boolean', 'boolean'],
  array: ['symbol-array', 'array'],
  object: ['symbol-namespace', 'object'],
  key: ['symbol-key', 'key'],
  null: ['symbol-boolean', 'null'],
  enumMember: ['symbol-enum-member', 'enumeratorMember'],
  struct: ['symbol-structure', 'struct'],
  event: ['symbol-event', 'event'],
  operator: ['symbol-operator', 'operator'],
  typeParameter: ['symbol-parameter', 'typeParameter'],
}

/** A symbol kind's icon, colored by its theme token. */
export function symbolIcon(kind: SymbolKind): { name: CodiconName; color: string } {
  const [name, token] = SYMBOL_ICONS[kind] ?? SYMBOL_ICONS.variable
  return { name, color: `var(--ws-color-symbolIcon-${token}Foreground, var(--ws-color-foreground))` }
}

/**
 * "Go to Symbol in Editor" (`@`): the active file's symbols in document order, nested ones with their container as
 * description, matched fuzzily by name. `symbols` is undefined while they're being asked for.
 */
export function symbolItems(symbols: readonly DocumentSymbol[] | undefined, filter: string, go: (symbol: DocumentSymbol) => void): QuickItem[] {
  if (!symbols) return []
  const flat: { symbol: DocumentSymbol; container?: string }[] = []
  const walk = (list: readonly DocumentSymbol[], container?: string) => {
    for (const symbol of list) {
      flat.push({ symbol, container })
      if (symbol.children) walk(symbol.children, symbol.name)
    }
  }
  walk(symbols)
  flat.sort((a, b) => (a.symbol.selection?.from ?? a.symbol.from) - (b.symbol.selection?.from ?? b.symbol.from))
  const query = filter.trim()
  const items: QuickItem[] = []
  for (const { symbol, container } of flat) {
    const match = fuzzyScore(query, symbol.name)
    if (!match) continue
    items.push({
      id: `symbol:${symbol.from}:${symbol.name}`,
      label: symbol.name,
      description: container,
      icon: symbolIcon(symbol.kind),
      highlights: { label: match.matches.map(([start, end]) => ({ start, end })) },
      run: () => go(symbol),
    })
  }
  if (!items.length) return [{ id: 'none', label: flat.length ? 'No matching editor symbols' : 'No editor symbols', disabled: true }]
  items[0]!.separator = `symbols (${items.length})`
  return items
}
