import type { Clipboard } from '@tensorai-workspace/host'
import { MIN_CONTRAST, hex } from '../core/colors.js'
import { encodeKey, encodePaste } from '../core/keys.js'
import { BOLD, ITALIC } from '../core/line.js'
import { linkAt, type FoundLink } from '../core/links.js'
import { encodeMouse, type TerminalMouse } from '../core/mouse.js'
import type { Screen } from '../core/screen.js'
import { Selection } from '../core/selection.js'
import { rowHtml, type RowContext } from './row.js'
import { Colors } from './theme.js'

export interface TerminalViewConfig {
  parent: HTMLElement
  screen: Screen
  /** What's typed, pasted or asked, for the process. */
  onInput: (data: Uint8Array) => void
  /** The view has another size, in cells. */
  onResize?: (cols: number, rows: number) => void
  /** A link was clicked, with ⌘ or Ctrl. Opens web pages in a new tab by default. */
  onLink?: (uri: string) => void
  /** A right-click, after what's under it was selected. */
  onContextMenu?: (at: { x: number; y: number }) => void
  /** Before the terminal's own keys. Return true to take the key. */
  onKey?: (e: KeyboardEvent) => boolean
  onFocus?: (focused: boolean) => void
  /** For hosts without `navigator.clipboard`. */
  clipboard?: Clipboard
  /** Selecting copies. Off by default. */
  copyOnSelect?: boolean
  /** The least contrast for text; 1 leaves colors as they are. 4.5 by default. */
  minimumContrast?: number
  /** The accessible name. */
  label?: string
}

/** The measures: padding round the cells, and the scrollbar beside them. */
const PAD_LEFT = 20
const PAD_Y = 8
const SCROLLBAR = 10
/** How long the size shows after it changes. */
const SIZE_MS = 500
/** A frame a program never finishes shows anyway. */
const SYNC_MS = 1000
const BLINK_MS = 600

const encoder = new TextEncoder()
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const px = (n: number) => `${n}px`

/**
 * A terminal's view: a framework-free DOM component. Each row is an element, drawn again only when its line changed; the
 * cursor and the rest are layers over them.
 */
export class TerminalView {
  readonly dom: HTMLDivElement
  readonly screen: Screen
  readonly selection: Selection
  readonly colors = new Colors()
  private readonly box: HTMLDivElement
  private readonly grid: HTMLDivElement
  private readonly rowsLayer: HTMLDivElement
  private readonly cursorEl: HTMLDivElement
  private readonly linkLayer: HTMLDivElement
  private readonly composition: HTMLDivElement
  private readonly input: HTMLTextAreaElement
  private readonly bar: HTMLDivElement
  private readonly slider: HTMLDivElement
  private readonly sizeEl: HTMLDivElement
  private rows: { el: HTMLDivElement; key: string }[] = []
  private cell = { width: 7, height: 14 }
  private charWidth = 7.2
  private readonly fitting = new Map<string, boolean>()
  private context: CanvasRenderingContext2D | null = null
  private frame = 0
  private focused = false
  private composing = false
  private destroyed = false
  private fitted = false
  private wheel = 0
  private sizeTimer: ReturnType<typeof setTimeout> | undefined
  private syncTimer: ReturnType<typeof setTimeout> | undefined
  private blinkTimer: ReturnType<typeof setInterval> | undefined
  private dragTimer: ReturnType<typeof setInterval> | undefined
  private link: FoundLink | undefined
  private pointer: { x: number; y: number; mod: boolean } | undefined
  private lastMouse = ''
  private readonly stops: (() => void)[] = []

