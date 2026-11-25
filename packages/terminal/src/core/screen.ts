import { Buffer, type Charset } from './buffer.js'
import { Emitter } from './events.js'
import { BLINK, BOLD, COLOR_MASK, COLOR_PALETTE, COLOR_RGB, DIM, INVERSE, INVISIBLE, ITALIC, OVERLINE, PROTECTED, STRIKE, UNDERLINE, Line, type Extended, type Link, type Pen } from './line.js'
import { Params, Parser, type ParserHandler } from './parser.js'
import { Utf8Decoder } from './utf8.js'
import { charWidth } from './width.js'

export type MouseTracking = 'none' | 'x10' | 'press' | 'drag' | 'any'
export type MouseEncoding = 'default' | 'sgr' | 'pixels'
export type CursorStyle = 'block' | 'underline' | 'bar'

/** What programs have switched on and off. */
export interface Modes {
  applicationCursor: boolean
  applicationKeypad: boolean
  autowrap: boolean
  bracketedPaste: boolean
  focus: boolean
  insert: boolean
  newLine: boolean
  mouse: MouseTracking
  mouseEncoding: MouseEncoding
  /** The wheel sends arrow keys in the alternate screen. */
  alternateScroll: boolean
  origin: boolean
  reverseWrap: boolean
  reverseVideo: boolean
  cursorVisible: boolean
  /** Undefined: the host's own style. */
  cursorStyle: CursorStyle | undefined
  cursorBlink: boolean | undefined
  /** Drawing waits until a program has finished a frame. */
  synchronized: boolean
}

export interface ScreenOptions {
  cols?: number
  rows?: number
  /** The most lines kept above the screen. */
  scrollback?: number
  /** The name and version a program gets when it asks what terminal this is. */
  name?: string
}

/** A color a program asked about or set: an index of the palette, or one of the terminal's own. */
export type ColorSlot = number | 'foreground' | 'background' | 'cursor'
export type ColorRequest = { slot: ColorSlot; type: 'get' } | { slot: ColorSlot; type: 'set'; rgb: number } | { slot: ColorSlot | 'palette'; type: 'reset' }

const defaultModes = (): Modes => ({
  applicationCursor: false,
  applicationKeypad: false,
  autowrap: true,
  bracketedPaste: false,
  focus: false,
  insert: false,
  newLine: false,
  mouse: 'none',
  mouseEncoding: 'default',
  alternateScroll: true,
  origin: false,
  reverseWrap: false,
  reverseVideo: false,
  cursorVisible: true,
  cursorStyle: undefined,
  cursorBlink: undefined,
  synchronized: false,
})

/** DEC's line-drawing characters, from 0x5f on. */
const GRAPHICS = ' ◆▒␉␌␍␊°±␤␋┘┐┌└┼⎺⎻─⎼⎽├┤┴┬│≤≥π≠£·'

/** A change of size smaller than this leaves nothing to draw on. */
const MIN_COLS = 2
const MIN_ROWS = 1

/** Programs may nest the title only so deep. */
const MAX_TITLES = 10

const noLine: Extended = { underline: 0, underlineColor: 0, link: undefined }

/**
 * A terminal's screen, with no DOM: give it what a program prints, and read its lines. It answers programs' questions
 * through `onData`, which also carries nothing else, so it can go straight to the process.
 */
export class Screen implements ParserHandler {
  readonly normal: Buffer
  readonly alternate: Buffer
  /** The one programs draw on now. */
  buffer: Buffer
  modes = defaultModes()
  title = ''
  /** The working directory a shell reported, if it has. */
  cwd: string | undefined
  /** The index in the buffer's lines of the first row on show. Higher up than `base` when scrolled back. */
  viewTop = 0
  /** A character cell in CSS pixels, for programs that ask. The view sets it. */
  cell = { width: 0, height: 0 }

  /** Answers for the program. */
  readonly onData = new Emitter<string>()
  readonly onTitle = new Emitter<string>()
  readonly onCwd = new Emitter<string>()
  readonly onBell = new Emitter<void>()
  /** A program wants to put text on the clipboard. */
  readonly onClipboard = new Emitter<string>()
  /** Programs asking about colors, or setting them. Answer with `answerColor`. */
  readonly onColor = new Emitter<ColorRequest>()
  /** Something to draw: after every write, resize or scroll. */
  readonly onChange = new Emitter<void>()
  /** Lines were dropped from the start of the buffer, or the buffer changed. */
  readonly onReset = new Emitter<void>()

  private readonly parser = new Parser(this)
  private readonly decoder = new Utf8Decoder()
  private codes = new Uint32Array(4096)
  private pen: Pen = { fg: 0, bg: 0, ext: undefined }
  private charsets: Charset[] = ['ascii', 'ascii', 'ascii', 'ascii']
  private shift = 0
  /** The character before, with its marks, for REP. Empty once anything but printing happens. */
  private last: number[] = []
  private titles: string[] = []
  private links = new Map<string, Link>()
  private following = true
  private readonly name: string

