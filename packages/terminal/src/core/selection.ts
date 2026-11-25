import { Emitter } from './events.js'
import type { Screen } from './screen.js'

/** A place between two cells. `line` counts from the first line there ever was, so it stays put as output scrolls. */
export interface Point {
  line: number
  x: number
}

export type SelectionMode = 'char' | 'word' | 'line' | 'block'

/** The default word separators for the terminal. */
export const WORD_SEPARATORS = ' ()[]{}\',"`─‘’“”|'

const before = (a: Point, b: Point) => a.line < b.line || (a.line === b.line && a.x <= b.x)

/** What's selected on a screen. */
export class Selection {
  readonly onChange = new Emitter<void>()
  private anchor: { start: Point; end: Point } | undefined
  private range: { start: Point; end: Point } | undefined
  private mode: SelectionMode = 'char'

  constructor(
    private readonly screen: Screen,
    private readonly separators = WORD_SEPARATORS,
  ) {
    // Lines may have moved or gone: nothing to hold on to.
    screen.onReset.listen(() => this.clear())
  }

  get isEmpty(): boolean {
    const { range } = this
    return !range || (range.start.line === range.end.line && range.start.x === range.end.x)
  }

  /** The point a cell of the view is at. */
  pointAt(x: number, row: number): Point {
    const { buffer, viewTop } = this.screen
    return { line: buffer.dropped + viewTop + row, x }
  }

  start(at: Point, mode: SelectionMode = 'char'): void {
    this.mode = mode
    this.anchor = this.grow(at)
    this.range = this.anchor
    this.onChange.emit()
  }

  /** Moves the end of the selection. */
  extend(to: Point): void {
    if (!this.anchor) return this.start(to)
    if (this.mode === 'block') this.range = { start: this.anchor.start, end: to }
    else {
      const there = this.grow(to)
      this.range = before(there.start, this.anchor.start) ? { start: there.start, end: this.anchor.end } : { start: this.anchor.start, end: there.end }
    }
    this.onChange.emit()
  }

  selectAll(): void {
    const { buffer } = this.screen
    this.mode = 'char'
    this.range = { start: { line: buffer.dropped, x: 0 }, end: { line: buffer.dropped + buffer.lines.length - 1, x: buffer.cols } }
    this.anchor = this.range
    this.onChange.emit()
  }

  clear(): void {
    if (!this.range) return
    this.range = undefined
    this.anchor = undefined
    this.onChange.emit()
  }

  /** The cells selected on a line of the buffer: from..to, or undefined for none. */
  cells(index: number): { from: number; to: number } | undefined {
    if (!this.range || this.isEmpty) return undefined
    const line = this.screen.buffer.dropped + index
    const { start, end } = this.range
    if (this.mode === 'block') {
      if (line < Math.min(start.line, end.line) || line > Math.max(start.line, end.line)) return undefined
      const from = Math.min(start.x, end.x)
      const to = Math.max(start.x, end.x)
      return from < to ? { from, to } : undefined
    }
    if (line < start.line || line > end.line) return undefined
    const from = line === start.line ? start.x : 0
    const to = line === end.line ? end.x : this.screen.cols
    return from < to ? { from, to } : undefined
  }

  /** The text selected. Wrapped rows are one line, and the blanks at the end of a line aren't part of it. */
  get text(): string {
    if (!this.range || this.isEmpty) return ''
    const { buffer } = this.screen
    const top = Math.min(this.range.start.line, this.range.end.line) - buffer.dropped
    const bottom = Math.max(this.range.start.line, this.range.end.line) - buffer.dropped
    let text = ''
    for (let i = Math.max(0, top); i <= bottom && i < buffer.lines.length; i++) {
      const line = buffer.lines[i]!
      const cells = this.cells(i)
      const goesOn = this.mode !== 'block' && !!buffer.lines[i + 1]?.wrapped
      const piece = cells ? line.text(!goesOn, cells.from, cells.to) : ''
      if (i > Math.max(0, top) && !(line.wrapped && this.mode !== 'block')) text += '\n'
      text += this.mode === 'block' ? piece.trimEnd() : piece
    }
    return text
  }

  /** What's selected at a point, by the mode. */
  private grow(at: Point): { start: Point; end: Point } {
    if (this.mode === 'word') return this.wordAt(at)
    if (this.mode === 'line') return this.lineAt(at)
    return { start: at, end: at }
  }

  private lineAt(at: Point): { start: Point; end: Point } {
    const { buffer } = this.screen
    let top = at.line - buffer.dropped
    let bottom = top
    while (top > 0 && buffer.lines[top]?.wrapped) top--
    while (buffer.lines[bottom + 1]?.wrapped) bottom++
    return { start: { line: top + buffer.dropped, x: 0 }, end: { line: bottom + buffer.dropped, x: buffer.cols } }
  }

  private wordAt(at: Point): { start: Point; end: Point } {
    const { buffer } = this.screen
    const { cols } = buffer
    const index = at.line - buffer.dropped
    const charAt = (i: number, x: number) => {
      const line = buffer.lines[i]
      if (!line) return undefined
      // The second half of a wide character is the character.
      return line.width(x) === 0 && x > 0 ? line.char(x - 1) : line.char(x)
    }
    const kind = (i: number, x: number): 'word' | 'blank' | 'separator' | undefined => {
      const char = charAt(i, x)
      if (char === undefined) return undefined
      if (char === '' || char === ' ') return 'blank'
      return this.separators.includes(char) ? 'separator' : 'word'
    }
    const x = Math.min(at.x, cols - 1)
    const here = kind(index, x)
    let from = { i: index, x }
    let to = { i: index, x }
    // Only words and blanks go on; a separator stands alone.
    if (here === 'word' || here === 'blank') {
      for (;;) {
        const step = from.x > 0 ? { i: from.i, x: from.x - 1 } : buffer.lines[from.i]?.wrapped ? { i: from.i - 1, x: cols - 1 } : undefined
        if (!step || kind(step.i, step.x) !== here) break
        from = step
      }
      for (;;) {
        const step = to.x < cols - 1 ? { i: to.i, x: to.x + 1 } : buffer.lines[to.i + 1]?.wrapped ? { i: to.i + 1, x: 0 } : undefined
        if (!step || kind(step.i, step.x) !== here) break
        to = step
      }
    }
    return { start: { line: from.i + buffer.dropped, x: from.x }, end: { line: to.i + buffer.dropped, x: to.x + 1 } }
  }
}
