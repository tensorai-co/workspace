import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog, Menu } from '../src/index.js'

afterEach(cleanup)

describe('Dialog', () => {
  const open = () => {
    const onAnswer = vi.fn()
    render(<Dialog message="Save?" detail="Or lose it." buttons={[{ label: 'Save', value: 'save' }, { label: 'Cancel', value: 'cancel' }, { label: "Don't Save", value: 'discard' }]} onAnswer={onAnswer} />)
    return onAnswer
  }

  it('puts the primary button at the right, with the focus', () => {
    open()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['', "Don't Save", 'Cancel', 'Save'])
    expect(document.activeElement?.textContent).toBe('Save')
    expect(screen.getByRole('alertdialog', { name: 'Save?' })).toBeTruthy()
  })

  it('answers with the button chosen, or nothing when dismissed', () => {
    const onAnswer = open()
    fireEvent.click(screen.getByText("Don't Save"))
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    fireEvent.click(screen.getByLabelText('Close Dialog'))
    expect(onAnswer.mock.calls).toEqual([['discard'], [undefined], [undefined]])
  })

  it('keeps the focus inside', () => {
    open()
    const dialog = screen.getByRole('alertdialog')
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByLabelText('Close Dialog'))
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(document.activeElement?.textContent).toBe('Cancel')
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(document.activeElement?.textContent).toBe('Save')
  })
})

describe('Menu', () => {
  it('skips disabled items, runs the chosen one and closes', () => {
    const run = vi.fn()
    const onClose = vi.fn()
    render(<Menu at={{ x: 0, y: 0 }} groups={[[{ label: 'One', run: vi.fn() }, { label: 'Two', disabled: true, run: vi.fn() }], [{ label: 'Three', keys: '⌘3', run }]]} onClose={onClose} />)
    const menu = screen.getByRole('menu')
    fireEvent.mouseUp(screen.getByText('Two'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    fireEvent.keyDown(menu, { key: 'Enter' })
    expect(run).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when something else is pressed', () => {
    const onClose = vi.fn()
    render(<Menu at={{ x: 0, y: 0 }} groups={[[{ label: 'One', run: vi.fn() }]]} onClose={onClose} />)
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