  constructor(options: ScreenOptions = {}) {
    const cols = Math.max(MIN_COLS, options.cols ?? 80)
    const rows = Math.max(MIN_ROWS, options.rows ?? 24)
    this.normal = new Buffer(cols, rows, options.scrollback ?? 1000)
    this.alternate = new Buffer(cols, rows, 0)
    this.buffer = this.normal
    this.name = options.name ?? 'workspace'
  }

  get cols(): number {
    return this.buffer.cols
  }

  get rows(): number {
    return this.buffer.rows
  }

  get isAlternate(): boolean {
    return this.buffer === this.alternate
  }

  /** The lines on show, top to bottom. */
  get view(): readonly Line[] {
    return this.buffer.lines.slice(this.viewTop, this.viewTop + this.rows)
  }

  /** Where the cursor is on show, or undefined while it's scrolled out of view. x is within the columns. */
  get cursor(): { x: number; y: number } | undefined {
    const y = this.buffer.base + this.buffer.y - this.viewTop
    return y < this.rows ? { x: Math.min(this.buffer.x, this.cols - 1), y } : undefined
  }

  // ------------------------------------------------------------ input

  /** Takes what a program printed. */
  write(data: Uint8Array | string): void {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
    if (this.codes.length < bytes.length + 1) this.codes = new Uint32Array(bytes.length + 1)
    const n = this.decoder.decode(bytes, this.codes)
    this.parser.parse(this.codes, n)
    this.follow()
    this.onChange.emit()
  }

  /** Changes the size. Wrapped lines wrap again at the new width. */
  resize(cols: number, rows: number): void {
    const c = Math.max(MIN_COLS, cols)
    const r = Math.max(MIN_ROWS, rows)
    if (c === this.cols && r === this.rows) return
    this.normal.resize(c, r, true)
    this.alternate.resize(c, r, false)
    this.following = true
    this.follow()
    this.onReset.emit()
    this.onChange.emit()
  }

  /** Scrolls the view to a line, by its index in the buffer. */
  scrollTo(top: number): void {
    const at = Math.max(0, Math.min(this.buffer.base, Math.round(top)))
    if (at === this.viewTop) return
    this.viewTop = at
    this.following = at === this.buffer.base
    this.onChange.emit()
  }

  scrollBy(lines: number): void {
    this.scrollTo(this.viewTop + lines)
  }

  scrollToBottom(): void {
    this.scrollTo(this.buffer.base)
  }

  /** Empties the screen and the scrollback, keeping the line with the cursor: a prompt, usually. */
  clear(): void {
    const b = this.buffer
    const line = b.row(b.y)
    b.dropped += b.base + b.y
    b.lines = [line]
    for (let i = 1; i < b.rows; i++) b.lines.push(new Line(b.cols))
    line.wrapped = false
    b.base = 0
    b.y = 0
    this.viewTop = 0
    this.following = true
    this.onReset.emit()
    this.onChange.emit()
  }

  /** Answers a color request, in the form programs expect. */
  answerColor(slot: ColorSlot, rgb: number): void {
    const part = (shift: number) => ((rgb >> shift) & 0xff).toString(16).padStart(2, '0').repeat(2)
    const color = `rgb:${part(16)}/${part(8)}/${part(0)}`
    this.onData.emit(typeof slot === 'number' ? `\x1b]4;${slot};${color}\x1b\\` : `\x1b]${slot === 'foreground' ? 10 : slot === 'background' ? 11 : 12};${color}\x1b\\`)
  }

  /** Keeps the view at the bottom while it's there. */
  private follow() {
    if (this.following) this.viewTop = this.buffer.base
    else this.viewTop = Math.min(this.viewTop, this.buffer.base)
  }

  // ------------------------------------------------------------ printing

  print(codes: Uint32Array, start: number, end: number): void {
    const b = this.buffer
    const { cols } = b
    const { pen } = this
    const charset = this.charsets[this.shift]!
    let line = b.row(b.y)

    // Writing on the second half of a wide character takes the first half away.
    if (b.x > 0 && b.x < cols && line.width(b.x - 1) === 2) line.blank(b.x - 1, b.x, pen.bg)

    for (let i = start; i < end; i++) {
      let code = codes[i]!
      // A soft hyphen only shows where a line breaks, which never happens here.
      if (code === 0xad) continue
      if (code < 0x7f && charset !== 'ascii') code = translate(charset, code)
      const width = charWidth(code)

      if (width === 0) {
        // It goes with the character before.
        const at = Math.min(b.x, cols) - 1
        if (at >= 0) line.append(at > 0 && line.width(at) === 0 ? at - 1 : at, code)
        this.last.push(code)
        continue
      }

      if (b.x + width > cols) {
        if (this.modes.autowrap) {
          // What's left of the row is blank: a wide character didn't fit.
          for (let x = b.x; x < cols; x++) line.set(x, 0, 1, pen)
          line.touch()
          b.x = 0
          this.down(true)
          line = b.row(b.y)
        } else {
          b.x = cols - 1
          if (width === 2) continue
        }
      }

      if (this.modes.insert) {
        line.insert(b.x, width, pen.bg)
      }
      line.set(b.x++, code, width, pen)
      if (width === 2) line.set(b.x++, 0, 0, pen)
      this.last = [code]
    }

    // And writing on the first half leaves no second half behind.
    if (b.x > 0 && b.x < cols && line.width(b.x) === 0 && line.width(b.x - 1) !== 2) line.set(b.x, 0, 1, pen)
    line.touch()
  }

