import type { InlineCompletion, InlineCompletionProvider, InlineCompletionRequest } from '@tensorai-co/workspace/host'
import { ChangeSet, type Text } from '@tensorai-co/workspace/text'
import type { EditorState, Transaction, TransactionSpec } from './state.js'

export interface InlineCompletionsConfig {
  provider: InlineCompletionProvider
  /** How long typing pauses before it asks, in milliseconds. 150 by default. */
  delay?: number
  /** The file's path, for the request. */
  path?: string
  /** Anything else the provider should see, such as recent edits or open files. It arrives as `request.context`. */
  completionContext?: (state: EditorState) => unknown
}

/** A piece of ghost text, drawn before the document text at `pos`. */
export interface GhostPart {
  pos: number
  /** A "\n" starts a line below. */
  text: string
}

/** What to draw: the suggestion's text after the cursor, in parts around text that's already there. */
export interface Ghost {
  /** The cursor. */
  pos: number
  /** In order. Text already after the cursor, such as an auto-closed bracket, comes between them. */
  parts: GhostPart[]
  /** All the parts' text, joined. */
  text: string
  /** Which suggestion it is, and how many there are. */
  index: number
  count: number
}

export type AcceptPart = 'all' | 'word' | 'line'

/** An edit somewhere else in the file, as it is now. */
export interface NextEdit {
  from: number
  to: number
  insert: string
  /** The text it replaces. */
  removed: string
  /** What `Tab` does now: go to it, or make it, once the cursor is on its lines. */
  action: 'jump' | 'accept'
}

interface Request {
  id: number
  doc: Text
  pos: number
  abort: AbortController
  /** Every change since the request, to move its suggestions to where they are now. */
  changes: ChangeSet
  /** Suggestions as they arrived, by index, in the request's document. */
  items: (InlineCompletion | undefined)[]
}

/** A suggestion where it is now: it replaces [from, to) with its text, which `parts` show. */
interface Live {
  item: InlineCompletion
  index: number
  from: number
  to: number
  parts: GhostPart[]
  key: string
}

/** An edit elsewhere, where it is now. */
interface LiveEdit {
  item: InlineCompletion
  from: number
  to: number
  insert: string
  removed: string
  key: string
}

/** An edit kept after the ghost text it came with went: accepted, or moved away from. It follows changes itself. */
interface Carried extends LiveEdit {
  changes: ChangeSet
}

/** Typing that asks again after a pause. Cursor moves, undo and outside changes don't. */
const TYPING = new Set(['input.type', 'delete.backward', 'delete.forward'])
const WORD_CHAR = /[\p{L}\p{N}_]/u

/**
 * AI ghost text, with no DOM: when to ask the provider, what it streamed, where its suggestions are as the user keeps
 * typing, and the transactions that accept them. The view draws `ghost` and sends keys here.
 *
 * - **Asking:** after a pause in typing, with one cursor and nothing selected, not in the middle of a word.
 * - **Typing through:** typing what the suggestion says keeps it, and the rest stays shown. Anything else drops it,
 *   aborts the request, and the next pause asks again.
 * - **Late answers:** a suggestion for an older version of the text is moved through the edits since, or dropped.
 * - **Next edits:** an edit elsewhere stays while the cursor moves. `Tab` goes to it and `Tab` again makes it, and
 *   then it asks again for the next one. It's dropped once the text it would replace has changed.
 */
export class InlineCompletions {
  private request: Request | undefined
  private selected = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private current: Live | undefined
  private edit: LiveEdit | undefined
  private carried: Carried | undefined
  /** Edits from this request that were dismissed or made. */
  private skipped = new Set<string>()
  /** Where our own jump puts the cursor, which isn't a move away. */
  private expected: number | undefined
  /** Ask again right after the edit being made goes in. */
  private followUp = false
  /** "request:index" for each suggestion shown, so `onShown` is once per suggestion however it grows. */
  private shown = new Set<string>()
  private nextId = 1
  private listeners = new Set<() => void>()
  private destroyed = false

  constructor(
    private config: InlineCompletionsConfig,
    private readonly getState: () => EditorState,
    private readonly options: { isComposing?: () => boolean; readOnly?: boolean } = {},
  ) {}

  /** Changes the provider, path or delay. A request in flight keeps going. */
  configure(config: InlineCompletionsConfig): void {
    if (config.provider !== this.config.provider) {
      this.carried = undefined
      this.clear(true)
    }
    this.config = config
  }

