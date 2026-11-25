import { languageById, type LanguageInfo } from '@tensorai-workspace/languages'
import { ChangeSet, Text, type ChangeSpec } from '@tensorai-workspace/text'
import { EditorSelection, SelectionRange } from './selection.js'

/** What kind of edit a transaction is, for undo grouping and for features that react to typing. */
export type UserEvent =
  | 'input.type'
  | 'input.paste'
  | 'input.complete'
  | 'input.replace'
  | 'input.format'
  | 'input.indent'
  | 'input.comment'
  | 'input.move'
  | 'delete.backward'
  | 'delete.forward'
  | 'delete.cut'
  | 'delete.line'
  | 'undo'
  | 'redo'
  | 'select'
  | 'move'
  | 'set'

export interface TransactionSpec {
  changes?: ChangeSpec | readonly ChangeSpec[] | ChangeSet
  /** The selection after the change, in new-document positions. Without one, the old selection is mapped. */
  selection?: EditorSelection | { anchor: number; head?: number }
  userEvent?: UserEvent
  /** Whether the edit can be undone. Off for edits that are already history (undo, redo). */
  addToHistory?: boolean
  scrollIntoView?: boolean
  /** Replaces the language. */
  language?: LanguageInfo
  /** @internal Replaces the history outright (undo and redo). */
  history?: History
}

/** One step from a state to the next. */
export class Transaction {
  private _state?: EditorState
  readonly changes: ChangeSet
  readonly selection: EditorSelection
  readonly newDoc: Text

  constructor(
    readonly startState: EditorState,
    spec: TransactionSpec,
  ) {
    const doc = startState.doc
    this.changes = spec.changes instanceof ChangeSet ? spec.changes : ChangeSet.of(spec.changes ?? [], doc.length)
    this.newDoc = this.changes.apply(doc)
    const sel = spec.selection
    this.selection = sel instanceof EditorSelection ? sel : sel ? EditorSelection.single(sel.anchor, sel.head ?? sel.anchor) : startState.selection.map(this.changes)
    this.userEvent = spec.userEvent
    this.addToHistory = spec.addToHistory ?? true
    this.scrollIntoView = spec.scrollIntoView ?? false
    this.language = spec.language
    this.history = spec.history
    // Clamp, so a bad command can't produce an out-of-range cursor.
    const max = this.newDoc.length
    if (this.selection.ranges.some((r) => r.anchor > max || r.head > max || r.anchor < 0 || r.head < 0)) {
      const clamp = (n: number) => Math.max(0, Math.min(max, n))
      this.selection = EditorSelection.create(
        this.selection.ranges.map((r) => new SelectionRange(clamp(r.anchor), clamp(r.head))),
        this.selection.mainIndex,
      )
    }
  }

  readonly userEvent: UserEvent | undefined
  readonly addToHistory: boolean
  readonly scrollIntoView: boolean
  readonly language: LanguageInfo | undefined
  readonly history: History | undefined

  get docChanged(): boolean {
    return !this.changes.empty
  }

  /** The state after this transaction. */
  get state(): EditorState {
    return (this._state ??= this.startState.applyTransaction(this))
  }
}

/** A group of edits undone together: the change from before the first to after the last. */
interface HistoryEntry {
  changes: ChangeSet
  /** The document before `changes`. */
  before: Text
  selectionBefore: EditorSelection
  selectionAfter: EditorSelection
  userEvent: UserEvent | undefined
  time: number
}

/** Undo and redo stacks. Immutable, like the rest of the state. */
export class History {
  constructor(
    readonly done: readonly HistoryEntry[] = [],
    readonly undone: readonly HistoryEntry[] = [],
  ) {}

  /** How long a pause ends a group of typing. */
  static readonly GROUP_MS = 500
  static readonly MAX = 500

  add(tr: Transaction, now: number): History {
    if (!tr.docChanged) return this
    const last = this.done[this.done.length - 1]
    const typing = tr.userEvent === 'input.type' || tr.userEvent === 'delete.backward' || tr.userEvent === 'delete.forward'
    const sameKind = last && last.userEvent === tr.userEvent
    if (last && typing && sameKind && now - last.time < History.GROUP_MS && adjacent(last, tr)) {
      const merged: HistoryEntry = { ...last, changes: last.changes.compose(tr.changes), selectionAfter: tr.selection, time: now }
      return new History([...this.done.slice(0, -1), merged], [])
    }
    const entry: HistoryEntry = { changes: tr.changes, before: tr.startState.doc, selectionBefore: tr.startState.selection, selectionAfter: tr.selection, userEvent: tr.userEvent, time: now }
    const done = [...this.done, entry]
    return new History(done.length > History.MAX ? done.slice(-History.MAX) : done, [])
  }

