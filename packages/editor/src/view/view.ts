import { bracketDepth, detectLanguage, grammarOf, loadGrammar, Tokenizer, type LanguageInfo, type Token } from '@tensorai-co/workspace/languages'
import { codicon, iconSvg, type CodiconName } from '@tensorai-co/workspace/icons'
import type { DocumentSymbol } from '@tensorai-co/workspace/host'
import type { Diagnostics } from '../core/diagnostics.js'
import type { Suggest } from '../core/suggest.js'
import { InlineCompletions, type InlineCompletionsConfig } from '../core/inline.js'
import type { FoldRange } from '../core/folding.js'
import { rowsOf } from '../core/wrap.js'
import type { Command, CommandEnv } from '../core/commands.js'
import { buildKeymap, defaultKeymap, isMac, keyName, type KeyBinding } from '../core/keymap.js'
import { EditorState, Transaction, type TransactionSpec } from '../core/state.js'
import { LanguageFeatures, type LanguageFeaturesConfig } from './features.js'
import { FindWidget } from './find.js'
import { Folding, renderChevron } from './folds.js'
import { bindInput } from './input.js'
import { layoutLine, type LineLayout } from './layout.js'
import { dragSlider, MouseSelection, type MouseHost } from './mouse.js'
import { overlaysFor, type Overlay } from './overlay.js'
import { appendRuns, paint, runsFor } from './paint.js'

export type { LanguageFeaturesConfig } from './features.js'

export interface EditorViewConfig {
  parent: HTMLElement
  state: EditorState
  /** Called after every transaction, with the view's new state. */
  onUpdate?: (tr: Transaction, view: EditorView) => void
  /** More key bindings; they win over the defaults. */
  keymap?: KeyBinding[]
  readOnly?: boolean
  /** AI ghost text, from a host's provider. */
  inlineCompletions?: InlineCompletionsConfig
  /** Wraps lines at the editor's width. Off by default. */
  wordWrap?: boolean
  /** Completions, hovers, problems and definitions, from a host's language service. */
  languages?: LanguageFeaturesConfig
}

/** The editor's sizes. */
const GLYPH_MARGIN = 18
const DECORATIONS = 26
const MIN_NUMBER_CHARS = 3
const SCROLLBAR = 14
/** Lines rendered beyond each edge of the viewport. */
const OVERSCAN = 8

interface RenderedLine {
  el: HTMLDivElement
  text: string
  tokens: Token[] | undefined
  /** Bracket nesting depth at the line's start, when known. */
  depth: number | undefined
  number: HTMLDivElement
  /** What's drawn in it besides its text, and how it wraps: the layout's key. */
  overlay: string
  top: number
  /** Its fold chevron in the gutter, when a region starts on it. */
  fold?: HTMLDivElement
}

/**
 * The editor's view: a framework-free DOM component. It renders only the visible lines (plus a margin), reads layout
 * once per frame after writing, and keeps its tokenizer in step with every transaction.
 */
export class EditorView {
  state: EditorState
  readonly dom: HTMLDivElement
  private readonly scroller: HTMLDivElement
  private readonly sizer: HTMLDivElement
  private readonly gutter: HTMLDivElement
  private readonly content: HTMLDivElement
  private readonly linesLayer: HTMLDivElement
  private readonly highlightLayer: HTMLDivElement
  private readonly cursorLayer: HTMLDivElement
  private readonly input: HTMLTextAreaElement
  private readonly vbar: HTMLDivElement
  private readonly vslider: HTMLDivElement
  private readonly hbar: HTMLDivElement
  private readonly hslider: HTMLDivElement
  private readonly rendered = new Map<number, RenderedLine>()
  /** Bracket depth at the start of each line (0-based index); [0, depthValid] are known. */
  private depths: number[] = [0]
  private depthValid = 0
  private readonly keymap: Map<string, Command>
  private readonly scrollListeners = new Set<() => void>()
  private tokenizer: Tokenizer
  private lineHeight = 18
  private charWidth = 7.2
  private gutterWidth = 66
  private contentWidth = 0
  private frame = 0
  private idle = 0
  private focused = false
  private composing = false
  private destroyed = false
  private readonly resizeObserver: ResizeObserver
  /** A run of text that changes size when the code font does. */
  private readonly fontProbe: HTMLDivElement
  private readonly onUpdate: EditorViewConfig['onUpdate']
  readonly readOnly: boolean
  private inline: InlineCompletions | undefined
  private stopInline: (() => void) | undefined
  /** Lines drawn with text that isn't in the document: ghost text, and an edit shown as a diff. */
  private overlays = new Map<number, Overlay>()
  /** How each line is drawn, kept while its text, overlay and wrap stay the same. */
  private layouts = new Map<number, LineLayout & { text: string }>()
  /** Where each line starts, in rows: line n starts at row starts[n - 1], and starts[lines] is them all. */
  private starts = new Int32Array(2)
  /** The rows each line wraps into, when wrapping. */
  private wrapRows: number[] = []
  /** The column lines wrap at; 0 when they don't. */
  private wrapColumns = 0
  private wordWrapOn: boolean
  private readonly folding: Folding
  private hidden = new Uint8Array(2)
  /** The folded regions as of the last measure, and their first lines. */
  private folded: FoldRange[] = []
  private foldedStarts = new Set<number>()
  /** After ⌘K, the next key finishes a chord. */
  private chord = false
  private numbersWidth = 22
  /** The next edit's marker at the left, and the shading beside its lines. */
  private readonly pill: HTMLDivElement
  private readonly editArea: HTMLDivElement
  /** The find widget, at the top right. */
  readonly find: FindWidget
  private readonly features: LanguageFeatures
  private readonly mouseSelection: MouseSelection
  private readonly stopInput: () => void

