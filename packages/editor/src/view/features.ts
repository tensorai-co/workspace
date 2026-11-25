import type { DocumentSymbol, LanguageService, Location } from '@tensorai-co/workspace/host'
import { Diagnostics } from '../core/diagnostics.js'
import { isMac } from '../core/keymap.js'
import { EditorSelection } from '../core/selection.js'
import type { EditorState, Transaction, TransactionSpec } from '../core/state.js'
import { Suggest } from '../core/suggest.js'
import { HoverWidget } from './hover.js'
import { SuggestWidget } from './suggest.js'

export interface LanguageFeaturesConfig {
  service: LanguageService
  /** The file's path, for requests. */
  path?: string
  /** A definition in another file: the host opens it. Definitions in this file are gone to here. */
  openLocation?: (location: Location) => void
}

/** What the language features need from the view. */
export interface FeaturesHost {
  readonly state: EditorState
  readonly readOnly: boolean
  /** Where the widgets go. */
  readonly dom: HTMLElement
  /** The text's element: it shows a pointer while ⌘ makes a word a link. */
  readonly content: HTMLElement
  focused(): boolean
  /** Whether the mouse is selecting: no hovers meanwhile. */
  dragging(): boolean
  destroyed(): boolean
  dispatch(spec: TransactionSpec): void
  focus(): void
  requestRender(): void
  coordsAt(pos: number): { left: number; top: number; bottom: number } | undefined
  posAtCoords(clientX: number, clientY: number): number
  tokenTypeAt(pos: number): string | undefined
  /** The suggest list opened: ghost text goes, as the two don't show together. */
  suggestOpened(): void
}

/** How long the mouse rests on text before its hover shows. */
const HOVER_DELAY = 300

/**
 * Completions, problems, hovers, definitions, symbols and formatting from a language service: the controllers, the
 * widgets that show them, and the keys and mouse moves that work them.
 */
export class LanguageFeatures {
  private current: LanguageFeaturesConfig | undefined
  private suggestModel: Suggest | undefined
  private diagnosticsModel: Diagnostics | undefined
  private stops: (() => void)[] = []
  private readonly suggestWidget: SuggestWidget
  private readonly hover: HoverWidget
  private hoverTimer: ReturnType<typeof setTimeout> | undefined
  private hideTimer: ReturnType<typeof setTimeout> | undefined
  private hoverAbort: AbortController | undefined
  private hoverRange: { from: number; to: number } | undefined
  /** The word ⌘ turns into a link, for go to definition. */
  private link: { from: number; to: number } | undefined
  private mouse: { x: number; y: number } | undefined
  private readonly stopWindow: () => void

  constructor(private readonly host: FeaturesHost) {
    this.suggestWidget = new SuggestWidget(
      {
        accept: (index) => {
          const spec = this.suggestModel?.accept(index)
          if (spec) this.host.dispatch(spec)
        },
        select: (index) => this.suggestModel?.select(index),
        toggleDetails: () => this.suggestModel?.toggleDetails(),
        language: () => this.host.state.language.id,
      },
      host.dom,
    )
    this.hover = new HoverWidget(host.dom)
    // ⌘ pressed or let go while the mouse rests on a word.
    const modKey = (e: KeyboardEvent) => {
      if (!this.mouse || (e.key !== 'Meta' && e.key !== 'Control')) return
      const mod = isMac ? e.metaKey : e.ctrlKey
      this.mouseMove(new MouseEvent('mousemove', { clientX: this.mouse.x, clientY: this.mouse.y, metaKey: isMac && mod, ctrlKey: !isMac && mod }))
    }
    window.addEventListener('keydown', modKey)
    window.addEventListener('keyup', modKey)
    this.stopWindow = () => {
      window.removeEventListener('keydown', modKey)
      window.removeEventListener('keyup', modKey)
    }
  }

  get config(): LanguageFeaturesConfig | undefined {
    return this.current
  }

  /** The document's problems, while there's a service. */
  get diagnostics(): Diagnostics | undefined {
    return this.diagnosticsModel
  }

  /** The suggest list's controller, while there's a service. */
  get suggest(): Suggest | undefined {
    return this.suggestModel
  }

  /** Turns them on with a service, changes their settings, or turns them off. */
  configure(config: LanguageFeaturesConfig | undefined): void {
    const before = this.current
    this.current = config
    if (!config) {
      for (const stop of this.stops) stop()
      this.stops = []
      this.suggestModel?.destroy()
      this.diagnosticsModel?.destroy()
      this.suggestModel = this.diagnosticsModel = undefined
      this.hideHover()
      this.host.requestRender()
      return
    }
    if (before && this.suggestModel && this.diagnosticsModel) {
      this.suggestModel.configure({ service: config.service, path: config.path })
      this.diagnosticsModel.configure({ service: config.service, path: config.path })
      return
    }
    const quiet = (pos: number) => /comment|string|regexp/.test(this.host.tokenTypeAt(pos) ?? '')
    this.suggestModel = new Suggest({ service: config.service, path: config.path }, () => this.host.state, quiet)
    this.diagnosticsModel = new Diagnostics({ service: config.service, path: config.path }, () => this.host.state)
    this.stops = [
      this.suggestModel.subscribe(() => {
        if (this.suggestModel?.isOpen) this.host.suggestOpened()
        this.host.requestRender()
      }),
      this.diagnosticsModel.subscribe(() => this.host.requestRender()),
    ]
  }

