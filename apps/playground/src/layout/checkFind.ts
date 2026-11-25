import { EditorState, EditorView } from '@tensorai-workspace/editor'
import { languageById } from '@tensorai-workspace/languages'
import { round, settle, type Check } from './measure'
import * as ref from './reference'

const CARGO = `[workspace]
members = [
    "crates/ui",
    "crates/ui-build",
    "crates/ui-cef-sys",
    "crates/ui-pack",
    "examples/embedded-app",
]
default-members = ["crates/ui"]
resolver = "3"
`

/** The find widget and its matches, against the reference. */
export async function checkFind(is: Check): Promise<void> {
  const parent = document.createElement('div')
  parent.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:300px;z-index:10'
  document.body.append(parent)
  const view = new EditorView({ parent, state: EditorState.create({ doc: CARGO, language: languageById('plaintext') }) })
  try {
    view.focus()
    view.find.open()
    const w = parent.querySelector<HTMLElement>('.ws-find')!
    const find = w.querySelector<HTMLTextAreaElement>('.ws-find-text')!
    find.value = 'ui'
    find.dispatchEvent(new Event('input'))
    await settle()
    const f = ref.find
    const css = getComputedStyle
    const wb = () => w.getBoundingClientRect()
    const fromLeft = (el: Element) => {
      const r = el.getBoundingClientRect()
      return [r.left - wb().left, r.top - wb().top, r.width, r.height].map(round).join(',')
    }
    const fromRight = (el: Element) => {
      const r = el.getBoundingClientRect()
      return [wb().right - r.left, r.top - wb().top, r.width, r.height].map(round).join(',')
    }
    const editor = view.dom.getBoundingClientRect()
    is('find: place', [round(editor.right - wb().right), round(wb().top - editor.top), round(wb().height), round(wb().width)].join(','), [f.widget.right, f.widget.top, f.widget.height, f.widget.width].join(','))
    const c = css(w)
    is('find: look', `${c.backgroundColor} ${c.borderTopWidth} ${c.borderTopColor} ${c.borderRadius} ${c.boxShadow} ${c.padding}`, f.look)
    is('find: replace toggle', fromLeft(w.querySelector('.ws-find-toggle-replace')!), f.toggleReplace)
    const box = w.querySelector<HTMLElement>('.ws-find-input')!
    const [bl, bt, bw, bh] = fromLeft(box).split(',')
    is('find: box', `${bl},${bt},${bh}`, f.input.box)
    is('find: box width', bw, f.inputWidth)
    is('find: box look', `${css(box).backgroundColor} ${css(box).borderTopWidth} ${css(box).borderTopColor} ${css(box).borderRadius}`, f.input.look)
    const [tl, tt, , th] = fromLeft(find).split(',')
    is('find: text', `${tl},${tt},${th} ${css(find).fontSize} ${css(find).lineHeight} ${css(find).padding} ${css(find).color}`, f.input.text)
    is('find: focus', css(box).outline, f.input.focus)
    const options = [...w.querySelectorAll('.ws-find-part:not(.ws-replace-part) .ws-find-controls .ws-find-option')]
    is('find: options', options.map(fromRight).join(' '), f.options.join(' '))
    is('find: option look', `${css(options[0]!).borderRadius} ${css(options[0]!).color}`, f.optionLook)
    const count = w.querySelector<HTMLElement>('.ws-find-count')!
    is('find: count', fromRight(count), f.count.box)
    is('find: count text', `${css(count).fontSize} ${css(count).lineHeight} ${css(count).padding} ${css(count).color}`, f.count.text)
    const buttons = [...w.querySelectorAll('.ws-find-part:not(.ws-replace-part) .ws-find-actions > button')]
    is('find: buttons', buttons.map(fromRight).join(' '), f.buttons.join(' '))
    is('find: button look', `${css(buttons[0]!).borderRadius} ${css(buttons[0]!).color}`, f.buttonLook)
    is('find: close', fromRight(w.querySelector('.ws-find-close')!), f.close)

    const marks = [...parent.querySelectorAll<HTMLElement>('.ws-find-match')]
    const other = marks.find((m) => !m.classList.contains('ws-current'))!
    const current = marks.find((m) => m.classList.contains('ws-current'))!
    is('find: matches', `${css(other).backgroundColor} ${css(current).backgroundColor} ${round(other.getBoundingClientRect().height)}`, `${f.matches.other} ${f.matches.current} ${f.matches.height}`)

    options[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle()
    is('find: option on', `${css(options[0]!).backgroundColor} ${css(options[0]!).borderTopColor}`, f.checked)
    options[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    find.value = 'zzzq'
    find.dispatchEvent(new Event('input'))
    await settle()
    is('find: no results', `${count.textContent} ${css(count).color}`, f.count.none)

    view.find.open({ replace: true })
    await settle()
    is('find: replace height', round(wb().height), f.widget.replaceHeight)
    const part = w.querySelector('.ws-replace-part')!
    const [rl, rt, , rh] = fromLeft(part.querySelector('.ws-find-input')!).split(',')
    is('replace: box', `${rl},${rt},${rh}`, f.replace.input)
    is('replace: preserve case', fromRight(part.querySelector('.ws-find-option')!), f.replace.option)
    is('replace: buttons', [...part.querySelectorAll('.ws-find-actions > button')].map(fromRight).join(' '), f.replace.buttons.join(' '))
  } finally {
    view.destroy()
    parent.remove()
  }
}
