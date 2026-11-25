import { Line, type Pen } from './line.js'

/** What DECSC saves and DECRC brings back. */
export interface SavedCursor {
  x: number
  y: number
  pen: Pen
  charsets: readonly Charset[]
  shift: number
  origin: boolean
  wrapPending: boolean
}

export type Charset = 'ascii' | 'graphics' | 'uk'

const TAB = 8

/** A screen's lines, its scrollback and where its cursor is. A terminal has two: the normal one and the alternate one. */
export class Buffer {
  /** Scrollback first, then the screen. */
  lines: Line[] = []
  /** The index in `lines` of the screen's first row. */
  base = 0
  /** The cursor. x may be one past the last column: the next character wraps. */
  x = 0
  y = 0
  /** The scroll region, in rows of the screen, both ends in it. */
  top = 0
  bottom: number
  saved: SavedCursor | undefined
  /** Columns with a tab stop. */
  tabs = new Set<number>()
  /** How many lines have been dropped from the start. A line's index plus this never changes. */
  dropped = 0

  constructor(
    public cols: number,
    public rows: number,
    /** The most lines of scrollback. */
    readonly scrollback: number,
  ) {
    this.bottom = rows - 1
    for (let i = 0; i < rows; i++) this.lines.push(new Line(cols))
    this.resetTabs()
  }

  /** A row of the screen. */
  row(y: number): Line {
    return this.lines[this.base + y]!
  }

  resetTabs(): void {
    this.tabs = new Set()
    for (let x = 0; x < this.cols; x += TAB) this.tabs.add(x)
  }

  nextTab(x: number): number {
    for (let i = x + 1; i < this.cols; i++) if (this.tabs.has(i)) return i
    return this.cols - 1
  }

  previousTab(x: number): number {
    for (let i = x - 1; i > 0; i--) if (this.tabs.has(i)) return i
    return 0
  }

  /**
   * Scrolls the region up a line. What leaves the top of the screen becomes scrollback. Returns whether a line was
   * dropped from the start of the scrollback to make room.
   */
  scrollUp(bg: number, wrapped = false): boolean {
    const at = this.base + this.bottom + 1
    if (this.top > 0) {
      const [line] = this.lines.splice(this.base + this.top, 1)
      line!.reset(bg)
      line!.wrapped = wrapped
      this.lines.splice(at - 1, 0, line!)
      return false
    }
    if (this.lines.length < this.rows + this.scrollback) {
      const line = new Line(this.cols, bg)
      line.wrapped = wrapped
      this.lines.splice(at, 0, line)
      this.base++
      return false
    }
    const line = this.lines.shift()!
    this.dropped++
    line.reset(bg)
    line.wrapped = wrapped
    // Its first rows are gone, so what's now first isn't the rest of anything.
    this.lines.splice(at - 1, 0, line)
    return true
  }

  /** Scrolls the region down a line. */
  scrollDown(bg: number): void {
    const [line] = this.lines.splice(this.base + this.bottom, 1)
    line!.reset(bg)
    this.lines.splice(this.base + this.top, 0, line!)
  }

  /** Moves rows from `y` down, within the region, and puts a blank one there. */
  insertLine(y: number, bg: number): void {
    const [line] = this.lines.splice(this.base + this.bottom, 1)
    line!.reset(bg)
    this.lines.splice(this.base + y, 0, line!)
  }

  /** Takes out row `y` and puts a blank one at the region's end. */
  deleteLine(y: number, bg: number): void {
    const [line] = this.lines.splice(this.base + y, 1)
    line!.reset(bg)
    this.lines.splice(this.base + this.bottom, 0, line!)
  }

  clearScrollback(): number {
    const gone = this.base
    this.lines.splice(0, gone)
    this.base = 0
    this.dropped += gone
    return gone
  }

  /** Changes the size. With `reflow`, lines that were wrapped wrap again at the new width. */
  resize(cols: number, rows: number, reflow: boolean): void {
    if (cols !== this.cols) {
      if (reflow) this.reflow(cols)
      else {
        for (const line of this.lines) line.resize(cols)
        this.x = Math.min(this.x, cols - 1)
      }
      const old = this.cols
      this.cols = cols
      if (cols > old) for (let x = Math.ceil(old / TAB) * TAB; x < cols; x += TAB) this.tabs.add(x)
      else for (const x of [...this.tabs]) if (x >= cols) this.tabs.delete(x)
    }
    if (rows !== this.rows) this.setRows(rows)
    this.top = 0
    this.bottom = rows - 1
    this.x = Math.min(this.x, cols)
    this.y = Math.max(0, Math.min(this.y, rows - 1))
    if (this.saved) {
      this.saved.x = Math.min(this.saved.x, cols - 1)
      this.saved.y = Math.min(this.saved.y, rows - 1)
    }
  }

