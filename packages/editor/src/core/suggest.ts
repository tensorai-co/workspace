import type { CompletionItem, CompletionList, LanguageService } from '@tensorai-co/workspace/host'
import { ChangeSet, type Text } from '@tensorai-co/workspace/text'
import { fuzzyScoreGraceful, type MatchRange } from './fuzzy.js'
import { EditorSelection } from './selection.js'
import type { EditorState, Transaction, TransactionSpec } from './state.js'

export interface SuggestConfig {
  service: LanguageService
  path?: string
  /** How long typing pauses before it asks, in milliseconds. 10 by default. */
  delay?: number
}

/** One row of the list: an item, and what in its label matched. */
export interface SuggestRow {
  item: CompletionItem
  matches: MatchRange[]
  score: number
}

/** What the suggest widget shows. */
export interface SuggestView {
  rows: readonly SuggestRow[]
  selected: number
  /** Where the list hangs: the cursor. It follows the cursor while the word grows. */
  anchor: number
  /** A message in place of rows: "No suggestions." */
  message?: string
  /** Whether the selected item's docs show beside the list. */
  details: boolean
}

interface Request {
  id: number
  doc: Text
  /** The cursor, in `doc`. */
  pos: number
  /** Where the typed word starts, in `doc`. */
  start: number
  abort: AbortController
  /** Every change since the request, to map its items onto the text as it is now. */
  changes: ChangeSet
  explicit: boolean
}

interface Live {
  item: CompletionItem
  /** Where its range starts, now. */
  from: number
}

