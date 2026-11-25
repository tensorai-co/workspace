import { wrapLine } from '../core/wrap.js'
import type { Mark, Overlay } from './overlay.js'

/** One drawn row of a line: a stretch of one of its logical rows, indented when it continues a wrapped one. */
export interface VisualRow {
  logical: number
  from: number
  to: number
  /** Columns of indent before it: the line's own, on rows a wrap continues. */
  indent: number
  /** Whether it's the last row of its logical row. */
  end: boolean
}

/**
 * How a document line is drawn: its logical rows (the line, or the line with text drawn into it, split where that
 * text has line breaks), each wrapped into visual rows. It maps between the line's columns and where they're drawn.
 */
export interface LineLayout {
  line: number
  logical: { text: string; marks: Mark[] }[]
  rows: VisualRow[]
  key: string
  /** The visual row a column of the line is drawn on, and how far into that row's text. At a wrap, the next row. */
  map(col: number): { row: number; offset: number }
  /** The line's column drawn at an offset into a visual row's text. The end of a wrapped row stays on that row. */
  unmap(row: number, offset: number): number
  /** The line's columns a visual row shows. */
  range(row: number): { from: number; to: number }
}

/** Lays out a line, wrapped at `columns` (0 for no wrap). */
export function layoutLine(line: number, text: string, overlay: Overlay | undefined, columns: number, tabSize: number): LineLayout {
  const logical = overlay ? overlay.rows : [{ text, marks: [] as Mark[] }]
  const rows: VisualRow[] = []
  const firstRow: number[] = []
  logical.forEach((l, i) => {
    firstRow.push(rows.length)
    const { breaks, indent } = wrapLine(l.text, columns, tabSize)
    const starts = [0, ...breaks]
    starts.forEach((from, k) => rows.push({ logical: i, from, to: starts[k + 1] ?? l.text.length, indent: k ? indent : 0, end: k === starts.length - 1 }))
  })
  const toLogical = (col: number) => (overlay ? overlay.map(col) : { row: 0, col })
  const fromLogical = (row: number, col: number) => (overlay ? overlay.unmap(row, col) : col)
  return {
    line,
    logical,
    rows,
    key: `${overlay?.key ?? ''}|${columns}`,
    map(col) {
      const p = toLogical(col)
      let row = firstRow[p.row] ?? 0
      while (row + 1 < rows.length && rows[row + 1]!.logical === p.row && rows[row + 1]!.from <= p.col) row++
      return { row, offset: p.col - rows[row]!.from }
    },
    unmap(row, offset) {
      const r = rows[Math.max(0, Math.min(rows.length - 1, row))]!
      let col = r.from + Math.max(0, Math.min(r.to - r.from, offset))
      // A position at a wrap is drawn on the next row; to stay on this one, stop a character short.
      if (!r.end && col === r.to && col > r.from) col--
      return fromLogical(r.logical, col)
    },
    range(row) {
      const r = rows[row]!
      return { from: fromLogical(r.logical, r.from), to: fromLogical(r.logical, r.to) }
    },
  }
}