  /** Moves down a row, scrolling at the end of the region. `wrapped` says whether the row goes on from the one above. */
  private down(wrapped: boolean | undefined) {
    const b = this.buffer
    if (b.y === b.bottom) this.scroll(wrapped)
    else if (b.y < b.rows - 1) {
      b.y++
      if (wrapped !== undefined) b.row(b.y).wrapped = wrapped
    }
  }

  private scroll(wrapped = false) {
    const dropped = this.buffer.scrollUp(this.pen.bg, wrapped)
    if (dropped && !this.following) this.viewTop = Math.max(0, this.viewTop - 1)
  }

  // ------------------------------------------------------------ control characters

  execute(code: number): void {
    const b = this.buffer
    switch (code) {
      case 0x07:
        this.onBell.emit()
        break
      case 0x08:
        this.backspace()
        break
      case 0x09:
        if (b.x < b.cols) b.x = b.nextTab(b.x)
        break
      case 0x0a:
      case 0x0b:
      case 0x0c:
        this.lineFeed()
        break
      case 0x0d:
        b.x = 0
        break
      case 0x0e:
        this.shift = 1
        break
      case 0x0f:
        this.shift = 0
        break
      case 0x84:
        this.index()
        break
      case 0x85:
        b.x = 0
        this.index()
        break
      case 0x88:
        b.tabs.add(b.x)
        break
    }
    this.last = []
  }

  private lineFeed() {
    const b = this.buffer
    if (this.modes.newLine) b.x = 0
    this.down(false)
    if (b.x >= b.cols) b.x = b.cols - 1
  }

  private index() {
    this.clampCursor()
    this.down(undefined)
    this.clampCursor()
  }

  private backspace() {
    const b = this.buffer
    if (!this.modes.reverseWrap) {
      this.clampCursor()
      if (b.x > 0) b.x--
      return
    }
    this.clampCursor(b.cols)
    if (b.x > 0) b.x--
    else if (b.y > b.top && b.y <= b.bottom && b.row(b.y).wrapped) {
      b.row(b.y).wrapped = false
      b.y--
      b.x = b.cols - 1
      const line = b.row(b.y)
      // Over the gap a wide character left at the end of the row.
      if (line.width(b.x) > 0 && !line.has(b.x)) b.x--
    }
    this.clampCursor()
  }

  // ------------------------------------------------------------ the cursor

  private clampCursor(maxX = this.cols - 1) {
    const b = this.buffer
    b.x = Math.min(maxX, Math.max(0, b.x))
    b.y = this.modes.origin ? Math.min(b.bottom, Math.max(b.top, b.y)) : Math.min(b.rows - 1, Math.max(0, b.y))
  }

  /** Moves the cursor to a position; the rows count from the region in origin mode. */
  private moveTo(x: number, y: number) {
    const b = this.buffer
    b.x = x
    b.y = this.modes.origin ? b.top + y : y
    this.clampCursor()
  }

  private moveBy(x: number, y: number) {
    this.clampCursor()
    const b = this.buffer
    b.x += x
    b.y += y
    this.clampCursor()
  }

  private up(n: number) {
    const room = this.buffer.y - this.buffer.top
    this.moveBy(0, -(room >= 0 ? Math.min(room, n) : n))
  }

  private downBy(n: number) {
    const room = this.buffer.bottom - this.buffer.y
    this.moveBy(0, room >= 0 ? Math.min(room, n) : n)
  }

  private saveCursor() {
    const b = this.buffer
    b.saved = { x: Math.min(b.x, b.cols - 1), y: b.y, pen: { ...this.pen }, charsets: [...this.charsets], shift: this.shift, origin: this.modes.origin, wrapPending: b.x >= b.cols }
  }

  private restoreCursor() {
    const b = this.buffer
    const s = b.saved
    b.x = s ? (s.wrapPending ? b.cols : s.x) : 0
    b.y = s?.y ?? 0
    this.pen = s ? { ...s.pen } : { fg: 0, bg: 0, ext: undefined }
    this.charsets = s ? [...s.charsets] : ['ascii', 'ascii', 'ascii', 'ascii']
    this.shift = s?.shift ?? 0
    this.modes.origin = s?.origin ?? false
    this.clampCursor(b.cols)
  }

  // ------------------------------------------------------------ escape sequences