  /** Hears when the ghost text changes. Returns a function that stops. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  /** The suggestion to draw, if there's one. */
  get ghost(): Ghost | undefined {
    const live = this.current
    if (!live) return undefined
    return { pos: this.getState().selection.main.head, parts: live.parts, text: live.parts.map((p) => p.text).join(''), index: live.index, count: this.request?.items.filter(Boolean).length ?? 1 }
  }

  /** The edit elsewhere to draw, if there's one. */
  get nextEdit(): NextEdit | undefined {
    const e = this.edit
    if (!e) return undefined
    const { doc, selection } = this.getState()
    const line = doc.lineAt(selection.main.head).number
    const near = line >= doc.lineAt(e.from).number && line <= doc.lineAt(e.to).number
    return { from: e.from, to: e.to, insert: e.insert, removed: e.removed, action: near ? 'accept' : 'jump' }
  }

  /** Whether a request is waiting or streaming. */
  get pending(): boolean {
    return !!this.request || this.timer !== undefined
  }

  /** Follows a transaction the view applied. */
  handleTransaction(tr: Transaction): void {
    if (this.destroyed) return
    if (!tr.docChanged) {
      if (tr.selection.eq(tr.startState.selection)) return
      const ours = this.expected !== undefined && tr.selection.ranges.length === 1 && tr.selection.main.head === this.expected
      this.expected = undefined
      if (ours) return
      // A cursor move hides ghost text. An edit elsewhere stays.
      this.carry()
      this.clear(true)
      return
    }
    this.expected = undefined
    if (this.request) this.request.changes = this.request.changes.compose(tr.changes)
    if (this.carried) this.carried.changes = this.carried.changes.compose(tr.changes)
    const event = tr.userEvent
    if (event === 'undo' || event === 'redo' || event === 'set') {
      this.carried = undefined
      return this.clear(true)
    }
    const had = this.current
    this.refresh()
    // Our own accept that used it all up isn't a dismissal.
    if (had && !this.current && event !== 'input.complete') this.config.provider.onDismissed?.(had.item)
    // A request with suggestions that no longer fit is done; one still waiting may yet answer with something that does.
    if (!this.current && this.request?.items.length && event !== 'input.complete') {
      this.carry()
      this.abort()
      this.refresh()
    }
    if (this.followUp) {
      this.followUp = false
      this.schedule(0, true)
    } else if (!this.current && event && TYPING.has(event)) this.schedule()
  }

  /** Asks now, as `⌥\` does. */
  trigger(): void {
    this.cancelTimer()
    this.start('explicit')
  }

  /** The transaction that accepts the suggestion, or its next word or line. Null when there's nothing to accept. */
  accept(part: AcceptPart = 'all'): TransactionSpec | null {
    const live = this.current
    if (!live) return null
    const state = this.getState()
    const cursor = state.selection.main.head
    this.config.provider.onAccepted?.(live.item, part)
    if (part === 'all') {
      const insert = live.item.text
      this.carry()
      this.clear(false)
      return { changes: { from: live.from, to: live.to, insert }, selection: { anchor: live.from + insert.length }, userEvent: 'input.complete', scrollIntoView: true }
    }
    // What's shown from the cursor on, ghost parts and the text between them, and how much of it to take.
    const segments: { pos: number; text: string; ghost: boolean }[] = []
    let at = cursor
    for (const p of live.parts) {
      if (p.pos > at) segments.push({ pos: at, text: state.sliceDoc(at, p.pos), ghost: false })
      segments.push({ pos: p.pos, text: p.text, ghost: true })
      at = p.pos
    }
    const shown = segments.map((g) => g.text).join('')
    let left = part === 'word' ? nextWordLength(shown, state) : nextLineLength(shown)
    const length = left
    // Ghost text is inserted; text that's already there is stepped over.
    const changes: { from: number; insert: string }[] = []
    for (const g of segments) {
      if (left <= 0) break
      const take = g.text.slice(0, left)
      if (g.ghost) changes.push({ from: g.pos, insert: take })
      left -= take.length
    }
    return { changes, selection: { anchor: cursor + length }, userEvent: 'input.complete', scrollIntoView: true }
  }

  /** What `Tab` does: accept the ghost text, or go to the edit elsewhere, or make it. Null when there's neither. */
  tab(): TransactionSpec | null {
    if (this.current) return this.accept('all')
    const edit = this.nextEdit
    if (!edit) return null
    return edit.action === 'accept' ? this.acceptEdit() : this.jumpToEdit()
  }

  /** Puts the cursor at the start of the edit elsewhere. */
  jumpToEdit(): TransactionSpec | null {
    const e = this.edit
    if (!e) return null
    this.expected = e.from
    return { selection: { anchor: e.from }, userEvent: 'select', scrollIntoView: true }
  }

