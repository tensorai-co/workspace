// The document text: a persistent B-tree of lines.
//
// Lines are stored without their line break. A leaf holds up to LEAF lines; a branch up to BRANCH children. Every node
// knows its line count and its "span": its characters plus one for each line's break. The document's length is its span
// minus one (the last line has no break). Positions are UTF-16 offsets, as in the DOM and JavaScript strings.
//
// Nothing is ever changed in place. An edit copies only the nodes on the path to the lines it touches, so every old
// version stays valid and shares all the untouched lines with the new one: undo, background tokenizing and diffing
// keep old versions for almost nothing.

const LEAF = 64
const BRANCH = 32

/** One line of a document. */
export interface Line {
  /** 1-based line number. */
  readonly number: number
  /** Offset of the line's first character. */
  readonly from: number
  /** Offset just past the line's last character (before its line break). */
  readonly to: number
  readonly text: string
}

abstract class Node {
  abstract readonly lines: number
  abstract readonly span: number
  /** The line at 0-based index i, with the span offset of its start. */
  abstract lineByIndex(i: number, offset: number): { text: string; from: number }
  /** The line containing span offset pos (0 <= pos < span). */
  abstract lineByOffset(pos: number, index: number, offset: number): { text: string; from: number; index: number }
  abstract collect(from: number, to: number, out: string[]): void
  abstract replace(start: number, end: number, insert: string[]): Node[]
  abstract get depth(): number
}

class Leaf extends Node {
  readonly span: number
  constructor(readonly text: readonly string[]) {
    super()
    let span = 0
    for (const line of text) span += line.length + 1
    this.span = span
  }
  get lines(): number {
    return this.text.length
  }
  get depth(): number {
    return 0
  }
  lineByIndex(i: number, offset: number) {
    let from = offset
    for (let k = 0; k < i; k++) from += this.text[k]!.length + 1
    return { text: this.text[i]!, from }
  }
  lineByOffset(pos: number, index: number, offset: number) {
    let from = offset
    for (let k = 0; k < this.text.length; k++) {
      const end = from + this.text[k]!.length + 1
      if (pos < end || k === this.text.length - 1) return { text: this.text[k]!, from, index: index + k }
      from = end
    }
    throw new RangeError('offset outside leaf')
  }
  collect(from: number, to: number, out: string[]) {
    for (let k = from; k < to; k++) out.push(this.text[k]!)
  }
  /** Replaces lines [start, end) with insert. May return several leaves, or none. */
  replace(start: number, end: number, insert: string[]): Node[] {
    const lines = [...this.text.slice(0, start), ...insert, ...this.text.slice(end)]
    return leavesOf(lines)
  }
}

class Branch extends Node {
  readonly lines: number
  readonly span: number
  readonly depth: number
  constructor(readonly children: readonly Node[]) {
    super()
    let lines = 0
    let span = 0
    let depth = 0
    for (const c of children) {
      lines += c.lines
      span += c.span
      depth = Math.max(depth, c.depth + 1)
    }
    this.lines = lines
    this.span = span
    this.depth = depth
  }
  lineByIndex(i: number, offset: number) {
    for (const child of this.children) {
      if (i < child.lines) return child.lineByIndex(i, offset)
      i -= child.lines
      offset += child.span
    }
    throw new RangeError('line index outside branch')
  }
  lineByOffset(pos: number, index: number, offset: number) {
    for (let k = 0; k < this.children.length; k++) {
      const child = this.children[k]!
      if (pos < offset + child.span || k === this.children.length - 1) return child.lineByOffset(pos, index, offset)
      offset += child.span
      index += child.lines
    }
    throw new RangeError('offset outside branch')
  }
  collect(from: number, to: number, out: string[]) {
    let start = 0
    for (const child of this.children) {
      const end = start + child.lines
      if (end > from && start < to) child.collect(Math.max(0, from - start), Math.min(child.lines, to - start), out)
      if (end >= to) break
      start = end
    }
  }
  replace(start: number, end: number, insert: string[]): Node[] {
    // The children holding the first and the last replaced line. The range always covers at least one line.
    let first = -1
    let last = this.children.length - 1
    let firstStart = 0
    let lastStart = this.lines - this.children[last]!.lines
    let pos = 0
    for (let k = 0; k < this.children.length; k++) {
      const childEnd = pos + this.children[k]!.lines
      if (first < 0 && start < childEnd) {
        first = k
        firstStart = pos
      }
      if (end - 1 < childEnd) {
        last = k
        lastStart = pos
        break
      }
      pos = childEnd
    }
    if (first < 0) {
      first = last
      firstStart = lastStart
    }
    let middle: Node[]
    if (first === last) {
      middle = this.children[first]!.replace(start - firstStart, end - firstStart, insert)
    } else {
      // Keep the head of the first child and the tail of the last; everything between goes.
      const a = this.children[first]!
      const b = this.children[last]!
      const head: string[] = []
      a.collect(0, start - firstStart, head)
      const tail: string[] = []
      b.collect(end - lastStart, b.lines, tail)
      middle = leavesOf([...head, ...insert, ...tail])
    }
    const children = [...this.children.slice(0, first), ...middle, ...this.children.slice(last + 1)]
    return branchesOf(merged(children))
  }
}

