import { codicon, iconSvg } from '@tensorai-co/workspace/icons'
import { foldRanges, Folds, type FoldRange } from '../core/folding.js'
import type { EditorState } from '../core/state.js'

/** What folding needs from the view. */
export interface FoldHost {
  readonly state: EditorState
  requestRender(): void
  /** Folds changed: the view moves a cursor out of what they hide. */
  changed(): void
  destroyed(): boolean
}

/** The regions that can fold, for one version of the text. */
export interface FoldRanges {
  doc: unknown
  list: FoldRange[]
  /** The innermost region starting on each line, as there's one chevron there. */
  byStart: Map<number, FoldRange>
}

/** Files longer than this find their regions again only after typing pauses. */
const LARGE_FILE = 5000

/** Which regions can fold and which are folded, and the commands that fold them. */
export class Folding {
  readonly folds = new Folds()
  private ranges: FoldRanges = { doc: null, list: [], byStart: new Map() }
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly host: FoldHost) {}

  /**
   * The regions that can fold, found again when the text has changed. In a large file that waits for a pause in
   * typing, unless `now` asks for them as they are.
   */
  rangesNow(now = false): FoldRanges {
    const doc = this.host.state.doc
    if (this.ranges.doc !== doc && !now && doc.lines > LARGE_FILE && this.ranges.doc) {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        if (this.host.destroyed()) return
        this.rangesNow(true)
        this.host.requestRender()
      }, 300)
      return this.ranges
    }
    if (this.ranges.doc !== doc) {
      const { state } = this.host
      const list = foldRanges(doc, state.language.rules, state.tabSize)
      const byStart = new Map<number, FoldRange>()
      for (const r of list) if (!byStart.has(r.start) || byStart.get(r.start)!.end > r.end) byStart.set(r.start, r)
      this.ranges = { doc, list, byStart }
    }
    return this.ranges
  }

  /** The lines that start folded regions. */
  get foldedLines(): number[] {
    return this.folds.ranges(this.host.state.doc).map((r) => r.start)
  }

  /** Folds the innermost region at a line that isn't folded yet. Returns whether it did. */
  fold(line: number): boolean {
    const doc = this.host.state.doc
    const range = this.rangesNow(true)
      .list.filter((r) => r.start <= line && line <= r.end && !this.folds.isFolded(doc, r.start))
      .sort((a, b) => a.end - a.start - (b.end - b.start))[0]
    if (!range) return false
    this.folds.fold(doc, range)
    this.host.changed()
    return true
  }

  /** Unfolds the region at a line: the one it starts, or the innermost folded one it's in. Returns whether it did. */
  unfold(line: number): boolean {
    const doc = this.host.state.doc
    const folded = this.folds.ranges(doc).filter((r) => r.start <= line && line <= r.end)
    const range = folded.find((r) => r.start === line) ?? folded.sort((a, b) => a.end - a.start - (b.end - b.start))[0]
    if (!range || !this.folds.unfold(doc, range.start)) return false
    this.host.changed()
    return true
  }

  /** Folds the region at a line, or unfolds it when it's folded. */
  toggle(line: number): boolean {
    return this.folds.isFolded(this.host.state.doc, line) ? this.unfold(line) : this.fold(line)
  }

  foldAll(): void {
    const doc = this.host.state.doc
    for (const r of this.rangesNow(true).list) this.folds.fold(doc, r)
    this.host.changed()
  }

  unfoldAll(): void {
    this.folds.clear()
    this.host.changed()
  }

  destroy(): void {
    clearTimeout(this.timer)
  }
}

/** A line's chevron in the gutter: shown on hovering the gutter, and always for a folded region. */
export function renderChevron(holder: { fold?: HTMLDivElement; top: number }, gutter: HTMLElement, n: number, range: FoldRange | undefined, folded: boolean, left: number): void {
  if (!range) {
    holder.fold?.remove()
    holder.fold = undefined
    return
  }
  if (!holder.fold) {
    holder.fold = document.createElement('div')
    gutter.appendChild(holder.fold)
  }
  const chevron = holder.fold
  const className = `ws-fold ${folded ? 'ws-folded' : ''}`
  if (chevron.className !== className) {
    chevron.className = className
    chevron.innerHTML = iconSvg(codicon(folded ? 'chevron-right' : 'chevron-down'), 16)
    chevron.title = folded ? 'Unfold' : 'Fold'
  }
  chevron.dataset.line = String(n)
  chevron.style.top = `${holder.top}px`
  chevron.style.left = `${left}px`
}
