import { MemoryFileSystem, MemoryStorage, ScriptedLanguageService, ScriptedTerminalHost } from '@tensorai-co/workspace/testing'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityToolbar, StatusItem, Workspace, type WorkspaceApi, type WorkspaceProps } from '../src/index.js'

afterEach(cleanup)
// The editor watches its size; jsdom has no layout to watch.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const files = () => new MemoryFileSystem({ '/work/src/main.ts': 'export {}\n', '/work/README.md': '# Hi\n' })

async function open(props: Partial<WorkspaceProps> = {}) {
  let api: WorkspaceApi | null = null
  const made = render(
    <StrictMode>
      <Workspace fs={files()} root="/work" mac onReady={(a) => (api = a)} {...props} />
    </StrictMode>,
  )
  await waitFor(() => expect(api).not.toBeNull())
  return { ...made, api: () => api! }
}

/** A key as a Mac keyboard sends it. */
const press = (target: Element, key: string, code: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}) => fireEvent.keyDown(target, { key, code, ...mods })

describe('Workspace', () => {
  it('lays out its parts, with the folder’s name in the command center', async () => {
    const { container } = await open({ terminals: new ScriptedTerminalHost({ output: '$ ' }) })
    for (const part of ['.ws-titlebar', '.ws-activitybar', '.ws-sidebar', '.ws-editors', '.ws-panel', '.ws-statusbar']) expect(container.querySelector(part)).not.toBeNull()
    expect(container.querySelector('.ws-auxiliarybar')).toBeNull()
    expect(screen.getByRole('button', { name: 'work' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Explorer' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: 'Toggle Panel (⌘J)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Secondary Side Bar/ })).toBeNull()
  })

  it('leaves the titlebar out for a host with its own bar, and keeps its commands', async () => {
    const { container, api } = await open({ titlebar: false })
    expect(container.querySelector('.ws-titlebar')).toBeNull()
    expect(container.querySelector('.ws-no-titlebar .ws-activitybar')).not.toBeNull()
    act(() => void api().commands.execute('workbench.action.toggleSidebarVisibility'))
    expect(api().layout.state.sidebar).toBe(false)
  })

  it('leaves the activity bar out, and puts its buttons wherever the host draws an ActivityToolbar', async () => {
    const { container, api } = await open({ activityBar: false, views: [{ id: 'search', title: 'Search', icon: 'search-large', content: <p>Find</p> }] })
    expect(container.querySelector('.ws-activitybar')).toBeNull()
    expect(api().views.map((v) => v.id)).toEqual(['explorer', 'search'])
    const bar = render(<ActivityToolbar workspace={api()} />)
    const tabs = within(bar.container).getAllByRole('tab')
    expect(tabs.map((t) => t.getAttribute('aria-label'))).toEqual(['Explorer', 'Search'])
    expect(within(bar.container).getByRole('tablist').getAttribute('aria-orientation')).toBe('horizontal')
    // The same layout: a view's button shows it, and hides the sidebar when it's showing.
    fireEvent.click(tabs[1]!)
    expect(api().layout.state).toMatchObject({ view: 'search', sidebar: true })
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    fireEvent.click(tabs[1]!)
    expect(api().layout.state.sidebar).toBe(false)
    // The application menu, read when it opens, under its button.
    fireEvent.click(within(bar.container).getByRole('button', { name: 'Application Menu' }))
    expect(screen.getAllByRole('menuitem').some((i) => i.textContent?.includes('Show All Commands') || i.textContent?.includes('Toggle Primary Side Bar'))).toBe(true)
  })

  it('says why a file isn’t shown: binary, or the host couldn’t read it', async () => {
    const fs = new MemoryFileSystem({ '/work/logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1]), '/work/gone.txt': 'x' })
    fs.fail('/work/gone.txt', 'Permission denied')
    const { api } = await open({ fs })
    act(() => api().open('/work/logo.png'))
    expect((await screen.findByRole('status')).textContent).toMatch(/binary/)
    act(() => api().open('/work/gone.txt'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Permission denied'))
  })

  it('toggles parts from keys and buttons, and keeps the layout', async () => {
    const storage = new MemoryStorage()
    const { container, api, unmount } = await open({ storage, terminals: new ScriptedTerminalHost({ output: '$ ' }), auxiliaryBar: { title: 'Chat', content: <p>chat</p> } })
    const root = container.querySelector('.ws-workspace')!
    press(root, 'b', 'KeyB', { metaKey: true })
    expect(api().layout.state.sidebar).toBe(false)
    expect(container.querySelector('.ws-parts')!.className).toContain('ws-no-sidebar')
    // ⌥⌘B arrives as "∫" on a Mac: it's read by the key's place.
    press(root, '∫', 'KeyB', { metaKey: true, altKey: true })
    expect(api().layout.state.auxiliaryBar).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Panel (⌘J)' }))
    expect(api().layout.state.panel).toBe(false)
    expect(screen.getByRole('button', { name: 'Toggle Panel (⌘J)' }).getAttribute('aria-pressed')).toBe('false')
    unmount()
    const again = await open({ storage, terminals: new ScriptedTerminalHost({ output: '$ ' }), auxiliaryBar: { title: 'Chat', content: <p>chat</p> } })
    expect(again.api().layout.state).toMatchObject({ sidebar: false, panel: false, auxiliaryBar: true })
    expect(screen.getByText('chat')).toBeTruthy()
  })

  it('shows a host’s views, and hides the sidebar when its view is clicked again', async () => {
    const { api } = await open({ views: [{ id: 'search', title: 'Search', icon: 'search-large', keybinding: 'shift+mod+f', content: <p>find things</p> }] })
    const search = screen.getByRole('tab', { name: 'Search' })
    expect(search.title).toBe('Search (⇧⌘F)')
    fireEvent.click(search)
    expect(api().layout.state.view).toBe('search')
    expect(screen.getByRole('heading', { name: 'Search' })).toBeTruthy()
    expect(screen.getByText('find things').closest('[hidden]')).toBeNull()
    fireEvent.click(search)
    expect(api().layout.state.sidebar).toBe(false)
    act(() => void api().commands.execute('workbench.view.explorer'))
    expect(api().layout.state).toMatchObject({ sidebar: true, view: 'explorer' })
  })

  it('lets a host override commands and add keys', async () => {
    const save = vi.fn()
    const other = vi.fn()
    const { container, api } = await open({
      commands: [
        { id: 'workbench.action.files.save', title: 'Save', keybinding: 'mod+s', run: save },
        { id: 'host.hello', title: 'Hello', category: 'Help', run: other },
      ],
      keybindings: [{ key: 'mod+shift+h', command: 'host.hello' }],
    })
    const root = container.querySelector('.ws-workspace')!
    press(root, 's', 'KeyS', { metaKey: true })
    expect(save).toHaveBeenCalledOnce()
    press(root, 'H', 'KeyH', { metaKey: true, shiftKey: true })
    expect(other).toHaveBeenCalledOnce()
    expect(api().commands.keyLabel('host.hello')).toBe('⇧⌘H')
  })

  it('opens files through its API, and puts the host’s items in the status bar', async () => {
    const { api } = await open({ slots: { statusLeft: <StatusItem kind="remote" icon="remote" text="Remote" onClick={() => {}} /> } })
    expect(screen.getByRole('button', { name: /Remote/ }).className).toContain('ws-status-remote')
    act(() => api().open('/work/README.md'))
    await waitFor(() => expect(api().context.get('activeEditor')).toBe('/work/README.md'))
    expect(api().context.get('activeEditorLangId')).toBe('markdown')
    expect(await screen.findByText('Markdown')).toBeTruthy()
    act(() => api().open('/work/src/main.ts'))
    await waitFor(() => expect(api().context.get('canNavigateBack')).toBe(true))
    act(() => void api().commands.execute('workbench.action.navigateBack'))
    await waitFor(() => expect(api().context.get('activeEditor')).toBe('/work/README.md'))
    expect(api().context.get('canNavigateForward')).toBe(true)
  })

  it('waits for the second key of a chord only where the chord works, and says so', async () => {
    const { container, api } = await open({ initialFiles: ['/work/README.md'] })
    const root = container.querySelector('.ws-workspace')!
    await waitFor(() => expect(api().context.get('editorAreaFocus')).toBe(true))
    expect(api().context.get('activeEditorLangId')).toBe('markdown')
    // With the focus elsewhere, ⌘K is left alone.
    act(() => (document.activeElement as HTMLElement).blur())
    await waitFor(() => expect(api().context.get('editorAreaFocus')).toBe(false))
    press(root, 'k', 'KeyK', { metaKey: true })
    expect(api().keybindings.chord).toBeUndefined()
    act(() => container.querySelector<HTMLElement>('.ws-editors textarea')!.focus())
    await waitFor(() => expect(api().context.get('editorAreaFocus')).toBe(true))
    press(root, 'k', 'KeyK', { metaKey: true })
    expect(await screen.findByText('(⌘K) was pressed. Waiting for second key of chord...')).toBeTruthy()
    press(root, 'v', 'KeyV')
    await waitFor(() => expect(api().context.get('editorGroupCount')).toBe(2))
  })

  it('shows messages for a while', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { api } = await open()
      act(() => api().notify('Could not read it'))
      expect(screen.getByRole('alert').textContent).toBe('Could not read it')
      act(() => vi.advanceTimersByTime(4100))
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('quick input', () => {
  const key = (target: Element, init: KeyboardEventInit) => fireEvent.keyDown(target, init)

  it('opens the command palette on ⇧⌘P, filters, and runs the picked command', async () => {
    const hello = vi.fn()
    const { container, api } = await open({ commands: [{ id: 'host.hello', title: 'Say Hello', category: 'Help', run: hello }] })
    const root = container.querySelector('.ws-workspace')!
    key(root, { key: 'P', code: 'KeyP', metaKey: true, shiftKey: true })
    const input = await screen.findByRole('combobox')
    expect((input as HTMLInputElement).value).toBe('>')
    expect(document.activeElement).toBe(input)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toContain('Show All Commands⇧⌘P')
    fireEvent.change(input, { target: { value: '>say hel' } })
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Help: Say Hello'])
    expect([...options[0]!.querySelectorAll('.ws-quick-highlight')].map((h) => h.textContent)).toEqual(['Say Hel'])
    key(input, { key: 'Enter' })
    expect(hello).toHaveBeenCalledOnce()
    expect(screen.queryByRole('combobox')).toBeNull()
    // It's remembered as recently used.
    act(() => api().quickOpen('>'))
    expect((await screen.findAllByRole('option'))[0]!.textContent).toBe('Help: Say Hellorecently used')
    key(screen.getByRole('combobox'), { key: 'Escape' })
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('goes through rows with the arrows, round the ends, past messages', async () => {
    const { api } = await open()
    act(() => api().quickOpen('>'))
    const input = await screen.findByRole('combobox')
    const selected = () => screen.getAllByRole('option').findIndex((o) => o.getAttribute('aria-selected') === 'true')
    expect(selected()).toBe(0)
    key(input, { key: 'ArrowUp' })
    expect(selected()).toBe(screen.getAllByRole('option').length - 1)
    key(input, { key: 'ArrowDown' })
    expect(selected()).toBe(0)
    fireEvent.change(input, { target: { value: '>nothing like this' } })
    expect(screen.getByRole('option').textContent).toBe('No matching commands')
    expect(selected()).toBe(-1)
  })

  it('finds files with ⌘P and goes to a line with ⌃G', async () => {
    const { container, api } = await open()
    const root = container.querySelector('.ws-workspace')!
    key(root, { key: 'p', code: 'KeyP', metaKey: true })
    const input = await screen.findByRole('combobox')
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['README.md', 'main.tssrc']))
    fireEvent.change(input, { target: { value: 'readme' } })
    key(input, { key: 'Enter' })
    await waitFor(() => expect(api().context.get('activeEditor')).toBe('/work/README.md'))
    key(root, { key: 'g', code: 'KeyG', ctrlKey: true })
    const line = await screen.findByRole('combobox')
    expect((line as HTMLInputElement).value).toBe(':')
    expect(screen.getByRole('option').textContent).toMatch(/^Current Line: 1, Character: 1\. Type a line number between 1 and 2/)
    key(line, { key: 'Escape' })
  })
})

describe('language features', () => {
  const service = () =>
    new ScriptedLanguageService({
      diagnostics: ({ path }) =>
        path === '/work/src/main.ts'
          ? [
              { from: 0, to: 6, severity: 'error', message: 'E' },
              { from: 7, to: 9, severity: 'warning', message: 'W' },
            ]
          : [],
      symbols: [
        { name: 'App', kind: 'function', from: 0, to: 9, children: [{ name: 'count', kind: 'variable', from: 7, to: 9 }] },
        { name: 'helper', kind: 'function', from: 2, to: 4 },
      ],
      definition: () => [{ path: '/work/README.md', from: 2 }],
    })

  it('counts the open files’ problems in the status bar', async () => {
    const { container } = await open({ languages: service(), initialFiles: ['/work/src/main.ts'] })
    await waitFor(() => expect(container.querySelector('.ws-status-problems')!.textContent).toBe(' 1  1'))
    expect(container.querySelector('.ws-status-problems')!.getAttribute('title')).toBe('Errors: 1, Warnings: 1')
  })

  it('has no problems item without a service', async () => {
    const { container } = await open({ initialFiles: ['/work/src/main.ts'] })
    expect(container.querySelector('.ws-status-problems')).toBeNull()
  })

  it('lists the file’s symbols with ⇧⌘O, in document order, and goes to the picked one', async () => {
    const { container, api } = await open({ languages: service(), initialFiles: ['/work/src/main.ts'] })
    await waitFor(() => expect(api().editor).toBeDefined())
    fireEvent.keyDown(container.querySelector('.ws-workspace')!, { key: 'O', code: 'KeyO', metaKey: true, shiftKey: true })
    const input = await screen.findByRole('combobox')
    expect((input as HTMLInputElement).value).toBe('@')
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Appsymbols (3)', 'helper', 'countApp']))
    fireEvent.change(input, { target: { value: '@cou' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['countAppsymbols (1)'])
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(api().editor!.state.selection.main.head).toBe(7)
  })

  it('opens a definition in another file at its place', async () => {
    const { api } = await open({ languages: service(), initialFiles: ['/work/src/main.ts'] })
    await waitFor(() => expect(api().editor).toBeDefined())
    await act(async () => void (await api().editor!.goToDefinition(1)))
    await waitFor(() => expect(api().context.get('activeEditor')).toBe('/work/README.md'))
    await waitFor(() => expect(api().editor!.state.selection.main.head).toBe(2))
  })

  it('puts the language commands in the palette with their keys', async () => {
    const { api } = await open({ languages: service() })
    expect(api().commands.keyLabel('editor.action.revealDefinition')).toBe('F12')
    expect(api().commands.keyLabel('editor.action.formatDocument')).toBe('⌥⇧F')
    expect(api().commands.keyLabel('editor.action.triggerSuggest')).toBe('⌃Space')
    expect(api().commands.keyLabel('workbench.action.gotoSymbol')).toBe('⇧⌘O')
  })
})

describe('appearance', () => {
  it('puts its theme, layout and options on the workspace, and meets the parts edge to edge when flat', async () => {
    const { container, rerender } = await open({ terminals: new ScriptedTerminalHost({ output: '$ ' }), appearance: { theme: 'dark', layout: 'flat', colors: { focusBorder: '#c2185b' } } })
    const root = container.querySelector<HTMLElement>('.ws-workspace')!
    expect(root.dataset).toMatchObject({ theme: 'dark', layout: 'flat' })
    expect(root.style.getPropertyValue('--ws-color-focusBorder')).toBe('#c2185b')
    expect(container.querySelector('.ws-columns')!.className).not.toContain('ws-gaps')
    rerender(
      <StrictMode>
        <Workspace fs={files()} root="/work" mac terminals={new ScriptedTerminalHost({ output: '$ ' })} appearance={{ gap: 8 }} />
      </StrictMode>,
    )
    expect(root.dataset.layout).toBeUndefined()
    expect(root.style.getPropertyValue('--ws-gap')).toBe('8px')
    expect(container.querySelector('.ws-columns')!.className).toContain('ws-gaps')
  })
})
