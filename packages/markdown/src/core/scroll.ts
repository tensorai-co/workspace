/** A drawn block: the source lines it came from (from 1) and where it is, in pixels from the content's top. */
export interface Placed {
  line: number
  /** The last line, for blocks that hold no other blocks. Lists, quotes and tables only mark where they start. */
  endLine?: number
  top: number
  bottom: number
  /** A fenced block's code: it starts a line below the block, and has padding of its own. */
  code?: { top: number; bottom: number; lines: number }
}

/**
 * Matches source lines to places in the drawn document. Both are fractions: line 3.5 is halfway down line 3. Between
 * blocks, and inside them, lines are spread evenly.
 */
export class ScrollMap {
  private readonly points: { line: number; offset: number }[]

  constructor(blocks: Placed[], lines: number, height: number) {
    const points = [{ line: 1, offset: 0 }]
    const add = (line: number, offset: number) => {
      const last = points[points.length - 1]!
      if (offset < last.offset) return
      if (line > last.line) points.push({ line, offset })
      // Where a block starts is better than where the one before it ends. The top of the text stays the top.
      else if (line === last.line && line > 1) last.offset = offset
    }
    for (const b of blocks) {
      add(b.line, b.top)
      if (b.code) {
        add(b.line + 1, b.code.top)
        add(b.line + 1 + b.code.lines, b.code.bottom)
      }
      if (b.endLine !== undefined) add(b.endLine + 1, b.bottom)
    }
    add(lines + 1, height)
    this.points = points
  }

  private between(from: 'line' | 'offset', to: 'line' | 'offset', value: number): number {
    const { points } = this
    let i = points.findIndex((p) => p[from] > value)
    if (i < 0) i = points.length
    const a = points[Math.max(0, i - 1)]!
    const b = points[i]
    if (!b || b[from] === a[from]) return a[to]
    return a[to] + ((b[to] - a[to]) * Math.max(0, value - a[from])) / (b[from] - a[from])
  }

  offsetOf(line: number): number {
    return this.between('line', 'offset', line)
  }

  lineAt(offset: number): number {
    return this.between('offset', 'line', offset)
  }
}

/** The block a source line is in: the first that starts on it, or the last that starts before it. */
export function blockOfLine<T extends { line: number }>(blocks: readonly T[], line: number): T | undefined {
  let previous: T | undefined
  for (const b of blocks) {
    if (b.line === line) return b
    if (b.line > line) return previous
    previous = b
  }
  return previous
}

/** Something that scrolls by source line: an editor's view, or a preview. */
export interface LineScroller {
  /** The line at the top, from 1. 3.5 is halfway down line 3. */
  readonly topLine: number
  scrollToLine(line: number): void
  /** Calls back on every scroll, its own and the user's. Returns a function that stops. */
  onScroll(listener: () => void): () => void
}

/** How long one side's scrolling counts as following the other. */
const ECHO_MS = 100

/** Scrolls two views of the same source together, starting from the first's place. Returns a function that stops. */
export function syncScroll(a: LineScroller, b: LineScroller, now: () => number = () => performance.now()): () => void {
  const quiet = new Map<LineScroller, number>()
  const follow = (from: LineScroller, to: LineScroller) => {
    if (now() < (quiet.get(from) ?? 0)) return
    quiet.set(to, now() + ECHO_MS)
    to.scrollToLine(from.topLine)
  }
  const stops = [a.onScroll(() => follow(a, b)), b.onScroll(() => follow(b, a))]
  follow(a, b)
  return () => stops.forEach((stop) => stop())
}