  esc(intermediates: string, final: string): void {
    const b = this.buffer
    this.last = []
    if (intermediates === '') {
      switch (final) {
        case '7':
          return this.saveCursor()
        case '8':
          return this.restoreCursor()
        case 'D':
          return this.index()
        case 'E':
          b.x = 0
          return this.index()
        case 'H':
          b.tabs.add(b.x)
          return
        case 'M':
          this.clampCursor()
          if (b.y === b.top) b.scrollDown(this.pen.bg)
          else this.moveBy(0, -1)
          return
        case '=':
          this.modes.applicationKeypad = true
          return
        case '>':
          this.modes.applicationKeypad = false
          return
        case 'c':
          return this.reset()
        case 'n':
          this.shift = 2
          return
        case 'o':
          this.shift = 3
          return
      }
    } else if (intermediates === '#' && final === '8') {
      // DECALN: a screen full of Es, to line up a display by.
      for (let y = 0; y < b.rows; y++) {
        const line = b.row(y)
        for (let x = 0; x < b.cols; x++) line.set(x, 0x45, 1, this.pen)
        line.wrapped = false
        line.touch()
      }
      this.moveTo(0, 0)
    } else {
      const set = '()*+'.indexOf(intermediates)
      const alternate = '-./'.indexOf(intermediates)
      const index = set >= 0 ? set : alternate >= 0 ? alternate + 1 : -1
      if (index >= 0) this.charsets[index] = final === '0' ? 'graphics' : final === 'A' ? 'uk' : 'ascii'
    }
  }

  csi(prefix: string, intermediates: string, final: string, p: Params): void {
    const b = this.buffer
    const last = this.last
    this.last = []
    const bg = this.pen.bg

    if (prefix === '?') {
      if (intermediates === '$' && final === 'p') return this.reportMode(p.at(0), true)
      if (intermediates) return
      if (final === 'h' || final === 'l') for (let i = 0; i < p.length; i++) this.setPrivateMode(p.at(i), final === 'h')
      else if (final === 'J') this.eraseDisplay(p.at(0), true)
      else if (final === 'K') this.eraseLine(p.at(0), true)
      else if (final === 'n' && p.at(0) === 6) this.onData.emit(`\x1b[?${b.y + 1};${Math.min(b.x, b.cols - 1) + 1}R`)
      return
    }
    if (prefix === '>') {
      if (final === 'c' && p.at(0) === 0) this.onData.emit('\x1b[>0;276;0c')
      else if (final === 'q' && p.at(0) === 0) this.onData.emit(`\x1bP>|${this.name}\x1b\\`)
      return
    }
    if (prefix) return

    if (intermediates) {
      switch (intermediates + final) {
        case ' q':
          return this.setCursorStyle(p.at(0))
        case ' @':
          return this.eachRow((line) => line.delete(0, p.count(0), bg))
        case ' A':
          return this.eachRow((line) => line.insert(0, p.count(0), bg))
        case "'}":
          return this.eachRow((line) => line.insert(Math.min(b.x, b.cols - 1), p.count(0), bg))
        case "'~":
          return this.eachRow((line) => line.delete(Math.min(b.x, b.cols - 1), p.count(0), bg))
        case '!p':
          return this.softReset()
        case '"q':
          this.pen.bg = p.at(0) === 1 ? this.pen.bg | PROTECTED : p.at(0) === 0 || p.at(0) === 2 ? this.pen.bg & ~PROTECTED : this.pen.bg
          return
        case '$p':
          return this.reportMode(p.at(0), false)
      }
      return
    }

    switch (final) {
      case '@':
        this.clampCursor()
        return b.row(b.y).insert(b.x, p.count(0), bg)
      case 'A':
        return this.up(p.count(0))
      case 'B':
      case 'e':
        return final === 'e' ? this.moveBy(0, p.count(0)) : this.downBy(p.count(0))
      case 'C':
      case 'a':
        return this.moveBy(p.count(0), 0)
      case 'D':
        return this.moveBy(-p.count(0), 0)
      case 'E':
        this.downBy(p.count(0))
        b.x = 0
        return
      case 'F':
        this.up(p.count(0))
        b.x = 0
        return
      case 'G':
      case '`':
        this.clampCursor()
        b.x = p.count(0) - 1
        return this.clampCursor()
      case 'H':
      case 'f':
        return this.moveTo(p.count(1) - 1, p.count(0) - 1)
      case 'I':
        for (let n = p.count(0); n > 0 && b.x < b.cols - 1; n--) b.x = b.nextTab(b.x)
        return
      case 'J':
        return this.eraseDisplay(p.at(0), false)
      case 'K':
        return this.eraseLine(p.at(0), false)
      case 'L':
        this.clampCursor()
        if (b.y < b.top || b.y > b.bottom) return
        for (let n = Math.min(p.count(0), b.rows); n > 0; n--) b.insertLine(b.y, bg)
        b.x = 0
        return
      case 'M':
        this.clampCursor()
        if (b.y < b.top || b.y > b.bottom) return
        for (let n = Math.min(p.count(0), b.rows); n > 0; n--) b.deleteLine(b.y, bg)
        b.x = 0
        return
      case 'P':
        this.clampCursor()
        return b.row(b.y).delete(b.x, p.count(0), bg)
      case 'S':
        for (let n = Math.min(p.count(0), b.rows); n > 0; n--) b.deleteLine(b.top, bg)
        return
      case 'T':
        // Five numbers is mouse highlighting, which isn't a scroll.
        if (p.length > 1) return
        for (let n = Math.min(p.count(0), b.rows); n > 0; n--) b.scrollDown(0)
        return
      case 'X':
        this.clampCursor()
        return b.row(b.y).erase(b.x, b.x + p.count(0), bg)
      case 'Z':
        if (b.x >= b.cols) return
        for (let n = p.count(0); n > 0 && b.x > 0; n--) b.x = b.previousTab(b.x)
        return
      case 'b': {
        if (!last.length) return
        const n = Math.min(p.count(0), b.cols * b.rows)
        const codes = Uint32Array.from({ length: n * last.length }, (_, i) => last[i % last.length]!)
        // What's repeated is already translated.
        const sets = this.charsets
        this.charsets = ['ascii', 'ascii', 'ascii', 'ascii']
        this.print(codes, 0, codes.length)
        this.charsets = sets
        return
      }
      case 'c':
        if (p.at(0) === 0) this.onData.emit('\x1b[?1;2c')
        return
      case 'd':
        return this.moveTo(Math.min(b.x, b.cols - 1), p.count(0) - 1)
      case 'g':
        if (p.at(0) === 0) b.tabs.delete(b.x)
        else if (p.at(0) === 3) b.tabs.clear()
        return
      case 'h':
      case 'l':
        for (let i = 0; i < p.length; i++) {
          if (p.at(i) === 4) this.modes.insert = final === 'h'
          else if (p.at(i) === 20) this.modes.newLine = final === 'h'
        }
        return
      case 'm':
        return this.setPen(p)
      case 'n':
        if (p.at(0) === 5) this.onData.emit('\x1b[0n')
        else if (p.at(0) === 6) this.onData.emit(`\x1b[${b.y + 1};${Math.min(b.x, b.cols - 1) + 1}R`)
        return
      case 'r': {
        const top = p.count(0)
        const bottom = p.length < 2 || p.at(1) > b.rows || p.at(1) === 0 ? b.rows : p.at(1)
        if (bottom > top) {
          b.top = top - 1
          b.bottom = bottom - 1
          this.moveTo(0, 0)
        }
        return
      }
      case 's':
        return this.saveCursor()
      case 't':
        return this.windowOperation(p)
      case 'u':
        return this.restoreCursor()
    }
  }

