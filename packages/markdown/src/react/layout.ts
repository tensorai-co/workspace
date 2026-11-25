import type { Placed } from '../core/scroll.js'

/** The blocks with a source line, in order: lists leave it to their first item. */
export function lineElements(body: HTMLElement): { line: number; el: HTMLElement }[] {
  return [...body.querySelectorAll<HTMLElement>('[data-line]')].filter((el) => !/^(?:UL|OL)$/.test(el.tagName)).map((el) => ({ line: Number(el.dataset.line), el }))
}

/** Where each block is. */
export function placeBlocks(body: HTMLElement, top: number): Placed[] {
  const out: Placed[] = []
  for (const { line, el } of lineElements(body)) {
    // Blocks in closed <details> aren't anywhere.
    if (!el.getClientRects().length) continue
    const fenced = el.tagName === 'CODE' ? el.parentElement : null
    const box = (fenced ?? el).getBoundingClientRect()
    const placed: Placed = { line, top: box.top - top, bottom: box.bottom - top }
    if (!el.querySelector('[data-line]') && el.dataset.endLine) placed.endLine = Number(el.dataset.endLine)
    if (fenced) {
      const code = el.getBoundingClientRect()
      const text = el.textContent ?? ''
      if (text) placed.code = { top: code.top - top, bottom: code.bottom - top, lines: text.split('\n').length }
    }
    out.push(placed)
  }
  return out
}
