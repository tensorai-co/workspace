import type { Rules } from '@tensorai-co/workspace/languages'
import type { ChangeSet, Text } from '@tensorai-co/workspace/text'

/** A region that can fold: its first line stays, the lines after it through `end` hide. */
export interface FoldRange {
  start: number
  end: number
}

/** A line's indentation in columns, or -1 for a line of only spaces. */
function indentLevel(text: string, tabSize: number): number {
  let columns = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    if (ch === 32) columns++
    else if (ch === 9) columns += tabSize - (columns % tabSize)
    else return columns
  }
  return -1
}

/**
 * The regions that fold without a language server: by indentation, and between markers such
 * as `// #region`. A region runs from a line to the last line below it indented further, so a closing `}` stays in
 * view; in off-side languages (Python) the blank lines at its end aren't in it. Sorted by first line.
 */
export function foldRanges(doc: Text, rules: Pick<Rules, 'folding'>, tabSize = 4): FoldRange[] {
  const { start: startMarker, end: endMarker, offSide } = rules.folding
  const out: FoldRange[] = []
  const previous: { indent: number; endAbove: number; line: number }[] = [{ indent: -1, endAbove: doc.lines + 1, line: doc.lines + 1 }]
  for (let line = doc.lines; line > 0; line--) {
    const text = doc.line(line).text
    const indent = indentLevel(text, tabSize)
    let top = previous[previous.length - 1]!
    if (indent === -1) {
      if (offSide) top.endAbove = line
      continue
    }
    const isStart = !!startMarker && startMarker.test(text)
    const isEnd = !isStart && !!endMarker && endMarker.test(text)
    if (isStart) {
      // The nearest end marker below closes it.
      let i = previous.length - 1
      while (i > 0 && previous[i]!.indent !== -2) i--
      if (i > 0) {
        previous.length = i + 1
        top = previous[i]!
        out.push({ start: line, end: top.line })
        top.line = line
        top.indent = indent
        top.endAbove = line
        continue
      }
    } else if (isEnd) {
      previous.push({ indent: -2, endAbove: line, line })
      continue
    }
    if (top.indent > indent) {
      do {
        previous.pop()
        top = previous[previous.length - 1]!
      } while (top.indent > indent)
      const end = top.endAbove - 1
      if (end - line >= 1) out.push({ start: line, end })
    }
    if (top.indent === indent) top.endAbove = line
    else previous.push({ indent, endAbove: line, line })
  }
  return out.sort((a, b) => a.start - b.start || b.end - a.end)
}

/** A folded region, by position: the end of its first line, and the end of its last. */
interface Fold {
  from: number
  to: number
}

/**
 * Which regions are folded, kept as positions so they follow edits. An edit inside a folded region, or the cursor
 * landing in one, unfolds it.
 */
export class Folds {
  private folds: Fold[] = []

  get size(): number {
    return this.folds.length
  }

  /** The folded regions now, by line. */
  ranges(doc: Text): FoldRange[] {
    return this.folds.map((f) => ({ start: doc.lineAt(f.from).number, end: doc.lineAt(f.to).number }))
  }

  /** Where a fold that starts at a position is, or would go, in the sorted list. */
  private indexOf(from: number): number {
    let lo = 0
    let hi = this.folds.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.folds[mid]!.from < from) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  isFolded(doc: Text, start: number): boolean {
    if (start < 1 || start > doc.lines) return false
    const from = doc.line(start).to
    return this.folds[this.indexOf(from)]?.from === from
  }

  fold(doc: Text, range: FoldRange): void {
    if (range.end <= range.start || range.start < 1 || range.end > doc.lines) return
    const from = doc.line(range.start).to
    const at = this.indexOf(from)
    if (this.folds[at]?.from === from) return
    this.folds.splice(at, 0, { from, to: doc.line(range.end).to })
  }

  /** Unfolds the region that starts at a line. Returns whether there was one. */
  unfold(doc: Text, start: number): boolean {
    if (!this.isFolded(doc, start)) return false
    this.folds.splice(this.indexOf(doc.line(start).to), 1)
    return true
  }

  clear(): void {
    this.folds = []
  }

  /** Follows an edit. A region it changed inside is unfolded. Returns whether anything unfolded. */
  map(changes: ChangeSet): boolean {
    const before = this.folds.length
    this.folds = this.folds.flatMap((f) => (changes.touches(f.from + 1, f.to) ? [] : [{ from: changes.mapPos(f.from, 1), to: changes.mapPos(f.to, -1) }]))
    return this.folds.length < before
  }

  /** Unfolds every region that hides one of these positions. Returns whether anything unfolded. */
  reveal(doc: Text, positions: readonly number[]): boolean {
    let changed = false
    for (const p of positions) {
      // Every fold hiding p starts before it; the comparisons are only numbers.
      for (let i = this.indexOf(p) - 1; i >= 0; i--) {
        const f = this.folds[i]!
        if (p > f.from && p <= f.to) {
          this.folds.splice(i, 1)
          changed = true
        }
      }
    }
    return changed
  }

  /** Whether a line is hidden in a folded region. */
  hidden(doc: Text): (line: number) => boolean {
    const spans = this.ranges(doc)
    return (line) => spans.some((r) => line > r.start && line <= r.end)
  }
}
