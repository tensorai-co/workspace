import { paintLine, type Token } from '@tensorai-co/workspace/languages'
import type { Mark } from './overlay.js'

/** A stretch of a line that looks one way: its text, and the classes that color it. */
export interface Run {
  text: string
  className: string
}

/** How each kind of drawn text looks: ghost text in the token colors when there are tokens, else in its own color. */
const MARK_CLASS: Record<Mark['kind'], [string, string]> = {
  ghost: ['ws-ghost', 'ws-ghost ws-ghost-plain'],
  removed: ['ws-edit-removed', 'ws-edit-removed'],
  inserted: ['ws-edit-inserted', 'ws-edit-inserted'],
  fold: ['ws-fold-placeholder', 'ws-fold-placeholder'],
}

/** A line's text as runs of one look each: token colors, and marks for text that isn't in the document. */
export function runsFor(text: string, tokens: readonly Token[] | undefined, depth: number | undefined, marks: readonly Mark[] = []): Run[] {
  const runs = tokens ? paintLine(tokens, depth) : [{ text, className: '' }]
  const cuts = marks.flatMap((m) => [m.from, m.to])
  const out: Run[] = []
  let at = 0
  for (const run of runs) {
    const start = at
    const end = at + run.text.length
    at = end
    const points = [start, ...cuts.filter((c) => c > start && c < end).sort((a, b) => a - b), end]
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!
      const b = points[i + 1]!
      if (b <= a) continue
      const mark = marks.find((m) => a >= m.from && b <= m.to)
      out.push({ text: run.text.slice(a - start, b - start), className: [run.className, mark ? MARK_CLASS[mark.kind][tokens ? 0 : 1] : ''].filter(Boolean).join(' ') })
    }
  }
  return out
}

/** Appends the part of some runs between two offsets. */
export function appendRuns(el: HTMLElement, runs: readonly Run[], from = 0, to = Infinity): void {
  let at = 0
  for (const run of runs) {
    const start = at
    at += run.text.length
    const a = Math.max(from, start)
    const b = Math.min(to, at)
    if (b <= a) continue
    const piece = run.text.slice(a - start, b - start)
    if (!run.className) {
      el.appendChild(document.createTextNode(piece))
      continue
    }
    const span = document.createElement('span')
    span.className = run.className
    span.textContent = piece
    el.appendChild(span)
  }
}

/** Draws a line's text in its token colors, with marks for text that isn't in the document or that an edit removes. */
export function paint(el: HTMLElement, text: string, tokens: readonly Token[] | undefined, depth: number | undefined, marks: readonly Mark[] = []): void {
  appendRuns(el, runsFor(text, tokens, depth, marks))
}