  /** Makes the edit elsewhere, as its own undo step, and asks again for the next one. */
  acceptEdit(): TransactionSpec | null {
    const e = this.edit
    if (!e) return null
    this.config.provider.onAccepted?.(e.item, 'edit')
    this.skipped.add(e.key)
    this.carried = undefined
    this.followUp = true
    this.clear(true)
    return { changes: { from: e.from, to: e.to, insert: e.insert }, selection: { anchor: e.from + e.insert.length }, userEvent: 'input.complete', scrollIntoView: true }
  }

  /** Hides the ghost text, as `Esc` does, or else the edit elsewhere. Returns whether there was one. */
  dismiss(): boolean {
    if (this.current) {
      this.config.provider.onDismissed?.(this.current.item)
      this.carry()
      this.clear(true)
      return true
    }
    const e = this.edit
    if (!e) return false
    this.config.provider.onDismissed?.(e.item)
    this.skipped.add(e.key)
    this.carried = undefined
    this.refresh()
    return true
  }

  /** Shows the next or previous suggestion, when there are several. Returns whether it moved. */
  cycle(by: 1 | -1): boolean {
    const r = this.request
    if (!r || !this.current) return false
    const indexes = r.items.flatMap((item, i) => (item && this.locate(item, i) ? [i] : []))
    if (indexes.length < 2) return false
    const at = indexes.indexOf(this.current.index)
    this.selected = indexes[(at + by + indexes.length) % indexes.length]!
    this.refresh()
    return true
  }

  /** Forgets everything, as when the view takes a whole new state. */
  reset(): void {
    this.carried = undefined
    this.clear(true)
  }

  destroy(): void {
    this.carried = undefined
    this.clear(false)
    this.destroyed = true
    this.listeners.clear()
  }

  // ------------------------------------------------------------ asking

