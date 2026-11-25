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

/** Folding's chevrons, "⋯" and shading, against the reference. */
export async function checkFold(is: Check): Promise<void> {
  const parent = document.createElement('div')
  parent.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:300px;z-index:10'
  document.body.append(parent)
  const view = new EditorView({ parent, state: EditorState.create({ doc: CARGO, language: languageById('plaintext') }) })
  try {
    await settle()
    const f = ref.fold
    const editor = () => view.dom.getBoundingClientRect()
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return [r.left - editor().left, r.top - editor().top, r.width, r.height].map(round).join(',')
    }
    const chevron = () => parent.querySelector<HTMLElement>('.ws-fold[data-line="2"]')!
    is('fold: chevron', box(chevron()), f.chevron)
    is('fold: chevron look', `${getComputedStyle(chevron()).color} ${chevron().querySelector('svg')!.getBoundingClientRect().width}`, f.chevronLook)
    const unfolded = getComputedStyle(chevron()).opacity
    view.fold(2)
    await settle()
    await new Promise((r) => setTimeout(r, 600))
    is('fold: chevron shown', `${unfolded} ${getComputedStyle(chevron()).opacity}`, f.opacity)
    const numbers = [...parent.querySelectorAll<HTMLElement>('.ws-line-number')].sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top)).slice(0, 4)
    is('fold: lines', numbers.map((n) => n.textContent).join(','), f.numbers)
    const mark = parent.querySelector<HTMLElement>('.ws-fold-placeholder')!
    const m = mark.getBoundingClientRect()
    const margin = parseFloat(getComputedStyle(mark).marginLeft) + parseFloat(getComputedStyle(mark).marginRight)
    is('fold: ⋯', `${+(m.left - parseFloat(getComputedStyle(mark).marginLeft) - editor().left).toFixed(1)},${Math.round(m.width + margin)} ${getComputedStyle(mark).color} ${getComputedStyle(mark).fontSize}`, f.placeholder)
    const shade = parent.querySelector<HTMLElement>('.ws-folded-line')!
    const [left, top, , height] = box(shade).split(',')
    is('fold: shading', `${left},${top},${height} ${getComputedStyle(shade).backgroundColor}`, f.background)
  } finally {
    view.destroy()
    parent.remove()
  }
}