  private setRows(rows: number) {
    for (let n = this.rows; n < rows; n++) {
      // Growing shows scrollback again; without any, blank rows come in below.
      if (this.base > 0) {
        this.base--
        this.y++
        if (this.saved) this.saved.y++
      } else this.lines.push(new Line(this.cols))
    }
    for (let n = this.rows; n > rows; n--) {
      // Shrinking drops blank rows below the cursor; without any, the top row becomes scrollback.
      const last = this.lines[this.lines.length - 1]!
      if (this.y < n - 1 && last.written === 0 && !last.wrapped) this.lines.pop()
      else {
        this.base++
        this.y--
        if (this.saved) this.saved.y = Math.max(0, this.saved.y - 1)
      }
    }
    this.rows = rows
    this.trim()
  }

  /** Drops scrollback past the limit. */
  private trim() {
    const extra = this.lines.length - this.rows - this.scrollback
    if (extra <= 0) return
    this.lines.splice(0, extra)
    this.base -= extra
    this.dropped += extra
  }

  /**
   * Wraps every logical line again. The cursor stays on the character it was on, and so does what's at the bottom of the
   * screen, as far as there are lines.
   */
  private reflow(cols: number) {
    const from = this.lines
    const cursorAt = this.base + this.y
    const pending = this.x >= this.cols
    const next: Line[] = []
    let cursorRow = -1
    let cursorX = 0

    for (let start = 0; start < from.length; ) {
      let end = start + 1
      while (end < from.length && from[end]!.wrapped) end++
      const group = from.slice(start, end)
      const cursorIn = cursorAt >= start && cursorAt < end ? cursorAt - start : -1

      // The logical line as runs of whole characters. A row's last cell may be empty only because a wide character
      // didn't fit there; that gap isn't text.
      const pieces: { line: Line; from: number; to: number }[] = []
      let cursorOffset = -1
      let length = 0
      group.forEach((line, i) => {
        const last = i === group.length - 1
        let to = last ? line.written : this.cols
        if (!last && !line.has(this.cols - 1) && line.width(this.cols - 1) === 1 && group[i + 1]!.width(0) === 2) to = this.cols - 1
        if (i === cursorIn) {
          cursorOffset = length + (pending ? this.cols : this.x)
          if (!last) cursorOffset = Math.min(cursorOffset, length + to)
        }
        pieces.push({ line, from: 0, to })
        length += to
      })

      const firstRow = next.length
      let row = new Line(cols)
      let x = 0
      let offset = 0
      const placeCursor = () => {
        cursorRow = next.length
        cursorX = x
      }
      for (const piece of pieces) {
        for (let at = piece.from; at < piece.to; ) {
          const width = Math.max(1, piece.line.width(at))
          const n = Math.min(width, piece.to - at)
          if (x + n > cols && x > 0) {
            next.push(row)
            row = new Line(cols)
            row.wrapped = true
            x = 0
          }
          if (cursorOffset >= offset && cursorOffset < offset + n) placeCursor()
          // A wide character in a one-column terminal has no room at all.
          if (n <= cols) row.copy(piece.line, at, x, n)
          x += Math.min(n, cols)
          at += n
          offset += n
        }
      }
      if (cursorOffset >= offset) {
        // Past the text: as far past it as it was.
        let rest = cursorOffset - offset
        if (pending && rest === 0) placeCursor()
        else {
          while (x + rest >= cols && rest > 0) {
            if (x + rest === cols && pending) break
            rest -= cols - x
            next.push(row)
            row = new Line(cols)
            row.wrapped = true
            x = 0
          }
          cursorRow = next.length
          cursorX = x + rest
        }
      }
      row.wrapped = next.length > firstRow
      next.push(row)
      if (group.length) next[firstRow]!.wrapped = group[0]!.wrapped && firstRow > 0
      start = end
    }

    // Lines below the cursor that only make up the screen's height needn't scroll anything away.
    const below = from.length - 1 - cursorAt
    while (next.length > this.rows && next.length - 1 - cursorRow > 0 && next.length - 1 - cursorRow >= below && next[next.length - 1]!.written === 0 && !next[next.length - 1]!.wrapped && next.length > from.length) next.pop()
    while (next.length < this.rows) next.push(new Line(cols))

    this.lines = next
    this.base = next.length - this.rows
    this.y = cursorRow - this.base
    this.x = pending && cursorX >= cols ? cols : Math.min(cursorX, cols - 1)
    if (this.y < 0) {
      // The cursor is above the last screenful: show from its row.
      this.base += this.y
      this.y = 0
      this.lines.length = this.base + this.rows
    }
    this.trim()
  }
}