  /** Asks after a pause. `anywhere` asks even in the middle of a word, as after making a next edit. */
  private schedule(ms = this.config.delay ?? 150, anywhere = false) {
    this.cancelTimer()
    if (this.options.readOnly) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      // A late answer may have arrived and fit in the meantime.
      if (!this.current) this.start('automatic', anywhere)
    }, ms)
  }

  private cancelTimer() {
    if (this.timer === undefined) return
    clearTimeout(this.timer)
    this.timer = undefined
  }

  private start(trigger: InlineCompletionRequest['trigger'], anywhere = false) {
    if (this.destroyed || this.options.readOnly || this.options.isComposing?.()) return
    const state = this.getState()
    const { selection, doc } = state
    if (selection.ranges.length !== 1 || !selection.main.empty) return
    const pos = selection.main.head
    if (trigger === 'automatic' && !anywhere && WORD_CHAR.test(doc.slice(pos, Math.min(doc.length, pos + 1)))) return
    this.abort()
    // A new answer replaces whatever the last one suggested.
    this.carried = undefined
    this.skipped.clear()
    this.shown.clear()
    const request: Request = { id: this.nextId++, doc, pos, abort: new AbortController(), changes: ChangeSet.empty(doc.length), items: [] }
    this.request = request
    this.selected = 0
    const spec: InlineCompletionRequest = {
      doc,
      position: pos,
      language: state.language.id,
      path: this.config.path,
      trigger,
      context: this.config.completionContext?.(state),
    }
    void this.read(request, spec)
  }

  private async read(request: Request, spec: InlineCompletionRequest) {
    const { signal } = request.abort
    try {
      for await (const item of this.config.provider.provide(spec, signal)) {
        if (signal.aborted || this.request !== request) return
        request.items[item.index ?? 0] = item
        this.refresh()
      }
    } catch (e) {
      // A provider that failed suggests nothing; one that stopped because it was aborted is fine.
      if (!signal.aborted) console.warn('Inline completions:', e)
    }
  }

  private abort() {
    this.request?.abort.abort()
    this.request = undefined
  }

  // ------------------------------------------------------------ where suggestions are

  /** A suggestion moved to the current text, if it still fits there. */
  private locate(item: InlineCompletion, index: number): Live | undefined {
    const r = this.request
    if (!r) return undefined
    const state = this.getState()
    const { selection, doc } = state
    if (selection.ranges.length !== 1 || !selection.main.empty) return undefined
    const cursor = selection.main.head
    const from = r.changes.mapPos(item.range?.from ?? r.pos, -1)
    const to = Math.max(cursor, r.changes.mapPos(item.range?.to ?? r.pos, 1))
    if (from > cursor || to > doc.length) return undefined
    // What's typed since must be how the suggestion starts.
    const typed = doc.slice(from, cursor)
    if (!item.text.startsWith(typed)) return undefined
    const rest = item.text.slice(typed.length)
    const kept = doc.slice(cursor, to)
    const parts: GhostPart[] = []
    if (kept.includes('\n')) {
      // Text it keeps over several lines: only as how it ends.
      if (!rest.endsWith(kept)) return undefined
      if (rest.length > kept.length) parts.push({ pos: cursor, text: rest.slice(0, rest.length - kept.length) })
    } else {
      // Text it keeps on this line, such as an auto-closed bracket, must come in it in order: the gaps are ghost text.
      let i = 0
      for (let k = 0; k < kept.length; k++) {
        const j = rest.indexOf(kept[k]!, i)
        if (j < 0) return undefined
        if (j > i) parts.push({ pos: cursor + k, text: rest.slice(i, j) })
        i = j + 1
      }
      if (i < rest.length) parts.push({ pos: to, text: rest.slice(i) })
    }
    return parts.length ? { item, index, from, to, parts, key: parts.map((p) => `${p.pos}:${p.text}`).join('\u0000') } : undefined
  }

  /** Works out what shows now, and tells listeners when that changed. */
  private refresh() {
    const before = this.current
    const r = this.request
    let live: Live | undefined
    if (r) {
      const preferred = r.items[this.selected]
      live = preferred && this.locate(preferred, this.selected)
      if (!live) {
        for (const [i, item] of r.items.entries()) {
          live = item && this.locate(item, i)
          if (live) break
        }
      }
    }
    this.current = live
    const key = live && `${r!.id}:${live.index}`
    if (live && key && !this.shown.has(key)) {
      this.shown.add(key)
      this.config.provider.onShown?.(live.item)
    }

    // The edit elsewhere: one carried on, or the first from this request that still applies.
    const editBefore = this.edit
    let edit: LiveEdit | undefined
    if (this.carried) edit = this.locateEdit(this.carried, this.carried.changes)
    else if (r) {
      for (const i of [this.selected, ...r.items.keys()]) {
        const item = r.items[i]
        const next = item?.nextEdit
        const editKey = `${r.id}:${i}:edit`
        if (!item || !next || this.skipped.has(editKey) || next.from < 0 || next.from > next.to || next.to > r.doc.length) continue
        edit = this.locateEdit({ item, ...next, removed: r.doc.slice(next.from, next.to), key: editKey }, r.changes)
        if (edit) break
      }
    }
    this.edit = edit
    if (edit && !this.shown.has(edit.key)) {
      this.shown.add(edit.key)
      // Shown with its ghost text, it was shown already.
      if (live?.item !== edit.item) this.config.provider.onShown?.(edit.item)
    }
    if (before?.key !== live?.key || before?.index !== live?.index || editBefore?.key !== edit?.key || editBefore?.from !== edit?.from || editBefore?.to !== edit?.to) this.listeners.forEach((l) => l())
  }

  /** An edit moved to the current text, if the text it replaces is still there. */
  private locateEdit(source: Omit<LiveEdit, 'from' | 'to'> & { from: number; to: number }, changes: ChangeSet): LiveEdit | undefined {
    const { doc } = this.getState()
    const from = changes.mapPos(source.from, 1)
    const to = source.to === source.from ? from : changes.mapPos(source.to, -1)
    if (to < from || to > doc.length || source.insert === source.removed) return undefined
    if (doc.slice(from, to) !== source.removed) return undefined
    return { item: source.item, from, to, insert: source.insert, removed: source.removed, key: source.key }
  }

  /** Keeps the edit elsewhere when the request it came with goes. */
  private carry() {
    if (!this.edit || this.carried) return
    this.carried = { ...this.edit, changes: ChangeSet.empty(this.getState().doc.length) }
  }

  private clear(cancel: boolean) {
    if (cancel) this.cancelTimer()
    this.abort()
    this.refresh()
  }
}

/** the "accept next word": up to the end of the next word, or the space or punctuation before it. */
export function nextWordLength(text: string, state: EditorState): number {
  const pattern = state.language.rules.wordPattern
  const word = new RegExp(pattern.source, pattern.flags.replace('g', ''))
  const m = word.exec(text)
  let until = m ? (m.index === 0 ? m[0].length : m.index) : text.length
  const space = /\s+/.exec(text)
  if (space && space.index + space[0].length < until) until = space.index + space[0].length
  return Math.max(1, until)
}

/** the "accept next line": up to and including the next line break. */
export function nextLineLength(text: string): number {
  const at = text.indexOf('\n')
  return at < 0 ? text.length : at + 1
}