  constructor(config: EditorViewConfig) {
    this.state = config.state
    this.onUpdate = config.onUpdate
    this.readOnly = config.readOnly ?? false
    this.wordWrapOn = config.wordWrap ?? false
    this.keymap = buildKeymap([...defaultKeymap, ...(config.keymap ?? [])])

    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
      const node = document.createElement(tag)
      node.className = className
      parent?.appendChild(node)
      return node
    }
    this.dom = el('div', 'ws-editor ws-syntax')
    this.scroller = el('div', 'ws-scroller', this.dom)
    this.sizer = el('div', 'ws-sizer', this.scroller)
    this.gutter = el('div', 'ws-gutter', this.sizer)
    this.content = el('div', 'ws-content', this.sizer)
    this.highlightLayer = el('div', 'ws-layer ws-highlights', this.content)
    this.linesLayer = el('div', 'ws-layer ws-lines', this.content)
    this.cursorLayer = el('div', 'ws-layer ws-cursors', this.content)
    this.input = el('textarea', 'ws-input', this.dom)
    this.input.setAttribute('autocapitalize', 'off')
    this.input.setAttribute('autocomplete', 'off')
    this.input.setAttribute('autocorrect', 'off')
    this.input.setAttribute('spellcheck', 'false')
    this.input.setAttribute('aria-label', 'Editor content')
    this.input.setAttribute('aria-multiline', 'true')
    this.input.readOnly = this.readOnly
    this.vbar = el('div', 'ws-scrollbar ws-vertical', this.dom)
    this.vslider = el('div', 'ws-slider', this.vbar)
    this.hbar = el('div', 'ws-scrollbar ws-horizontal', this.dom)
    this.hslider = el('div', 'ws-slider', this.hbar)
    this.editArea = el('div', 'ws-edit-area', this.gutter)
    this.editArea.hidden = true
    this.pill = el('div', 'ws-edit-pill', this.dom)
    this.pill.hidden = true
    this.pill.setAttribute('role', 'button')
    const view = this
    this.find = new FindWidget(
      {
        get state() {
          return view.state
        },
        mac: isMac,
        dispatch: (spec) => this.dispatch(spec),
        focusEditor: () => this.focus(),
        changed: () => this.requestRender(),
      },
      this.dom,
    )
    this.folding = new Folding({
      get state() {
        return view.state
      },
      requestRender: () => this.requestRender(),
      changed: () => this.foldsChanged(),
      destroyed: () => this.destroyed,
    })
    this.features = new LanguageFeatures({
      get state() {
        return view.state
      },
      readOnly: this.readOnly,
      dom: this.dom,
      content: this.content,
      focused: () => this.focused,
      dragging: () => this.mouseSelection.dragging,
      destroyed: () => this.destroyed,
      dispatch: (spec) => this.dispatch(spec),
      focus: () => this.focus(),
      requestRender: () => this.requestRender(),
      coordsAt: (pos) => this.coordsAt(pos),
      posAtCoords: (x, y) => this.posAtCoords(x, y),
      tokenTypeAt: (pos) => this.tokenTypeAt(pos),
      suggestOpened: () => {
        if (this.inline?.ghost) this.inline.dismiss()
      },
    })
    config.parent.appendChild(this.dom)

