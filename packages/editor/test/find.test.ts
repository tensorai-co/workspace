import { languageById } from '@tensorai-co/workspace/languages'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { EditorState, EditorView, isMac } from '../src/index.js'

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
const mod = (init: KeyboardEventInit = {}): KeyboardEventInit => (isMac ? { metaKey: true, ...init } : { ctrlKey: true, ...init })

function open(doc: string, cursor = 0) {
  const parent = document.createElement('div')
  document.body.append(parent)
  const made = new EditorView({ parent, state: EditorState.create({ doc, selection: cursor, language: languageById('plaintext') }) })
  view = made
  const editorInput = made.dom.querySelector<HTMLTextAreaElement>('textarea.ws-input')!
  const widget = made.dom.querySelector<HTMLElement>('.ws-find')!
  const [findBox, replaceBox] = [...widget.querySelectorAll<HTMLTextAreaElement>('.ws-find-text')]
  const key = (target: HTMLElement, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
  const type = (box: HTMLTextAreaElement, text: string) => {
    box.value = text
    box.dispatchEvent(new Event('input'))
  }
  const selected = () => made.state.sliceDoc(made.state.selection.main.from, made.state.selection.main.to) + '@' + made.state.selection.main.from
  return { view: made, editorInput, widget, findBox: findBox!, replaceBox: replaceBox!, key, type, selected, count: () => widget.querySelector('.ws-find-count')!.textContent }
}

describe('find widget', () => {
  it('opens on ⌘F with the word at the cursor, finds as you type, and goes through matches', async () => {
    const t = open('one two one\nthree one', 0)
    t.key(t.editorInput, mod({ key: 'f', code: 'KeyF' }))
    expect(t.view.find.isOpen).toBe(true)
    expect(t.widget.classList).toContain('ws-visible')
    expect(document.activeElement).toBe(t.findBox)
    expect(t.findBox.value).toBe('one')
    expect(t.count()).toBe('? of 3')
    t.type(t.findBox, 'one')
    expect(t.selected()).toBe('one@0')
    expect(t.count()).toBe('1 of 3')
    await settle()
    expect(t.view.dom.querySelectorAll('.ws-find-match')).toHaveLength(3)
    expect(t.view.dom.querySelectorAll('.ws-find-match.ws-current')).toHaveLength(1)
    t.key(t.findBox, { key: 'Enter' })
    expect(t.selected()).toBe('one@8')
    t.key(t.findBox, { key: 'Enter' })
    t.key(t.findBox, { key: 'Enter' })
    expect(t.selected()).toBe('one@0')
    t.key(t.findBox, { key: 'Enter', shiftKey: true })
    expect(t.selected()).toBe('one@18')
    expect(t.count()).toBe('3 of 3')
  })

  it('says when nothing matches or the expression is wrong, and turns options on and off', async () => {
    const t = open('Alpha alpha alphabet')
    t.view.find.open()
    t.type(t.findBox, 'zzz')
    expect(t.count()).toBe('No results')
    expect(t.widget.classList).toContain('ws-no-results')
    t.type(t.findBox, 'alpha')
    expect(t.count()).toBe('1 of 3')
    const option = (name: string) => t.widget.querySelector<HTMLElement>(`[aria-label^="${name}"]`)!
    option('Match Case').click()
    expect(t.count()).toMatch(/of 2$/)
    expect(option('Match Case').getAttribute('aria-checked')).toBe('true')
    // ⌥⌘W, from the box.
    t.key(t.findBox, isMac ? { key: '∑', code: 'KeyW', metaKey: true, altKey: true } : { key: 'w', code: 'KeyW', altKey: true })
    expect(t.count()).toMatch(/of 1$/)
    option('Use Regular Expression').click()
    t.type(t.findBox, '(')
    expect(t.findBox.parentElement!.classList).toContain('ws-error')
    expect(t.count()).toBe('No results')
  })

  it('replaces one at a time, then all as one undo step, and keeps case when asked', () => {
    const t = open('Foo foo FOO bar')
    t.key(t.editorInput, isMac ? { key: 'ƒ', code: 'KeyF', metaKey: true, altKey: true } : { key: 'h', code: 'KeyH', ctrlKey: true })
    expect(t.widget.classList).toContain('ws-replacing')
    expect(document.activeElement).toBe(t.replaceBox)
    t.type(t.findBox, 'foo')
    t.type(t.replaceBox, 'baz')
    t.widget.querySelector<HTMLElement>('[aria-label^="Preserve Case"]')!.click()
    t.key(t.replaceBox, { key: 'Enter' })
    expect(t.view.state.doc.toString()).toBe('Baz foo FOO bar')
    expect(t.selected()).toBe('foo@4')
    t.key(t.replaceBox, mod({ key: 'Enter' }))
    expect(t.view.state.doc.toString()).toBe('Baz baz BAZ bar')
    expect(t.count()).toBe('No results')
    t.view.focus()
    t.key(t.editorInput, mod({ key: 'z', code: 'KeyZ' }))
    expect(t.view.state.doc.toString()).toBe('Baz foo FOO bar')
  })

  it('selects every match on ⌥Enter, searches only the selection when asked, and closes on Esc', async () => {
    const t = open('a x\na x\na x', 0)
    t.view.dispatch({ selection: { anchor: 4, head: 11 } })
    t.view.find.open()
    t.type(t.findBox, 'a')
    expect(t.count()).toMatch(/of 3$/)
    t.view.dispatch({ selection: { anchor: 4, head: 11 } })
    t.widget.querySelector<HTMLElement>('[aria-label^="Find in Selection"]')!.click()
    expect(t.count()).toMatch(/of 2$/)
    await settle()
    expect(t.view.dom.querySelectorAll('.ws-find-scope')).toHaveLength(2)
    t.key(t.findBox, { key: 'Enter', altKey: true })
    expect(t.view.state.selection.ranges).toHaveLength(2)
    expect(document.activeElement).toBe(t.editorInput)
    t.key(t.editorInput, { key: 'Escape' })
    expect(t.view.find.isOpen).toBe(false)
    expect(t.widget.getAttribute('aria-hidden')).toBe('true')
    await settle()
    expect(t.view.dom.querySelectorAll('.ws-find-match')).toHaveLength(0)
  })

  it('finds the next use of the selected word with ⌘G while closed', () => {
    const t = open('cat dog cat dog', 4)
    // From a bare cursor at its start, the word itself comes first.
    t.key(t.editorInput, mod({ key: 'g', code: 'KeyG' }))
    expect(t.view.find.isOpen).toBe(false)
    expect(t.selected()).toBe('dog@4')
    t.key(t.editorInput, mod({ key: 'g', code: 'KeyG' }))
    expect(t.selected()).toBe('dog@12')
    t.key(t.editorInput, mod({ key: 'g', code: 'KeyG', shiftKey: true }))
    expect(t.selected()).toBe('dog@4')
  })

  it('makes room for itself in a narrow editor does', () => {
    const t = open('x')
    t.view.find.layout(800)
    expect(t.widget.style.maxWidth).toBe('757px')
    expect(t.widget.classList).not.toContain('ws-reduced')
    t.view.find.layout(440)
    expect(t.widget.classList).toContain('ws-reduced')
    expect(t.widget.classList).not.toContain('ws-narrow')
    t.view.find.layout(370)
    expect(t.widget.classList).toContain('ws-narrow')
    t.view.find.layout(300)
    expect(t.widget.classList).toContain('ws-collapsed')
  })
})
