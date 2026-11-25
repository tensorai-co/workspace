import type { Terminals } from '@tensorai-co/workspace/terminal'
import * as ref from './reference'
import { all, border, box, css, find, round, settle, textBox, type Check } from './measure'

/** The terminal and the header over it. */
export async function checkTerminal(is: Check, terminals: Terminals): Promise<void> {
  const panel = find('#check-terminal')
  const terminal = find('.ws-terminal', panel)
  const { screen } = terminals.active!
  is('terminal: size', `${screen.cols}x${screen.rows}`, ref.terminal.size)
  is('terminal: cell', [css(terminal).getPropertyValue('--ws-cell-width'), css(terminal).getPropertyValue('--ws-cell-height')].map(parseFloat), ref.terminal.cell)
  is('terminal: cells', box(find('.ws-term-grid', terminal), terminal), ref.terminal.grid)
  is('terminal: background', css(terminal).backgroundColor, ref.terminal.background)
  is('terminal: font', `${css(terminal).fontSize} ${css(terminal).fontFamily.split(',')[0]}`, ref.terminal.font)

  screen.write(`\x1b[H\x1b[2J${Object.keys(ref.terminal.kept).map((name) => `\x1b[3${['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'].indexOf(name)}m${name}\x1b[0m `).join('')}plain`)
  await settle()
  const row = find('.ws-term-row', terminal)
  for (const [name, color] of Object.entries(ref.terminal.kept)) is(`terminal: ${name}`, css(all('span', row).find((s) => s.textContent === name)!).color, color)
  is('terminal: text', css(row).color, ref.terminal.foreground)
  // Every character is on the grid: a line's width is its length in cells.
  const word = all('span', row)[1]!
  const start = row.textContent!.indexOf(word.textContent!)
  is('terminal: a word’s place', textBox(word, row)[0], round(start * 7))

  const view = find('.ws-term-input', terminal)
  view.focus()
  await settle()
  const cursor = css(find('.ws-term-cursor', terminal))
  is('terminal: cursor', `${cursor.backgroundColor} ${cursor.color} ${cursor.width} ${cursor.height}`, `${ref.terminal.cursor} ${ref.terminal.cursorText} 7px 14px`)
  terminal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, detail: 2, clientX: row.getBoundingClientRect().left + 10, clientY: row.getBoundingClientRect().top + 5 }))
  document.dispatchEvent(new MouseEvent('mouseup'))
  await settle()
  is('terminal: selection', css(all('span', row)[0]!).backgroundColor, ref.terminal.selection)
  view.blur()
  await settle()
  is('terminal: cursor without the focus', border(find('.ws-term-cursor', terminal)), `1px ${ref.terminal.cursor}`)
  screen.write('\r\n'.repeat(40))
  await settle()
  const slider = css(find('.ws-term-slider', terminal))
  is('terminal: scrollbar', box(find('.ws-term-scrollbar', terminal), terminal), ref.terminal.scrollbar)
  is('terminal: slider', `${slider.borderRadius} ${slider.backgroundColor}`, `${ref.terminal.sliderRadius} ${ref.terminal.sliderColor}`)
  const badge = css(find('.ws-term-size', terminal))
  const want = ref.terminal.size_badge
  is('size badge', `${badge.padding} ${badge.borderRadius} ${badge.fontSize} ${badge.boxShadow} ${badge.borderTopWidth} ${badge.borderTopColor} ${badge.backgroundColor}`, `${want.padding} ${want.radius} ${want.font} ${want.shadow} ${want.border} ${want.background}`)

  const h = ref.terminal.header
  const header = find('.ws-terminal-header', panel)
  is('panel header', `${header.offsetHeight} ${css(header).backgroundColor} ${css(header).boxShadow}`, `${h.height} ${h.background} ${h.line}`)
  const tab = find('.ws-terminal-heading', header)
  const text = find('span', tab)
  const [left, , width] = box(tab, header)
  is('panel tab', [left, width], h.tab)
  const [x, y, , height] = box(text, header)
  is('panel tab: text', [x, y, height], h.text)
  is('panel tab: font', `${css(text).fontSize} ${css(text).fontWeight} ${css(text).lineHeight} ${css(text).color}`, h.font)
  const fill = find('i', tab)
  is('panel tab: fill', `${box(fill, header)} ${css(fill).borderRadius} ${css(fill).backgroundColor}`, h.fill)
  const s = getComputedStyle(fill, '::after')
  is('panel tab: shoulder', `${s.width} ${s.height} ${s.borderBottomWidth} ${s.borderBottomColor} ${s.borderRadius} ${s.boxShadow}`, h.shoulder)
  const buttons = all('.ws-terminal-action', header)
  for (const b of buttons) is('panel button', [b.offsetWidth, b.offsetHeight, box(b, header)[1]], h.button)
  const last = header.querySelector('.ws-terminal-actions')!.lastElementChild!
  is('panel: right end', round(header.getBoundingClientRect().right - last.getBoundingClientRect().right), h.buttonRight)
  is('panel: between buttons', round(buttons[1]!.getBoundingClientRect().left - buttons[0]!.getBoundingClientRect().right), h.gap)
  const single = find('.ws-terminal-single', header)
  is('panel: name', `${round(single.getBoundingClientRect().height)},${css(single).padding},${css(single).fontSize}`, h.single)
  const icon = find('.ws-codicon', single)
  is('panel: name’s icon', `${icon.offsetWidth},${css(icon).marginRight} ${css(icon).color}`, h.singleIcon)
  const line = find('.ws-terminal-separator', header)
  const lineBox = line.getBoundingClientRect()
  is('panel: separator', `${lineBox.width},${lineBox.height} ${css(line).backgroundColor}`, h.separator)
  is('panel: round the separator', [round(lineBox.left - buttons[2]!.getBoundingClientRect().right), round(last.getBoundingClientRect().left - lineBox.right)], h.separatorGaps)
}
