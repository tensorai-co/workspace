import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TabsModel, TabStrip, type TabStripProps } from '../src/index.js'

let model: TabsModel<string>
beforeEach(() => {
  model = new TabsModel<string>((s) => s)
  for (const id of ['a.ts', 'b.ts', 'c.ts']) model.open(id)
})
afterEach(cleanup)

const show = (m = model) => m.tabs.map((t) => (m.active === t ? `[${t.id}]` : t.id)).join(' ')
const strip = (props: Partial<TabStripProps<string>> = {}, m = model) => <TabStrip model={m} label="Files" describe={(t) => ({ label: t.id })} dragType="files" {...props} />
const open = (props: Partial<TabStripProps<string>> = {}) => render(<StrictMode>{strip(props)}</StrictMode>)
const tab = (name: RegExp | string) => screen.getByRole('tab', { name })

describe('the mouse', () => {
  it('activates on press, tells the host on click, keeps on double-click', () => {
    const onSelect = vi.fn()
    open({ onSelect })
    act(() => void model.open('p.ts', { preview: true }))
    expect(tab('p.ts, preview').className).toContain('ws-preview')
    fireEvent.mouseDown(tab('a.ts'), { button: 0 })
    expect(show()).toBe('[a.ts] b.ts c.ts p.ts')
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(tab('a.ts'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    fireEvent.doubleClick(tab('p.ts, preview'))
    expect(tab('p.ts').className).not.toContain('ws-preview')
  })

  it('closes with the button or a middle click, without activating', () => {
    open()
    fireEvent.mouseDown(screen.getByLabelText('Close a.ts'))
    fireEvent.click(screen.getByLabelText('Close a.ts'))
    expect(show()).toBe('b.ts [c.ts]')
    fireEvent(tab('b.ts'), new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(show()).toBe('[c.ts]')
    fireEvent.click(screen.getByLabelText('Close c.ts'))
    // An empty strip isn't shown.
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('lets the host ask before closing', () => {
    const onClose = vi.fn()
    open({ onClose })
    act(() => model.setDirty('b.ts', true))
    fireEvent.click(screen.getByLabelText('Close b.ts'))
    expect(onClose.mock.calls[0]![0]).toMatchObject({ id: 'b.ts', dirty: true })
    expect(show()).toBe('a.ts b.ts [c.ts]')
    expect(tab('b.ts, unsaved').className).toContain('ws-dirty')
  })
})

describe('the keyboard', () => {
  it('moves between tabs, taking the focus along', () => {
    open()
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([-1, -1, 0])
    tab('c.ts').focus()
    fireEvent.keyDown(tab('c.ts'), { key: 'ArrowLeft' })
    expect(show()).toBe('a.ts [b.ts] c.ts')
    expect(document.activeElement).toBe(tab('b.ts'))
    fireEvent.keyDown(tab('b.ts'), { key: 'Home' })
    fireEvent.keyDown(tab('a.ts'), { key: 'ArrowLeft' })
    expect(show()).toBe('[a.ts] b.ts c.ts')
    fireEvent.keyDown(tab('a.ts'), { key: 'End' })
    expect(document.activeElement).toBe(tab('c.ts'))
  })
})

it('shows what describe gives', () => {
  open({ describe: (t) => ({ label: t.id, icon: <i data-testid={`icon-${t.id}`} />, description: t.id === 'b.ts' ? '…/lib' : undefined, badge: t.id === 'c.ts' ? 'M' : undefined }), actions: <button>split</button> })
  expect(screen.getByTestId('icon-a.ts')).toBeTruthy()
  expect(tab('b.ts, …/lib').textContent).toContain('…/lib')
  expect(tab('c.ts').textContent).toContain('M')
  expect(screen.getByText('split')).toBeTruthy()
})

describe('dragging', () => {
  /** Tabs are 100px wide here, side by side. */
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = [...(this.parentElement?.children ?? [])].indexOf(this)
      return new DOMRect(i * 100, 0, 100, 31)
    })
  })
  afterEach(() => void vi.restoreAllMocks())
  const transfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }
  // jsdom's drag events have no pointer position.
  const over = (el: Element, clientX: number) => {
    const event = createEvent.dragOver(el, { dataTransfer: transfer })
    Object.defineProperty(event, 'clientX', { value: clientX })
    fireEvent(el, event)
    return event.defaultPrevented
  }
  const start = (el: Element) => fireEvent.dragStart(el, { dataTransfer: transfer })
  const drop = (el: Element) => fireEvent.drop(el, { dataTransfer: transfer })

  it('reorders', () => {
    open()
    start(tab('a.ts'))
    // Either side of itself is nowhere.
    over(tab('b.ts'), 120)
    expect(document.querySelector('.ws-drop-before')).toBeNull()
    over(tab('b.ts'), 180)
    expect(document.querySelector('.ws-drop-before')).toBe(tab('c.ts'))
    drop(tab('b.ts'))
    expect(show()).toBe('b.ts a.ts [c.ts]')
    expect(document.querySelector('.ws-drop-before')).toBeNull()
  })

  it('drops past the last tab', () => {
    open()
    start(tab('a.ts'))
    const list = screen.getByRole('tablist')
    over(list, 900)
    expect(document.querySelector('.ws-drop-after')).toBe(tab('c.ts'))
    drop(list)
    expect(show()).toBe('b.ts [c.ts] a.ts')
  })

  it('moves to another strip of the same kind, and no other', () => {
    const other = new TabsModel<string>((s) => s)
    other.open('x.ts')
    const terminals = new TabsModel<string>((s) => s)
    terminals.open('bash')
    render(
      <>
        {strip()}
        {strip({ label: 'Other' }, other)}
        {strip({ label: 'Terminals', dragType: 'terminals' }, terminals)}
      </>,
    )
    start(tab('b.ts'))
    expect(over(tab('bash'), 10)).toBe(false)
    expect(over(tab('x.ts'), 10)).toBe(true)
    drop(tab('x.ts'))
    expect(show()).toBe('a.ts [c.ts]')
    expect(show(other)).toBe('[b.ts] x.ts')
    expect(show(terminals)).toBe('[bash]')
  })
})
