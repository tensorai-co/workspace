/**
 * Word wrap for monospace text: break before "([{" and the like, after spaces, ")]}",
 * punctuation and CJK, never just before a space; break mid-word only when a word won't fit on a row of its own.
 * Rows after the first are indented like the line, when that leaves room.
 */

/** Where a line is broken: the offsets that start each row after the first, and the indent of those rows, in columns. */
export interface LineBreaks {
  breaks: number[]
  indent: number
}

const BREAK_BEFORE = '([{‘“〈《「『【〔（［｛｢£¥＄￡￥+＋'
const BREAK_AFTER = ' \t})]?|/&.,;¢°′″‰℃、。｡､￠，．：；？！％・･ゝゞヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻ｧｨｩｪｫｬｭｮｯｰ”〉》」』】〕）］｝｣'

const enum Class {
  None,
  Before,
  After,
  Ideographic,
}

const classes = new Map<number, Class>()
for (const ch of BREAK_BEFORE) classes.set(ch.charCodeAt(0), Class.Before)
for (const ch of BREAK_AFTER) classes.set(ch.charCodeAt(0), Class.After)

function classOf(code: number): Class {
  const known = classes.get(code)
  if (known !== undefined) return known
  // Hiragana and Katakana, and the CJK ideographs.
  if ((code >= 0x3040 && code <= 0x30ff) || (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x4e00 && code <= 0x9fff)) return Class.Ideographic
  return Class.None
}

/** The full-width characters: CJK and full-width forms take two columns. */
export const isFullWidth = (code: number) => (code >= 0x2e80 && code <= 0xd7af) || (code >= 0xf900 && code <= 0xfaff) || (code >= 0xff01 && code <= 0xff5e)

/** How many columns a character takes at a column. */
export function charColumns(code: number, column: number, tabSize: number): number {
  if (code === 9) return tabSize - (column % tabSize)
  if (isFullWidth(code) || code < 32) return 2
  return 1
}

const canBreak = (prevClass: Class, code: number, cls: Class) =>
  code !== 32 &&
  ((prevClass === Class.After && cls !== Class.After) ||
    (prevClass !== Class.Before && cls === Class.Before) ||
    (prevClass === Class.Ideographic && cls !== Class.After) ||
    (cls === Class.Ideographic && prevClass !== Class.Before))

/** The columns a line's indentation takes. */
function indentColumns(text: string, tabSize: number): number {
  let columns = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 32) columns++
    else if (code === 9) columns += tabSize - (columns % tabSize)
    else return columns
  }
  // A line of only spaces has no indent to keep.
  return 0
}

/** Breaks a line into rows of at most `columns` columns. No breaks when it fits, or when `columns` is 0. */
export function wrapLine(text: string, columns: number, tabSize = 4): LineBreaks {
  const none = { breaks: [], indent: 0 }
  if (columns <= 0 || text.length <= 1) return none
  // Most lines are plain and short.
  if (text.length <= columns && !/[\t\u0000-\u001f⺀-￿]/.test(text)) return none

  let indent = indentColumns(text, tabSize)
  if (indent + 2 > columns) indent = 0
  const wrappedWidth = columns - indent

  const breaks: number[] = []
  let breakOffset = 0
  let breakColumn = 0
  let limit = columns
  let first = text.charCodeAt(0)
  let column = charColumns(first, 0, tabSize)
  let start = 1
  if (first >= 0xd800 && first <= 0xdbff) {
    column += 1
    first = text.charCodeAt(1)
    start = 2
  }
  let prevClass = classOf(first)

  for (let i = start; i < text.length; i++) {
    const at = i
    const code = text.charCodeAt(i)
    let cls: Class
    let width: number
    if (code >= 0xd800 && code <= 0xdbff) {
      i++
      cls = Class.None
      width = 2
    } else {
      cls = classOf(code)
      width = charColumns(code, column, tabSize)
    }
    if (canBreak(prevClass, code, cls)) {
      breakOffset = at
      breakColumn = column
    }
    column += width
    if (column > limit) {
      // No place to break in this row, or the last one is too far back: break here, in the word.
      if (breakOffset === 0 || column - breakColumn > wrappedWidth) {
        breakOffset = at
        breakColumn = column - width
      }
      const rowStart = breaks.length ? breaks[breaks.length - 1]! : 0
      if (breakOffset > rowStart) {
        breaks.push(breakOffset)
        limit = breakColumn + wrappedWidth
        breakOffset = 0
      }
    }
    prevClass = cls
  }
  return breaks.length ? { breaks, indent } : none
}

/** How many rows a line takes. */
export const rowsOf = (text: string, columns: number, tabSize = 4) => wrapLine(text, columns, tabSize).breaks.length + 1
