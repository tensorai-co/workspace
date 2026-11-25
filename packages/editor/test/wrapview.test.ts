import { languageById } from '@tensorai-co/workspace/languages'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cursorDown, cursorUp, EditorState, EditorView, insertText } from '../src/index.js'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

let view: EditorView | undefined
afterEach(() => {
  view?.destroy()
  view = undefined
})

const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)))
const settle = async () => {
  for (let i = 0; i < 3; i++) await frame()
}

/** A view of plain text. jsdom has no layout, so the editor is given a width: 20 columns of text after the gutter. */
function open(doc: string, { wrap = false, language = 'plaintext', cursor = 0 } = {}) {
  const parent = document.createElement('div')
  document.body.append(parent)
  const made = new EditorView({ parent, state: EditorState.create({ doc, selection: cursor, language: languageById(language) }), wordWrap: wrap })
  Object.defineProperty(made.dom, 'clientWidth', { value: 66 + 14 + 2 + 7.2 * 20 + 1 })
  view = made
  const lines = () => [...made.dom.querySelectorAll<HTMLElement>('.ws-lines > .ws-line')].sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top))
  const numbers = () => [...made.dom.querySelectorAll<HTMLElement>('.ws-line-number')].sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top)).map((n) => `${n.textContent}@${n.style.top}`)
  const at = () => {
    const h = made.state.selection.main.head
    const l = made.state.doc.lineAt(h)
    return `${l.number}:${h - l.from}`
  }
  return { view: made, lines, numbers, at }
}

describe('word wrap', () => {
  it('wraps a long line into rows that push the next line down', async () => {
    const t = open('const total = items.reduce((sum, item) => sum + 1)\nnext', { wrap: true })
    await settle()
    const [first, second] = t.lines()
    expect([...first!.querySelectorAll('.ws-row')].map((r) => r.textContent)).toEqual(['const total = items.', 'reduce((sum, item) ', '=> sum + 1)'])
    expect(first!.style.height).toBe('54px')
    expect(second!.style.top).toBe('54px')
    // Only the first row has a number.
    expect(t.numbers()).toEqual(['1@0px', '2@54px'])
  })

  it('moves the cursor up and down by rows, keeping its column', async () => {
    const t = open('aaaa bbbb cccc dddd eeee ffff gggg\nshort', { wrap: true, cursor: 2 })
    await settle()
    t.view.run(cursorDown)
    expect(t.at()).toBe('1:22')
    t.view.run(cursorDown)
    expect(t.at()).toBe('2:2')
    t.view.run(cursorUp)
    t.view.run(cursorUp)
    expect(t.at()).toBe('1:2')
  })

  it('wraps again as the text changes, and turns off', async () => {
    const t = open('short\nx', { wrap: true, cursor: 5 })
    await settle()
    expect(t.lines()[1]!.style.top).toBe('18px')
    t.view.run(insertText(' and now much longer than twenty'))
    await settle()
    expect(t.lines()[1]!.style.top).toBe('36px')
    t.view.setWordWrap(false)
    await settle()
    expect(t.lines()[1]!.style.top).toBe('18px')
    expect(t.view.dom.querySelectorAll('.ws-row')).toHaveLength(0)
  })
})

describe('folding', () => {
  const code = ['function f() {', '    if (x) {', '        y()', '    }', '    z()', '}', 'done'].join('\n')

  it('shows a chevron for each region, and folds one to its first line with "⋯" after it', async () => {
    const t = open(code, { language: 'typescript' })
    await settle()
    expect([...t.view.dom.querySelectorAll<HTMLElement>('.ws-fold')].map((f) => f.dataset.line)).toEqual(['1', '2'])
    expect(t.view.fold(1)).toBe(true)
    await settle()
    expect(t.numbers()).toEqual(['1@0px', '6@18px', '7@36px'])
    expect(t.view.dom.querySelector('.ws-fold-placeholder')!.textContent).toBe('⋯')
    expect(t.view.dom.querySelectorAll('.ws-folded-line')).toHaveLength(1)
    expect(t.view.dom.querySelector('.ws-fold.ws-folded')!.getAttribute('data-line')).toBe('1')
    // Down from the folded line goes past what it hides.
    t.view.run(cursorDown)
    expect(t.at()).toBe('6:0')
  })

  it('folds and unfolds from the chevron, the "⋯", and the keys', async () => {
    const t = open(code, { language: 'typescript', cursor: 20 })
    await settle()
    const chevron = () => t.view.dom.querySelector<HTMLElement>('.ws-fold[data-line="2"]')!
    chevron().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    expect(t.view.foldedLines).toEqual([2])
    await settle()
    t.view.dom.querySelector('.ws-fold-placeholder')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    expect(t.view.foldedLines).toEqual([])
    t.view.foldAll()
    expect(t.view.foldedLines).toEqual([1, 2])
    t.view.unfoldAll()
    expect(t.view.foldedLines).toEqual([])
    expect(t.view.toggleFold(2)).toBe(true)
    expect(t.view.toggleFold(2)).toBe(true)
    expect(t.view.foldedLines).toEqual([])
  })

  it('moves a cursor out of what folds, and unfolds when the cursor goes in', async () => {
    const t = open(code, { language: 'typescript' })
    t.view.dispatch({ selection: { anchor: t.view.state.doc.line(3).from + 4 } })
    t.view.fold(2)
    expect(t.view.foldedLines).toEqual([2])
    expect(t.at()).toBe('2:4')
    t.view.dispatch({ selection: { anchor: t.view.state.doc.line(3).from } })
    expect(t.view.foldedLines).toEqual([])
  })
})
