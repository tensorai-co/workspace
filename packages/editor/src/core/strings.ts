// Small helpers over line text: indentation, visual columns, graphemes, word boundaries.

/** The leading whitespace of a line. */
export function indentOf(text: string): string {
  return /^[ \t]*/.exec(text)![0]
}

/** The visual column of index in text, with tabs expanded to the next tab stop. */
export function columnAt(text: string, index: number, tabSize: number): number {
  let col = 0
  for (let i = 0; i < index && i < text.length; i++) col = text[i] === '\t' ? col + tabSize - (col % tabSize) : col + 1
  return col
}

/** The index in text closest to a visual column. */
export function indexAtColumn(text: string, column: number, tabSize: number): number {
  let col = 0
  for (let i = 0; i < text.length; i++) {
    const next = text[i] === '\t' ? col + tabSize - (col % tabSize) : col + 1
    if (next > column) return column - col <= next - column ? i : i + 1
    col = next
  }
  return text.length
}

/** Whitespace that reaches the given visual column. */
export function indentString(columns: number, tabSize: number, insertSpaces: boolean): string {
  if (insertSpaces) return ' '.repeat(columns)
  return '\t'.repeat(Math.floor(columns / tabSize)) + ' '.repeat(columns % tabSize)
}

let segmenter: Intl.Segmenter | undefined
const graphemes = () => (segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' }))

/** The index after the grapheme at index (an emoji, a letter with accents, a surrogate pair moves as one). */
export function nextGrapheme(text: string, index: number): number {
  if (index >= text.length) return text.length
  const code = text.charCodeAt(index)
  if (code < 0x300) {
    const next = text.charCodeAt(index + 1)
    if (Number.isNaN(next) || next < 0x300) return index + 1
  }
  for (const seg of graphemes().segment(text.slice(index, index + 64))) return index + seg.segment.length
  return index + 1
}

/** The index of the grapheme before index. */
export function prevGrapheme(text: string, index: number): number {
  if (index <= 0) return 0
  const code = text.charCodeAt(index - 1)
  if (code < 0x300 && (index < 2 || text.charCodeAt(index - 2) < 0xd800 || text.charCodeAt(index - 2) > 0xdbff)) return index - 1
  const start = Math.max(0, index - 64)
  let last = start
  for (const seg of graphemes().segment(text.slice(start, index))) last = start + seg.index
  return last
}

/** The default word separators. */
const SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?'

type CharClass = 'space' | 'separator' | 'word'

function classOf(ch: string): CharClass {
  if (ch === ' ' || ch === '\t') return 'space'
  return SEPARATORS.includes(ch) ? 'separator' : 'word'
}

/** Where alt+right lands from index in text: past any whitespace, then past one run of word or separator characters. */
export function wordRight(text: string, index: number): number {
  let i = index
  while (i < text.length && classOf(text[i]!) === 'space') i++
  if (i >= text.length) return text.length
  const cls = classOf(text[i]!)
  while (i < text.length && classOf(text[i]!) === cls) i++
  return i
}

/** Where alt+left lands from index in text. */
export function wordLeft(text: string, index: number): number {
  let i = index
  while (i > 0 && classOf(text[i - 1]!) === 'space') i--
  if (i <= 0) return 0
  const cls = classOf(text[i - 1]!)
  while (i > 0 && classOf(text[i - 1]!) === cls) i--
  return i
}