  constructor(private readonly config: TerminalViewConfig) {
    const { screen } = config
    this.screen = screen
    this.selection = new Selection(screen)

    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
      const node = document.createElement(tag)
      node.className = className
      parent?.appendChild(node)
      return node
    }
    this.dom = el('div', 'ws-terminal')
    this.box = el('div', 'ws-term-box', this.dom)
    this.grid = el('div', 'ws-term-grid', this.box)
    this.rowsLayer = el('div', 'ws-term-rows', this.grid)
    this.linkLayer = el('div', 'ws-term-links', this.grid)
    this.cursorEl = el('div', 'ws-term-cursor', this.grid)
    this.composition = el('div', 'ws-term-composition', this.grid)
    this.input = el('textarea', 'ws-term-input', this.grid)
    this.bar = el('div', 'ws-term-scrollbar', this.box)
    this.slider = el('div', 'ws-term-slider', this.bar)
    this.sizeEl = el('div', 'ws-term-size', this.dom)
    this.cursorEl.setAttribute('aria-hidden', 'true')
    this.input.setAttribute('aria-label', config.label ?? 'Terminal')
    this.input.setAttribute('aria-multiline', 'true')
    for (const name of ['autocapitalize', 'autocomplete', 'autocorrect']) this.input.setAttribute(name, 'off')
    this.input.spellcheck = false
    config.parent.appendChild(this.dom)

