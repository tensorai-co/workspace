import type { Text } from '@tensorai-workspace/text'
import type { Ghost, NextEdit } from '../core/inline.js'

/** How a piece of a drawn row looks: ghost text, text an edit removes or adds, or the "⋯" of a folded line. */
export type MarkKind = 'ghost' | 'removed' | 'inserted' | 'fold'

export interface Mark {
  from: number
  to: number
  kind: MarkKind
}

export interface OverlayRow {
  text: string
  marks: Mark[]
}

/**
 * A document line drawn with text that isn't in the document: ghost text, or an edit shown as a diff. Its first row
 * is the line; text with line breaks in it adds rows below, and the rest of the line ends the last of them.
 */
export interface Overlay {
  line: number
  rows: OverlayRow[]
  /** Changes when what's drawn changes. */
  key: string
  /** Where a column of the line is drawn. A column at an insertion is drawn before it. */
  map(col: number): { row: number; col: number }
  /** The line's column drawn at a row and column. Inside drawn text, it's where that text goes. */
  unmap(row: number, col: number): number
}

interface Insertion {
  col: number
  text: string
  kind: MarkKind
}

/** Lays out a line with insertions (in column order) and marks over its own text. */
export function buildOverlay(line: number, text: string, insertions: readonly Insertion[], marks: readonly Mark[]): Overlay {
  const rows: OverlayRow[] = [{ text: '', marks: [] }]
  const points: ({ row: number; col: number } | undefined)[] = new Array(text.length + 1)
  const current = () => rows[rows.length - 1]!
  const mark = (row: OverlayRow, from: number, to: number, kind: MarkKind) => {
    if (to <= from) return
    const last = row.marks[row.marks.length - 1]
    if (last && last.kind === kind && last.to === from) last.to = to
    else row.marks.push({ from, to, kind })
  }
  const real = (from: number, to: number) => {
    const row = current()
    const start = row.text.length
    for (let c = from; c <= to; c++) points[c] ??= { row: rows.length - 1, col: start + (c - from) }
    row.text += text.slice(from, to)
    for (const m of marks) mark(row, start + Math.max(m.from, from) - from, start + Math.min(m.to, to) - from, m.kind)
  }
  const drawn = (insert: string, kind: MarkKind) => {
    insert.split('\n').forEach((piece, i) => {
      if (i > 0) rows.push({ text: '', marks: [] })
      const row = current()
      mark(row, row.text.length, row.text.length + piece.length, kind)
      row.text += piece
    })
  }
  let at = 0
  for (const ins of insertions) {
    real(at, ins.col)
    drawn(ins.text, ins.kind)
    at = ins.col
  }
  real(at, text.length)
  const key = JSON.stringify([insertions, marks])
  return {
    line,
    rows,
    key,
    map: (col) => points[Math.max(0, Math.min(text.length, col))]!,
    unmap(row, col) {
      let best = 0
      for (let c = 0; c <= text.length; c++) {
        const p = points[c]!
        if (p.row < row || (p.row === row && p.col <= col)) best = c
      }
      return best
    },
  }
}

/** The part of an edit that changes: what's the same at the start and end isn't drawn as a change. */
export function innerChange(from: number, removed: string, insert: string): { from: number; to: number; insert: string } {
  let start = 0
  while (start < removed.length && start < insert.length && removed[start] === insert[start]) start++
  let end = 0
  while (end < removed.length - start && end < insert.length - start && removed[removed.length - 1 - end] === insert[insert.length - 1 - end]) end++
  return { from: from + start, to: from + removed.length - end, insert: insert.slice(start, insert.length - end) }
}

/**
 * Every line drawn differently: the ghost text's line, the lines of an edit elsewhere, and folded lines, which end
 * in "⋯". Ghost text wins a line over an edit.
 */
export function overlaysFor(doc: Text, ghost: Ghost | undefined, edit: NextEdit | undefined, folded: readonly number[] = []): Map<number, Overlay> {
  const parts = new Map<number, { insertions: Insertion[]; marks: Mark[] }>()
  const at = (n: number) => {
    let p = parts.get(n)
    if (!p) parts.set(n, (p = { insertions: [], marks: [] }))
    return p
  }
  if (edit) {
    // An inline diff: the removed text struck through, the added text after it.
    const change = innerChange(edit.from, edit.removed, edit.insert)
    const first = doc.lineAt(change.from)
    const last = doc.lineAt(change.to)
    for (let n = first.number; n <= last.number; n++) {
      const line = doc.line(n)
      const from = Math.max(change.from, line.from) - line.from
      const to = Math.min(change.to, line.to) - line.from
      if (to > from) at(n).marks.push({ from, to, kind: 'removed' })
      if (n === last.number && change.insert) at(n).insertions.push({ col: change.to - line.from, text: change.insert, kind: 'inserted' })
    }
  }
  if (ghost) {
    const line = doc.lineAt(ghost.pos)
    parts.set(line.number, { insertions: ghost.parts.map((p) => ({ col: p.pos - line.from, text: p.text, kind: 'ghost' as const })), marks: [] })
  }
  for (const n of folded) at(n).insertions.push({ col: doc.line(n).text.length, text: '⋯', kind: 'fold' })
  const out = new Map<number, Overlay>()
  for (const [n, p] of parts) {
    if (!p.insertions.length && !p.marks.length) continue
    p.insertions.sort((a, b) => a.col - b.col)
    out.set(n, buildOverlay(n, doc.line(n).text, p.insertions, p.marks))
  }
  return out
}
