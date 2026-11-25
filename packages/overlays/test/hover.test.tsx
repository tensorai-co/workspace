import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useHover } from '../src/index.js'

function Row({ text }: { text?: string }) {
  const hover = useHover()
  return (
    <>
      <div data-testid="row" onMouseMove={(e) => hover.over(e, text)} onMouseLeave={hover.hide} />
      {hover.element}
    </>
  )
}

beforeEach(() => void vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const pass = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

it('shows after the pointer rests, 10px to its right, and goes when it leaves', () => {
  render(<Row text="/src/main.tsx" />)
  fireEvent.mouseMove(screen.getByTestId('row'), { clientX: 20 })
  pass(400)
  // Still moving: it waits again.
  fireEvent.mouseMove(screen.getByTestId('row'), { clientX: 30 })
  pass(400)
  expect(screen.queryByRole('tooltip')).toBeNull()
  pass(101)
  expect(screen.getByRole('tooltip').textContent).toBe('/src/main.tsx')
  expect(screen.getByRole('tooltip').style.left).toBe('40px')
  fireEvent.mouseLeave(screen.getByTestId('row'))
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('shows nothing without text, or while a button is down', () => {
  const { rerender } = render(<Row />)
  fireEvent.mouseMove(screen.getByTestId('row'), { clientX: 20 })
  pass(1000)
  rerender(<Row text="x" />)
  fireEvent.mouseMove(screen.getByTestId('row'), { clientX: 20, buttons: 1 })
  pass(1000)
  expect(screen.queryByRole('tooltip')).toBeNull()
})
