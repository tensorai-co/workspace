import type { InlineCompletionRequest } from '@tensorai-workspace/host'
import { languageById } from '@tensorai-workspace/languages'
import { ScriptedCompletionProvider, type ScriptedSuggestion } from '@tensorai-workspace/testing'
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
  for (let i = 0; i < 5; i++) await frame()
}

/** A view of plain text, so ghost text has no tokens and takes the ghost text color. */
function open(doc: string, cursor: number, suggest: (request: InlineCompletionRequest) => ScriptedSuggestion) {
  const parent = document.createElement('div')
  document.body.append(parent)
  const provider = new ScriptedCompletionProvider({ suggest })
  const made = new EditorView({ parent, state: EditorState.create({ doc, selection: cursor, language: languageById('plaintext') }), inlineCompletions: { provider, delay: 0 } })
  view = made
  const input = made.dom.querySelector('textarea')!
  const key = (init: KeyboardEventInit) => input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
  return { view: made, provider, input, key, ghost: () => [...made.dom.querySelectorAll('.ws-ghost')].map((e) => e.textContent).join('') }
}

describe('ghost text in the view', () => {
  it('draws a suggestion after the cursor, faded, and never puts it in the document', async () => {
    const t = open('let total = ', 12, () => 'items.length')
    t.key({ key: '\\', code: 'Backslash', altKey: true })
    await settle()
    expect(t.ghost()).toBe('items.length')
    expect(t.view.dom.querySelector('.ws-ghost')!.className).toContain('ws-ghost-plain')
    expect(t.view.dom.querySelector('.ws-line')!.textContent).toBe('let total = items.length')
    expect(t.view.state.doc.toString()).toBe('let total = ')
    expect(t.provider.requests[0]!.trigger).toBe('explicit')
  })

  it('draws the lines below the cursor’s as rows that push the code down, with the rest of the line after them', async () => {
    const t = open('if (x) {}\nnext', 8, () => '\n    go()\n')
    t.view.inlineCompletions!.trigger()
    await settle()
    const lines = [...t.view.dom.querySelectorAll<HTMLElement>('.ws-line')]
    // The line holds its rows: itself, the suggestion's line, and the rest of the line.
    expect([...lines[0]!.querySelectorAll('.ws-row')].map((r) => r.textContent)).toEqual(['if (x) {', '    go()', '}'])
    expect(lines[0]!.style.height).toBe('54px')
    expect(lines[1]!.style.top).toBe('54px')
    // No numbers for rows that aren't in the document.
    expect(t.view.dom.querySelectorAll('.ws-line-number')).toHaveLength(2)
  })

  it('takes Tab, Esc and the word key only while a suggestion shows', async () => {
    const t = open('a = ', 4, (r) => (r.position === 4 ? 'one two' : ' two'))
    t.key({ key: 'Tab' })
    expect(t.view.state.doc.toString()).toBe('a =     ')
    t.view.dispatch({ changes: { from: 4, to: 8, insert: '' } })
    t.view.inlineCompletions!.trigger()
    await settle()
    t.key(isMac ? { key: 'ArrowRight', metaKey: true } : { key: 'ArrowRight', ctrlKey: true })
    expect(t.view.state.doc.toString()).toBe('a = one')
    await settle()
    expect(t.ghost()).toBe(' two')
    t.key({ key: 'Escape' })
    await settle()
    expect(t.ghost()).toBe('')
    expect(t.provider.dismissed).toHaveLength(1)
    t.view.inlineCompletions!.trigger()
    await settle()
    t.key({ key: 'Tab' })
    expect(t.view.state.doc.toString()).toBe('a = one two')
    expect(t.provider.accepted.map((a) => a.part)).toEqual(['word', 'all'])
  })

  it('puts the suggestion away before a click, and when the editor loses the focus', async () => {
    const t = open('x\ny', 1, () => 'yz')
    t.view.inlineCompletions!.trigger()
    await settle()
    expect(t.ghost()).toBe('yz')
    t.view.dom.querySelector('.ws-content')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(t.view.inlineCompletions!.ghost).toBeUndefined()
    t.view.focus()
    t.view.inlineCompletions!.trigger()
    await settle()
    expect(t.view.inlineCompletions!.ghost).toBeDefined()
    t.input.blur()
    expect(t.view.inlineCompletions!.ghost).toBeUndefined()
  })

  it('turns off without a provider, and in a read-only editor', async () => {
    const t = open('a', 1, () => 'b')
    t.view.setInlineCompletions(undefined)
    expect(t.view.inlineCompletions).toBeUndefined()
    const parent = document.createElement('div')
    const readOnly = new EditorView({ parent, readOnly: true, state: EditorState.create({ doc: 'a' }), inlineCompletions: { provider: t.provider } })
    expect(readOnly.inlineCompletions).toBeUndefined()
    readOnly.destroy()
  })
})

describe('next edits in the view', () => {
  const edit = { text: '', nextEdit: { from: 22, to: 27, insert: 'total' } }

  it('shows an edit elsewhere as a diff with a marker, goes to it on Tab, and makes it on Tab again', async () => {
    const t = open('let total = 0\nfoo()\nx(count)', 9, (r) => (r.position === 9 ? edit : undefined))
    t.view.inlineCompletions!.trigger()
    await settle()
    expect([...t.view.dom.querySelectorAll('.ws-edit-removed')].map((e) => e.textContent)).toEqual(['count'])
    expect([...t.view.dom.querySelectorAll('.ws-edit-inserted')].map((e) => e.textContent)).toEqual(['total'])
    const pill = t.view.dom.querySelector<HTMLElement>('.ws-edit-pill')!
    expect(pill.hidden).toBe(false)
    expect(pill.title).toBe('Go to Edit (Tab)')
    expect(t.view.dom.querySelector<HTMLElement>('.ws-edit-area')!.hidden).toBe(false)
    t.key({ key: 'Tab' })
    expect(t.view.state.selection.main.head).toBe(22)
    await settle()
    expect(pill.className).toContain('ws-accept')
    expect(pill.title).toBe('Accept Edit (Tab)')
    // A click on the marker does what Tab does.
    pill.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(t.view.state.doc.toString()).toBe('let total = 0\nfoo()\nx(total)')
    await settle()
    expect(pill.hidden).toBe(true)
    expect(t.provider.accepted.map((a) => a.part)).toEqual(['edit'])
  })

  it('keeps an edit through a click elsewhere, and lets Esc put it away', async () => {
    const t = open('let total = 0\nfoo()\nx(count)', 9, (r) => (r.position === 9 ? edit : undefined))
    t.view.inlineCompletions!.trigger()
    await settle()
    t.view.dom.querySelector('.ws-content')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(t.view.inlineCompletions!.nextEdit).toBeDefined()
    t.key({ key: 'Escape' })
    await settle()
    expect(t.view.dom.querySelector<HTMLElement>('.ws-edit-pill')!.hidden).toBe(true)
    expect(t.view.dom.querySelectorAll('.ws-edit-removed')).toHaveLength(0)
  })
})
