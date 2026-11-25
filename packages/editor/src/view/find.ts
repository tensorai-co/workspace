import { codicon, iconSvg, type CodiconName } from '@tensorai-co/workspace/icons'
import { findMatches, findNext, findPrevious, matchIndex, MATCHES_LIMIT, nearestMatch, replaceAll, replaceNext, selectAllMatches, type SearchMatch, type SearchQuery } from '../core/search.js'
import type { EditorState, TransactionSpec } from '../core/state.js'

/** What the find widget needs from its editor. */
export interface FindHost {
  readonly state: EditorState
  readonly mac: boolean
  dispatch(spec: TransactionSpec): void
  focusEditor(): void
  /** Draws the matches again. */
  changed(): void
}

type Option = 'caseSensitive' | 'wholeWord' | 'regexp' | 'preserveCase'

/** The widths, measured: the widget, and what's left of the editor around it. */
const WIDTH = 419
const AROUND = 28
const COUNT_WIDTH = 69
/** Past a million characters, matches are found again a moment after typing stops. */
const LARGE = 1_000_000
const RESEARCH_DELAY = 240

/**
 * The find widget, with no framework: find and replace, its options, the count, and the keys that go with them.
 * It keeps the matches; the view draws them.
 */
export class FindWidget {
  readonly dom: HTMLDivElement
  readonly query: SearchQuery = { search: '', replace: '' }
  /** Whether it's open, and with the replace row. */
  isOpen = false
  replaceOpen = false
  /** Searching only here, when "Find in Selection" is on. */
  scope: { from: number; to: number } | undefined
  matches: SearchMatch[] = []
  limited = false
  error: string | undefined
  /** Where typing in the search box looks from: the cursor when it opened. */
  private start = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly findInput: HTMLTextAreaElement
  private readonly replaceInput: HTMLTextAreaElement
  private readonly count: HTMLDivElement
  private readonly toggles = new Map<Option | 'scope', HTMLElement>()
  private readonly buttons: Record<'previous' | 'next' | 'replace' | 'replaceAll', HTMLButtonElement>
  private readonly toggleReplace: HTMLButtonElement

  constructor(
    private readonly host: FindHost,
    parent: HTMLElement,
  ) {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, into?: HTMLElement) => {
      const node = document.createElement(tag)
      node.className = className
      into?.appendChild(node)
      return node
    }
    const key = (mac: string, other: string) => (host.mac ? mac : other)
    const button = (into: HTMLElement, icon: CodiconName, label: string, className = 'ws-find-button') => {
      const b = el('button', className, into)
      b.type = 'button'
      b.title = label
      b.setAttribute('aria-label', label)
      b.innerHTML = iconSvg(codicon(icon), 16)
      b.addEventListener('mousedown', (e) => e.preventDefault())
      return b
    }
    const toggle = (into: HTMLElement, option: Option | 'scope', icon: CodiconName, label: string, className = 'ws-find-option') => {
      const t = button(into, icon, label, className)
      t.setAttribute('role', 'checkbox')
      t.setAttribute('aria-checked', 'false')
      t.addEventListener('click', () => this.toggle(option))
      this.toggles.set(option, t)
      return t
    }
    const input = (into: HTMLElement, label: string) => {
      const box = el('div', 'ws-find-input', into)
      const area = el('textarea', 'ws-find-text', box)
      area.rows = 1
      area.placeholder = label
      area.setAttribute('aria-label', label)
      area.spellcheck = false
      area.setAttribute('autocomplete', 'off')
      area.setAttribute('autocorrect', 'off')
      area.setAttribute('autocapitalize', 'off')
      area.addEventListener('focus', () => box.classList.add('ws-focused'))
      area.addEventListener('blur', () => box.classList.remove('ws-focused'))
      return { box, area, controls: el('div', 'ws-find-controls', box) }
    }