    this.measure()
    this.colors.read(this.dom)
    this.bind()
    this.fit()
    this.render()
  }

  // ------------------------------------------------------------ public

  get hasFocus(): boolean {
    return this.focused
  }

  /** The size of a character cell. */
  get cellSize(): { width: number; height: number } {
    return this.cell
  }

  focus(): void {
    this.input.focus({ preventScroll: true })
    this.setFocused(document.activeElement === this.input)
  }

  /** Types something, as if from the keyboard. */
  type(text: string): void {
    this.send(text)
  }

  paste(text: string): void {
    this.send(encodePaste(text, this.screen.modes))
  }

  async pasteFromClipboard(): Promise<void> {
    const text = await (this.config.clipboard ?? navigator.clipboard).readText()
    if (text) this.paste(text)
  }

  /** Copies the selection. Returns whether there was one. */
  copy(): boolean {
    const { text } = this.selection
    if (!text) return false
    void (this.config.clipboard ?? navigator.clipboard).writeText(text).catch(() => {
      // Nothing to do where copying isn't allowed.
    })
    return true
  }

  /** Empties the screen and the scrollback, keeping the line with the cursor. */
  clear(): void {
    this.selection.clear()
    this.screen.clear()
  }

  /** Reads the theme's colors again, after it changed. */
  updateTheme(): void {
    this.colors.read(this.dom)
    this.requestRender()
  }

  /** Makes the screen fill the view. */
  fit(): void {
    const width = this.dom.clientWidth
    const height = this.dom.clientHeight
    if (!width || !height) return
    // In device pixels, as cells are.
    const dpr = window.devicePixelRatio || 1
    const cols = Math.max(2, Math.floor((Math.floor((width - PAD_LEFT - SCROLLBAR) * dpr) + 1e-6) / Math.round(this.cell.width * dpr)))
    const rows = Math.max(1, Math.floor((Math.floor((height - PAD_Y * 2) * dpr) + 1e-6) / Math.round(this.cell.height * dpr)))
    const changed = cols !== this.screen.cols || rows !== this.screen.rows
    if (changed) this.screen.resize(cols, rows)
    if (changed || !this.fitted) this.config.onResize?.(cols, rows)
    if (changed && this.fitted) this.showSize(cols, rows)
    this.fitted = true
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.frame)
    clearTimeout(this.sizeTimer)
    clearTimeout(this.syncTimer)
    clearInterval(this.blinkTimer)
    clearInterval(this.dragTimer)
    for (const stop of this.stops) stop()
    this.dom.remove()
  }

  // ------------------------------------------------------------ measuring

  private measure() {
    const probe = document.createElement('span')
    probe.className = 'ws-term-probe'
    probe.textContent = 'W'.repeat(32)
    this.grid.appendChild(probe)
    const rect = probe.getBoundingClientRect()
    probe.remove()
    const dpr = window.devicePixelRatio || 1
    this.charWidth = rect.width / 32 || 7.2
    // Cells are whole device pixels, so that shapes meet.
    this.cell = { width: Math.max(1, Math.floor(this.charWidth * dpr)) / dpr, height: Math.ceil((rect.height || 14) * dpr) / dpr }
    this.screen.cell = this.cell
    this.fitting.clear()
    this.dom.style.setProperty('--ws-cell-width', px(this.cell.width))
    this.dom.style.setProperty('--ws-cell-height', px(this.cell.height))
    this.dom.style.setProperty('--ws-letter-spacing', px(this.cell.width - this.charWidth))
  }

  /** Whether the font draws a character as wide as the others. */
  private fits(text: string): boolean {
    if (text.length === 1 && text >= ' ' && text <= '~') return true
    let fits = this.fitting.get(text)
    if (fits === undefined) {
      this.context ??= document.createElement('canvas').getContext('2d')
      if (this.context) {
        const style = getComputedStyle(this.rowsLayer)
        this.context.font = `${style.fontSize} ${style.fontFamily}`
        fits = Math.abs(this.context.measureText(text).width - this.charWidth) < 0.05
      } else fits = true
      this.fitting.set(text, fits)
    }
    return fits
  }

  // ------------------------------------------------------------ drawing

  requestRender(): void {
    if (this.frame || this.destroyed) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.render()
    })
  }

  private render() {
    if (this.destroyed) return
    const { screen } = this
    // A program is in the middle of a frame.
    if (screen.modes.synchronized) {
      this.syncTimer ??= setTimeout(() => {
        this.syncTimer = undefined
        screen.modes.synchronized = false
        this.requestRender()
      }, SYNC_MS)
      return
    }
    clearTimeout(this.syncTimer)
    this.syncTimer = undefined

    const { cols, buffer, viewTop } = screen
    while (this.rows.length < screen.rows) {
      const row = document.createElement('div')
      row.className = 'ws-term-row'
      this.rowsLayer.appendChild(row)
      this.rows.push({ el: row, key: '' })
    }
    while (this.rows.length > screen.rows) this.rows.pop()!.el.remove()
    this.grid.style.width = px(cols * this.cell.width)
    this.grid.style.height = px(screen.rows * this.cell.height)
    this.dom.classList.toggle('ws-mouse', screen.modes.mouse !== 'none')
    const reverse = screen.modes.reverseVideo
    const background = reverse ? this.colors.theme.foreground : this.colors.theme.background
    this.dom.style.setProperty('--ws-term-background', hex(background))
    this.dom.style.setProperty('--ws-term-foreground', hex(reverse ? this.colors.theme.background : this.colors.theme.foreground))

    const context: RowContext = { colors: this.colors, cell: this.cell, selected: undefined, focused: this.focused, reverse, fits: (text) => this.fits(text), contrast: this.config.minimumContrast ?? MIN_CONTRAST }
    let blinking = false
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]!
      const line = buffer.lines[viewTop + i]
      if (!line) continue
      const selected = this.selection.cells(viewTop + i)
      const key = `${line.version} ${cols} ${this.colors.version} ${selected ? `${selected.from}-${selected.to}${this.focused ? 'f' : ''}` : ''}${reverse ? 'r' : ''}`
      if (row.key !== key) {
        row.key = key
        row.el.innerHTML = rowHtml(line, cols, { ...context, selected })
      }
      if (row.el.querySelector('.ws-blink')) blinking = true
    }
    this.setBlinking(blinking)
    this.renderCursor()
    this.renderScrollbar()
    this.updateLink()
  }

  private renderCursor() {
    const { screen } = this
    const at = screen.cursor
    const visible = !!at && screen.modes.cursorVisible && !this.composing
    this.cursorEl.style.display = visible ? '' : 'none'
    if (!at) return
    const { width, height } = this.cell
    const line = screen.buffer.lines[screen.viewTop + at.y]!
    // On the second half of a wide character it's on the whole of it.
    const x = at.x > 0 && line.width(at.x) === 0 ? at.x - 1 : at.x
    const cells = Math.max(1, line.width(x))
    this.input.style.left = px(x * width)
    this.input.style.top = px(at.y * height)
    this.composition.style.left = px(x * width)
    this.composition.style.top = px(at.y * height)
    if (!visible) return
    const shape = screen.modes.cursorStyle ?? 'block'
    const blink = screen.modes.cursorBlink ?? false
    this.cursorEl.className = `ws-term-cursor ws-${this.focused ? shape : 'outline'} ${blink && this.focused ? 'ws-cursor-blink' : ''}`
    this.cursorEl.style.transform = `translate(${px(x * width)}, ${px(at.y * height)})`
    this.cursorEl.style.width = px(cells * width)
    this.cursorEl.style.setProperty('--ws-cursor', hex(this.colors.theme.cursor))
    this.cursorEl.style.setProperty('--ws-cursor-text', hex(this.colors.theme.cursorText))
    this.cursorEl.style.fontWeight = line.fg(x) & BOLD ? 'bold' : ''
    this.cursorEl.style.fontStyle = line.bg(x) & ITALIC ? 'italic' : ''
    this.cursorEl.textContent = this.focused && shape === 'block' ? line.char(x) : ''
  }

  private renderScrollbar() {
    const { screen } = this
    const total = screen.buffer.lines.length
    const height = screen.rows * this.cell.height
    this.bar.style.display = total > screen.rows ? '' : 'none'
    this.bar.style.height = px(height)
    const size = Math.max(20, Math.floor((height * screen.rows) / total))
    const range = Math.max(1, screen.buffer.base)
    this.slider.style.height = px(size)
    this.slider.style.transform = `translateY(${px((screen.viewTop / range) * (height - size))})`
  }

  private setBlinking(on: boolean) {
    if (on === (this.blinkTimer !== undefined)) return
    if (on) this.blinkTimer = setInterval(() => this.dom.classList.toggle('ws-blink-off'), BLINK_MS)
    else {
      clearInterval(this.blinkTimer)
      this.blinkTimer = undefined
      this.dom.classList.remove('ws-blink-off')
    }
  }

  private showSize(cols: number, rows: number) {
    this.sizeEl.textContent = `${cols} x ${rows}`
    this.sizeEl.classList.add('ws-visible')
    clearTimeout(this.sizeTimer)
    this.sizeTimer = setTimeout(() => this.sizeEl.classList.remove('ws-visible'), SIZE_MS)
  }

  // ------------------------------------------------------------ input

  private bind() {
    const { screen, input, dom } = this
    const on = <K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, handler: (e: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) => {
      target.addEventListener(type, handler, options)
      this.stops.push(() => target.removeEventListener(type, handler, options))
    }

    this.stops.push(
      screen.onChange.listen(() => this.requestRender()),
      screen.onData.listen((data) => this.config.onInput(encoder.encode(data))),
      screen.onColor.listen((request) => {
        const color = this.colors.request(request)
        if (color !== undefined && request.slot !== 'palette') screen.answerColor(request.slot, color)
        this.requestRender()
      }),
      screen.onClipboard.listen((text) => void (this.config.clipboard ?? navigator.clipboard)?.writeText(text).catch(() => {})),
      this.selection.onChange.listen(() => this.requestRender()),
    )

    on(input, 'focus', () => this.setFocused(true))
    on(input, 'blur', () => this.setFocused(false))
    on(input, 'keydown', (e) => this.keyDown(e))
    on(input, 'keyup', (e) => this.modifierChanged(e))
    on(input, 'input', () => {
      if (this.composing || !input.value) return
      // A line break here is a Return: some keyboards type it.
      const text = input.value.replace(/\r?\n/g, '\r')
      input.value = ''
      this.send(text)
    })
    on(input, 'compositionstart', () => {
      this.composing = true
      this.composition.textContent = ''
      this.composition.classList.add('ws-visible')
      this.requestRender()
    })
    on(input, 'compositionupdate', (e) => void (this.composition.textContent = e.data))
    on(input, 'compositionend', (e) => {
      this.composing = false
      this.composition.classList.remove('ws-visible')
      input.value = ''
      if (e.data) this.send(e.data)
      this.requestRender()
    })
    on(input, 'paste', (e) => {
      e.preventDefault()
      const text = e.clipboardData?.getData('text/plain')
      if (text) this.paste(text)
    })
    on(input, 'copy', (e) => {
      const { text } = this.selection
      if (!text) return
      e.preventDefault()
      if (this.config.clipboard) void this.config.clipboard.writeText(text)
      else e.clipboardData?.setData('text/plain', text)
    })

    on(dom, 'mousedown', (e) => this.mouseDown(e))
    on(dom, 'mousemove', (e) => this.mouseMove(e))
    on(dom, 'mouseleave', () => {
      this.pointer = undefined
      this.updateLink()
    })
    on(dom, 'contextmenu', (e) => {
      if (this.tracksMouse(e)) return e.preventDefault()
      if (!this.config.onContextMenu) return
      e.preventDefault()
      // On a Mac a right-click selects the word under it, if there's one.
      const at = this.cellAt(e)
      const line = screen.buffer.lines[screen.viewTop + at.y]
      if (isMac && this.selection.isEmpty && line && (line.width(at.x) === 0 || line.char(at.x).trim())) this.selection.start(this.selection.pointAt(at.x, at.y), 'word')
      this.config.onContextMenu({ x: e.clientX, y: e.clientY })
    })
    on(dom, 'wheel', (e) => this.wheelTurn(e), { passive: false })
    this.bindScrollbar()

    const resized = () => {
      this.fit()
      this.render()
    }
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(resized)
      observer.observe(dom)
      // A run of text that changes size when the font does: then the cells are measured again.
      const probe = document.createElement('span')
      probe.className = 'ws-term-probe'
      probe.setAttribute('aria-hidden', 'true')
      probe.textContent = 'W'.repeat(32)
      this.grid.appendChild(probe)
      let size = ''
      const fontObserver = new ResizeObserver(() => {
        const r = probe.getBoundingClientRect()
        const now = `${r.width}x${r.height}`
        if (size && now !== size) this.remeasure()
        size = now
      })
      fontObserver.observe(probe)
      this.stops.push(() => (observer.disconnect(), fontObserver.disconnect(), probe.remove()))
    }
    // The theme and appearance are attributes somewhere above; the system's theme is a media query.
    const themed = () => this.updateTheme()
    const observer = new MutationObserver(themed)
    observer.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-theme', 'data-appearance'] })
    this.stops.push(() => observer.disconnect())
    if (typeof matchMedia !== 'undefined') {
      const scheme = matchMedia('(prefers-color-scheme: dark)')
      scheme.addEventListener?.('change', themed)
      this.stops.push(() => scheme.removeEventListener?.('change', themed))
    }
    this.followPixelRatio()
  }

  /** Measures the cells again and redraws: after the font changed, or the screen's pixels did. */
  remeasure(): void {
    if (this.destroyed) return
    this.measure()
    for (const row of this.rows) row.key = ''
    this.fit()
    this.requestRender()
  }

  /** Cells change when the window moves to a screen with other pixels, or is zoomed. */
  private followPixelRatio() {
    if (typeof matchMedia === 'undefined') return
    const query = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    const changed = () => {
      if (this.destroyed) return
      this.remeasure()
      this.followPixelRatio()
    }
    query.addEventListener?.('change', changed, { once: true })
    this.stops.push(() => query.removeEventListener?.('change', changed))
  }

  private setFocused(focused: boolean) {
    if (this.focused === focused) return
    this.focused = focused
    this.dom.classList.toggle('ws-focused', focused)
    if (this.screen.modes.focus) this.config.onInput(encoder.encode(focused ? '\x1b[I' : '\x1b[O'))
    this.config.onFocus?.(focused)
    this.requestRender()
  }

  /** Sends what the user typed: that goes to the bottom, and lets go of the selection. */
  private send(text: string) {
    this.selection.clear()
    this.screen.scrollToBottom()
    this.config.onInput(encoder.encode(text))
  }

  private keyDown(e: KeyboardEvent) {
    this.modifierChanged(e)
    if (this.composing || e.isComposing || e.key === 'Process' || e.key === 'Dead') return
    if (this.config.onKey?.(e) || this.viewKey(e)) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    const data = encodeKey(e, this.screen.modes, { mac: isMac })
    if (data === undefined) return
    e.preventDefault()
    e.stopPropagation()
    this.send(data)
  }

  /** The view's own keys. */
  private viewKey(e: KeyboardEvent): boolean {
    const { screen } = this
    const only = (...mods: ('metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey')[]) => (['metaKey', 'ctrlKey', 'altKey', 'shiftKey'] as const).every((m) => e[m] === mods.includes(m))
    const key = e.key.toLowerCase()
    if (isMac ? only('metaKey') : only('ctrlKey', 'shiftKey')) {
      // On a Mac the browser's own copy and paste events do it.
      if (!isMac && key === 'c') return this.copy() || true
      if (!isMac && key === 'v') {
        void this.pasteFromClipboard()
        return true
      }
      if (key === 'a') {
        this.selection.selectAll()
        return true
      }
      if (isMac && key === 'k') {
        this.clear()
        return true
      }
    }
    if (screen.isAlternate) return false
    if (isMac ? only() : only('shiftKey')) {
      if (e.key === 'PageUp') screen.scrollBy(-(screen.rows - 1))
      else if (e.key === 'PageDown') screen.scrollBy(screen.rows - 1)
      else return false
      return true
    }
    if (isMac && only('metaKey')) {
      if (e.key === 'Home') screen.scrollTo(0)
      else if (e.key === 'End') screen.scrollToBottom()
      else return false
      return true
    }
    if (e.key === 'Escape' && only() && !this.selection.isEmpty) {
      this.selection.clear()
      return true
    }
    return false
  }

  // ------------------------------------------------------------ the mouse

  /** The cell under the pointer, and the nearest boundary between cells. */
  private cellAt(e: { clientX: number; clientY: number }) {
    const rect = this.grid.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const { cols, rows } = this.screen
    return {
      x: Math.max(0, Math.min(cols - 1, Math.floor(x / this.cell.width))),
      y: Math.max(0, Math.min(rows - 1, Math.floor(y / this.cell.height))),
      edge: Math.max(0, Math.min(cols, Math.round(x / this.cell.width))),
      above: y < 0 ? y : y > rows * this.cell.height ? y - rows * this.cell.height : 0,
      px: x,
      py: y,
    }
  }

  /** Whether the program gets this event. Shift, or Option on a Mac, keeps it for selecting. */
  private tracksMouse(e: MouseEvent): boolean {
    return this.screen.modes.mouse !== 'none' && !(isMac ? e.altKey : e.shiftKey)
  }

  private report(e: MouseEvent, action: TerminalMouse['action'], button: number): boolean {
    const at = this.cellAt(e)
    const data = encodeMouse({ action, button, x: at.x, y: at.y, px: at.px, py: at.py, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey }, this.screen.modes)
    if (data === undefined) return false
    // A move within a cell says nothing new.
    if (action === 'move' && data === this.lastMouse) return true
    this.lastMouse = data
    // Positions past ASCII are single bytes, not text.
    this.config.onInput(Uint8Array.from(data, (c) => c.charCodeAt(0)))
    return true
  }

  private mouseDown(e: MouseEvent) {
    if (this.bar.contains(e.target as Node)) return
    e.preventDefault()
    this.focus()
    const modifier = isMac ? e.metaKey : e.ctrlKey
    if (e.button === 0 && modifier && this.link) {
      this.openLink(this.link.uri)
      return
    }
    if (this.tracksMouse(e)) {
      if (e.button > 2 || !this.report(e, 'press', e.button)) return
      this.drag(
        (move) => this.report(move, 'move', e.button),
        (up) => this.report(up, 'release', e.button),
      )
      return
    }
    if (e.button !== 0) return

    const at = this.cellAt(e)
    const { selection } = this
    if (e.shiftKey && !selection.isEmpty) selection.extend(selection.pointAt(at.edge, at.y))
    else if (e.detail === 2) selection.start(selection.pointAt(at.x, at.y), 'word')
    else if (e.detail >= 3) selection.start(selection.pointAt(at.x, at.y), 'line')
    else selection.start(selection.pointAt(at.edge, at.y), e.altKey ? 'block' : 'char')
    const byCell = e.detail > 1

    let last = e
    const extend = () => {
      const to = this.cellAt(last)
      const row = to.above < 0 ? 0 : to.above > 0 ? this.screen.rows - 1 : to.y
      selection.extend(selection.pointAt(byCell ? to.x : to.edge, row))
    }
    this.drag(
      (move) => {
        last = move
        const { above } = this.cellAt(move)
        // Past an edge it scrolls, faster the farther.
        if (above && !this.dragTimer)
          this.dragTimer = setInterval(() => {
            const past = this.cellAt(last).above
            if (!past) return
            this.screen.scrollBy(Math.sign(past) * Math.min(15, Math.ceil(Math.abs(past) / this.cell.height)))
            extend()
          }, 50)
        else if (!above) this.stopDragScroll()
        extend()
      },
      () => {
        this.stopDragScroll()
        if (selection.isEmpty) selection.clear()
        else if (this.config.copyOnSelect) this.copy()
      },
    )
  }

  private stopDragScroll() {
    clearInterval(this.dragTimer)
    this.dragTimer = undefined
  }

  private drag(move: (e: MouseEvent) => void, up: (e: MouseEvent) => void) {
    const end = (e: MouseEvent) => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', end)
      up(e)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', end)
    this.stops.push(() => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', end)
    })
  }

  private mouseMove(e: MouseEvent) {
    if (this.screen.modes.mouse === 'any' && e.buttons === 0 && this.tracksMouse(e)) this.report(e, 'move', -1)
    this.pointer = { x: e.clientX, y: e.clientY, mod: isMac ? e.metaKey : e.ctrlKey }
    this.updateLink()
  }

  private wheelTurn(e: WheelEvent) {
    const { screen } = this
    const lines = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? e.deltaY * screen.rows : e.deltaY / this.cell.height
    this.wheel += lines * (e.altKey ? 5 : 1)
    const whole = Math.trunc(this.wheel)
    e.preventDefault()
    if (!whole) return
    this.wheel -= whole
    if (this.tracksMouse(e)) {
      for (let n = Math.min(Math.abs(whole), 20); n > 0; n--) this.report(e, 'wheel', whole < 0 ? 0 : 1)
    } else if (screen.isAlternate) {
      // Full-screen programs have no scrollback: the wheel is the arrow keys.
      if (!screen.modes.alternateScroll) return
      const key = `${screen.modes.applicationCursor ? '\x1bO' : '\x1b['}${whole < 0 ? 'A' : 'B'}`
      this.config.onInput(encoder.encode(key.repeat(Math.min(Math.abs(whole), 20))))
    } else screen.scrollBy(whole)
  }

  private bindScrollbar() {
    let drag: { y: number; top: number } | undefined
    const geometry = () => {
      const height = this.bar.clientHeight
      const size = this.slider.offsetHeight
      return { height, size, scale: this.screen.buffer.base / Math.max(1, height - size) }
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      const { size, scale } = geometry()
      if (e.target !== this.slider) this.screen.scrollTo((e.clientY - this.bar.getBoundingClientRect().top - size / 2) * scale)
      drag = { y: e.clientY, top: this.screen.viewTop }
      this.bar.setPointerCapture?.(e.pointerId)
      this.bar.classList.add('ws-active')
    }
    const move = (e: PointerEvent) => {
      if (drag) this.screen.scrollTo(drag.top + (e.clientY - drag.y) * geometry().scale)
    }
    const up = () => {
      drag = undefined
      this.bar.classList.remove('ws-active')
    }
    this.bar.addEventListener('pointerdown', down)
    this.bar.addEventListener('pointermove', move)
    this.bar.addEventListener('pointerup', up)
    this.bar.addEventListener('pointercancel', up)
  }

  // ------------------------------------------------------------ links

  private modifierChanged(e: KeyboardEvent) {
    if (!this.pointer) return
    const mod = isMac ? e.metaKey : e.ctrlKey
    if (mod === this.pointer.mod) return
    this.pointer.mod = mod
    this.updateLink()
  }

  /** Underlines the link under the pointer while ⌘ or Ctrl is held. */
  private updateLink() {
    const { pointer, screen } = this
    this.link = undefined
    if (pointer?.mod) {
      const rect = this.grid.getBoundingClientRect()
      const inside = pointer.x >= rect.left && pointer.x < rect.right && pointer.y >= rect.top && pointer.y < rect.bottom
      const at = this.cellAt({ clientX: pointer.x, clientY: pointer.y })
      if (inside) this.link = linkAt(screen, at.x, screen.viewTop + at.y)
    }
    this.dom.classList.toggle('ws-link', !!this.link)
    this.linkLayer.replaceChildren()
    for (const { index, from, to } of this.link?.cells ?? []) {
      const row = index - screen.viewTop
      if (row < 0 || row >= screen.rows) continue
      const line = document.createElement('div')
      line.style.cssText = `left:${from * this.cell.width}px;top:${row * this.cell.height}px;width:${(to - from) * this.cell.width}px`
      this.linkLayer.appendChild(line)
    }
  }

  private openLink(uri: string) {
    if (this.config.onLink) this.config.onLink(uri)
    // Nothing but web pages opens by itself: what prints links isn't to be trusted.
    else if (/^https?:/i.test(uri)) window.open(uri, '_blank', 'noopener,noreferrer')
  }
}
