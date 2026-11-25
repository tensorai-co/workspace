import { languageById } from '@tensorai-co/workspace/languages'
import { ScriptedLanguageService, type ScriptedLanguageOptions } from '@tensorai-co/workspace/testing'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { EditorState, EditorView, renderMarkdown } from '../src/index.js'

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

function open(doc: string, cursor: number, options: ScriptedLanguageOptions, openLocation = vi.fn()) {
  const parent = document.createElement('div')
  document.body.append(parent)
  const service = new ScriptedLanguageService(options)
  const made = new EditorView({ parent, state: EditorState.create({ doc, selection: cursor, language: languageById('plaintext') }), languages: { service, path: '/a.ts', openLocation } })
  view = made
  made.focus()
  const input = made.dom.querySelector('textarea')!
  const key = (init: KeyboardEventInit) => input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
  return { view: made, service, key, openLocation }
}

describe('language features in the view', () => {
  it('opens the suggest list on ⌃Space, moves with the arrows, and puts the item in with Enter', async () => {
    const t = open('let x = c', 9, { completions: [{ label: 'count', kind: 'variable', detail: 'const count: number' }, { label: 'console', kind: 'variable' }] })
    t.key({ key: ' ', code: 'Space', ctrlKey: true })
    await settle()
    const rows = () => [...t.view.dom.querySelectorAll('.ws-suggest-row')]
    expect(t.view.dom.querySelector<HTMLElement>('.ws-suggest')!.hidden).toBe(false)
    expect(rows().map((r) => r.querySelector('.ws-suggest-label')!.textContent)).toEqual(['console', 'count'])
    expect(rows()[0]!.className).toContain('ws-focused')
    expect(rows()[0]!.querySelector('.ws-suggest-highlight')!.textContent).toBe('c')
    t.key({ key: 'ArrowDown' })
    await settle()
    // The selected row shows its detail.
    expect(rows()[1]!.querySelector('.ws-suggest-detail')!.textContent).toBe('const count: number')
    t.key({ key: 'Enter' })
    await settle()
    expect(t.view.state.doc.toString()).toBe('let x = count')
    expect(t.view.dom.querySelector<HTMLElement>('.ws-suggest')!.hidden).toBe(true)
  })

  it('draws the problems as wavy lines, by severity', async () => {
    const t = open('one two\nthree', 0, {
      diagnostics: [
        { from: 0, to: 3, severity: 'error', message: 'E' },
        { from: 4, to: 7, severity: 'warning', message: 'W' },
        { from: 8, to: 8, severity: 'info', message: 'I' },
      ],
    })
    await settle()
    await settle()
    const squiggles = [...t.view.dom.querySelectorAll<HTMLElement>('.ws-squiggle')]
    expect(squiggles.map((s) => s.className)).toEqual(['ws-squiggle ws-error', 'ws-squiggle ws-warning', 'ws-squiggle ws-info'])
    expect(t.view.diagnostics!.counts).toEqual({ errors: 1, warnings: 1, infos: 1 })
  })

  it('shows the problems and the service’s hover for a place, problems first', async () => {
    const t = open('const total = 1', 8, {
      diagnostics: [{ from: 6, to: 11, severity: 'error', message: 'Not used.', source: 'ts', code: 6133 }],
      hover: ({ position }) => ({ contents: ['```typescript\nconst total: number\n```', `At ${position}.`] }),
    })
    await settle()
    t.view.showHover()
    await settle()
    const hover = t.view.dom.querySelector<HTMLElement>('.ws-editor-hover')!
    expect(hover.hidden).toBe(false)
    const rows = [...hover.querySelectorAll('.ws-editor-hover-row')]
    expect(rows[0]!.textContent).toBe('Not used.ts(6133)')
    expect(rows[0]!.querySelector('.ws-editor-hover-severity')!.className).toContain('ws-error')
    expect(rows[1]!.querySelector('.ws-rendered-code')!.textContent).toBe('const total: number')
    expect(rows[2]!.textContent).toBe('At 8.')
    // Typing puts it away.
    t.key({ key: 'a' })
    expect(hover.hidden).toBe(true)
  })

  it('goes to a definition in the file with F12, and asks the host for one elsewhere', async () => {
    const t = open('function go() {}\ngo()', 18, { definition: ({ position }) => (position < 20 ? [{ from: 9 }] : [{ path: '/b.ts', from: 4 }]) })
    t.key({ key: 'F12' })
    await settle()
    expect(t.view.state.selection.main.head).toBe(9)
    t.view.dispatch({ selection: { anchor: 20 } })
    expect(await t.view.goToDefinition()).toBe(true)
    expect(t.openLocation).toHaveBeenCalledWith({ path: '/b.ts', from: 4 })
  })

  it('formats with the service’s edits, as one undo step', async () => {
    const t = open('a  \nb\t', 0, { format: [{ from: 1, to: 3, insert: '' }, { from: 5, to: 6, insert: '' }] })
    expect(await t.view.format()).toBe(true)
    expect(t.view.state.doc.toString()).toBe('a\nb')
    expect(t.service.of('format')[0]).toMatchObject({ tabSize: 4, insertSpaces: true, path: '/a.ts' })
  })
})

describe('markdown in hovers', () => {
  it('draws paragraphs, inline code, emphasis and safe links, and shows HTML as text', () => {
    const el = renderMarkdown('Returns *x*, `y` or [z](https://example.com).\n\n<b>raw</b> [bad](javascript:alert(1))')
    expect(el.querySelectorAll('p')).toHaveLength(2)
    expect(el.querySelector('em')!.textContent).toBe('x')
    expect(el.querySelector('code')!.textContent).toBe('y')
    expect(el.querySelector('a')!.getAttribute('href')).toBe('https://example.com/')
    expect(el.querySelectorAll('a')).toHaveLength(1)
    expect(el.querySelector('b')).toBeNull()
    expect(el.textContent).toContain('<b>raw</b>')
  })
})