  /** Ends the current group, so the next edit starts a new undo step. */
  close(): History {
    const last = this.done[this.done.length - 1]
    return last ? new History([...this.done.slice(0, -1), { ...last, time: -Infinity }], this.undone) : this
  }
}

/** Whether a new edit continues the last one: it starts where every cursor of the last one ended. */
function adjacent(last: HistoryEntry, tr: Transaction): boolean {
  const before = tr.startState.selection.ranges
  const after = last.selectionAfter.ranges
  return before.length === after.length && before.every((r, i) => r.head === after[i]!.head)
}

export interface EditorStateConfig {
  doc?: string | Text
  selection?: EditorSelection | number | { anchor: number; head?: number }
  /** A LanguageInfo, or an id: "tsx", "typescriptreact", "python". Defaults to TSX. */
  language?: LanguageInfo | string
  tabSize?: number
  insertSpaces?: boolean
  /** The line ending the document is saved with. Lines are always "\n" inside. */
  lineEnding?: '\n' | '\r\n'
}

/** An immutable editor state. Change it with transactions: `state.update({...}).state`. */
export class EditorState {
  private constructor(
    readonly doc: Text,
    readonly selection: EditorSelection,
    readonly language: LanguageInfo,
    readonly tabSize: number,
    readonly insertSpaces: boolean,
    readonly lineEnding: '\n' | '\r\n',
    readonly history: History,
  ) {}

  static create(config: EditorStateConfig = {}): EditorState {
    const raw = config.doc ?? ''
    const doc = raw instanceof Text ? raw : Text.of(raw)
    const lineEnding = config.lineEnding ?? (typeof raw === 'string' && raw.includes('\r\n') ? '\r\n' : '\n')
    const sel = config.selection
    const selection = sel instanceof EditorSelection ? sel : typeof sel === 'number' ? EditorSelection.single(sel) : sel ? EditorSelection.single(sel.anchor, sel.head ?? sel.anchor) : EditorSelection.single(0)
    const language = typeof config.language === 'string' ? languageById(config.language) : (config.language ?? languageById('tsx'))
    return new EditorState(doc, selection, language, config.tabSize ?? 4, config.insertSpaces ?? true, lineEnding, new History())
  }

  update(spec: TransactionSpec): Transaction {
    return new Transaction(this, spec)
  }

  /** Shorthand for `state.update(spec).state`. */
  apply(spec: TransactionSpec | Transaction): EditorState {
    return spec instanceof Transaction ? spec.state : this.update(spec).state
  }

  /** @internal */
  applyTransaction(tr: Transaction, now = Date.now()): EditorState {
    // Edits go into history; a cursor move or selection ends the current undo group.
    const history = tr.history ?? (tr.docChanged ? (tr.addToHistory ? this.history.add(tr, now) : this.history) : tr.userEvent === 'select' || tr.userEvent === 'move' ? this.history.close() : this.history)
    return new EditorState(tr.newDoc, tr.selection, tr.language ?? this.language, this.tabSize, this.insertSpaces, this.lineEnding, history)
  }

  /** @internal Replaces the history; used by undo and redo. */
  withHistory(history: History): EditorState {
    return new EditorState(this.doc, this.selection, this.language, this.tabSize, this.insertSpaces, this.lineEnding, history)
  }

  /** One level of indentation: spaces or a tab. */
  get indentUnit(): string {
    return this.insertSpaces ? ' '.repeat(this.tabSize) : '\t'
  }

  sliceDoc(from = 0, to = this.doc.length): string {
    return this.doc.slice(from, to)
  }

  /** The text, with the document's own line endings, for saving. */
  toFileString(): string {
    const text = this.doc.toString()
    return this.lineEnding === '\n' ? text : text.replace(/\n/g, this.lineEnding)
  }

  /** The word at pos, by the language's word pattern, or undefined. */
  wordAt(pos: number): { from: number; to: number; text: string } | undefined {
    const line = this.doc.lineAt(pos)
    const re = new RegExp(this.language.rules.wordPattern.source, this.language.rules.wordPattern.flags.includes('g') ? this.language.rules.wordPattern.flags : this.language.rules.wordPattern.flags + 'g')
    for (const m of line.text.matchAll(re)) {
      const from = line.from + m.index
      const to = from + m[0].length
      if (m[0].length && from <= pos && pos <= to) return { from, to, text: m[0] }
    }
    return undefined
  }
}
