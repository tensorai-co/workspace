// Cells are packed, three 32-bit words each: what's in the cell, its foreground and its background.
//
//   content     bits 0-20 a code point, 21 "there's more" (the whole text is in `combined`), 22-23 the width
//   foreground  bits 0-23 a color, 24-25 how to read it, 26-31 flags
//   background  the same, with other flags
//
// A width of 0 is the second half of a wide character. A code point of 0 is a cell nothing was written in.

const WORDS = 3
const CODE = 0x1fffff
const COMBINED = 0x200000
const WIDTH_SHIFT = 22

/** How a color is written. */
export const COLOR_MASK = 0x3ffffff
export const COLOR_DEFAULT = 0
export const COLOR_PALETTE = 0x1000000
export const COLOR_RGB = 0x2000000
const COLOR_KIND = 0x3000000

/** Flags in the foreground word. */
export const INVERSE = 0x4000000
export const BOLD = 0x8000000
export const UNDERLINE = 0x10000000
export const BLINK = 0x20000000
export const INVISIBLE = 0x40000000
export const STRIKE = 0x80000000

/** Flags in the background word. */
export const ITALIC = 0x4000000
export const DIM = 0x8000000
export const EXTENDED = 0x10000000
export const PROTECTED = 0x20000000
export const OVERLINE = 0x40000000

export interface Link {
  readonly uri: string
  /** Cells with the same id are one link, even apart. */
  readonly id: string | undefined
}

/** What few cells have. Shared between cells, and never changed. */
export interface Extended {
  /** 0 none, 1 single, 2 double, 3 curly, 4 dotted, 5 dashed. */
  readonly underline: number
  /** As a color word; 0 is the text's own color. */
  readonly underlineColor: number
  readonly link: Link | undefined
}

/** The attributes text is written with. */
export interface Pen {
  fg: number
  bg: number
  ext: Extended | undefined
}

/** A color, unpacked. */
export type CellColor = { kind: 'default' } | { kind: 'palette'; index: number } | { kind: 'rgb'; rgb: number }

export const cellColor = (word: number): CellColor => {
  const kind = word & COLOR_KIND
  if (kind === COLOR_PALETTE) return { kind: 'palette', index: word & 0xff }
  if (kind === COLOR_RGB) return { kind: 'rgb', rgb: word & 0xffffff }
  return { kind: 'default' }
}

let stamp = 0

/** A row of cells. */
export class Line {
  /** The text goes on from the line before. */
  wrapped = false
  /** Changes whenever the line does, so a view knows what to draw again. */
  version = ++stamp
  private words: Uint32Array
  /** Whole texts of cells with more than one code point. */
  private combined: Map<number, string> | undefined
  private extended: Map<number, Extended> | undefined

  constructor(cols: number, bg = 0) {
    this.words = new Uint32Array(cols * WORDS)
    this.blank(0, cols, bg)
  }

  get cols(): number {
    return this.words.length / WORDS
  }

  // ------------------------------------------------------------ reading

  code(x: number): number {
    return this.words[x * WORDS]! & CODE
  }

  width(x: number): number {
    return this.words[x * WORDS]! >>> WIDTH_SHIFT
  }

  fg(x: number): number {
    return this.words[x * WORDS + 1]!
  }

  bg(x: number): number {
    return this.words[x * WORDS + 2]!
  }

  ext(x: number): Extended | undefined {
    return this.words[x * WORDS + 2]! & EXTENDED ? this.extended?.get(x) : undefined
  }

  /** Whether anything was written in the cell. */
  has(x: number): boolean {
    return (this.words[x * WORDS]! & (CODE | COMBINED)) !== 0
  }

  /** A cell's text: "" in an empty one, and in the second half of a wide one. */
  char(x: number): string {
    const content = this.words[x * WORDS]!
    if (content & COMBINED) return this.combined?.get(x) ?? ''
    return content & CODE ? String.fromCodePoint(content & CODE) : ''
  }

  /** How many cells there are up to the last one written in. */
  get written(): number {
    for (let x = this.cols - 1; x >= 0; x--) if (this.has(x)) return x + this.width(x)
    return 0
  }

  /** As text, with empty cells as spaces. `trim` leaves out the empty ones at the end. */
  text(trim = false, from = 0, to = this.cols): string {
    const end = trim ? Math.min(to, this.written) : to
    let text = ''
    for (let x = from; x < end; x++) if (this.width(x) > 0) text += this.char(x) || ' '
    return text
  }

  // ------------------------------------------------------------ writing

  touch(): void {
    this.version = ++stamp
  }

  set(x: number, code: number, width: number, pen: Pen): void {
    const at = x * WORDS
    if (this.words[at]! & COMBINED) this.combined?.delete(x)
    this.words[at] = code | (width << WIDTH_SHIFT)
    this.words[at + 1] = pen.fg
    this.words[at + 2] = pen.bg
    if (pen.ext) {
      this.words[at + 2]! |= EXTENDED
      ;(this.extended ??= new Map()).set(x, pen.ext)
    }
  }

