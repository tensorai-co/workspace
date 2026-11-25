import type { ChangeSet } from '@tensorai-workspace/text'

/** One cursor or selection: anchor is where it started, head where the cursor is. */
export class SelectionRange {
  constructor(
    readonly anchor: number,
    readonly head: number,
    /** The column up/down movement aims for, kept across short lines. */
    readonly goalColumn?: number,
  ) {}

  static cursor(pos: number, goalColumn?: number): SelectionRange {
    return new SelectionRange(pos, pos, goalColumn)
  }

  get from(): number {
    return Math.min(this.anchor, this.head)
  }
  get to(): number {
    return Math.max(this.anchor, this.head)
  }
  get empty(): boolean {
    return this.anchor === this.head
  }

  /** Moves through an edit. A cursor at an insertion point ends up after the inserted text. */
  map(changes: ChangeSet): SelectionRange {
    if (changes.empty) return this
    const anchor = changes.mapPos(this.anchor, this.empty || this.anchor > this.head ? 1 : -1)
    const head = changes.mapPos(this.head, this.empty || this.head > this.anchor ? 1 : -1)
    return new SelectionRange(anchor, head)
  }

  eq(other: SelectionRange): boolean {
    return this.anchor === other.anchor && this.head === other.head
  }
}

/** All the cursors and selections; one is the main one. Ranges are sorted and never overlap. */
export class EditorSelection {
  private constructor(
    readonly ranges: readonly SelectionRange[],
    readonly mainIndex: number,
  ) {}

  /** One cursor, or one selection from anchor to head. */
  static single(anchor: number, head = anchor): EditorSelection {
    return new EditorSelection([new SelectionRange(anchor, head)], 0)
  }

  /** Several ranges: sorted, and overlapping (or touching, for selections) ranges merged. */
  static create(ranges: readonly SelectionRange[], mainIndex = 0): EditorSelection {
    if (ranges.length === 0) throw new RangeError('a selection needs at least one range')
    const main = ranges[Math.min(mainIndex, ranges.length - 1)]!
    const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to)
    const out: SelectionRange[] = []
    let newMain = 0
    for (const r of sorted) {
      const prev = out[out.length - 1]
      // Overlapping ranges merge, and so does a cursor touching another range. Two selections that only touch don't.
      const overlaps = prev && (r.from < prev.to || (r.from === prev.to && (r.empty || prev.empty)))
      if (prev && overlaps) {
        const from = Math.min(prev.from, r.from)
        const to = Math.max(prev.to, r.to)
        const forward = prev.head >= prev.anchor
        out[out.length - 1] = forward ? new SelectionRange(from, to) : new SelectionRange(to, from)
        if (r === main) newMain = out.length - 1
      } else {
        if (r === main) newMain = out.length
        out.push(r)
      }
    }
    return new EditorSelection(out, newMain)
  }

  get main(): SelectionRange {
    return this.ranges[this.mainIndex]!
  }

  map(changes: ChangeSet): EditorSelection {
    if (changes.empty) return this
    return EditorSelection.create(
      this.ranges.map((r) => r.map(changes)),
      this.mainIndex,
    )
  }

  /** Adds a range and makes it the main one. */
  add(range: SelectionRange): EditorSelection {
    return EditorSelection.create([...this.ranges, range], this.ranges.length)
  }

  /** Only the main range. */
  asSingle(): EditorSelection {
    return new EditorSelection([this.main], 0)
  }

  eq(other: EditorSelection): boolean {
    if (other.ranges.length !== this.ranges.length || other.mainIndex !== this.mainIndex) return false
    return this.ranges.every((r, i) => r.eq(other.ranges[i]!))
  }
}