  /** Runs something on every row of the region, if the cursor is in it. */
  private eachRow(change: (line: Line) => void) {
    const b = this.buffer
    if (b.y < b.top || b.y > b.bottom) return
    for (let y = b.top; y <= b.bottom; y++) {
      const line = b.row(y)
      change(line)
      line.wrapped = false
    }
  }

  private eraseRow(y: number, keepProtected: boolean) {
    const line = this.buffer.row(y)
    line.erase(0, this.cols, this.pen.bg, keepProtected)
    line.wrapped = false
  }

  private eraseDisplay(what: number, keepProtected: boolean) {
    this.clampCursor(this.cols)
    const b = this.buffer
    const { bg } = this.pen
    const line = b.row(b.y)
    if (what === 0) {
      line.erase(b.x, b.cols, bg, keepProtected)
      if (b.x === 0) line.wrapped = false
      for (let y = b.y + 1; y < b.rows; y++) this.eraseRow(y, keepProtected)
    } else if (what === 1) {
      line.erase(0, b.x + 1, bg, keepProtected)
      line.wrapped = false
      if (b.x + 1 >= b.cols && b.y + 1 < b.rows) b.row(b.y + 1).wrapped = false
      for (let y = 0; y < b.y; y++) this.eraseRow(y, keepProtected)
    } else if (what === 2) {
      for (let y = 0; y < b.rows; y++) this.eraseRow(y, keepProtected)
    } else if (what === 3) {
      if (b.clearScrollback()) {
        this.viewTop = b.base
        this.following = true
        this.onReset.emit()
      }
    }
  }

  private eraseLine(what: number, keepProtected: boolean) {
    this.clampCursor(this.cols)
    const b = this.buffer
    const line = b.row(b.y)
    if (what === 0) {
      line.erase(b.x, b.cols, this.pen.bg, keepProtected)
      if (b.x === 0) line.wrapped = false
    } else if (what === 1) line.erase(0, b.x + 1, this.pen.bg, keepProtected)
    else if (what === 2) {
      line.erase(0, b.cols, this.pen.bg, keepProtected)
      line.wrapped = false
    }
  }

  // ------------------------------------------------------------ colors and styles

