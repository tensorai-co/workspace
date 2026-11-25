import type { Text } from './text.js'

/** One edit: replace from..to (in the old document) with insert. */
export interface ChangeSpec {
  from: number
  to?: number
  insert?: string
}

/** A normalized change: from <= to, never overlapping its neighbors. */
export interface Change {
  readonly from: number
  readonly to: number
  readonly insert: string
}

/** How a position at the exact edge of an insertion moves: -1 stays before it, 1 moves after it. */
export type Assoc = -1 | 1

/**
 * A set of edits that apply together to one document version. All positions refer to the document before the
 * change; edits are sorted and don't overlap. A change set can be applied, inverted (for undo) and used to map positions
 * from the old document into the new one (to keep cursors, selections and decorations in place).
 */
export class ChangeSet {
  private constructor(
    /** The edits, sorted, non-overlapping, in old-document positions. */
    readonly changes: readonly Change[],
    /** Length of the document these apply to. */
    readonly length: number,
  ) {}

  /** No edits, for a document of the given length. */
  static empty(length: number): ChangeSet {
    return new ChangeSet([], length)
  }

  /**
   * Edits for a document of the given length. Specs may come in any order; touching or overlapping specs are merged,
   * in the order given.
   */
  static of(specs: ChangeSpec | readonly ChangeSpec[], length: number): ChangeSet {
    const list = (Array.isArray(specs) ? specs : [specs]) as readonly ChangeSpec[]
    const sorted = list
      .map((s, i) => ({ from: s.from, to: s.to ?? s.from, insert: s.insert ?? '', i }))
      .map((c) => (c.from > c.to ? { ...c, from: c.to, to: c.from } : c))
      .sort((a, b) => a.from - b.from || a.i - b.i)
    const out: Change[] = []
    for (const c of sorted) {
      if (c.from < 0 || c.to > length) throw new RangeError(`change ${c.from}..${c.to} outside a document of ${length}`)
      if (c.from === c.to && c.insert === '') continue
      const prev = out[out.length - 1]
      if (prev && c.from < prev.to) {
        out[out.length - 1] = { from: prev.from, to: Math.max(prev.to, c.to), insert: prev.insert + c.insert }
      } else out.push({ from: c.from, to: c.to, insert: c.insert })
    }
    return new ChangeSet(out, length)
  }

  get empty(): boolean {
    return this.changes.length === 0
  }

  /** Length of the document after the change. */
  get newLength(): number {
    let n = this.length
    for (const c of this.changes) n += c.insert.length - (c.to - c.from)
    return n
  }

