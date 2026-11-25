import type { Diagnostic, LanguageService } from '@tensorai-co/workspace/host'
import { ChangeSet } from '@tensorai-co/workspace/text'
import type { EditorState, Transaction } from './state.js'

export interface DiagnosticsConfig {
  service: LanguageService
  path?: string
  /** How long after an edit it asks again, in milliseconds. */
  delay?: number
}

/** How many problems of each kind there are. */
export interface ProblemCounts {
  errors: number
  warnings: number
  infos: number
}

const RANK: Record<Diagnostic['severity'], number> = { error: 0, warning: 1, info: 2, hint: 3 }

/**
 * A document's problems: asked for when the document opens and a little after each edit, and kept on the text they're
 * about as it changes, until the next answer replaces them.
 */
export class Diagnostics {
  private config: DiagnosticsConfig
  private items: Diagnostic[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: { abort: AbortController; changes: ChangeSet } | undefined
  private listeners = new Set<() => void>()

  constructor(
    config: DiagnosticsConfig,
    private readonly getState: () => EditorState,
  ) {
    this.config = config
    this.ask()
  }

  configure(config: DiagnosticsConfig): void {
    const changed = config.service !== this.config.service || config.path !== this.config.path
    this.config = config
    if (changed) this.ask()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Every problem, in document order. */
  get all(): readonly Diagnostic[] {
    return this.items
  }

  get counts(): ProblemCounts {
    const counts = { errors: 0, warnings: 0, infos: 0 }
    for (const d of this.items) {
      if (d.severity === 'error') counts.errors++
      else if (d.severity === 'warning') counts.warnings++
      else if (d.severity === 'info') counts.infos++
    }
    return counts
  }

  /** The problems at a position, the worst first. */
  at(pos: number): Diagnostic[] {
    return this.items.filter((d) => d.from <= pos && pos <= d.to).sort((a, b) => RANK[a.severity] - RANK[b.severity])
  }

  /** The next problem after `pos` (or before, going back), round the ends. */
  next(pos: number, back = false): Diagnostic | undefined {
    const items = this.items
    if (!items.length) return undefined
    if (back) return [...items].reverse().find((d) => d.from < pos) ?? items[items.length - 1]
    return items.find((d) => d.from > pos) ?? items[0]
  }

  /** Follows an edit: moves the problems with their text, and asks again a little later. */
  handleTransaction(tr: Transaction): void {
    if (tr.language) return this.ask()
    if (!tr.docChanged) return
    if (this.pending) this.pending.changes = this.pending.changes.compose(tr.changes)
    this.items = mapAll(this.items, tr.changes)
    this.notify()
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.ask(), this.config.delay ?? 500)
  }

  /** Asks now. */
  ask(): void {
    clearTimeout(this.timer)
    this.timer = undefined
    this.pending?.abort.abort()
    const service = this.config.service
    if (!service.diagnostics) {
      if (this.items.length) (this.items = []), this.notify()
      return
    }
    const state = this.getState()
    const pending = { abort: new AbortController(), changes: ChangeSet.empty(state.doc.length) }
    this.pending = pending
    service.diagnostics({ doc: state.doc, language: state.language.id, path: this.config.path }, pending.abort.signal).then(
      (list) => {
        if (this.pending !== pending) return
        this.pending = undefined
        const length = state.doc.length
        const clean = list.filter((d) => d.from >= 0 && d.to >= d.from && d.from <= length).map((d) => ({ ...d, to: Math.min(d.to, length) }))
        this.items = mapAll(clean, pending.changes)
        this.notify()
      },
      (error: unknown) => {
        if (this.pending !== pending) return
        this.pending = undefined
        if (!pending.abort.signal.aborted) console.warn('Diagnostics failed:', error)
      },
    )
  }

  destroy(): void {
    clearTimeout(this.timer)
    this.pending?.abort.abort()
    this.pending = undefined
    this.listeners.clear()
  }

  private notify() {
    for (const listener of [...this.listeners]) listener()
  }
}

/** Problems moved through changes, in document order. A problem whose text was deleted keeps a place, empty. */
function mapAll(items: readonly Diagnostic[], changes: ChangeSet): Diagnostic[] {
  const out = changes.empty ? [...items] : items.map((d) => ({ ...d, from: changes.mapPos(d.from, 1), to: Math.max(changes.mapPos(d.from, 1), changes.mapPos(d.to, -1)) }))
  return out.sort((a, b) => a.from - b.from || a.to - b.to)
}