  /** Follows a transaction. */
  handleTransaction(tr: Transaction): void {
    if (!this.host.readOnly) this.suggestModel?.handleTransaction(tr)
    this.diagnosticsModel?.handleTransaction(tr)
    if (tr.docChanged) this.hideHover()
  }

  /** Another document is in the view now. */
  replaced(): void {
    this.suggestModel?.close()
    this.hideHover()
    this.diagnosticsModel?.ask()
  }

  /** The editor lost the focus. */
  blurred(): void {
    this.suggestModel?.close()
  }

  /** Asks for completions at the cursor: ⌃Space. */
  triggerSuggest(): void {
    if (!this.host.readOnly) this.suggestModel?.trigger(true)
  }

  /** Shows the hover for a place: ⌘K ⌘I. */
  showHover(pos: number): void {
    void this.hoverAt(pos, true)
  }

  /** Goes to where the symbol at pos is declared. Returns whether there was somewhere to go. */
  async goToDefinition(pos: number): Promise<boolean> {
    const config = this.current
    if (!config?.service.definition) return false
    const state = this.host.state
    let found: Location[] | undefined
    try {
      found = await config.service.definition({ doc: state.doc, position: pos, language: state.language.id, path: config.path }, new AbortController().signal)
    } catch (error) {
      console.warn('Definition failed:', error)
      return false
    }
    const target = found?.[0]
    if (!target || this.host.destroyed()) return false
    if (target.path && target.path !== config.path) {
      config.openLocation?.(target)
      return !!config.openLocation
    }
    if (this.host.state.doc !== state.doc) return false
    const at = Math.min(target.from, this.host.state.doc.length)
    this.host.dispatch({ selection: EditorSelection.single(at), userEvent: 'select', scrollIntoView: true })
    this.host.focus()
    return true
  }

  /** Formats the document with the service's edits. Returns whether it changed anything. */
  async format(): Promise<boolean> {
    const config = this.current
    if (!config?.service.format || this.host.readOnly) return false
    const state = this.host.state
    let edits
    try {
      edits = await config.service.format({ doc: state.doc, language: state.language.id, path: config.path, tabSize: state.tabSize, insertSpaces: state.insertSpaces }, new AbortController().signal)
    } catch (error) {
      console.warn('Formatting failed:', error)
      return false
    }
    // The text changed while it worked: its edits no longer fit.
    if (!edits.length || this.host.state.doc !== state.doc || this.host.destroyed()) return false
    this.host.dispatch({ changes: [...edits].sort((a, b) => a.from - b.from), userEvent: 'input.format' })
    return true
  }

  /** The document's outline. */
  async symbols(): Promise<DocumentSymbol[]> {
    const config = this.current
    if (!config?.service.symbols) return []
    const state = this.host.state
    return config.service.symbols({ doc: state.doc, language: state.language.id, path: config.path }, new AbortController().signal)
  }