/** Characters that never grow a word, so typing them puts the list away. */
const BREAKS = /[\s`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?]/

/**
 * The suggest list's logic, without the DOM: asks the language service as words are typed, after trigger characters
 * and on ⌃Space; filters and sorts what comes back as the word grows; and makes the edit for the
 * picked item.
 */
export class Suggest {
  private config: SuggestConfig
  private request: Request | undefined
  private nextId = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private items: Live[] = []
  private incomplete = false
  /** Whether the list came from typing, not ⌃Space or a trigger character: it goes when the word is deleted. */
  private auto = false
  private rows: SuggestRow[] = []
  private selectedIndex = 0
  private messageText: string | undefined
  private resolving = new WeakSet<CompletionItem>()
  private listeners = new Set<() => void>()
  /** Whether the details show is kept across lists. */
  private detailsOpen = false

  constructor(
    config: SuggestConfig,
    private readonly getState: () => EditorState,
    /** Whether a position is in a comment or a string, where typing doesn't ask. */
    private readonly quiet: (pos: number) => boolean = () => false,
  ) {
    this.config = config
  }

  configure(config: SuggestConfig): void {
    if (config.service !== this.config.service) this.close()
    this.config = config
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** What to draw, or undefined when the list is closed. */
  get view(): SuggestView | undefined {
    if (!this.rows.length && !this.messageText) return undefined
    return { rows: this.rows, selected: this.selectedIndex, anchor: this.getState().selection.main.head, message: this.messageText, details: this.detailsOpen }
  }

  get isOpen(): boolean {
    return !!this.view
  }

  /** The selected item, if the list is open. */
  get selected(): CompletionItem | undefined {
    return this.rows[this.selectedIndex]?.item
  }

  /** Asks now: ⌃Space. While the list is open, ⌃Space shows or hides the details instead. */
  trigger(explicit = true): void {
    if (this.rows.length && explicit) {
      this.detailsOpen = !this.detailsOpen
      this.notify()
      return
    }
    this.ask(explicit ? 'explicit' : 'typing')
  }

  /** Follows a transaction: asks as words grow, filters, or closes. */
  handleTransaction(tr: Transaction): void {
    const state = tr.state
    const main = state.selection.main
    if (this.request) this.request.changes = this.request.changes.compose(tr.changes)
    if (tr.docChanged) for (const live of this.items) live.from = tr.changes.mapPos(live.from, -1)

    const typed = tr.userEvent === 'input.type' ? insertedText(tr) : undefined
    const deleting = tr.userEvent === 'delete.backward' || tr.userEvent === 'delete.forward'
    if (!typed && !deleting) {
      // Moving the cursor, undoing, pasting: the list goes.
      if (tr.docChanged || !tr.selection.eq(tr.startState.selection)) this.close()
      return
    }
    if (state.selection.ranges.length > 1 || !main.empty) return this.close()

    const triggers = this.config.service.triggerCharacters ?? []
    if (typed && triggers.includes(typed.slice(-1))) {
      this.ask('character', typed.slice(-1))
      return
    }
    const active = this.isOpen || !!this.request
    if (typed && BREAKS.test(typed.slice(-1))) return this.close()
    if (active) {
      const start = this.wordStart()
      if (main.head < start || state.doc.lineAt(main.head).number !== state.doc.lineAt(start).number) return this.close()
      if (deleting && this.auto && start === main.head) return this.close()
      if (this.incomplete && !this.request) return this.ask('typing')
      this.filter()
      if (!this.rows.length && !this.request) this.close()
      return
    }
    if (typed && !this.quiet(main.head - 1)) this.schedule()
  }

  /** Moves the selection; it goes round the ends. */
  move(by: number): void {
    const n = this.rows.length
    if (!n) return
    this.select((((this.selectedIndex + by) % n) + n) % n)
  }

  /** Moves by a page, stopping at the ends. */
  page(by: number, rows: number): void {
    if (!this.rows.length) return
    this.select(Math.max(0, Math.min(this.rows.length - 1, this.selectedIndex + by * rows)))
  }

  select(index: number): void {
    if (index === this.selectedIndex || !this.rows[index]) return
    this.selectedIndex = index
    this.resolve()
    this.notify()
  }

  /** Shows or hides the selected item's docs. */
  toggleDetails(): void {
    this.detailsOpen = !this.detailsOpen
    this.notify()
  }

  /** The edit that puts the selected item in, and closes the list. */
  accept(index = this.selectedIndex): TransactionSpec | undefined {
    const live = this.items.find((l) => l.item === this.rows[index]?.item)
    if (!live) return undefined
    const state = this.getState()
    const head = state.selection.main.head
    const item = live.item
    const text = item.insertText ?? item.label
    const changes = [{ from: Math.min(live.from, head), to: head, insert: text }]
    for (const edit of item.additionalEdits ?? []) {
      // Edits are in the document the items came for; follow the edits since.
      const map = this.mapFromItems
      const from = map ? map.mapPos(edit.from, 1) : edit.from
      const to = map ? map.mapPos(edit.to, -1) : edit.to
      if (to < changes[0]!.from || from > changes[0]!.to) changes.push({ from, to: Math.max(from, to), insert: edit.insert })
    }
    changes.sort((a, b) => a.from - b.from)
    const set = ChangeSet.of(changes, state.doc.length)
    const end = set.mapPos(Math.min(live.from, head), -1) + text.length
    this.close()
    return { changes, selection: EditorSelection.single(end), userEvent: 'input.complete', scrollIntoView: true }
  }

  close(): void {
    clearTimeout(this.timer)
    this.timer = undefined
    this.request?.abort.abort()
    this.request = undefined
    this.mapFromItems = undefined
    const was = this.isOpen
    this.items = []
    this.rows = []
    this.messageText = undefined
    this.incomplete = false
    if (was) this.notify()
  }

  destroy(): void {
    this.close()
    this.listeners.clear()
  }

  // ------------------------------------------------------------------------------------------------------------------

  /** The changes from the document the current items came for to now. */
  private mapFromItems: ChangeSet | undefined

  private schedule() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.ask('typing')
    }, this.config.delay ?? 10)
  }

  /** Where the word being typed starts. */
  private wordStart(): number {
    const state = this.getState()
    const head = state.selection.main.head
    const word = state.wordAt(head)
    return word && word.from < head ? word.from : head
  }

  private ask(trigger: 'typing' | 'character' | 'explicit', character?: string) {
    const service = this.config.service
    clearTimeout(this.timer)
    this.timer = undefined
    this.request?.abort.abort()
    const state = this.getState()
    if (!service.completions || state.selection.ranges.length > 1 || !state.selection.main.empty) return
    const pos = state.selection.main.head
    const start = this.wordStart()
    this.auto = trigger === 'typing'
    const req: Request = { id: ++this.nextId, doc: state.doc, pos, start, abort: new AbortController(), changes: ChangeSet.empty(state.doc.length), explicit: trigger === 'explicit' }
    this.request = req
    service
      .completions({ doc: state.doc, position: pos, language: state.language.id, path: this.config.path, trigger, character }, req.abort.signal)
      .then(
        (answer) => this.receive(req, answer),
        (error: unknown) => {
          if (this.request !== req) return
          this.request = undefined
          if (!req.abort.signal.aborted) console.warn('Completions failed:', error)
          if (!this.rows.length) this.close()
        },
      )
  }

  private receive(req: Request, answer: CompletionList | CompletionItem[] | undefined) {
    if (this.request !== req || req.abort.signal.aborted) return
    this.request = undefined
    const list = Array.isArray(answer) ? { items: answer } : (answer ?? { items: [] })
    this.incomplete = !!list.incomplete
    this.mapFromItems = req.changes
    this.items = list.items.map((item) => ({ item, from: req.changes.mapPos(item.range?.from ?? req.start, -1) }))
    const state = this.getState()
    const head = state.selection.main.head
    // The cursor left the word while waiting.
    if (head < req.changes.mapPos(req.start, -1)) return this.close()
    this.filter()
    if (!this.rows.length) {
      if (req.explicit) {
        this.messageText = 'No suggestions.'
        this.notify()
      } else this.close()
    }
  }

  /** Filters and sorts the items by the word typed since each one's start. */
  private filter() {
    const state = this.getState()
    const head = state.selection.main.head
    const previous = this.rows[this.selectedIndex]?.item
    const rows: (SuggestRow & { sort: string })[] = []
    for (const live of this.items) {
      const typed = state.doc.slice(Math.min(live.from, head), head)
      const target = live.item.filterText ?? live.item.label
      const match = fuzzyScoreGraceful(typed, target)
      if (!match) continue
      // Matches against filterText don't line up with the label; show them only when the two agree.
      const matches = live.item.filterText && live.item.filterText !== live.item.label ? [] : match.matches
      rows.push({ item: live.item, matches, score: match.score, sort: live.item.sortText ?? live.item.label })
    }
    rows.sort((a, b) => b.score - a.score || compare(a.sort, b.sort) || compare(a.item.label, b.item.label))
    this.rows = rows.map(({ sort: _, ...row }) => row)
    this.messageText = undefined
    const typed = state.doc.slice(this.wordStartOf(head), head)
    const keep = previous && typed ? this.rows.findIndex((r) => r.item === previous) : -1
    const pre = typed ? -1 : this.rows.findIndex((r) => r.item.preselect)
    this.selectedIndex = keep >= 0 && this.rows[0]?.score === this.rows[keep]?.score ? keep : pre >= 0 ? pre : 0
    this.resolve()
    this.notify()
  }

  private wordStartOf(head: number): number {
    const word = this.getState().wordAt(head)
    return word && word.from < head ? word.from : head
  }

  /** Asks the service to fill in the selected item, once. */
  private resolve() {
    const service = this.config.service
    const row = this.rows[this.selectedIndex]
    if (!service.resolveCompletion || !row || this.resolving.has(row.item)) return
    const item = row.item
    this.resolving.add(item)
    const abort = new AbortController()
    service.resolveCompletion(item, abort.signal).then(
      (full) => {
        if (full === item) return
        this.resolving.add(full)
        for (const live of this.items) if (live.item === item) live.item = full
        for (const r of this.rows) if (r.item === item) r.item = full
        this.notify()
      },
      () => {},
    )
  }

  private notify() {
    for (const listener of [...this.listeners]) listener()
  }
}

/** Ordinal: "E" before "abs". */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** What a typing transaction put in, when it was one insertion. */
function insertedText(tr: Transaction): string | undefined {
  const changes = tr.changes.changes
  if (changes.length !== 1) return undefined
  const c = changes[0]!
  return c.insert || undefined
}
