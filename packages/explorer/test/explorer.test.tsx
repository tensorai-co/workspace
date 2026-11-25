import { MemoryClipboard, MemoryFileSystem } from '@tensorai-co/workspace/testing'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Explorer, type ExplorerProps } from '../src/index.js'

const files = { 'src/main.tsx': 'export const App = () => <div />\n', 'src/lib/a.ts': '', 'README.md': '' }
let fs: MemoryFileSystem
beforeEach(() => void (fs = new MemoryFileSystem(files)))
afterEach(cleanup)

const open = async (props: Partial<ExplorerProps> = {}) => {
  render(
    <StrictMode>
      <Explorer fs={fs} root="/" title="project" {...props} />
    </StrictMode>,
  )
  await screen.findByRole('treeitem', { name: 'README.md' })
}
const row = (name: string) => screen.getByRole('treeitem', { name })
const rows = () => screen.getAllByRole('treeitem').map((r) => r.getAttribute('aria-label'))
const click = (name: string, init = {}) => {
  fireEvent.mouseDown(row(name), init)
  fireEvent.click(row(name), { detail: 1, ...init })
}
const key = (name: string, init = {}) => fireEvent.keyDown(screen.getByRole('tree'), { key: name, ...init })

describe('Explorer', () => {
  it('opens folders, previews on a click and pins on a double one', async () => {
    const onOpen = vi.fn()
    await open({ onOpen })
    click('src')
    await screen.findByRole('treeitem', { name: 'main.tsx' })
    expect(rows()).toEqual(['src', 'lib', 'main.tsx', 'README.md'])
    expect(row('src').getAttribute('aria-expanded')).toBe('true')
    click('main.tsx')
    expect(onOpen).toHaveBeenLastCalledWith('/src/main.tsx', { preview: true })
    fireEvent.click(row('main.tsx'), { detail: 2 })
    fireEvent.doubleClick(row('main.tsx'))
    expect(onOpen).toHaveBeenCalledTimes(2)
    expect(onOpen).toHaveBeenLastCalledWith('/src/main.tsx', { preview: false })
  })

  it('has the roles and states of a tree', async () => {
    await open()
    click('src')
    await screen.findByRole('treeitem', { name: 'lib' })
    const lib = row('lib')
    expect(lib.getAttribute('aria-level')).toBe('2')
    expect(lib.getAttribute('aria-posinset')).toBe('1')
    expect(lib.getAttribute('aria-setsize')).toBe('2')
    expect(lib.getAttribute('aria-expanded')).toBe('false')
    expect(row('README.md').hasAttribute('aria-expanded')).toBe(false)
    expect(row('src').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tree').getAttribute('aria-activedescendant')).toBe(row('src').id)
  })

  it('makes a file from the header, and opens it', async () => {
    const onOpen = vi.fn()
    await open({ onOpen })
    fireEvent.click(screen.getByRole('button', { name: 'New File...' }))
    const box = await screen.findByRole('textbox')
    expect(document.activeElement).toBe(box)
    fireEvent.change(box, { target: { value: 'index.ts' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await screen.findByRole('treeitem', { name: 'index.ts' })
    expect(fs.text('/index.ts')).toBe('')
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('/index.ts', { preview: false }))
    expect(fs.calls.filter((c) => c.method === 'createFile')).toHaveLength(1)
  })

  it('shows what is wrong with a name, and Escape cancels', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'New Folder...' }))
    const box = await screen.findByRole('textbox')
    fireEvent.change(box, { target: { value: 'README.md' } })
    expect(screen.getByRole('alert').textContent).toContain('already exists')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(screen.queryByRole('textbox')).not.toBeNull()
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(rows()).toEqual(['src', 'README.md'])
    expect(document.activeElement).toBe(screen.getByRole('tree'))
  })

  it('renames from the keyboard', async () => {
    const onRename = vi.fn()
    await open({ onRename })
    click('README.md')
    key(/Mac/.test(navigator.platform) ? 'Enter' : 'F2')
    const box = await screen.findByRole<HTMLInputElement>('textbox')
    expect([box.value, box.selectionStart, box.selectionEnd]).toEqual(['README.md', 0, 6])
    fireEvent.change(box, { target: { value: 'NOTES.md' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await screen.findByRole('treeitem', { name: 'NOTES.md' })
    expect(onRename).toHaveBeenCalledWith('/README.md', '/NOTES.md')
  })

  it('asks before deleting', async () => {
    const onDelete = vi.fn()
    await open({ onDelete })
    fireEvent.contextMenu(row('src'))
    fireEvent.mouseUp(screen.getByRole('menuitem', { name: /Delete Permanently/ }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain("permanently delete 'src' and its contents?")
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(fs.exists('/src')).toBe(true)
    fireEvent.contextMenu(row('src'))
    fireEvent.mouseUp(screen.getByRole('menuitem', { name: /Delete Permanently/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(rows()).toEqual(['README.md']))
    expect(onDelete).toHaveBeenCalledWith(['/src'])
  })

  it("its menu matches what it's on, and works from the keyboard", async () => {
    const clipboard = new MemoryClipboard()
    await open({ clipboard })
    const labels = () => screen.getAllByRole('menuitem').map((i) => i.firstChild!.textContent)
    fireEvent.contextMenu(row('src'))
    expect(labels()).toEqual(['New File...', 'New Folder...', 'Copy Path', 'Copy Relative Path', 'Rename...', 'Delete Permanently'])
    expect(row('src').getAttribute('aria-selected')).toBe('true')
    const menu = screen.getByRole('menu')
    for (let i = 0; i < 4; i++) fireEvent.keyDown(menu, { key: 'ArrowDown' })
    fireEvent.keyDown(menu, { key: 'Enter' })
    expect(screen.queryByRole('menu')).toBeNull()
    await waitFor(() => expect(clipboard.text).toBe('src'))
    fireEvent.contextMenu(row('README.md'))
    expect(labels()).toEqual(['Open', 'Copy Path', 'Copy Relative Path', 'Rename...', 'Delete Permanently'])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(document.activeElement).toBe(screen.getByRole('tree'))
  })

  it('shows the active file, and follows changes outside', async () => {
    await open({ activePath: '/src/lib/a.ts' })
    await screen.findByRole('treeitem', { name: 'a.ts' })
    expect(row('a.ts').getAttribute('aria-selected')).toBe('true')
    fs.change('/src/lib/b.ts', '')
    await screen.findByRole('treeitem', { name: 'b.ts' })
  })

  it('closes its section, and collapses every folder', async () => {
    await open()
    click('src')
    await screen.findByRole('treeitem', { name: 'lib' })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Folders in Explorer' }))
    expect(rows()).toEqual(['src', 'README.md'])
    fireEvent.click(screen.getByRole('button', { name: 'Explorer Section: project' }))
    expect(screen.queryByRole('tree')).toBeNull()
  })

  it('renders only the rows in view', async () => {
    fs = new MemoryFileSystem(Object.fromEntries([...Array.from({ length: 5000 }, (_, i) => [`file${i}.ts`, '']), ['README.md', '']]))
    render(<Explorer fs={fs} root="/" />)
    await screen.findByRole('treeitem', { name: 'file0.ts' })
    expect(screen.getAllByRole('treeitem').length).toBeLessThan(80)
    key('End')
    expect(row('README.md').className).toContain('ws-focused')
  })
})