/** Lines into leaves of at most LEAF lines. */
function leavesOf(lines: readonly string[]): Node[] {
  const out: Node[] = []
  for (let i = 0; i < lines.length; i += LEAF) out.push(new Leaf(lines.slice(i, i + LEAF)))
  return out
}

/** Joins neighboring small leaves, so a tree edited many times doesn't fill up with tiny leaves. */
function merged(children: Node[]): Node[] {
  const out: Node[] = []
  for (const child of children) {
    const prev = out[out.length - 1]
    if (prev instanceof Leaf && child instanceof Leaf && prev.lines + child.lines <= LEAF / 2) out[out.length - 1] = new Leaf([...prev.text, ...child.text])
    else out.push(child)
  }
  return out
}

/** Children into branches of at most BRANCH children. */
function branchesOf(children: Node[]): Node[] {
  if (children.length <= BRANCH) return [new Branch(children)]
  const out: Node[] = []
  for (let i = 0; i < children.length; i += BRANCH) out.push(new Branch(children.slice(i, i + BRANCH)))
  return out
}

/** Builds a balanced tree over nodes. */
function treeOf(nodes: Node[]): Node {
  while (nodes.length > 1) {
    const next: Node[] = []
    for (let i = 0; i < nodes.length; i += BRANCH) next.push(new Branch(nodes.slice(i, i + BRANCH)))
    nodes = next
  }
  return nodes[0] ?? new Leaf([''])
}

/** Splits text into lines on \n, \r\n and \r. */
export function splitLines(text: string): string[] {
  return text.split(/\r\n?|\n/)
}

/** An immutable document. */
export class Text {
  private constructor(private readonly root: Node) {}

  /** The empty document: one empty line. */
  static readonly empty = new Text(new Leaf(['']))

  /** A document from a string (any line endings) or from its lines. */
  static of(text: string | readonly string[]): Text {
    const lines = typeof text === 'string' ? splitLines(text) : text.length ? [...text] : ['']
    return new Text(treeOf(leavesOf(lines)))
  }

  /** Length in UTF-16 code units, with one per line break. */
  get length(): number {
    return this.root.span - 1
  }

  /** Number of lines; at least 1. */
  get lines(): number {
    return this.root.lines
  }

  /** Line by 1-based number. */
  line(n: number): Line {
    if (n < 1 || n > this.lines) throw new RangeError(`no line ${n} in a document of ${this.lines}`)
    const { text, from } = this.root.lineByIndex(n - 1, 0)
    return { number: n, from, to: from + text.length, text }
  }

  /** The line holding pos. A position at a line's end belongs to that line. */
  lineAt(pos: number): Line {
    if (pos < 0 || pos > this.length) throw new RangeError(`position ${pos} outside a document of ${this.length}`)
    const { text, from, index } = this.root.lineByOffset(pos, 0, 0)
    return { number: index + 1, from, to: from + text.length, text }
  }

  /** The text between from and to, with \n line breaks. */
  slice(from = 0, to = this.length): string {
    if (from > to) [from, to] = [to, from]
    if (from === to) return ''
    const a = this.lineAt(from)
    const b = this.lineAt(to)
    if (a.number === b.number) return a.text.slice(from - a.from, to - a.from)
    const parts: string[] = [a.text.slice(from - a.from)]
    if (b.number - a.number > 1) this.root.collect(a.number, b.number - 1, parts)
    parts.push(b.text.slice(0, to - b.from))
    return parts.join('\n')
  }

  /** Replaces from..to with insert. Returns a new document; this one is unchanged. */
  replace(from: number, to: number, insert: string): Text {
    if (from > to) [from, to] = [to, from]
    if (from < 0 || to > this.length) throw new RangeError(`range ${from}..${to} outside a document of ${this.length}`)
    const a = this.lineAt(from)
    const b = to === from ? a : this.lineAt(to)
    const lines = splitLines(a.text.slice(0, from - a.from) + insert + b.text.slice(to - b.from))
    const nodes = this.root.replace(a.number - 1, b.number, lines)
    return new Text(nodes.length === 1 && nodes[0]!.lines > 0 ? nodes[0]! : treeOf(nodes.length ? nodes : [new Leaf([''])]))
  }

  /** Lines from..to (1-based, inclusive), as strings. */
  lineTexts(from = 1, to = this.lines): string[] {
    const out: string[] = []
    this.root.collect(from - 1, to, out)
    return out
  }

  toString(): string {
    return this.lineTexts().join('\n')
  }

  /** Whether two documents hold the same text. */
  eq(other: Text): boolean {
    if (other === this) return true
    if (other.length !== this.length || other.lines !== this.lines) return false
    return this.toString() === other.toString()
  }

  /** Tree depth, for tests and diagnostics. */
  get depth(): number {
    return this.root.depth
  }
}

/** A document version, for consumers that must not depend on the live one (background work, AI providers). */
export type TextSnapshot = Text