  /** Adds a code point to what's in a cell: a mark over a letter, for instance. */
  append(x: number, code: number): void {
    const at = x * WORDS
    const content = this.words[at]!
    const more = String.fromCodePoint(code)
    if (content & COMBINED) this.combined!.set(x, this.combined!.get(x)! + more)
    else if (content & CODE) {
      ;(this.combined ??= new Map()).set(x, String.fromCodePoint(content & CODE) + more)
      this.words[at] = (content & ~CODE) | COMBINED
    } else this.words[at] = (content & ~CODE) | code | (1 << WIDTH_SHIFT)
  }

  /** Empties cells from..to, leaving only a background color. */
  blank(from: number, to: number, bg: number): void {
    const color = bg & COLOR_MASK
    for (let x = from; x < to; x++) {
      const at = x * WORDS
      if (this.words[at]! & COMBINED) this.combined?.delete(x)
      this.words[at] = 1 << WIDTH_SHIFT
      this.words[at + 1] = 0
      this.words[at + 2] = color
    }
  }

  /** Erases cells from..to. Half of a wide character takes the other half with it. */
  erase(from: number, to: number, bg: number, keepProtected = false): void {
    const end = Math.min(to, this.cols)
    if (from >= end) return
    if (keepProtected) {
      if (from > 0 && this.width(from - 1) === 2 && !(this.bg(from - 1) & PROTECTED)) this.blank(from - 1, from, bg)
      if (end < this.cols && this.width(end - 1) === 2 && !(this.bg(end) & PROTECTED)) this.blank(end, end + 1, bg)
      for (let x = from; x < end; x++) if (!(this.bg(x) & PROTECTED)) this.blank(x, x + 1, bg)
    } else {
      if (from > 0 && this.width(from - 1) === 2) this.blank(from - 1, from, bg)
      if (end < this.cols && this.width(end - 1) === 2) this.blank(end, end + 1, bg)
      this.blank(from, end, bg)
    }
    this.touch()
  }

  /** Makes room for n cells at x. What's pushed past the end is gone. */
  insert(x: number, n: number, bg: number): void {
    const { cols } = this
    if (x > 0 && this.width(x) === 0) this.breakWide(x - 1, bg)
    const count = Math.min(n, cols - x)
    this.shift(x, x + count, cols - x - count)
    this.blank(x, x + count, bg)
    // A wide character cut in two at the end.
    if (cols > 0 && this.width(cols - 1) === 2) this.blank(cols - 1, cols, bg)
    this.touch()
  }

  /** Takes out n cells at x, and fills up the end. */
  delete(x: number, n: number, bg: number): void {
    const { cols } = this
    const count = Math.min(n, cols - x)
    // A wide character cut in two at either side of what goes.
    if (x > 0 && this.width(x - 1) === 2) this.blank(x - 1, x, bg)
    this.shift(x + count, x, cols - x - count)
    this.blank(cols - count, cols, bg)
    if (this.width(x) === 0) this.blank(x, x + 1, bg)
    this.touch()
  }

  resize(cols: number, bg = 0): void {
    const old = this.cols
    if (cols === old) return
    const words = new Uint32Array(cols * WORDS)
    words.set(this.words.subarray(0, Math.min(old, cols) * WORDS))
    this.words = words
    if (cols > old) this.blank(old, cols, bg)
    else {
      for (const map of [this.combined, this.extended]) if (map) for (const x of [...map.keys()]) if (x >= cols) map.delete(x)
      if (cols > 0 && this.width(cols - 1) === 2) this.blank(cols - 1, cols, bg)
    }
    this.touch()
  }

  /** Copies n cells of another line here. */
  copy(from: Line, fromX: number, toX: number, n: number): void {
    this.words.set(from.words.subarray(fromX * WORDS, (fromX + n) * WORDS), toX * WORDS)
    for (let i = 0; i < n; i++) {
      const text = from.combined?.get(fromX + i)
      if (text !== undefined) (this.combined ??= new Map()).set(toX + i, text)
      else this.combined?.delete(toX + i)
      const ext = from.extended?.get(fromX + i)
      if (ext) (this.extended ??= new Map()).set(toX + i, ext)
    }
    this.touch()
  }

  /** Empties the whole line, to use it again. */
  reset(bg: number): void {
    this.combined = undefined
    this.extended = undefined
    this.blank(0, this.cols, bg)
    this.wrapped = false
    this.touch()
  }

  private breakWide(x: number, bg: number) {
    this.blank(x, x + 2, bg)
  }

  private shift(from: number, to: number, n: number) {
    if (n <= 0) return
    this.words.copyWithin(to * WORDS, from * WORDS, (from + n) * WORDS)
    if (this.combined?.size) this.combined = shiftKeys(this.combined, from, to, n)
    if (this.extended?.size) this.extended = shiftKeys(this.extended, from, to, n)
  }
}

/** What a map of cells is after n cells moved from one place to another. */
function shiftKeys<V>(map: Map<number, V>, from: number, to: number, n: number): Map<number, V> {
  const next = new Map<number, V>()
  for (const [x, value] of map) {
    if (x >= from && x < from + n) next.set(x + to - from, value)
    else if (x < to || x >= to + n) next.set(x, value)
  }
  return next
}