  private setPen(p: Params) {
    const { pen } = this
    for (let i = 0; i < p.length; i++) {
      const n = p.at(i)
      const sub = p.sub(i)
      if (n === 0) {
        pen.fg = 0
        // Protection isn't a style.
        pen.bg &= PROTECTED
        this.setExt({ underline: 0, underlineColor: 0 })
      } else if (n >= 30 && n <= 37) pen.fg = color(pen.fg, COLOR_PALETTE | (n - 30))
      else if (n >= 40 && n <= 47) pen.bg = color(pen.bg, COLOR_PALETTE | (n - 40))
      else if (n >= 90 && n <= 97) pen.fg = color(pen.fg, COLOR_PALETTE | (n - 90 + 8))
      else if (n >= 100 && n <= 107) pen.bg = color(pen.bg, COLOR_PALETTE | (n - 100 + 8))
      else if (n === 1) pen.fg |= BOLD
      else if (n === 2) pen.bg |= DIM
      else if (n === 3) pen.bg |= ITALIC
      else if (n === 4) this.setUnderline(sub ? (sub[0]! < 0 ? 1 : sub[0]!) : 1)
      else if (n === 5) pen.fg |= BLINK
      else if (n === 7) pen.fg |= INVERSE
      else if (n === 8) pen.fg |= INVISIBLE
      else if (n === 9) pen.fg |= STRIKE
      else if (n === 21) this.setUnderline(2)
      else if (n === 22) {
        pen.fg &= ~BOLD
        pen.bg &= ~DIM
      } else if (n === 23) pen.bg &= ~ITALIC
      else if (n === 24) this.setUnderline(0)
      else if (n === 25) pen.fg &= ~BLINK
      else if (n === 27) pen.fg &= ~INVERSE
      else if (n === 28) pen.fg &= ~INVISIBLE
      else if (n === 29) pen.fg &= ~STRIKE
      else if (n === 39) pen.fg = color(pen.fg, 0)
      else if (n === 49) pen.bg = color(pen.bg, 0)
      else if (n === 53) pen.bg |= OVERLINE
      else if (n === 55) pen.bg &= ~OVERLINE
      else if (n === 59) this.setExt({ underlineColor: 0 })
      else if (n === 38 || n === 48 || n === 58) {
        const [word, used] = extendedColor(p, i)
        i += used
        if (word === undefined) continue
        if (n === 38) pen.fg = color(pen.fg, word)
        else if (n === 48) pen.bg = color(pen.bg, word)
        else this.setExt({ underlineColor: word })
      }
      // Bitwise work leaves signed numbers; the cells hold unsigned ones.
      pen.fg >>>= 0
      pen.bg >>>= 0
    }
  }

  private setUnderline(style: number) {
    const underline = style >= 0 && style <= 5 ? style : 1
    this.pen.fg = underline ? this.pen.fg | UNDERLINE : this.pen.fg & ~UNDERLINE
    this.setExt({ underline })
  }

  private setExt(change: Partial<Extended>) {
    const ext: Extended = { ...(this.pen.ext ?? noLine), ...change }
    // Only what a plain underline can't say needs keeping apart.
    this.pen.ext = ext.link || ext.underlineColor || ext.underline > 1 ? ext : undefined
    if (ext.underline > 0 && !this.pen.ext) this.pen.fg |= UNDERLINE
  }

  // ------------------------------------------------------------ modes

  private setPrivateMode(mode: number, on: boolean) {
    const m = this.modes
    switch (mode) {
      case 1:
        m.applicationCursor = on
        break
      case 5:
        m.reverseVideo = on
        break
      case 6:
        m.origin = on
        this.moveTo(0, 0)
        break
      case 7:
        m.autowrap = on
        break
      case 9:
        m.mouse = on ? 'x10' : 'none'
        break
      case 12:
        m.cursorBlink = on
        break
      case 25:
        m.cursorVisible = on
        break
      case 45:
        m.reverseWrap = on
        break
      case 66:
        m.applicationKeypad = on
        break
      case 1000:
        m.mouse = on ? 'press' : 'none'
        break
      case 1002:
        m.mouse = on ? 'drag' : 'none'
        break
      case 1003:
        m.mouse = on ? 'any' : 'none'
        break
      case 1004:
        m.focus = on
        break
      case 1006:
        m.mouseEncoding = on ? 'sgr' : 'default'
        break
      case 1016:
        m.mouseEncoding = on ? 'pixels' : 'default'
        break
      case 1007:
        m.alternateScroll = on
        break
      case 1048:
        if (on) this.saveCursor()
        else this.restoreCursor()
        break
      case 1049:
        if (on) this.saveCursor()
        this.useAlternate(on)
        if (!on) this.restoreCursor()
        break
      case 47:
      case 1047:
        this.useAlternate(on)
        break
      case 2004:
        m.bracketedPaste = on
        break
      case 2026:
        m.synchronized = on
        break
    }
  }

  private useAlternate(on: boolean) {
    if (on === this.isAlternate) return
    const from = this.buffer
    if (on) {
      const to = this.alternate
      to.x = from.x
      to.y = from.y
      // It starts empty, in the colors of now, with a region and tab stops of its own.
      for (const line of to.lines) line.reset(this.pen.bg)
      to.top = 0
      to.bottom = to.rows - 1
      to.resetTabs()
      this.buffer = to
    } else {
      const to = this.normal
      to.x = from.x
      to.y = from.y
      this.buffer = to
    }
    this.following = true
    this.viewTop = this.buffer.base
    this.clampCursor(this.cols)
    this.onReset.emit()
  }

  private modeState(mode: number): boolean | undefined {
    const m = this.modes
    switch (mode) {
      case 1:
        return m.applicationCursor
      case 5:
        return m.reverseVideo
      case 6:
        return m.origin
      case 7:
        return m.autowrap
      case 9:
        return m.mouse === 'x10'
      case 12:
        return m.cursorBlink ?? false
      case 25:
        return m.cursorVisible
      case 45:
        return m.reverseWrap
      case 47:
      case 1047:
      case 1049:
        return this.isAlternate
      case 66:
        return m.applicationKeypad
      case 1000:
        return m.mouse === 'press'
      case 1002:
        return m.mouse === 'drag'
      case 1003:
        return m.mouse === 'any'
      case 1004:
        return m.focus
      case 1006:
        return m.mouseEncoding === 'sgr'
      case 1016:
        return m.mouseEncoding === 'pixels'
      case 1007:
        return m.alternateScroll
      case 1048:
        return true
      case 2004:
        return m.bracketedPaste
      case 2026:
        return m.synchronized
    }
    return undefined
  }

