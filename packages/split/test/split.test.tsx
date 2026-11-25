import { MemoryStorage } from '@tensorai-co/workspace/testing'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Pane, Split } from '../src/index.js'

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const sizes = (dimension: 'width' | 'height' = 'width') => [...document.querySelectorAll<HTMLElement>('.ws-pane')].map((p) => (p.style.display === 'none' ? '-' : p.style[dimension]))
const drag = (sash: Element, ...xs: number[]) => {
  fireEvent.pointerDown(sash, { button: 0, clientX: 500, clientY: 500 })
  for (const x of xs) fireEvent.pointerMove(sash, { clientX: 500 + x, clientY: 500 + x })
  fireEvent.pointerUp(sash)
}
const sashes = () => screen.getAllByRole('separator')

it('lays out panes and resizes them by their sash', () => {
  render(
    <StrictMode>
      <Split direction="row" gap={4}>
        <Pane id="a" size={256} min={170}>A</Pane>
        {null}
        <Pane id="b" grow>B</Pane>
      </Split>
    </StrictMode>,
  )
  expect(sizes()).toEqual(['256px', '740px'])
  expect(sashes()[0]!.style.left).toBe('256px')
  drag(sashes()[0]!, 10, 50)
  expect(sizes()).toEqual(['306px', '690px'])
  fireEvent.doubleClick(sashes()[0]!)
  expect(sizes()).toEqual(['256px', '740px'])
})

it('works in a column', () => {
  render(
    <Split direction="column">
      <Pane id="a" grow />
      <Pane id="b" size={200} />
    </Split>,
  )
  expect(sizes('height')).toEqual(['400px', '200px'])
  drag(sashes()[0]!, -100)
  expect(sizes('height')).toEqual(['300px', '300px'])
})

it('follows the host’s visibility, and tells it when a drag closes a pane', () => {
  const heard = vi.fn()
  function App() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <button onClick={() => setOpen(!open)}>toggle</button>
        <Split direction="row">
          <Pane id="side" size={256} min={170} snap visible={open} onVisibleChange={(v) => (heard(v), setOpen(v))} />
          <Pane id="main" grow />
        </Split>
      </>
    )
  }
  render(<App />)
  fireEvent.click(screen.getByText('toggle'))
  expect(sizes()).toEqual(['-', '1000px'])
  fireEvent.click(screen.getByText('toggle'))
  expect(sizes()).toEqual(['256px', '744px'])
  drag(sashes()[0]!, -220)
  expect(sizes()).toEqual(['-', '1000px'])
  expect(heard).toHaveBeenCalledWith(false)
  fireEvent.click(screen.getByText('toggle'))
  expect(sizes()).toEqual(['256px', '744px'])
  drag(sashes()[0]!, -220)
  drag(sashes()[0]!, 300)
  expect(heard).toHaveBeenLastCalledWith(true)
  expect(sizes()).toEqual(['300px', '700px'])
})

it('saves its sizes, and starts from them', () => {
  vi.useFakeTimers()
  const storage = new MemoryStorage()
  const ui = () => (
    <Split direction="row" storage={storage} storageKey="layout">
      <Pane id="a" size={256} />
      <Pane id="b" grow />
    </Split>
  )
  const { unmount } = render(ui())
  drag(sashes()[0]!, 44)
  act(() => void vi.advanceTimersByTime(150))
  expect(JSON.parse(storage.getItem('layout')!).a).toEqual({ size: 300, visible: true })
  unmount()
  const second = render(ui())
  expect(sizes()).toEqual(['300px', '700px'])
  second.unmount()
  storage.setItem('layout', 'nonsense {')
  render(ui())
  expect(sizes()).toEqual(['256px', '744px'])
})

it('panes can come and go, and the others keep their state', () => {
  function App() {
    const [two, setTwo] = useState(false)
    return (
      <>
        <button onClick={() => setTwo(!two)}>toggle</button>
        <Split direction="row">
          <Pane id="a">
            <input aria-label="kept" />
          </Pane>
          {two && <Pane id="b">B</Pane>}
        </Split>
      </>
    )
  }
  render(<App />)
  const input = screen.getByLabelText<HTMLInputElement>('kept')
  fireEvent.click(screen.getByText('toggle'))
  expect(sizes()).toEqual(['500px', '500px'])
  expect(screen.getByLabelText('kept')).toBe(input)
  fireEvent.click(screen.getByText('toggle'))
  expect(sizes()).toEqual(['1000px'])
  expect(screen.queryByRole('separator')).toBeNull()
})

it('the sash lights up after the pointer rests on it', () => {
  vi.useFakeTimers()
  render(
    <Split direction="row">
      <Pane id="a" />
      <Pane id="b" />
    </Split>,
  )
  fireEvent.pointerEnter(sashes()[0]!)
  act(() => void vi.advanceTimersByTime(200))
  expect(sashes()[0]!.className).not.toContain('ws-hover')
  act(() => void vi.advanceTimersByTime(101))
  expect(sashes()[0]!.className).toContain('ws-hover')
  fireEvent.pointerLeave(sashes()[0]!)
  expect(sashes()[0]!.className).not.toContain('ws-hover')
})