    this.dom = el('div', 'ws-find', parent)
    this.dom.setAttribute('role', 'dialog')
    this.dom.setAttribute('aria-label', 'Find / Replace')
    this.dom.setAttribute('aria-hidden', 'true')
    this.toggleReplace = button(this.dom, 'chevron-right', 'Toggle Replace', 'ws-find-button ws-find-toggle-replace')
    this.toggleReplace.addEventListener('click', () => this.setReplace(!this.replaceOpen, true))

    const findPart = el('div', 'ws-find-part', this.dom)
    const find = input(findPart, 'Find')
    this.findInput = find.area
    toggle(find.controls, 'caseSensitive', 'case-sensitive', `Match Case (${key('⌥⌘C', 'Alt+C')})`)
    toggle(find.controls, 'wholeWord', 'whole-word', `Match Whole Word (${key('⌥⌘W', 'Alt+W')})`)
    toggle(find.controls, 'regexp', 'regex', `Use Regular Expression (${key('⌥⌘R', 'Alt+R')})`)
    const actions = el('div', 'ws-find-actions', findPart)
    this.count = el('div', 'ws-find-count', actions)
    this.count.setAttribute('aria-live', 'polite')
    const previous = button(actions, 'arrow-up', 'Previous Match (⇧Enter)')
    const next = button(actions, 'arrow-down', 'Next Match (Enter)')
    toggle(actions, 'scope', 'list-selection', `Find in Selection (${key('⌥⌘L', 'Alt+L')})`, 'ws-find-option ws-find-in-selection')

    const replacePart = el('div', 'ws-find-part ws-replace-part', this.dom)
    const replace = input(replacePart, 'Replace')
    this.replaceInput = replace.area
    toggle(replace.controls, 'preserveCase', 'preserve-case', `Preserve Case (${key('⌥⌘P', 'Alt+P')})`)
    const replaceActions = el('div', 'ws-find-actions', replacePart)
    const replaceOne = button(replaceActions, 'replace', 'Replace (Enter)')
    const replaceEvery = button(replaceActions, 'replace-all', `Replace All (${key('⌘Enter', 'Ctrl+Alt+Enter')})`)
    button(this.dom, 'close', 'Close (Escape)', 'ws-find-button ws-find-close').addEventListener('click', () => this.close())

    this.buttons = { previous, next, replace: replaceOne, replaceAll: replaceEvery }
    previous.addEventListener('click', () => this.previous())
    next.addEventListener('click', () => this.next())
    replaceOne.addEventListener('click', () => this.replaceOne())
    replaceEvery.addEventListener('click', () => this.replaceAll())

