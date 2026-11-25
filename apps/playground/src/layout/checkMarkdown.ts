import { all, box, css, find, inset, round, settle, type Check } from './measure'
import * as ref from './reference'

/** The Markdown preview. `mark` moves the editor's line. */
export async function checkMarkdown(is: Check, mark: (line: number) => void): Promise<void> {
  const body = find('#check-markdown .ws-markdown-body')
  is('preview: padding', css(body).padding, ref.preview.padding)
  const outer = find('.ws-markdown', find('#check-markdown'))
  is('preview: background', css(outer).backgroundColor, 'rgb(255, 255, 255)')

  // Every element, in order. Colored runs of code, icons and buttons aren't in the list.
  const elements = all('*', body).filter((el) => !el.closest('svg, button') && !(el.tagName === 'SPAN' && el.closest('code')))
  const boxes = ref.preview.boxes.split('\n')
  is('preview: elements', elements.length, boxes.length)
  const padding = [52, 14]
  elements.forEach((el, i) => {
    const [tag, ...want] = (boxes[i] ?? '').split(' ')
    const [left, top, width, height] = box(el, body)
    const actual = [round(left! - padding[0]!), round(top! - padding[1]!), width!, height!]
    // Text widths are measured to a hundredth, and runs of colored code round differently.
    const close = el.tagName.toLowerCase() === tag && actual.every((n, j) => Math.abs(n - Number(want[j])) <= 0.03)
    is(`preview: ${i} ${el.tagName.toLowerCase()} “${el.textContent?.trim().slice(0, 16)}”`, close ? boxes[i] : `${el.tagName.toLowerCase()} ${actual.join(' ')}`, boxes[i])
  })
  for (const [selector, want] of Object.entries(ref.preview.styles)) {
    const el = selector === 'pre code' || selector.startsWith('.') ? find(selector, body) : all(selector, body).find((e) => !e.closest('.ws-md-front') && (selector === 'a code' || !e.parentElement?.closest('a, pre')))!
    const c = css(el)
    is(`preview: ${selector}`, [c.color, c.backgroundColor, c.fontSize, c.fontWeight, c.lineHeight, c.padding, c.margin, c.borderWidth, c.borderColor, c.borderRadius, c.textAlign, c.boxShadow].join(' | '), want)
  }
  const copy = find('.ws-md-copy', body)
  const [, top, right, height] = inset(copy, copy.parentElement!)
  is('preview: copy button', [right, top, copy.offsetWidth, height], ref.preview.copy)
  is('preview: copy button’s style', `${css(copy).color} ${css(copy).backgroundColor} ${css(copy).borderTopWidth} ${css(copy).borderTopColor} ${css(copy).borderRadius} ${css(copy).opacity}`, ref.preview.copyStyle)

  const marked = async (line: number) => {
    mark(line)
    await settle()
    const el = find('[data-active]', body)
    const c = getComputedStyle(el, '::before')
    return [el.tagName, `${c.left} ${c.borderLeftWidth} ${c.borderLeftColor}`] as const
  }
  const [tag, style] = await marked(9)
  is('preview: mark of a paragraph', `${tag} ${style}`, `P ${ref.preview.mark}`)
  const [tag2, style2] = await marked(14)
  is('preview: mark of a list item', `${tag2} ${style2}`, `LI ${ref.preview.itemMark}`)
  mark(9)
}