  /** The document after the change. */
  apply(doc: Text): Text {
    if (doc.length !== this.length) throw new RangeError(`change set for length ${this.length} applied to a document of ${doc.length}`)
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const c = this.changes[i]!
      doc = doc.replace(c.from, c.to, c.insert)
    }
    return doc
  }

  /** The change that undoes this one. `doc` is the document before this change. */
  invert(doc: Text): ChangeSet {
    let delta = 0
    const out: Change[] = []
    for (const c of this.changes) {
      const from = c.from + delta
      out.push({ from, to: from + c.insert.length, insert: doc.slice(c.from, c.to) })
      delta += c.insert.length - (c.to - c.from)
    }
    return new ChangeSet(out, this.newLength)
  }

  /**
   * Where a position in the old document ends up. A position inside a replaced range moves to its end when assoc is 1
   * (or to its start when -1); at an insertion point, assoc picks the side.
   */
  mapPos(pos: number, assoc: Assoc = -1): number {
    let delta = 0
    for (const c of this.changes) {
      if (pos < c.from) break
      if (pos > c.to || (pos === c.to && c.from !== c.to)) {
        delta += c.insert.length - (c.to - c.from)
        continue
      }
      // pos is inside c, or at the insertion point of a pure insert.
      if (pos === c.from && c.from === c.to) return assoc < 0 ? pos + delta : pos + delta + c.insert.length
      return assoc < 0 ? c.from + delta : c.from + delta + c.insert.length
    }
    return pos + delta
  }

  /**
   * This change followed by `next` (which applies to this change's result), as one change on this change's input.
   * History uses it to merge typing into one undo step.
   */
  compose(next: ChangeSet): ChangeSet {
    if (next.length !== this.newLength) throw new RangeError(`can't compose: lengths ${this.newLength} and ${next.length} differ`)
    const a = toOps(this)
    const b = toOps(next)
    const out: Op[] = []
    const push = (op: Op) => {
      const last = out[out.length - 1]
      if (last && typeof op === 'number' && typeof last === 'number' && op > 0 && last > 0) out[out.length - 1] = last + op
      else if (last && typeof op === 'number' && typeof last === 'number' && op < 0 && last < 0) out[out.length - 1] = last + op
      else if (last && typeof op === 'string' && typeof last === 'string') out[out.length - 1] = last + op
      else out.push(op)
    }
    let i = 0
    let j = 0
    let x: Op | undefined = a[i++]
    let y: Op | undefined = b[j++]
    while (x !== undefined || y !== undefined) {
      if (typeof x === 'number' && x < 0) {
        push(x)
        x = a[i++]
        continue
      }
      if (typeof y === 'string') {
        push(y)
        y = b[j++]
        continue
      }
      if (x === undefined || y === undefined) throw new Error('compose: ran out of operations')
      if (typeof x === 'number' && typeof y === 'number' && y > 0) {
        // retain, retain
        const n = Math.min(x, y)
        push(n)
        x = x > n ? x - n : a[i++]
        y = y > n ? y - n : b[j++]
      } else if (typeof x === 'string' && typeof y === 'number' && y < 0) {
        // insert, then delete: they cancel
        const n = Math.min(x.length, -y)
        x = x.length > n ? x.slice(n) : a[i++]
        y = -y > n ? y + n : b[j++]
      } else if (typeof x === 'string' && typeof y === 'number') {
        // insert, then retain
        const n = Math.min(x.length, y)
        push(x.slice(0, n))
        x = x.length > n ? x.slice(n) : a[i++]
        y = y > n ? y - n : b[j++]
      } else if (typeof x === 'number' && typeof y === 'number') {
        // retain, then delete
        const n = Math.min(x, -y)
        push(-n)
        x = x > n ? x - n : a[i++]
        y = -y > n ? y + n : b[j++]
      }
    }
    return fromOps(out, this.length)
  }

  /** Whether the change touches the range from..to of the old document. */
  touches(from: number, to = from): boolean {
    for (const c of this.changes) if (c.from <= to && c.to >= from) return true
    return false
  }

  /** @internal */
  static fromChanges(changes: Change[], length: number): ChangeSet {
    return new ChangeSet(changes, length)
  }

  /** The changes in new-document positions: where each edit's inserted text now sits. */
  *inserted(): Generator<{ from: number; to: number; oldFrom: number; oldTo: number }> {
    let delta = 0
    for (const c of this.changes) {
      yield { from: c.from + delta, to: c.from + delta + c.insert.length, oldFrom: c.from, oldTo: c.to }
      delta += c.insert.length - (c.to - c.from)
    }
  }
}

/** An operation over a document: a positive number keeps that many characters, a negative one deletes, a string inserts. */
type Op = number | string

function toOps(set: ChangeSet): Op[] {
  const ops: Op[] = []
  let pos = 0
  for (const c of set.changes) {
    if (c.from > pos) ops.push(c.from - pos)
    if (c.to > c.from) ops.push(-(c.to - c.from))
    if (c.insert) ops.push(c.insert)
    pos = c.to
  }
  if (set.length > pos) ops.push(set.length - pos)
  return ops
}

function fromOps(ops: Op[], length: number): ChangeSet {
  const changes: Change[] = []
  let pos = 0
  let current: { from: number; to: number; insert: string } | undefined
  for (const op of ops) {
    if (typeof op === 'number' && op > 0) {
      if (current) changes.push(current)
      current = undefined
      pos += op
    } else if (typeof op === 'number') {
      current ??= { from: pos, to: pos, insert: '' }
      current.to += -op
      pos += -op
    } else {
      current ??= { from: pos, to: pos, insert: '' }
      current.insert += op
    }
  }
  if (current) changes.push(current)
  return ChangeSet.fromChanges(changes, length)
}