  /** Their keys: the suggest list's, ⌃Space, F12 and ⇧⌥F. Returns whether one acted. */
  key(e: KeyboardEvent): boolean {
    if (!['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) this.hideHover()
    if (this.suggestKey(e)) return true
    const service = this.current?.service
    const plain = !e.metaKey && !e.ctrlKey && !e.altKey
    if (plain && !e.shiftKey && e.key === 'F12' && service?.definition) return void this.goToDefinition(this.host.state.selection.main.head), true
    if (e.shiftKey && e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyF' && service?.format) return void this.format(), true
    return false
  }

  private suggestKey(e: KeyboardEvent): boolean {
    const suggest = this.suggestModel
    if (!suggest || this.host.readOnly) return false
    if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.code === 'Space' || e.key === ' ')) return this.triggerSuggest(), true
    if (!suggest.isOpen || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false
    switch (e.key) {
      case 'ArrowDown':
        return suggest.move(1), true
      case 'ArrowUp':
        return suggest.move(-1), true
      case 'PageDown':
        return suggest.page(1, this.suggestWidget.pageRows), true
      case 'PageUp':
        return suggest.page(-1, this.suggestWidget.pageRows), true
      case 'Escape':
        return suggest.close(), true
      case 'Enter':
      case 'Tab': {
        const spec = suggest.accept()
        if (!spec) return suggest.close(), false
        this.host.dispatch(spec)
        return true
      }
    }
    return false
  }

  /** A press on the text: ⌘-click on a link goes to its definition. Returns whether it did. */
  pressed(e: MouseEvent): boolean {
    this.hideHover()
    if (!(isMac ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey || e.detail !== 1 || !this.current?.service.definition) return false
    const pos = this.host.posAtCoords(e.clientX, e.clientY)
    if (!this.link || pos < this.link.from || pos > this.link.to) return false
    this.host.focus()
    void this.goToDefinition(pos)
    return true
  }

  /** The mouse moved over the text: a hover after a rest, and ⌘ turning words into links. */
  mouseMove(e: MouseEvent): void {
    const config = this.current
    if (this.host.dragging() || !config) return
    const mod = isMac ? e.metaKey : e.ctrlKey
    this.mouse = { x: e.clientX, y: e.clientY }
    const pos = this.host.posAtCoords(e.clientX, e.clientY)
    const word = this.host.state.wordAt(pos)
    const a = word && this.host.coordsAt(word.from)
    const b = word && this.host.coordsAt(word.to)
    const onWord = !!(a && b && e.clientX >= a.left && e.clientX <= b.left && e.clientY >= a.top && e.clientY <= b.bottom)
    const link = mod && onWord && config.service.definition ? { from: word!.from, to: word!.to } : undefined
    if (link?.from !== this.link?.from || link?.to !== this.link?.to) this.setLink(link)
    const hovering = onWord || this.diagnosticsModel?.at(pos).length
    const range = this.hoverRange
    if (range && hovering && pos >= range.from && pos <= range.to) {
      clearTimeout(this.hideTimer)
      return
    }
    if (this.hover.isOpen) this.scheduleHide()
    clearTimeout(this.hoverTimer)
    if (hovering && !mod) this.hoverTimer = setTimeout(() => void this.hoverAt(pos), HOVER_DELAY)
  }

  /** The mouse left the text. */
  mouseLeft(): void {
    this.mouse = undefined
    clearTimeout(this.hoverTimer)
    if (this.hover.isOpen) this.scheduleHide()
    if (this.link) this.setLink(undefined)
  }

  private setLink(link: { from: number; to: number } | undefined) {
    this.link = link
    this.host.content.classList.toggle('ws-linking', !!link)
    this.host.requestRender()
  }

  /** Hides the hover a moment from now, unless the mouse goes into it. */
  private scheduleHide() {
    clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => {
      if (!this.hover.hovered) this.hideHover()
    }, HOVER_DELAY)
  }

  hideHover(): void {
    clearTimeout(this.hoverTimer)
    clearTimeout(this.hideTimer)
    this.hoverAbort?.abort()
    this.hoverAbort = undefined
    this.hoverRange = undefined
    if (this.hover.isOpen) this.hover.hide()
  }

  /** Shows what's known about a place: its problems, then the service's hover. */
  private async hoverAt(pos: number, explicit = false) {
    const config = this.current
    if (!config) return
    this.hoverAbort?.abort()
    const abort = (this.hoverAbort = new AbortController())
    const state = this.host.state
    const diagnostics = this.diagnosticsModel?.at(pos) ?? []
    let hover
    if (config.service.hover) {
      try {
        hover = await config.service.hover({ doc: state.doc, position: pos, language: state.language.id, path: config.path }, abort.signal)
      } catch (error) {
        if (!abort.signal.aborted) console.warn('Hover failed:', error)
      }
    }
    if (abort.signal.aborted || this.host.destroyed() || this.host.state.doc !== state.doc) return
    const contents = hover ? (Array.isArray(hover.contents) ? hover.contents : [hover.contents]) : []
    if (!diagnostics.length && !contents.some((c) => c.trim())) {
      if (explicit) this.hideHover()
      return
    }
    const word = state.wordAt(pos)
    const from = Math.min(hover?.range?.from ?? word?.from ?? pos, ...diagnostics.map((d) => d.from))
    const to = Math.max(hover?.range?.to ?? word?.to ?? pos, ...diagnostics.map((d) => d.to))
    const anchor = this.host.coordsAt(from)
    if (!anchor) return
    this.hoverRange = { from, to }
    this.hover.show({ diagnostics, contents, language: state.language.id }, anchor, () => this.scheduleHide())
  }

  /**
   * What they draw under the text of the lines in view: the problems' wavy lines, and the word ⌘ makes a link. `mark`
   * draws a class over a stretch of text.
   */
  decorate(first: number, last: number, mark: (from: number, to: number, className: string) => void): void {
    const { doc } = this.host.state
    const items = this.diagnosticsModel?.all ?? []
    if (items.length) {
      const start = doc.line(first).from
      const end = doc.line(last).to
      for (const d of items) {
        if (d.to < start) continue
        if (d.from > end) break
        let { from, to } = d
        // An empty range marks the word it's in, or a character.
        if (from === to) {
          const word = this.host.state.wordAt(from)
          const line = doc.lineAt(from)
          if (word) ({ from, to } = word)
          else if (from < line.to) to = from + 1
          else if (from > line.from) from = from - 1
        }
        mark(from, to, `ws-squiggle ws-${d.severity}`)
      }
    }
    if (this.link) mark(this.link.from, this.link.to, 'ws-link')
  }

  /** Places the suggest list at the cursor. */
  layout(): void {
    const view = this.host.focused() ? this.suggestModel?.view : undefined
    this.suggestWidget.update(view, view && this.host.coordsAt(view.anchor), this.host.dom.getBoundingClientRect())
  }

  destroy(): void {
    this.configure(undefined)
    this.stopWindow()
    this.suggestWidget.destroy()
    this.hover.destroy()
  }
}
