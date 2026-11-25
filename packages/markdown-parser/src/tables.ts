// GitHub tables: a header row, a delimiter row (| --- | :-: |), then body
// rows, until a blank line or another block.

import type { Align } from './ast.js'

/**
 * splitRow splits a table row into its cells' text, trimmed. Leading and
 * trailing pipes are optional; a backslash-escaped pipe (\|) is part of a
 * cell, even inside a code span, and loses its backslash.
 */
export function splitRow(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  const s = line.trim()
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (c === '\\' && s[i + 1] === '|') {
      cell += '|'
      i++
    } else if (c === '\\' && i + 1 < s.length) {
      cell += c + s[i + 1]
      i++
    } else if (c === '|') {
      cells.push(cell)
      cell = ''
    } else {
      cell += c
    }
  }
  cells.push(cell)
  // A row's outer pipes don't make empty cells.
  if (s.startsWith('|')) cells.shift()
  if (s.length > 1 && s.endsWith('|') && !s.endsWith('\\|')) cells.pop()
  return cells.map((c) => c.trim())
}

/**
 * parseDelimiterRow reads a delimiter row's alignments, or returns undefined
 * when the line isn't one. partial accepts a row still being written while
 * streaming ("| --- | :-"): fewer cells, and a last cell of only a colon.
 */
export function parseDelimiterRow(line: string, partial = false): Align[] | undefined {
  if (!/^[\s|:-]+$/.test(line) || !line.includes('-')) return undefined
  const cells = splitRow(line)
  if (cells.length === 0) return undefined
  const align: Align[] = []
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    if (!/^:?-+:?$/.test(cell)) {
      const last = i === cells.length - 1
      if (partial && last && /^:?-*$/.test(cell)) {
        align.push(null)
        continue
      }
      return undefined
    }
    const left = cell.startsWith(':')
    const right = cell.endsWith(':')
    align.push(left && right ? 'center' : left ? 'left' : right ? 'right' : null)
  }
  return align
}

/** fitRow pads a row with empty cells, or drops extra ones, to n cells. */
export function fitRow(cells: string[], n: number): string[] {
  if (cells.length > n) return cells.slice(0, n)
  while (cells.length < n) cells.push('')
  return cells
}
