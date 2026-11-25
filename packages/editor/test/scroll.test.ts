import { languageById } from '@tensorai-co/workspace/languages'
import { beforeAll, expect, it, vi } from 'vitest'
import { EditorState, EditorView } from '../src/index.js'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

it('scrolls by line, and tells when it does', () => {
  const parent = document.createElement('div')
  document.body.append(parent)
  const view = new EditorView({ parent, state: EditorState.create({ doc: 'a\n'.repeat(100), language: languageById('plaintext') }) })
  const onScroll = vi.fn()
  const stop = view.onScroll(onScroll)
  expect(view.topLine).toBe(1)
  view.scrollToLine(11.5)
  expect(view.topLine).toBe(11.5)
  const scroller = view.dom.querySelector('.ws-scroller')!
  scroller.dispatchEvent(new Event('scroll'))
  expect(onScroll).toHaveBeenCalledTimes(1)
  stop()
  scroller.dispatchEvent(new Event('scroll'))
  expect(onScroll).toHaveBeenCalledTimes(1)
  view.destroy()
})