  private reportMode(mode: number, isPrivate: boolean) {
    const state = isPrivate ? this.modeState(mode) : mode === 4 ? this.modes.insert : mode === 20 ? this.modes.newLine : undefined
    this.onData.emit(`\x1b[${isPrivate ? '?' : ''}${mode};${state === undefined ? 0 : state ? 1 : 2}$y`)
  }

  private setCursorStyle(n: number) {
    const m = this.modes
    if (n === 0) {
      m.cursorStyle = undefined
      m.cursorBlink = undefined
      return
    }
    m.cursorStyle = n <= 2 ? 'block' : n <= 4 ? 'underline' : 'bar'
    m.cursorBlink = n % 2 === 1
  }

  private softReset() {
    const b = this.buffer
    const m = this.modes
    m.cursorVisible = true
    b.top = 0
    b.bottom = b.rows - 1
    this.pen = { fg: 0, bg: 0, ext: undefined }
    this.charsets = ['ascii', 'ascii', 'ascii', 'ascii']
    this.shift = 0
    m.origin = false
    m.insert = false
    m.applicationCursor = false
    m.applicationKeypad = false
    m.autowrap = true
    b.saved = undefined
  }

  /** Back to how it started, with nothing in it. */
  reset(): void {
    const { cols, rows } = this
    for (const b of [this.normal, this.alternate]) {
      const fresh = new Buffer(cols, rows, b.scrollback)
      fresh.dropped = b.dropped + b.lines.length
      Object.assign(b, fresh)
    }
    this.buffer = this.normal
    this.modes = defaultModes()
    this.pen = { fg: 0, bg: 0, ext: undefined }
    this.charsets = ['ascii', 'ascii', 'ascii', 'ascii']
    this.shift = 0
    this.last = []
    this.titles = []
    this.links.clear()
    this.viewTop = 0
    this.following = true
    this.onColor.emit({ slot: 'palette', type: 'reset' })
    this.onReset.emit()
  }

  private windowOperation(p: Params) {
    const { width, height } = this.cell
    switch (p.at(0)) {
      case 14:
        if (p.at(1) !== 2 && width) this.onData.emit(`\x1b[4;${Math.round(height * this.rows)};${Math.round(width * this.cols)}t`)
        break
      case 16:
        if (width) this.onData.emit(`\x1b[6;${Math.round(height)};${Math.round(width)}t`)
        break
      case 18:
        this.onData.emit(`\x1b[8;${this.rows};${this.cols}t`)
        break
      case 22:
        if (p.at(1) !== 1 && this.titles.length < MAX_TITLES) this.titles.push(this.title)
        break
      case 23: {
        const title = p.at(1) !== 1 ? this.titles.pop() : undefined
        if (title !== undefined) this.setTitle(title)
        break
      }
    }
  }

  // ------------------------------------------------------------ strings