    this.findInput.addEventListener('input', () => {
      this.query.search = this.findInput.value
      this.research()
      // Typing goes to the nearest match from where the search started.
      const m = nearestMatch(this.matches, this.start)
      if (m) this.host.dispatch({ selection: { anchor: m.from, head: m.to }, userEvent: 'select', scrollIntoView: true })
    })
    this.replaceInput.addEventListener('input', () => (this.query.replace = this.replaceInput.value))
    this.findInput.addEventListener('keydown', (e) => this.inputKey(e, 'find'))
    this.replaceInput.addEventListener('keydown', (e) => this.inputKey(e, 'replace'))
    this.update()
  }

  // ------------------------------------------------------------ opening

  /** Opens it with the focus in the search box, filled from the selection or the word at the cursor. */
  open({ replace = false }: { replace?: boolean } = {}): void {
    const state = this.host.state
    const { main } = state.selection
    const seed = main.empty ? state.wordAt(main.head)?.text : state.doc.lineAt(main.from).number === state.doc.lineAt(main.to).number ? state.sliceDoc(main.from, main.to) : undefined
    if (seed) {
      this.findInput.value = this.query.search = seed
    }
    this.start = main.from
    this.isOpen = true
    this.dom.classList.add('ws-visible')
    this.dom.setAttribute('aria-hidden', 'false')
    this.setReplace(replace || this.replaceOpen, false)
    this.research()
    const target = replace ? this.replaceInput : this.findInput
    target.focus({ preventScroll: true })
    target.select()
  }

  /** Closes it, and puts the focus back in the editor. */
  close(): void {
    if (!this.isOpen) return
    this.isOpen = false
    this.scope = undefined
    this.dom.classList.remove('ws-visible')
    this.dom.setAttribute('aria-hidden', 'true')
    this.matches = []
    this.update()
    this.host.changed()
    this.host.focusEditor()
  }

  private setReplace(open: boolean, focus: boolean) {
    this.replaceOpen = open
    this.dom.classList.toggle('ws-replacing', open)
    this.toggleReplace.innerHTML = iconSvg(codicon(open ? 'chevron-down' : 'chevron-right'), 16)
    this.toggleReplace.setAttribute('aria-expanded', String(open))
    if (focus && open) this.replaceInput.focus({ preventScroll: true })
  }

  /** Fits the widget to the editor's width: the count goes first, then the widget narrows. */
  layout(editorWidth: number): void {
    const reduced = WIDTH + AROUND >= editorWidth
    const narrow = WIDTH + AROUND - COUNT_WIDTH >= editorWidth
    const collapsed = WIDTH + AROUND - COUNT_WIDTH >= editorWidth + 50
    this.dom.classList.toggle('ws-reduced', reduced)
    this.dom.classList.toggle('ws-narrow', narrow)
    this.dom.classList.toggle('ws-collapsed', collapsed)
    this.dom.style.maxWidth = narrow || collapsed ? '' : `${editorWidth - AROUND - 15}px`
  }

  // ------------------------------------------------------------ matches

  /** The document changed: find again, at once for most files, a moment later for very large ones. */
  docChanged(): void {
    if (!this.isOpen) return
    clearTimeout(this.timer)
    if (this.host.state.doc.length < LARGE) return this.research()
    this.timer = setTimeout(() => this.research(), RESEARCH_DELAY)
  }

  /** The selection changed: the count may say another match now. */
  selectionChanged(): void {
    if (this.isOpen) this.update()
  }

  private research() {
    const result = findMatches(this.host.state.doc, this.query, this.scope)
    this.matches = result.matches
    this.limited = result.limited
    this.error = result.error
    this.update()
    this.host.changed()
  }

  /** Which match the selection is on, from 0; -1 when it's on none. */
  get current(): number {
    return matchIndex(this.matches, this.host.state)
  }

  private update() {
    const total = this.matches.length
    const at = this.current
    const none = !!this.query.search && !total
    this.count.textContent = !this.query.search ? '' : none ? 'No results' : `${at < 0 ? '?' : at + 1} of ${total}${this.limited ? '+' : ''}`
    this.count.title = this.limited ? `Only the first ${MATCHES_LIMIT} results are highlighted, but all find operations work on the entire text.` : ''
    this.dom.classList.toggle('ws-no-results', none)
    this.findInput.parentElement!.classList.toggle('ws-error', !!this.error)
    this.findInput.title = this.error ?? ''
    for (const b of [this.buttons.previous, this.buttons.next, this.buttons.replace, this.buttons.replaceAll]) b.disabled = !total
    for (const [option, t] of this.toggles) {
      const on = option === 'scope' ? !!this.scope : !!this.query[option]
      t.classList.toggle('ws-checked', on)
      t.setAttribute('aria-checked', String(on))
    }
  }

  // ------------------------------------------------------------ actions

  next(): void {
    this.ensureSearch()
    const spec = findNext(this.host.state, this.matches)
    if (spec) this.host.dispatch(spec)
  }

  previous(): void {
    this.ensureSearch()
    const spec = findPrevious(this.host.state, this.matches)
    if (spec) this.host.dispatch(spec)
  }

  replaceOne(): void {
    const spec = replaceNext(this.host.state, this.query, this.matches)
    if (spec) this.host.dispatch(spec)
  }

  replaceAll(): void {
    const spec = replaceAll(this.host.state, this.query, this.scope)
    if (spec) this.host.dispatch(spec)
  }

  /** A cursor on every match, with the focus back in the editor. */
  selectAll(): void {
    const spec = selectAllMatches(this.matches)
    if (!spec) return
    this.host.dispatch(spec)
    this.host.focusEditor()
  }

  toggle(option: Option | 'scope'): void {
    if (option === 'scope') {
      const { main } = this.host.state.selection
      this.scope = this.scope || main.empty ? undefined : { from: main.from, to: main.to }
    } else this.query[option] = !this.query[option]
    this.research()
  }

  /** With the widget closed, `⌘G` searches for what's selected or the word at the cursor. */
  private ensureSearch() {
    if (this.query.search && (this.isOpen || this.matches.length)) return
    const state = this.host.state
    const { main } = state.selection
    const seed = main.empty ? state.wordAt(main.head)?.text : state.sliceDoc(main.from, main.to)
    if (!seed) return
    this.findInput.value = this.query.search = seed
    this.research()
  }

  // ------------------------------------------------------------ keys

  /** The editor's keys for finding. Returns whether it took the key. */
  editorKey(e: KeyboardEvent): boolean {
    const mod = this.host.mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
    const letter = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : key
    if (mod && !e.altKey && !e.shiftKey && letter === 'f') return this.open(), true
    if ((this.host.mac ? mod && e.altKey && !e.shiftKey && letter === 'f' : mod && !e.altKey && !e.shiftKey && letter === 'h')) return this.open({ replace: true }), true
    if ((mod && !e.altKey && letter === 'g') || (key === 'F3' && !mod && !e.altKey)) return (e.shiftKey ? this.previous() : this.next()), true
    if (!this.isOpen) return false
    return this.sharedKey(e, mod, letter)
  }

  /** Keys that work in the editor and in the widget's boxes, while it's open. */
  private sharedKey(e: KeyboardEvent, mod: boolean, letter: string): boolean {
    if (e.key === 'Escape' && !mod && !e.altKey) return this.close(), true
    if (e.key === 'Enter' && e.altKey && !mod && !e.shiftKey) return this.selectAll(), true
    const optionKey = this.host.mac ? mod && e.altKey && !e.shiftKey : e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
    const options: Record<string, Option | 'scope'> = { c: 'caseSensitive', w: 'wholeWord', r: 'regexp', p: 'preserveCase', l: 'scope' }
    if (optionKey && options[letter]) return this.toggle(options[letter]!), true
    return false
  }

  private inputKey(e: KeyboardEvent, which: 'find' | 'replace') {
    const mod = this.host.mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
    const letter = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase()
    let done = true
    if (e.key === 'Enter' && which === 'replace' && ((mod && !e.shiftKey) || (mod && e.altKey))) this.replaceAll()
    else if (e.key === 'Enter' && e.ctrlKey && !e.metaKey && !e.altKey && which === 'find') {
      // ⌃Enter puts a line break in the search.
      const area = this.findInput
      area.setRangeText('\n', area.selectionStart, area.selectionEnd, 'end')
      area.dispatchEvent(new Event('input'))
    } else if (e.key === 'Enter' && !mod && !e.altKey) which === 'replace' && !e.shiftKey ? this.replaceOne() : e.shiftKey ? this.previous() : this.next()
    else if (mod && e.shiftKey && e.code === 'Digit1') this.replaceOne()
    else if (mod && !e.altKey && !e.shiftKey && letter === 'f') this.findInput.select()
    else if (this.host.mac ? mod && e.altKey && letter === 'f' : mod && letter === 'h') this.setReplace(true, true)
    else if ((mod && !e.altKey && letter === 'g') || e.key === 'F3') e.shiftKey ? this.previous() : this.next()
    else done = this.sharedKey(e, mod, letter)
    if (!done) return
    e.preventDefault()
    e.stopPropagation()
  }

  destroy(): void {
    clearTimeout(this.timer)
    this.dom.remove()
  }
}
