// The cursor the block parser moves along each line, and the character
// classes the spec defines.

export const TAB = 9
export const NEWLINE = 10
export const SPACE = 32

/** Indentation from which a line is indented code. */
export const CODE_INDENT = 4

/**
 * Line is the line being parsed and a cursor on it. Columns count a tab as
 * reaching the next multiple of 4, as the spec does; offsets count UTF-16
 * code units. A tab can be partly used up: "-\tfoo" is a list item whose
 * content starts two columns into the tab.
 */
export class Line {
  text = ''
  offset = 0
  column = 0
  /** The cursor stopped inside a tab: the rest of it still counts as spaces. */
  partialTab = false

  // Set by findNextNonspace.
  nextNonspace = 0
  nextNonspaceColumn = 0
  indent = 0
  blank = false

  reset(text: string): void {
    this.text = text
    this.offset = 0
    this.column = 0
    this.partialTab = false
  }

  /** The character code at i, or -1 past the end. */
  at(i: number): number {
    return i < this.text.length ? this.text.charCodeAt(i) : -1
  }

  get indented(): boolean {
    return this.indent >= CODE_INDENT
  }

  /** Finds the first character after spaces and tabs, without moving. */
  findNextNonspace(): void {
    let i = this.offset
    let col = this.column
    for (;;) {
      const c = this.at(i)
      if (c === SPACE) {
        i++
        col++
      } else if (c === TAB) {
        i++
        col += 4 - (col % 4)
      } else {
        break
      }
    }
    this.blank = i >= this.text.length
    this.nextNonspace = i
    this.nextNonspaceColumn = col
    this.indent = col - this.column
  }

  advanceNextNonspace(): void {
    this.offset = this.nextNonspace
    this.column = this.nextNonspaceColumn
    this.partialTab = false
  }

  /**
   * Moves count characters, or count columns when columns is true. A tab
   * wider than the columns left is entered partway.
   */
  advance(count: number, columns: boolean): void {
    while (count > 0 && this.offset < this.text.length) {
      if (this.text.charCodeAt(this.offset) === TAB) {
        const toTab = 4 - (this.column % 4)
        if (columns) {
          this.partialTab = toTab > count
          const n = Math.min(toTab, count)
          this.column += n
          if (!this.partialTab) this.offset++
          count -= n
        } else {
          this.partialTab = false
          this.column += toTab
          this.offset++
          count--
        }
      } else {
        this.partialTab = false
        this.offset++
        this.column++
        count--
      }
    }
  }

  /** The rest of the line from the cursor, with a partly used tab as spaces. */
  rest(): string {
    if (this.partialTab) {
      return ' '.repeat(4 - (this.column % 4)) + this.text.slice(this.offset + 1)
    }
    return this.text.slice(this.offset)
  }
}

export function isSpaceOrTab(c: number): boolean {
  return c === SPACE || c === TAB
}

export function isBlank(s: string): boolean {
  return !/[^ \t\r\n\f\v]/.test(s)
}

/** Unicode whitespace: Zs, tab, line feed, form feed and carriage return. */
const WHITESPACE = /^[\p{Zs}\t\n\f\r]/u

/** ASCII punctuation, and Unicode P (punctuation) and S (symbol). */
const PUNCTUATION = /^[\p{P}\p{S}]/u

export function isUnicodeWhitespace(ch: string): boolean {
  return WHITESPACE.test(ch)
}

export function isPunctuation(ch: string): boolean {
  return PUNCTUATION.test(ch)
}

/** The characters a backslash escapes. */
export const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/

export function isEscapable(ch: string): boolean {
  return ch.length === 1 && ESCAPABLE.test(ch)
}

/** The character (a whole code point) ending just before offset i, or "\n" at the start. */
export function charBefore(s: string, i: number): string {
  if (i <= 0) return '\n'
  const lo = s.charCodeAt(i - 1)
  if (lo >= 0xdc00 && lo <= 0xdfff && i >= 2) {
    const hi = s.charCodeAt(i - 2)
    if (hi >= 0xd800 && hi <= 0xdbff) return s.slice(i - 2, i)
  }
  return s.charAt(i - 1)
}

/** The character (a whole code point) starting at offset i, or "\n" at the end. */
export function charAt(s: string, i: number): string {
  if (i >= s.length) return '\n'
  const cp = s.codePointAt(i)!
  return String.fromCodePoint(cp)
}
