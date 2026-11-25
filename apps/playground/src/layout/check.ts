import type { ExplorerModel } from '@tensorai-co/workspace/explorer'
import type { Terminals } from '@tensorai-co/workspace/terminal'
import { checkFind } from './checkFind'
import { checkFold } from './checkFold'
import { checkLanguages } from './checkLanguages'
import { checkMarkdown } from './checkMarkdown'
import { checkTabs } from './checkTabs'
import { checkTerminal } from './checkTerminal'
import { checkWorkspace } from './checkWorkspace'
import { all, border, box, css, find, inset, outline, round, settle, textBox, type Check, type Result } from './measure'
import * as ref from './reference'

/** Puts the explorer in each state the reference was measured in, and compares. */
export async function check(model: ExplorerModel, terminals: Terminals, mark: (line: number) => void): Promise<Result[]> {
  const results: Result[] = []
  const is: Check = (what, actual, expected) => void results.push({ what, actual: String(actual), expected: String(expected), ok: String(actual) === String(expected) })
  const tree = find('[role=tree]')
  const rowEls = () => all('[role=treeitem]').sort((a, b) => a.offsetTop - b.offsetTop)
  const row = (i: number) => rowEls()[i]!
  const state = (what: string, el: Element, want: (typeof ref.states)[keyof typeof ref.states]) => {
    is(`${what}: background`, css(el).backgroundColor, want.bg)
    is(`${what}: outline`, outline(el), want.outline)
    const twistie = el.querySelector('.ws-expandable')
    if (twistie) is(`${what}: twistie color`, css(twistie).color, want.twistie)
  }

  // A file selected, with the focus in the tree.
  model.tree.select('/crates/ui/Cargo.toml')
  tree.focus()
  await settle()
  rowEls().forEach((el, i) => {
    const want = ref.rows[i]!
    const at = (what: string) => `${want.name} (row ${i + 1}): ${what}`
    is(at('row'), inset(el, tree), want.row)
    is(at('label'), textBox(find('.ws-tree-label', el), tree), want.label)
    if (want.twistie) is(at('twistie'), box(find('.ws-codicon', el), tree), want.twistie)
    if (want.icon) {
      const icon = find('.ws-file-icon', el)
      is(at('icon'), [...box(icon, tree), parseFloat(css(icon).marginRight)], want.icon)
      is(at('icon color'), css(icon).color, want.iconColor)
      is(at('icon glyph size'), find('svg', icon).getBoundingClientRect().width, 19.5)
    }
    is(at('guides'), all('.ws-tree-guide', el).map((g) => [...box(g, tree), css(g).opacity].join()).join(';'), want.guides)
    for (const g of all('.ws-active', el)) is(at('guide color'), `${css(g).borderLeftWidth} ${css(g).borderLeftColor}`, '1px rgb(169, 169, 169)')
    is(at('aria'), ['level', 'setsize', 'posinset', 'expanded', 'selected'].map((k) => el.getAttribute(`aria-${k}`)).join(), want.aria)
    const label = css(find('.ws-tree-label', el))
    is(at('text'), [label.fontSize, label.fontWeight, label.lineHeight, label.color, label.getPropertyValue('-webkit-font-smoothing'), label.whiteSpace, css(el).borderRadius], Object.values(ref.text))
    state(at('state'), el, i === 5 ? ref.states.focusedAndSelected : ref.states.plain)
  })

  const ink = (icon: Element) => {
    const [left = 0, top = 0, width = 0, height = 0] = box(find('path', icon), icon)
    return [left, top, left + width, top + height].map((n) => n.toFixed(1))
  }
  is('README.md icon: ink', ink(find('.ws-file-icon', row(15))), ref.ink['README.md'])
  is('Cargo.lock icon: ink', ink(find('.ws-file-icon', row(12))), ref.ink['Cargo.lock'])
  is('open chevron: ink', ink(find('.ws-codicon', row(0))), ref.ink.chevron)

  // The focus moved on.
  model.tree.moveFocus(1)
  await settle()
  state('selected, focus elsewhere', row(5), ref.states.selected)
  state('focused', row(6), ref.states.focused)

  // A folder selected, with and without the focus in the tree.
  model.tree.select('/crates/ui-build')
  await settle()
  state('folder focused and selected', row(6), ref.states.focusedAndSelected)
  tree.blur()
  await settle()
  state('folder selected, tree not focused', row(6), ref.states.selectedInactive)

  const header = find('.ws-explorer-header')
  const explorer = find('.ws-explorer')
  is('header', inset(header, explorer), ref.header.box)
  is('header: radius', css(header).borderRadius, ref.header.radius)
  is('header: background', css(header).backgroundColor, ref.header.background)
  is('header: twistie', box(find('.ws-explorer-twistie'), explorer).slice(0, 2), ref.header.twistie)
  is('header: twistie color', css(find('.ws-explorer-twistie')).color, ref.header.twistieColor)
  const title = find('.ws-explorer-title')
  is('header: title', box(title, explorer).slice(0, 2), ref.header.title)
  is('header: title font', `${css(title).fontSize} ${css(title).fontWeight} ${css(title).lineHeight} ${css(title).color}`, ref.header.titleFont)
  tree.focus()
  is('header: actions', all('.ws-explorer-action').map((a) => [inset(a, explorer)[1], inset(a, explorer)[2], a.offsetWidth, a.offsetHeight].join()).join(';'), ref.header.actions)
  is('list top', box(tree, explorer)[1], ref.header.listTop)

  // Renaming ui-build.
  model.startRename('/crates/ui-build')
  await settle()
  const edit = find('.ws-tree-edit')
  const input = find('input', edit) as HTMLInputElement
  is('rename: box', box(edit, row(6)), ref.edit.box)
  is('rename: input', box(input, row(6)), ref.edit.input)
  is('rename: border', border(edit), ref.edit.border)
  is('rename: outline', outline(edit), ref.edit.outline)
  is('rename: radius', css(edit).borderRadius, ref.edit.radius)
  is('rename: background', css(edit).backgroundColor, ref.edit.background)
  is('rename: font', css(input).fontSize, ref.edit.font)
  is('rename: selection', [input.selectionStart, input.selectionEnd], ref.edit.selection)
  state('row being renamed', row(6), ref.states.selectedInactive)
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  set.call(input, '/ui-build')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await settle()
  const message = find('.ws-tree-message')
  is('bad name: position', box(message, edit).slice(0, 2), [ref.message.left, ref.message.top])
  is('bad name: width', message.offsetWidth, edit.offsetWidth)
  is('bad name: padding', css(message).padding, ref.message.padding)
  is('bad name: font', `${css(message).fontSize} ${css(message).lineHeight}`, ref.message.font)
  is('bad name: border', border(message), ref.message.border)
  is('bad name: colors', `${css(message).backgroundColor} ${css(message).color}`, `${ref.message.background} ${ref.message.color}`)
  is('bad name: radius', css(message).borderRadius, ref.message.radius)
  is('bad name: box', `${border(edit)} ${outline(edit)}`, `${ref.message.boxBorder} ${ref.message.boxOutline}`)
  model.cancelEdit()
  await settle()

  // The context menu.
  const rightClick = () => row(13).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 60, clientY: 120 }))
  rightClick()
  await settle()
  state('menu open on a row', row(13), ref.states.menuOpen)
  const menu = find('.ws-menu')
  const items = all('.ws-menu-item', menu)
  is('menu: border', border(menu), ref.menu.border)
  is('menu: radius', css(menu).borderRadius, ref.menu.radius)
  is('menu: background', css(menu).backgroundColor, ref.menu.background)
  is('menu: shadow', css(menu).boxShadow, ref.menu.shadow)
  is('menu: font', css(menu).fontSize, ref.menu.font)
  is('menu: first item', box(items[0]!, menu).slice(0, 2), ref.menu.firstItem)
  is('menu: item height', items[0]!.offsetHeight, ref.menu.itemHeight)
  is('menu: item radius', css(items[0]!).borderRadius, ref.menu.itemRadius)
  is('menu: label padding', css(find('.ws-menu-label', menu)).padding, ref.menu.labelPadding)
  is('menu: keys', css(find('.ws-menu-keys', menu)).opacity, ref.menu.keysOpacity)
  is('menu: step between groups', items[1]!.offsetTop - items[0]!.offsetTop, ref.menu.groupStep)
  is('menu: separator', getComputedStyle(all('.ws-menu-group', menu)[1]!, '::before').borderBottomColor, ref.menu.separator)
  menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
  await settle()
  is('menu: active item', `${css(items[0]!).backgroundColor} ${outline(items[0]!)}`, `${ref.menu.activeBackground} ${ref.menu.activeOutline}`)

  // The delete dialog, from the menu.
  items[items.length - 1]!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
  await settle()
  const dialog = find('.ws-dialog')
  const dialogTitle = find('.ws-dialog-title')
  const detail = find('.ws-dialog-detail')
  const [secondary, primary] = all('.ws-button', dialog)
  const dialogBox = dialog.getBoundingClientRect()
  is('dialog: width', dialog.offsetWidth, ref.dialog.width)
  is('dialog: border', border(dialog), ref.dialog.border)
  is('dialog: radius', css(dialog).borderRadius, ref.dialog.radius)
  is('dialog: background', css(dialog).backgroundColor, ref.dialog.background)
  is('dialog: shadow', css(dialog).boxShadow, ref.dialog.shadow)
  is('dialog: close button', box(find('.ws-dialog-close'), dialog), ref.dialog.close)
  is('dialog: icon', box(find('.ws-dialog-icon'), dialog), ref.dialog.icon)
  is('dialog: title', box(dialogTitle, dialog).slice(0, 3), ref.dialog.title)
  is('dialog: title font', `${css(dialogTitle).fontSize} ${css(dialogTitle).fontWeight} ${css(dialogTitle).lineHeight}`, ref.dialog.titleFont)
  is('dialog: detail', box(detail, dialog).slice(0, 3), ref.dialog.detail)
  is('dialog: detail font', `${css(detail).fontSize} ${css(detail).lineHeight} ${css(detail).color}`, ref.dialog.detailFont)
  is('dialog: button', `${css(primary!).fontSize} ${css(primary!).lineHeight} ${css(primary!).padding} ${css(primary!).borderRadius}`, ref.dialog.button)
  is('dialog: button height', primary!.offsetHeight, ref.dialog.buttonHeight)
  is('dialog: last button', round(dialogBox.right - primary!.getBoundingClientRect().right), ref.dialog.lastButtonRight)
  is('dialog: bottom', round(dialogBox.bottom - primary!.getBoundingClientRect().bottom), ref.dialog.bottom)
  is('dialog: focused button', `${css(primary!).backgroundColor} ${css(primary!).color} ${css(primary!).outlineWidth} ${css(primary!).outlineColor} ${css(primary!).outlineOffset}`, ref.dialog.primary)
  is('dialog: other button', `${css(secondary!).backgroundColor} ${css(secondary!).color}`, ref.dialog.secondary)
  secondary!.click()
  await settle()
  model.tree.select('/crates/ui/Cargo.toml')
  await checkTabs(is)
  await checkTerminal(is, terminals)
  await checkMarkdown(is, mark)
  await checkWorkspace(is)
  await checkFind(is)
  await checkFold(is)
  await checkLanguages(is)
  return results
}