  osc(data: string): void {
    this.last = []
    const cut = data.indexOf(';')
    const id = Number(cut < 0 ? data : data.slice(0, cut))
    const rest = cut < 0 ? '' : data.slice(cut + 1)
    if (!Number.isInteger(id) || data === '' || cut === 0) return
    switch (id) {
      case 0:
      case 2:
        this.setTitle(rest)
        break
      case 4:
        this.paletteColors(rest)
        break
      case 7:
        this.setCwd(rest)
        break
      case 8:
        this.setLink(rest)
        break
      case 10:
      case 11:
      case 12:
        this.terminalColors(id, rest)
        break
      case 52:
        this.clipboard(rest)
        break
      case 104:
        if (!rest) this.onColor.emit({ slot: 'palette', type: 'reset' })
        else for (const n of rest.split(';')) if (/^\d+$/.test(n) && Number(n) < 256) this.onColor.emit({ slot: Number(n), type: 'reset' })
        break
      case 110:
        this.onColor.emit({ slot: 'foreground', type: 'reset' })
        break
      case 111:
        this.onColor.emit({ slot: 'background', type: 'reset' })
        break
      case 112:
        this.onColor.emit({ slot: 'cursor', type: 'reset' })
        break
      case 633:
        // The own: only the working directory.
        if (rest.startsWith('P;Cwd=')) this.reportCwd(rest.slice(6).replace(/\\x([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).replace(/\\\\/g, '\\'))
        break
    }
  }

  private setTitle(title: string) {
    this.title = title
    this.onTitle.emit(title)
  }

  private setCwd(uri: string) {
    const path = /^file:\/\/[^/]*(\/.*)$/.exec(uri)?.[1]
    if (path === undefined) return
    try {
      this.reportCwd(decodeURIComponent(path))
    } catch {
      this.reportCwd(path)
    }
  }

  private reportCwd(path: string) {
    this.cwd = path
    this.onCwd.emit(path)
  }

  private setLink(rest: string) {
    const cut = rest.indexOf(';')
    if (cut < 0) return
    const uri = rest.slice(cut + 1)
    if (!uri) return this.setExt({ link: undefined })
    const id = rest
      .slice(0, cut)
      .split(':')
      .find((part) => part.startsWith('id='))
      ?.slice(3)
    let link: Link = { uri, id: id || undefined }
    if (id) {
      const key = `${id}\n${uri}`
      const known = this.links.get(key)
      if (known) link = known
      else {
        if (this.links.size > 1000) this.links.clear()
        this.links.set(key, link)
      }
    }
    this.setExt({ link })
  }

  private paletteColors(rest: string) {
    const parts = rest.split(';')
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const slot = Number(parts[i])
      if (!/^\d+$/.test(parts[i]!) || slot > 255) continue
      this.color(slot, parts[i + 1]!)
    }
  }

  private terminalColors(id: number, rest: string) {
    const slots = ['foreground', 'background', 'cursor'] as const
    rest.split(';').forEach((spec, i) => {
      const slot = slots[id - 10 + i]
      if (slot) this.color(slot, spec)
    })
  }

  private color(slot: ColorSlot, spec: string) {
    if (spec === '?') return this.onColor.emit({ slot, type: 'get' })
    const rgb = parseColor(spec)
    if (rgb !== undefined) this.onColor.emit({ slot, type: 'set', rgb })
  }

  private clipboard(rest: string) {
    const cut = rest.indexOf(';')
    const data = cut < 0 ? '' : rest.slice(cut + 1)
    // Reading the clipboard isn't a program's business.
    if (!data || data === '?') return
    try {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      this.onClipboard.emit(new TextDecoder().decode(bytes))
    } catch {
      // Not base64.
    }
  }

  dcs(prefix: string, intermediates: string, final: string, _params: Params, data: string): void {
    this.last = []
    if (prefix || final !== 'q') return
    if (intermediates === '$') {
      // DECRQSS: what a setting is.
      const b = this.buffer
      const style = { block: 2, underline: 4, bar: 6 }[this.modes.cursorStyle ?? 'block'] - (this.modes.cursorBlink ? 1 : 0)
      const answers: Record<string, string> = { '"q': `${this.pen.bg & PROTECTED ? 1 : 0}"q`, '"p': '61;1"p', r: `${b.top + 1};${b.bottom + 1}r`, m: '0m', ' q': `${style} q` }
      const answer = answers[data]
      this.onData.emit(answer === undefined ? '\x1bP0$r\x1b\\' : `\x1bP1$r${answer}\x1b\\`)
    } else if (intermediates === '+') {
      // XTGETTCAP: nothing to say about terminfo.
      this.onData.emit(`\x1bP0+r${data}\x1b\\`)
    }
  }
}

const color = (word: number, value: number): number => (word & ~COLOR_MASK) | value

function translate(charset: Charset, code: number): number {
  if (charset === 'uk') return code === 0x23 ? 0xa3 : code
  return code >= 0x5f && code <= 0x7e ? GRAPHICS.charCodeAt(code - 0x5f) : code
}

/** The color after 38, 48 or 58, and how many parameters it took besides. */
function extendedColor(p: Params, i: number): [word: number | undefined, used: number] {
  const sub = p.sub(i)
  const rgb = (r: number, g: number, b: number) => COLOR_RGB | (Math.min(255, Math.max(0, r)) << 16) | (Math.min(255, Math.max(0, g)) << 8) | Math.min(255, Math.max(0, b))
  if (sub?.length) {
    // 38:5:n and 38:2:r:g:b, or 38:2:<space>:r:g:b.
    if (sub[0] === 5) return [sub[1] !== undefined && sub[1] >= 0 ? COLOR_PALETTE | Math.min(255, sub[1]) : COLOR_PALETTE, 0]
    if (sub[0] === 2) {
      const at = sub.length >= 5 ? 2 : 1
      return [rgb(sub[at] ?? 0, sub[at + 1] ?? 0, sub[at + 2] ?? 0), 0]
    }
    return [undefined, 0]
  }
  if (p.at(i + 1) === 5) return [p.length > i + 2 ? COLOR_PALETTE | Math.min(255, p.at(i + 2)) : undefined, 2]
  if (p.at(i + 1) === 2) return [p.length > i + 4 ? rgb(p.at(i + 2), p.at(i + 3), p.at(i + 4)) : undefined, 4]
  return [undefined, 1]
}

/** X11's "rgb:rr/gg/bb" in any of its widths, and "#rrggbb". */
export function parseColor(spec: string): number | undefined {
  const named = /^rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})$/i.exec(spec)
  if (named) {
    const [r, g, b] = named.slice(1).map((h) => Math.round((parseInt(h, 16) / (16 ** h.length - 1)) * 255))
    return (r! << 16) | (g! << 8) | b!
  }
  const hex = /^#([0-9a-f]+)$/i.exec(spec)?.[1]
  if (!hex || hex.length % 3 || hex.length > 12) return undefined
  const n = hex.length / 3
  const part = (i: number) => {
    const h = hex.slice(i * n, i * n + n)
    return n === 1 ? parseInt(h, 16) * 16 : parseInt(h.slice(0, 2), 16)
  }
  return (part(0) << 16) | (part(1) << 8) | part(2)
}