    this.tokenizer = new Tokenizer(this.state.doc, grammarOf(this.state.language))
    this.ensureGrammar(this.state.language)
    this.fontProbe = el('div', 'ws-font-probe', this.linesLayer)
    this.fontProbe.setAttribute('aria-hidden', 'true')
    this.fontProbe.textContent = 'x'.repeat(100)
    this.measureFont()
    ;({ mouse: this.mouseSelection, stopInput: this.stopInput } = this.bindEvents())
    this.resizeObserver = new ResizeObserver(() => {
      if (this.fontChanged()) this.remeasure()
      this.requestRender()
    })
    this.resizeObserver.observe(this.dom)
    this.resizeObserver.observe(this.fontProbe)
    this.setInlineCompletions(config.inlineCompletions)
    this.setLanguages(config.languages)
    this.requestRender()
  }

  // ------------------------------------------------------------ public API

  /** Applies a transaction (or a spec for one) and redraws. */
  dispatch(spec: TransactionSpec | Transaction): void {
    if (this.destroyed) return
    const tr = spec instanceof Transaction ? spec : this.state.update(spec)
    if (this.readOnly && tr.docChanged) return
    this.state = tr.state
    if (tr.docChanged) {
      this.folding.folds.map(tr.changes)
      this.updateWrapRows(tr)
      this.tokenizer.update(tr.changes, this.state.doc)
      const first = tr.changes.changes[0]
      if (first) this.invalidateDepths(tr.startState.doc.lineAt(first.from).number)
    }
    if (tr.language) {
      this.invalidateDepths(1)
      this.tokenizer = new Tokenizer(this.state.doc, grammarOf(tr.language))
      this.ensureGrammar(tr.language)
    }
    const { folds } = this.folding
    if (folds.size) folds.reveal(this.state.doc, this.state.selection.ranges.map((r) => r.head))
    this.inline?.handleTransaction(tr)
    this.features.handleTransaction(tr)
    if (tr.docChanged) this.find.docChanged()
    else if (!tr.selection.eq(tr.startState.selection)) this.find.selectionChanged()
    this.restartBlink()
    this.requestRender(tr.scrollIntoView)
    this.onUpdate?.(tr, this)
  }

  /** Turns AI ghost text on with a provider, changes its settings, or turns it off. */
  setInlineCompletions(config: InlineCompletionsConfig | undefined): void {
    if (!config || this.readOnly) {
      this.stopInline?.()
      this.inline?.destroy()
      this.inline = this.stopInline = undefined
      this.requestRender()
      return
    }
    if (this.inline) return this.inline.configure(config)
    this.inline = new InlineCompletions(config, () => this.state, { isComposing: () => this.composing })
    this.stopInline = this.inline.subscribe(() => this.requestRender())
  }

  /** Turns language features on with a service, changes their settings, or turns them off. */
  setLanguages(config: LanguageFeaturesConfig | undefined): void {
    this.features.configure(config)
  }

  /** The document's problems, while there's a language service. */
  get diagnostics(): Diagnostics | undefined {
    return this.features.diagnostics
  }

  /** The suggest list's controller, while there's a language service. */
  get suggest(): Suggest | undefined {
    return this.features.suggest
  }

  /** Asks for completions at the cursor: ⌃Space. */
  triggerSuggest(): void {
    this.features.triggerSuggest()
  }

  /** Shows the hover for the cursor's place: ⌘K ⌘I. */
  showHover(pos = this.state.selection.main.head): void {
    this.features.showHover(pos)
  }

  /** Goes to where the symbol at pos is declared: F12. Returns whether there was somewhere to go. */
  goToDefinition(pos = this.state.selection.main.head): Promise<boolean> {
    return this.features.goToDefinition(pos)
  }

  /** Formats the document with the language service: ⇧⌥F. Returns whether it changed anything. */
  format(): Promise<boolean> {
    return this.features.format()
  }

  /** The document's outline, from the language service. */
  symbols(): Promise<DocumentSymbol[]> {
    return this.features.symbols()
  }

  /** Client coordinates of a position's row: for placing widgets. Undefined while the line isn't drawn. */
  coordsAt(pos: number): { left: number; top: number; bottom: number } | undefined {
    const n = this.state.doc.lineAt(pos).number
    if (!this.rendered.has(n) || this.hidden[n]) return undefined
    const box = this.linesLayer.getBoundingClientRect()
    const top = box.top + this.top(n) + this.rowOf(pos) * this.lineHeight
    return { left: box.left + this.xAt(pos), top, bottom: top + this.lineHeight }
  }

  /** Whether lines wrap at the editor's width. */
  get wordWrap(): boolean {
    return this.wordWrapOn
  }

  /** Turns word wrap on or off, keeping the cursor in view. */
  setWordWrap(on: boolean): void {
    if (on === this.wordWrapOn) return
    this.wordWrapOn = on
    this.requestRender(true)
  }

  /** The lines that start folded regions. */
  get foldedLines(): number[] {
    return this.folding.foldedLines
  }

  /** Folds the innermost region at a line (the cursor's by default) that isn't folded yet. Returns whether it did. */
  fold(line = this.cursorLine()): boolean {
    return this.folding.fold(line)
  }

  /** Unfolds the region at a line: the one it starts, or the innermost folded one it's in. Returns whether it did. */
  unfold(line = this.cursorLine()): boolean {
    return this.folding.unfold(line)
  }

  /** Folds the region at a line, or unfolds it when it's folded. */
  toggleFold(line = this.cursorLine()): boolean {
    return this.folding.toggle(line)
  }

  /** Folds every region, as `⌘K ⌘0` does. */
  foldAll(): void {
    this.folding.foldAll()
  }

  /** Unfolds everything, as `⌘K ⌘J` does. */
  unfoldAll(): void {
    this.folding.unfoldAll()
  }

  private cursorLine(): number {
    return this.state.doc.lineAt(this.state.selection.main.head).number
  }

  /** After folding: a cursor in a region that hid goes to the line the region shows. */
  private foldsChanged() {
    const doc = this.state.doc
    const head = this.state.selection.main.head
    const line = doc.lineAt(head)
    const hiding = this.folding.folds.ranges(doc).filter((r) => line.number > r.start && line.number <= r.end).sort((a, b) => a.start - b.start)[0]
    if (hiding) {
      const to = doc.line(hiding.start)
      this.dispatch({ selection: { anchor: to.from + Math.min(to.text.length, head - line.from) }, userEvent: 'select', scrollIntoView: true })
    }
    this.requestRender()
  }

  /** The view's own keys: folding, the ⌘K chords, and ⌥Z for word wrap. */
  private viewKey(e: KeyboardEvent): boolean {
    const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
    if (this.chord) {
      this.chord = false
      if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return (this.chord = true), false
      if (!mod) return true
      if (e.code === 'KeyI') this.showHover()
      else if (e.code === 'Digit0') this.foldAll()
      else if (e.code === 'KeyJ') this.unfoldAll()
      else if (e.code === 'KeyL') this.toggleFold()
      return true
    }
    if (mod && !e.shiftKey && !e.altKey && e.code === 'KeyK') return (this.chord = true), true
    const foldKey = isMac ? mod && e.altKey && !e.shiftKey : mod && e.shiftKey && !e.altKey
    if (foldKey && e.code === 'BracketLeft') return this.fold(), true
    if (foldKey && e.code === 'BracketRight') return this.unfold(), true
    if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.code === 'KeyZ') return this.setWordWrap(!this.wordWrapOn), true
    return false
  }

  /** The ghost text's controller, when there's a provider: to ask, accept or dismiss from outside. */
  get inlineCompletions(): InlineCompletions | undefined {
    return this.inline
  }

  /** Runs a command against the current state. Returns whether it applied. */
  run(command: Command): boolean {
    const spec = command(this.state, this.env)
    if (!spec) return false
    this.dispatch(spec)
    return true
  }

  /** Replaces the whole state, as when another file opens in this view. */
  setState(state: EditorState): void {
    this.inline?.reset()
    this.features.replaced()
    this.folding.folds.clear()
    this.state = state
    this.wrapColumns = -1
    this.tokenizer = new Tokenizer(state.doc, grammarOf(state.language))
    this.ensureGrammar(state.language)
    this.invalidateDepths(1)
    for (const line of this.rendered.values()) {
      line.el.remove()
      line.number.remove()
      line.fold?.remove()
    }
    this.rendered.clear()
    this.find.docChanged()
    this.requestRender()
  }

  /** The line at the top, from 1. 3.5 is halfway down line 3. */
  get topLine(): number {
    this.measureRows()
    const row = this.scroller.scrollTop / this.lineHeight
    const n = this.lineAtRow(Math.floor(row))
    const rows = Math.max(1, this.starts[n]! - this.starts[n - 1]!)
    return n + Math.min(0.999, (row - this.starts[n - 1]!) / rows)
  }

  /** Scrolls a line to the top. Fractions of a line work too. */
  scrollToLine(line: number): void {
    this.measureRows()
    this.sizeDocument()
    const n = Math.max(1, Math.min(this.state.doc.lines, Math.floor(line)))
    const rows = this.starts[n]! - this.starts[n - 1]!
    this.scroller.scrollTop = Math.round((this.starts[n - 1]! + (line - n) * rows) * this.lineHeight)
  }

  /** Calls back on every scroll. Returns a function that stops. */
  onScroll(listener: () => void): () => void {
    this.scrollListeners.add(listener)
    return () => void this.scrollListeners.delete(listener)
  }

  focus(): void {
    this.input.focus({ preventScroll: true })
    // The focus event doesn't fire when the page itself isn't focused yet; sync from the DOM.
    this.setFocused(document.activeElement === this.input)
  }

  private setFocused(focused: boolean) {
    if (this.focused === focused) return
    this.focused = focused
    this.dom.classList.toggle('ws-focused', focused)
    if (focused) this.restartBlink()
  }

  get hasFocus(): boolean {
    return this.focused
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.frame)
    clearTimeout(this.idle)
    this.folding.destroy()
    this.resizeObserver.disconnect()
    this.setInlineCompletions(undefined)
    this.features.destroy()
    this.stopInput()
    this.find.destroy()
    this.dom.remove()
  }

  /** What commands get from the view. */
  get env(): CommandEnv {
    return {
      tokenTypeAt: (pos) => this.tokenTypeAt(pos),
      pageLines: Math.max(1, Math.floor(this.scroller.clientHeight / this.lineHeight) - 1),
      moveVertically: (pos, rows, goal) => this.moveVertically(pos, rows, goal),
    }
  }

  /** The token type at pos, if its line is tokenized. */
  tokenTypeAt(pos: number): string | undefined {
    const line = this.state.doc.lineAt(pos)
    const tokens = this.tokenizer.lineTokens(line.number)
    if (!tokens) return undefined
    let at = line.from
    for (const t of tokens) {
      if (pos < at + t.text.length) return t.type
      at += t.text.length
    }
    return tokens[tokens.length - 1]?.type
  }

  // ------------------------------------------------------------ language

  private ensureGrammar(language: LanguageInfo) {
    if (!language.grammar || grammarOf(language)) return
    void loadGrammar(language).then((grammar) => {
      if (this.destroyed || this.state.language !== language) return
      this.tokenizer.setGrammar(grammar)
      this.invalidateDepths(1)
      this.requestRender()
    })
  }

  /** Detects the language from a file path, and switches to it. */
  setLanguageFromPath(path: string): void {
    const language = detectLanguage(path, this.state.doc.line(1).text)
    if (language.id !== this.state.language.id) this.dispatch({ language })
  }

  // ------------------------------------------------------------ measuring

  private fontMetrics(): { charWidth: number; lineHeight: number } {
    const rect = this.fontProbe.getBoundingClientRect()
    const lh = parseFloat(getComputedStyle(this.fontProbe).lineHeight)
    return { charWidth: rect.width / 100 || 7.2, lineHeight: Number.isFinite(lh) && lh > 0 ? lh : 18 }
  }

  private measureFont() {
    ;({ charWidth: this.charWidth, lineHeight: this.lineHeight } = this.fontMetrics())
  }

  private fontChanged(): boolean {
    const now = this.fontMetrics()
    return Math.abs(now.charWidth - this.charWidth) > 0.001 || now.lineHeight !== this.lineHeight
  }

  /** Measures the code font again and redraws every line: after the font, its size or the line height changed. */
  remeasure(): void {
    this.measureFont()
    this.layouts.clear()
    this.wrapColumns = -1
    for (const line of this.rendered.values()) {
      line.el.remove()
      line.number.remove()
      line.fold?.remove()
    }
    this.rendered.clear()
    this.requestRender()
  }

  /** x of pos within its line, in content coordinates. The line must be rendered. */
  private xAt(pos: number): number {
    const line = this.state.doc.lineAt(pos)
    const layout = this.layoutOf(line.number)
    const { row, offset } = layout.map(pos - line.from)
    return this.xIn(line.number, layout, row, offset)
  }

  /** x of an offset into a visual row's text, in content coordinates. */
  private xIn(n: number, layout: LineLayout, row: number, offset: number): number {
    const r = layout.rows[row]!
    const text = layout.logical[r.logical]!.text.slice(r.from, r.from + offset)
    const indent = r.indent * this.charWidth
    // Plain ASCII without tabs: a monospace grid, no layout needed.
    if (/^[\x20-\x7e]*$/.test(text)) return indent + offset * this.charWidth
    const el = this.rowEl(n, row)
    const found = el && this.domPoint(el, offset)
    if (!found) return indent + offset * this.charWidth
    const range = document.createRange()
    range.setStart(found.node, found.offset)
    range.setEnd(found.node, found.offset)
    const rects = range.getClientRects()
    const rect = rects[rects.length - 1] ?? range.getBoundingClientRect()
    return rect.left - this.linesLayer.getBoundingClientRect().left
  }

  /** The element of a visual row of a rendered line. */
  private rowEl(n: number, row: number): HTMLElement | undefined {
    const rendered = this.rendered.get(n)
    if (!rendered) return undefined
    return rendered.el.children.length && rendered.el.firstElementChild?.classList.contains('ws-row') ? (rendered.el.children[row] as HTMLElement | undefined) : rendered.el
  }

  /** The text node and offset for a column in a rendered line. */
  private domPoint(lineEl: HTMLElement, col: number): { node: Node; offset: number } | undefined {
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT)
    let left = col
    let last: Node | undefined
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const len = node.textContent?.length ?? 0
      if (left <= len) return { node, offset: left }
      left -= len
      last = node
    }
    return last ? { node: last, offset: last.textContent?.length ?? 0 } : undefined
  }

  /** The document position at client coordinates. */
  posAtCoords(clientX: number, clientY: number): number {
    this.measureRows()
    const box = this.linesLayer.getBoundingClientRect()
    const { line: n, row } = this.pointAtY(clientY - box.top)
    const line = this.state.doc.line(n)
    const layout = this.layoutOf(n)
    const r = layout.rows[Math.min(row, layout.rows.length - 1)]!
    const rowText = layout.logical[r.logical]!.text.slice(r.from, r.to)
    const x = clientX - box.left - r.indent * this.charWidth
    let offset = Math.max(0, Math.min(rowText.length, Math.round(x / this.charWidth)))
    const el = this.rowEl(n, row)
    if (!/^[\x20-\x7e]*$/.test(rowText) && el) {
      const doc = document as Document & { caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null }
      const y = box.top + this.top(n) + row * this.lineHeight + this.lineHeight / 2
      let node: Node | undefined
      let at = 0
      if (doc.caretPositionFromPoint) {
        const p = doc.caretPositionFromPoint(clientX, y)
        if (p) ((node = p.offsetNode), (at = p.offset))
      } else if (document.caretRangeFromPoint) {
        const c = document.caretRangeFromPoint(clientX, y)
        if (c) ((node = c.startContainer), (at = c.startOffset))
      }
      if (node && el.contains(node)) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let col = 0
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          if (t === node) {
            offset = Math.min(rowText.length, col + at)
            break
          }
          col += t.textContent?.length ?? 0
        }
      } else if (clientX - box.left > (el.getBoundingClientRect().width || 0)) offset = rowText.length
    }
    return line.from + layout.unmap(row, offset)
  }

  /** Where a vertical move by drawn rows lands, keeping to a goal column: wrapped rows count, folded lines don't. */
  private moveVertically(pos: number, rows: number, goal: number | undefined): { pos: number; goal: number } {
    this.measureRows()
    const doc = this.state.doc
    const line = doc.lineAt(pos)
    const layout = this.layoutOf(line.number)
    const { row, offset } = layout.map(pos - line.from)
    const column = goal ?? this.xIn(line.number, layout, row, offset) / this.charWidth
    const target = this.starts[line.number - 1]! + row + rows
    const total = this.starts[doc.lines]!
    if (target < 0) return { pos: 0, goal: column }
    if (target >= total) return { pos: doc.length, goal: column }
    const n = this.lineAtRow(target)
    const to = this.layoutOf(n)
    const r = target - this.starts[n - 1]!
    const visual = to.rows[r]!
    const text = to.logical[visual.logical]!.text.slice(visual.from, visual.to)
    // The offset whose column is nearest the goal, counting tabs and wide characters.
    let col = visual.indent
    let at = 0
    while (at < text.length) {
      const code = text.charCodeAt(at)
      const width = code === 9 ? this.state.tabSize - (col % this.state.tabSize) : code >= 0x2e80 ? 2 : 1
      if (col + width / 2 > column) break
      col += width
      at++
    }
    return { pos: doc.line(n).from + to.unmap(r, at), goal: column }
  }

  // ------------------------------------------------------------ rendering

  requestRender(scrollIntoView = false): void {
    if (scrollIntoView) this.pendingScroll = true
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.render()
    })
  }
  private pendingScroll = false

  /** Draws now rather than at the next frame. */
  private renderNow() {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.render()
  }

  private render() {
    if (this.destroyed) return
    const doc = this.state.doc
    const lh = this.lineHeight
    const viewport = this.scroller.clientHeight || 1

    // Gutter and sizes.
    const digits = Math.max(MIN_NUMBER_CHARS, String(doc.lines).length)
    const numbersWidth = Math.round(digits * this.charWidth)
    this.numbersWidth = numbersWidth
    this.gutterWidth = GLYPH_MARGIN + numbersWidth + DECORATIONS
    this.dom.style.setProperty('--ws-gutter', `${this.gutterWidth}px`)
    this.dom.style.setProperty('--ws-numbers', `${numbersWidth}px`)
    this.dom.style.setProperty('--ws-lh', `${lh}px`)
    this.measureRows()
    this.sizeDocument()

    if (this.pendingScroll) {
      this.pendingScroll = false
      this.scrollToCursor()
    }

    // Tokenize what's visible first; the rest fills in when idle.
    // The rows in view and a margin of rows around them, as folded lines take none and wrapped ones several.
    const first = this.lineAtRow(Math.max(0, Math.floor(this.scroller.scrollTop / lh) - OVERSCAN))
    const last = Math.min(doc.lines, this.lineAtRow(Math.floor((this.scroller.scrollTop + viewport) / lh) + OVERSCAN))
    const worked = this.tokenizer.work(last, 6)
    if (worked) this.invalidateDepths(worked.from)
    this.scheduleIdle()

    // Lines: reuse what's there, rebuild what changed, drop what scrolled away.
    let widest = this.contentWidth
    const ranges = this.folding.rangesNow()
    for (const [n, line] of this.rendered) {
      if (n < first || n > last || this.hidden[n]) {
        line.el.remove()
        line.number.remove()
        line.fold?.remove()
        this.rendered.delete(n)
      }
    }
    for (let n = first; n <= last; n++) {
      if (this.hidden[n]) continue
      const text = doc.line(n).text
      const tokens = this.tokenizer.lineTokens(n)
      const depth = tokens ? this.depthAt(n) : undefined
      const layout = this.layoutOf(n)
      let line = this.rendered.get(n)
      if (!line) {
        const el = document.createElement('div')
        el.className = 'ws-line'
        const number = document.createElement('div')
        number.className = 'ws-line-number'
        number.textContent = String(n)
        this.linesLayer.appendChild(el)
        this.gutter.appendChild(number)
        line = { el, text: '', tokens: undefined, depth: undefined, number, overlay: '', top: -1 }
        this.rendered.set(n, line)
        this.fillLine(line, text, tokens, depth, layout)
      } else if (line.text !== text || line.tokens !== tokens || line.depth !== depth || line.overlay !== layout.key + (this.foldedStarts.has(n) ? '|folded' : '')) {
        this.fillLine(line, text, tokens, depth, layout)
      }
      const top = this.top(n)
      if (line.top !== top) {
        line.top = top
        line.el.style.top = line.number.style.top = `${top}px`
        if (line.fold) line.fold.style.top = `${top}px`
      }
      renderChevron(line, this.gutter, n, ranges.byStart.get(n), this.foldedStarts.has(n), GLYPH_MARGIN + this.numbersWidth + 2)
      if (!this.wrapColumns) widest = Math.max(widest, text.length * this.charWidth)
    }
    if (this.wrapColumns) {
      this.contentWidth = 0
      this.sizer.style.width = ''
    } else if (widest > this.contentWidth) {
      this.contentWidth = widest
      this.sizer.style.width = `${this.gutterWidth + widest + 40}px`
    }

    this.renderSelection(first, last)
    this.features.layout()
    this.find.layout(this.dom.clientWidth)
    this.renderEdit()
    this.renderScrollbars()
    this.positionInput()
  }

  private fillLine(line: RenderedLine, text: string, tokens: Token[] | undefined, depth: number | undefined, layout: LineLayout) {
    line.text = text
    line.tokens = tokens
    line.depth = depth
    const folded = this.foldedStarts.has(layout.line)
    line.overlay = layout.key + (folded ? '|folded' : '')
    const el = line.el
    el.textContent = ''
    const overlay = this.overlays.get(layout.line)
    const rows = layout.rows.length
    el.style.height = rows > 1 ? `${rows * this.lineHeight}px` : ''
    // A folded line ends in "⋯", after its last row; clicking it unfolds.
    const placeholder = () => {
      if (!folded) return
      const mark = document.createElement('span')
      mark.className = 'ws-fold-placeholder'
      mark.textContent = '⋯'
      ;(el.lastElementChild?.classList.contains('ws-row') ? el.lastElementChild : el).appendChild(mark)
    }
    if (!overlay && rows === 1) {
      if (!tokens) el.textContent = text
      else paint(el, text, tokens, depth)
      placeholder()
      return
    }
    // Each logical row in its token colors, as the rows the document would have with the drawn text in it; then
    // each cut into the visual rows it wraps into.
    const tokensOf = overlay && tokens ? this.tokenizer.preview(layout.line, layout.logical.map((l) => l.text)) : tokens ? [tokens] : undefined
    let rowDepth = depth
    layout.logical.forEach((logical, i) => {
      if (i > 0 && rowDepth !== undefined && tokensOf?.[i - 1]) rowDepth = bracketDepth(tokensOf[i - 1]!, rowDepth)
      const runs = runsFor(logical.text, tokensOf?.[i], rowDepth, logical.marks)
      for (const r of layout.rows) {
        if (r.logical !== i) continue
        const target = rows === 1 ? el : document.createElement('div')
        if (target !== el) {
          target.className = 'ws-row'
          if (r.indent) target.style.paddingLeft = `${r.indent * this.charWidth}px`
          el.appendChild(target)
        }
        appendRuns(target, runs, r.from, r.to)
      }
    })
    placeholder()
  }

  /** How a line is drawn now: its overlay, wrapped. Kept while those stay the same. */
  private layoutOf(n: number): LineLayout {
    const text = this.state.doc.line(n).text
    const overlay = this.overlays.get(n)
    const key = `${overlay?.key ?? ''}|${this.wrapColumns}`
    const known = this.layouts.get(n)
    if (known && known.text === text && known.key === key) return known
    if (this.layouts.size > 4000) this.layouts.clear()
    const made = Object.assign(layoutLine(n, text, overlay, this.wrapColumns, this.state.tabSize), { text })
    this.layouts.set(n, made)
    return made
  }

  /**
   * Works out what each line takes: what's drawn into it, the column it wraps at, which lines folds hide, and from
   * those, the row each line starts on.
   */
  private measureRows() {
    const doc = this.state.doc
    const lines = doc.lines
    const { folds } = this.folding
    const ranges = folds.size ? folds.ranges(doc) : []
    this.folded = ranges
    this.foldedStarts = new Set(ranges.map((r) => r.start))
    this.overlays = overlaysFor(doc, this.inline?.ghost, this.inline?.nextEdit)
    const width = this.dom.clientWidth - this.gutterWidth
    const columns = this.wordWrapOn && width > 0 ? Math.max(1, Math.floor((width - SCROLLBAR - 2) / this.charWidth)) : 0
    if (columns !== this.wrapColumns || this.wrapRows.length !== lines) {
      this.wrapColumns = columns
      this.wrapRows = columns ? Array.from({ length: lines }, (_, i) => rowsOf(doc.line(i + 1).text, columns, this.state.tabSize)) : []
    }
    if (this.hidden.length !== lines + 1) this.hidden = new Uint8Array(lines + 1)
    else this.hidden.fill(0)
    for (const r of ranges) this.hidden.fill(1, r.start + 1, r.end + 1)
    if (this.starts.length !== lines + 1) this.starts = new Int32Array(lines + 1)
    let at = 0
    for (let n = 1; n <= lines; n++) {
      this.starts[n - 1] = at
      if (this.hidden[n]) continue
      at += this.overlays.has(n) ? this.layoutOf(n).rows.length : columns ? this.wrapRows[n - 1]! : 1
    }
    this.starts[lines] = at
  }

  /** Keeps each line's count of wrapped rows through an edit: only the lines it touched are wrapped again. */
  private updateWrapRows(tr: Transaction) {
    if (!this.wrapColumns || this.wrapRows.length !== tr.startState.doc.lines) return
    const old = tr.startState.doc
    const doc = this.state.doc
    let first = Infinity
    let lastOld = -1
    let lastNew = -1
    for (const c of tr.changes.inserted()) {
      first = Math.min(first, old.lineAt(c.oldFrom).number - 1)
      lastOld = Math.max(lastOld, old.lineAt(c.oldTo).number - 1)
      lastNew = Math.max(lastNew, doc.lineAt(c.to).number - 1)
    }
    if (first === Infinity) return
    const fresh = Array.from({ length: lastNew - first + 1 }, (_, i) => rowsOf(doc.line(first + i + 1).text, this.wrapColumns, this.state.tabSize))
    this.wrapRows.splice(first, lastOld - first + 1, ...fresh)
  }

  /** The next edit's shading in the gutter, and its marker: on its line when that's in view, else at the nearest edge. */
  private renderEdit() {
    const edit = this.inline?.nextEdit
    this.pill.hidden = this.editArea.hidden = !edit
    if (!edit) return
    const { doc } = this.state
    const lh = this.lineHeight
    const first = doc.lineAt(edit.from).number
    const last = doc.lineAt(edit.to).number
    const top = this.top(first)
    Object.assign(this.editArea.style, { top: `${top}px`, height: `${this.top(last + 1) - top}px`, width: `${this.gutterWidth - 2}px` })

    // 2px in from the edges of the view.
    const want = top - this.scroller.scrollTop
    const bottom = (this.scroller.clientHeight || lh) - 2 - lh
    const docked = want >= 2 && want <= bottom
    const at = docked ? want : Math.max(2, Math.min(bottom, want))
    const accept = edit.action === 'accept'
    const cursorLine = doc.lineAt(this.state.selection.main.head).number
    const icon: CodiconName = accept ? 'keyboard-tab' : docked ? (cursorLine <= first ? 'keyboard-tab-above' : 'keyboard-tab-below') : 'arrow-right'
    // Off the view, the arrow points the way to the edit.
    const turn = docked ? 0 : at < want ? 90 : -90
    const numberWidth = GLYPH_MARGIN + this.numbersWidth - 1
    this.pill.className = `ws-edit-pill ${accept ? 'ws-accept' : ''}`
    this.pill.title = accept ? 'Accept Edit (Tab)' : 'Go to Edit (Tab)'
    Object.assign(this.pill.style, { top: `${at}px`, height: `${lh}px`, width: `${docked ? this.gutterWidth - 2 : 22}px` })
    this.pill.innerHTML =
      (docked ? `<span class="ws-edit-pill-number" style="width:${numberWidth}px">${first}</span>` : '') +
      `<span class="ws-edit-pill-icon" style="transform:rotate(${turn}deg)">${iconSvg(codicon(icon), 16)}</span>`
  }

  /** Where a line starts, in content pixels. */
  private top(n: number): number {
    return (this.starts[Math.max(0, Math.min(this.starts.length - 1, n - 1))] ?? 0) * this.lineHeight
  }

  /** The line a row is in. A row past the end is in the last line. */
  private lineAtRow(row: number): number {
    const lines = this.state.doc.lines
    if (this.starts.length !== lines + 1) return Math.max(1, Math.min(lines, row + 1))
    let lo = 1
    let hi = lines
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.starts[mid - 1]! <= row) lo = mid
      else hi = mid - 1
    }
    // Hidden lines start where the next one does; the visible one before them holds the row.
    while (lo > 1 && this.hidden[lo]) lo--
    return lo
  }

  /** The line and its visual row at a height in the content. */
  private pointAtY(y: number): { line: number; row: number } {
    const row = Math.max(0, Math.floor(y / this.lineHeight))
    const line = this.lineAtRow(row)
    const rows = this.layoutOf(line).rows.length
    return { line, row: Math.max(0, Math.min(rows - 1, row - this.starts[line - 1]!)) }
  }

  /** The visual row a position is on, within its line. */
  private rowOf(pos: number): number {
    const line = this.state.doc.lineAt(pos)
    return this.layoutOf(line.number).map(pos - line.from).row
  }

  private invalidateDepths(line: number) {
    this.depthValid = Math.min(this.depthValid, Math.max(0, line - 1))
  }

  /** Bracket depth at the start of a line, from tokenized lines above it; undefined until they're tokenized. */
  private depthAt(n: number): number | undefined {
    while (this.depthValid < n - 1) {
      const i = this.depthValid
      const tokens = this.tokenizer.lineTokens(i + 1)
      if (!tokens) return undefined
      this.depths[i + 1] = bracketDepth(tokens, this.depths[i] ?? 0)
      this.depthValid = i + 1
    }
    return this.depths[n - 1]
  }

  private renderSelection(first: number, last: number) {
    const doc = this.state.doc
    const lh = this.lineHeight
    const main = this.state.selection.main
    const highlights: string[] = []
    const cursors: string[] = []
    const mainLine = doc.lineAt(main.head).number
    for (const [n, line] of this.rendered) line.number.classList.toggle('ws-active', n === mainLine)
    // The current line, when nothing is selected.
    if (this.state.selection.ranges.every((r) => r.empty) && mainLine >= first && mainLine <= last) {
      highlights.push(`<div class="ws-current-line" style="top:${this.top(mainLine) + this.rowOf(main.head) * lh}px"></div>`)
    }
    for (const r of this.state.selection.ranges) {
      if (!r.empty) {
        const a = doc.lineAt(r.from)
        const b = doc.lineAt(r.to)
        for (let n = Math.max(a.number, first); n <= Math.min(b.number, last); n++) {
          if (this.hidden[n]) continue
          const line = doc.line(n)
          // Selected line breaks show as a little extra width.
          for (const s of this.spans(n, n === a.number ? r.from - line.from : 0, n === b.number ? r.to - line.from : line.text.length, n !== b.number)) {
            highlights.push(`<div class="ws-selection" style="top:${s.top}px;left:${s.left}px;width:${s.width}px"></div>`)
          }
        }
      }
      const head = doc.lineAt(r.head).number
      if (head >= first && head <= last) cursors.push(`<div class="ws-cursor" style="top:${this.top(head) + this.rowOf(r.head) * lh}px;left:${this.xAt(r.head)}px"></div>`)
    }
    // Folded lines, shaded.
    for (const range of this.folded) {
      if (range.start >= first && range.start <= last) highlights.push(`<div class="ws-folded-line" style="top:${this.top(range.start)}px"></div>`)
    }
    this.features.decorate(first, last, (from, to, className) => this.mark(first, last, from, to, className, highlights))
    this.findHighlights(first, last, highlights)
    this.highlightLayer.innerHTML = highlights.join('')
    this.cursorLayer.innerHTML = cursors.join('')
  }

  /** Draws a class over a stretch of text, in the lines in view: one box per row it's on. */
  private mark(first: number, last: number, from: number, to: number, className: string, out: string[]) {
    const { doc } = this.state
    const a = doc.lineAt(from)
    const b = doc.lineAt(to)
    for (let n = Math.max(a.number, first); n <= Math.min(b.number, last); n++) {
      if (this.hidden[n] || !this.rendered.has(n)) continue
      const line = doc.line(n)
      for (const s of this.spans(n, n === a.number ? from - line.from : 0, n === b.number ? to - line.from : line.text.length, false)) {
        out.push(`<div class="${className}" style="top:${s.top}px;left:${s.left}px;width:${s.width}px"></div>`)
      }
    }
  }

  /** The find widget's matches, and the range "Find in Selection" searches. */
  private findHighlights(first: number, last: number, out: string[]) {
    const find = this.find
    if (!find.isOpen) return
    const { doc } = this.state
    const lh = this.lineHeight
    if (find.scope) {
      const a = Math.max(first, doc.lineAt(find.scope.from).number)
      const b = Math.min(last, doc.lineAt(find.scope.to).number)
      for (let n = a; n <= b; n++) if (!this.hidden[n]) out.push(`<div class="ws-find-scope" style="top:${this.top(n)}px;height:${this.top(n + 1) - this.top(n)}px"></div>`)
    }
    const { matches } = find
    const start = doc.line(first).from
    const end = doc.line(last).to
    // The first match that reaches the lines in view.
    let lo = 0
    let hi = matches.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (matches[mid]!.to < start) lo = mid + 1
      else hi = mid
    }
    const current = find.current
    for (let i = lo; i < matches.length && matches[i]!.from <= end; i++) {
      const m = matches[i]!
      if (m.from === m.to) continue
      const className = i === current ? 'ws-find-match ws-current' : 'ws-find-match'
      const a = doc.lineAt(m.from)
      const b = doc.lineAt(m.to)
      for (let n = Math.max(a.number, first); n <= Math.min(b.number, last); n++) {
        if (this.hidden[n]) continue
        const line = doc.line(n)
        for (const s of this.spans(n, n === a.number ? m.from - line.from : 0, n === b.number ? m.to - line.from : line.text.length, n !== b.number)) {
          out.push(`<div class="${className}" style="top:${s.top}px;left:${s.left}px;width:${s.width}px;height:${lh}px"></div>`)
        }
      }
    }
  }

  /** The boxes a stretch of a line takes, one per visual row it's on. `eol` adds the line break, as it's selected. */
  private spans(n: number, from: number, to: number, eol: boolean): { top: number; left: number; width: number }[] {
    const layout = this.layoutOf(n)
    const out: { top: number; left: number; width: number }[] = []
    layout.rows.forEach((row, r) => {
      const range = layout.range(r)
      const last = r === layout.rows.length - 1
      const a = Math.max(from, range.from)
      const b = Math.min(to, range.to)
      if (a > b || (a === b && !(last && eol))) return
      const x0 = this.xIn(n, layout, r, layout.map(a).row === r ? layout.map(a).offset : 0)
      let x1 = b === range.to && !row.end ? this.xIn(n, layout, r, row.to - row.from) : this.xIn(n, layout, r, layout.map(b).row === r ? layout.map(b).offset : row.to - row.from)
      if (last && eol) x1 += this.charWidth * 0.6
      if (x1 > x0) out.push({ top: this.top(n) + r * this.lineHeight, left: x0, width: x1 - x0 })
    })
    return out
  }

  private renderScrollbars() {
    const s = this.scroller
    const vTrack = this.dom.clientHeight
    const vRatio = s.clientHeight / Math.max(1, s.scrollHeight)
    const vSize = Math.max(20, vTrack * vRatio)
    this.vbar.style.display = vRatio >= 1 ? 'none' : ''
    this.vslider.style.height = `${vSize}px`
    this.vslider.style.transform = `translateY(${(s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight)) * (vTrack - vSize)}px)`
    const hTrack = this.dom.clientWidth - this.gutterWidth - SCROLLBAR
    const hRatio = (s.clientWidth - this.gutterWidth) / Math.max(1, s.scrollWidth - this.gutterWidth)
    const hSize = Math.max(20, hTrack * hRatio)
    this.hbar.style.display = hRatio >= 1 ? 'none' : ''
    this.hbar.style.left = `${this.gutterWidth}px`
    this.hslider.style.width = `${hSize}px`
    this.hslider.style.transform = `translateX(${(s.scrollLeft / Math.max(1, s.scrollWidth - s.clientWidth)) * (hTrack - hSize)}px)`
    this.dom.classList.toggle('ws-scrolled', s.scrollTop > 0)
  }

  private sizeDocument() {
    // The last line can scroll to the top.
    const lh = this.lineHeight
    const rows = this.starts[this.state.doc.lines] ?? this.state.doc.lines
    this.sizer.style.height = `${rows * lh + Math.max(0, (this.scroller.clientHeight || 1) - lh)}px`
  }

  private scrollToCursor() {
    const head = this.state.selection.main.head
    const line = this.state.doc.lineAt(head)
    const top = this.top(line.number) + this.rowOf(head) * this.lineHeight
    const s = this.scroller
    if (top < s.scrollTop) s.scrollTop = top
    else if (top + this.lineHeight > s.scrollTop + s.clientHeight) s.scrollTop = top + this.lineHeight - s.clientHeight
    if (this.wrapColumns) return
    const x = (head - line.from) * this.charWidth
    const visible = s.clientWidth - this.gutterWidth - SCROLLBAR
    if (x < s.scrollLeft) s.scrollLeft = Math.max(0, x - 20)
    else if (x > s.scrollLeft + visible - 10) s.scrollLeft = x - visible + 30
  }

  /** Keeps the hidden input at the main cursor, so the IME candidate window opens there. */
  private positionInput() {
    const head = this.state.selection.main.head
    const n = this.state.doc.lineAt(head).number
    const top = this.top(n) + this.rowOf(head) * this.lineHeight - this.scroller.scrollTop
    const left = this.gutterWidth + (this.rendered.has(n) ? this.xAt(head) : 0) - this.scroller.scrollLeft
    this.input.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, top)}px)`
  }

  private scheduleIdle() {
    if (this.tokenizer.done || this.idle) return
    this.idle = window.setTimeout(() => {
      this.idle = 0
      if (this.destroyed) return
      const changed = this.tokenizer.work(this.state.doc.lines, 8)
      if (changed) this.invalidateDepths(changed.from)
      if (changed && [...this.rendered.keys()].some((n) => n >= changed.from && n <= changed.to)) this.requestRender()
      this.scheduleIdle()
    }, 0)
  }

  private restartBlink() {
    this.cursorLayer.classList.remove('ws-blink')
    void this.cursorLayer.offsetWidth
    this.cursorLayer.classList.add('ws-blink')
  }

  // ------------------------------------------------------------ input

  private bindEvents(): { mouse: MouseSelection; stopInput: () => void } {
    const view = this
    const stopInput = bindInput(this.input, {
      get readOnly() {
        return view.readOnly
      },
      get state() {
        return view.state
      },
      get composing() {
        return view.composing
      },
      set composing(on) {
        view.composing = on
      },
      setFocused: (focused) => this.setFocused(focused),
      blurred: () => {
        this.features.blurred()
        if (this.inline?.ghost) this.inline.dismiss()
      },
      handleKey: (e) => this.features.key(e) || this.inlineKey(e) || this.find.editorKey(e) || this.viewKey(e),
      commandFor: (e) => this.keymap.get(keyName(e)),
      run: (command) => this.run(command),
    })

    this.scroller.addEventListener('scroll', () => {
      this.features.hideHover()
      this.requestRender()
      this.scrollListeners.forEach((listener) => listener())
    })
    this.content.addEventListener('mousemove', (e) => this.features.mouseMove(e))
    this.content.addEventListener('mouseleave', () => this.features.mouseLeft())

    const mouseHost: MouseHost = {
      get state() {
        return view.state
      },
      dom: this.dom,
      scroller: this.scroller,
      scrollbarWidth: SCROLLBAR,
      dispatch: (spec) => this.dispatch(spec),
      focus: () => this.focus(),
      posAtCoords: (x, y) => this.posAtCoords(x, y),
      gutterWidth: () => this.gutterWidth,
      toggleFold: (line) => void this.toggleFold(line),
      pressed: (e) => {
        // "⋯" on a folded line unfolds it.
        if ((e.target as Element).closest('.ws-fold-placeholder')) {
          for (const [n, line] of this.rendered) if (line.el.contains(e.target as Node)) this.unfold(n)
          return true
        }
        if (this.features.pressed(e)) return true
        // Clicking puts the suggestion away first, so the click lands on the text as it really is.
        if (this.inline?.ghost && this.inline.dismiss()) this.renderNow()
        return false
      },
    }
    const mouse = new MouseSelection(mouseHost, this.content, this.gutter)
    dragSlider(mouseHost, this.vslider, 'y')
    dragSlider(mouseHost, this.hslider, 'x')

    // The next edit's marker: Tab's job, by click. The focus stays in the editor.
    this.pill.addEventListener('mousedown', (e) => e.preventDefault())
    this.pill.addEventListener('click', () => {
      const inline = this.inline
      if (!inline) return
      this.focus()
      this.run(() => inline.tab())
    })
    return { mouse, stopInput }
  }

  /** The ghost text's keys. They only act while there's a suggestion, except asking for one. */
  private inlineKey(e: KeyboardEvent): boolean {
    const inline = this.inline
    if (!inline) return false
    const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
    const plain = !e.metaKey && !e.ctrlKey && !e.shiftKey
    // By the key's place, as Option changes the character on a Mac; by the character where there's no place.
    const is = (code: string, key: string) => e.code === code || (!e.code && e.key === key)
    if (plain && e.altKey && is('Backslash', '\\')) {
      inline.trigger()
      return true
    }
    if (plain && !e.altKey && e.key === 'Tab' && (inline.ghost || inline.nextEdit)) return this.run(() => inline.tab())
    if (plain && !e.altKey && e.key === 'Escape') return inline.dismiss()
    if (!inline.ghost) return false
    if (mod && !e.altKey && e.key === 'ArrowRight') return this.run(() => inline.accept(e.shiftKey ? 'line' : 'word'))
    if (plain && e.altKey && (is('BracketRight', ']') || is('BracketLeft', '['))) return inline.cycle(is('BracketRight', ']') ? 1 : -1)
    return false
  }
}
