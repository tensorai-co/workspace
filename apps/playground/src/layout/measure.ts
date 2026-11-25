export interface Result {
  what: string
  expected: string
  actual: string
  ok: boolean
}

/** Adds a result. */
export type Check = (what: string, actual: unknown, expected: unknown) => void

export const round = (n: number) => +n.toFixed(2)
export const find = (selector: string, from: ParentNode | undefined = document) => {
  const el = from.querySelector<HTMLElement>(selector)
  if (!el) throw new Error(`nothing matches ${selector}`)
  return el
}
export const all = (selector: string, from: ParentNode = document) => [...from.querySelectorAll<HTMLElement>(selector)]
export const css = (el: Element) => getComputedStyle(el)
/** A box from another's corner: left, top, width, height. */
export const box = (el: Element | Range, from: Element) => {
  const a = el.getBoundingClientRect()
  const b = from.getBoundingClientRect()
  return [a.left - b.left, a.top - b.top, a.width, a.height].map(round)
}
/** The same, with the distance from the right in place of the width. */
export const inset = (el: Element, from: Element) => {
  const [left, top, , height] = box(el, from)
  return [left, top, round(from.getBoundingClientRect().right - el.getBoundingClientRect().right), height]
}
export const textBox = (el: Element, from: Element) => {
  const range = document.createRange()
  range.selectNodeContents(el)
  return box(range, from)
}
export const border = (el: Element) => `${css(el).borderTopWidth} ${css(el).borderTopColor}`
export const outline = (el: Element) => (css(el).outlineStyle === 'none' ? 'none' : `${css(el).outlineWidth} ${css(el).outlineColor} ${css(el).outlineOffset}`)

const frame = () => new Promise((r) => requestAnimationFrame(r))

/** Long enough for transitions to finish, and for what they wait on to be drawn, however slow frames are. */
export const settle = async () => {
  await frame()
  await new Promise((r) => setTimeout(r, 250))
  await frame()
  await frame()
}
