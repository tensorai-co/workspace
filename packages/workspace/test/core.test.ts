import { MemoryStorage } from '@tensorai-co/workspace/testing'
import { describe, expect, it, vi } from 'vitest'
import { CommandRegistry, ContextKeys, Keybindings, keybindingLabel, LayoutModel, parseKeybinding, parseWhen, strokeOf } from '../src/core/index.js'

const key = (key: string, code: string, mods: Partial<Record<'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey', boolean>> = {}) => ({ key, code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods })

describe('when clauses', () => {
  const ctx = (values: Record<string, unknown>) => (k: string) => values[k]

  it('reads keys, comparisons and logic', () => {
    const get = ctx({ editorFocus: true, lang: 'markdown', count: 2, off: false })
    expect(parseWhen('editorFocus')(get)).toBe(true)
    expect(parseWhen('!editorFocus')(get)).toBe(false)
    expect(parseWhen('off')(get)).toBe(false)
    expect(parseWhen('missing')(get)).toBe(false)
    expect(parseWhen('lang == markdown')(get)).toBe(true)
    expect(parseWhen("lang == 'markdown'")(get)).toBe(true)
    expect(parseWhen('lang != markdown')(get)).toBe(false)
    expect(parseWhen('count == 2 && editorFocus == true')(get)).toBe(true)
    expect(parseWhen('missing == undefined')(get)).toBe(false)
    expect(parseWhen('missing != x')(get)).toBe(true)
  })

  it('binds ! tightest, then &&, then ||', () => {
    const get = ctx({ a: true, b: false, c: true })
    expect(parseWhen('b && c || a')(get)).toBe(true)
    expect(parseWhen('a || b && c')(get)).toBe(true)
    expect(parseWhen('!a || c')(get)).toBe(true)
    expect(parseWhen('!(a && c)')(get)).toBe(false)
    expect(parseWhen('(a || b) && !b')(get)).toBe(true)
  })

  it('says where a clause is wrong', () => {
    expect(() => parseWhen('a &&')).toThrow(SyntaxError)
    expect(() => parseWhen('(a')).toThrow(/Expected "\)"/)
    expect(() => parseWhen("a == 'b")).toThrow(/Unclosed/)
    expect(() => parseWhen('a b')).toThrow(/Unexpected/)
  })
})

describe('keys', () => {
  it('reads bindings, with mod as ⌘ on a Mac and Ctrl elsewhere', () => {
    expect(parseKeybinding('mod+b', true)).toEqual([{ ctrl: false, shift: false, alt: false, meta: true, key: 'b' }])
    expect(parseKeybinding('mod+b', false)).toEqual([{ ctrl: true, shift: false, alt: false, meta: false, key: 'b' }])
    expect(parseKeybinding('cmd+k v', true).map((s) => s.key)).toEqual(['k', 'v'])
    expect(parseKeybinding('ctrl++', true)[0]!.key).toBe('+')
    expect(parseKeybinding('shift+esc', true)[0]).toMatchObject({ shift: true, key: 'escape' })
    expect(() => parseKeybinding('ctrl+', true)).toThrow()
    expect(() => parseKeybinding('hyper+x', true)).toThrow()
  })

  it('reads keys by where they are, so Option and Shift don’t change them', () => {
    expect(strokeOf(key('∫', 'KeyB', { altKey: true, metaKey: true }))).toMatchObject({ key: 'b', alt: true, meta: true })
    expect(strokeOf(key('_', 'Minus', { ctrlKey: true, shiftKey: true }))).toMatchObject({ key: '-', shift: true })
    expect(strokeOf(key('`', 'Backquote', { ctrlKey: true }))).toMatchObject({ key: '`', ctrl: true })
    expect(strokeOf(key('ArrowUp', 'ArrowUp'))).toMatchObject({ key: 'arrowup' })
    expect(strokeOf(key('Meta', 'MetaLeft', { metaKey: true }))).toBeUndefined()
  })

  it('labels keys for macOS and other systems', () => {
    expect(keybindingLabel(parseKeybinding('shift+cmd+e', true), true)).toBe('⇧⌘E')
    expect(keybindingLabel(parseKeybinding('alt+cmd+b', true), true)).toBe('⌥⌘B')
    expect(keybindingLabel(parseKeybinding('ctrl+shift+g', true), true)).toBe('⌃⇧G')
    expect(keybindingLabel(parseKeybinding('cmd+k v', true), true)).toBe('⌘K V')
    expect(keybindingLabel(parseKeybinding('ctrl+shift+e', false), false)).toBe('Ctrl+Shift+E')
    expect(keybindingLabel(parseKeybinding('ctrl+`', true), true)).toBe('⌃`')
  })
})

describe('commands and keybindings', () => {
  const setup = () => {
    const commands = new CommandRegistry({ mac: true })
    const context = new ContextKeys()
    return { commands, context, keys: new Keybindings(commands, context) }
  }

  it('runs the command bound to a key, while its clause holds', () => {
    const { commands, context, keys } = setup()
    const run = vi.fn()
    commands.register({ id: 'a', title: 'A', keybinding: 'mod+b', when: 'editorFocus', run })
    expect(keys.handle(key('b', 'KeyB', { metaKey: true }))).toEqual({ kind: 'none' })
    context.set('editorFocus', true)
    expect(keys.handle(key('b', 'KeyB', { metaKey: true }))).toEqual({ kind: 'command', id: 'a' })
    expect(run).toHaveBeenCalledOnce()
    expect(commands.tooltip('a')).toBe('A (⌘B)')
  })

  it('waits for the second key of a chord, only when the chord can run', () => {
    const { commands, context, keys } = setup()
    const run = vi.fn()
    commands.register({ id: 'side', title: 'Side', keybinding: 'mod+k v', when: 'markdown', run })
    // In a terminal, ⌘K isn't a chord: it goes on to the terminal.
    expect(keys.handle(key('k', 'KeyK', { metaKey: true }))).toEqual({ kind: 'none' })
    context.set('markdown', true)
    expect(keys.handle(key('k', 'KeyK', { metaKey: true }))).toEqual({ kind: 'chord', label: '⌘K' })
    expect(keys.chord).toBe('⌘K')
    expect(keys.handle(key('Shift', 'ShiftLeft', { shiftKey: true }))).toEqual({ kind: 'none' })
    expect(keys.handle(key('v', 'KeyV'))).toEqual({ kind: 'command', id: 'side' })
    expect(run).toHaveBeenCalledOnce()
    expect(keys.chord).toBeUndefined()
    keys.handle(key('k', 'KeyK', { metaKey: true }))
    expect(keys.handle(key('x', 'KeyX'))).toEqual({ kind: 'unbound', label: '⌘K X' })
  })

  it('lets a host override a command and add keys, newest first', () => {
    const { commands, keys } = setup()
    const builtIn = vi.fn()
    const own = vi.fn()
    commands.register({ id: 'save', title: 'Save', keybinding: 'mod+s', run: builtIn })
    const undo = commands.register({ id: 'save', title: 'Save', keybinding: 'mod+s', run: own })
    keys.handle(key('s', 'KeyS', { metaKey: true }))
    expect(own).toHaveBeenCalledOnce()
    undo()
    keys.handle(key('s', 'KeyS', { metaKey: true }))
    expect(builtIn).toHaveBeenCalledOnce()

    const other = vi.fn()
    commands.register({ id: 'other', title: 'Other', run: other })
    const unbind = commands.bind({ key: 'mod+s', command: 'other', args: [1] })
    keys.handle(key('s', 'KeyS', { metaKey: true }))
    expect(other).toHaveBeenCalledWith(1)
    unbind()
    expect(commands.keyLabel('other')).toBeUndefined()
    expect(() => commands.execute('nothing')).toThrow(/No command/)
  })
})

describe('layout', () => {
  it('toggles parts and keeps them between sessions', () => {
    const storage = new MemoryStorage()
    const layout = new LayoutModel({ storage, key: 'w' })
    expect(layout.state).toMatchObject({ sidebar: true, panel: true, auxiliaryBar: false, view: 'explorer' })
    layout.toggle('sidebar')
    layout.clickView('search')
    expect(layout.state).toMatchObject({ sidebar: true, view: 'search' })
    layout.clickView('search')
    expect(layout.state.sidebar).toBe(false)
    layout.toggleMaximizedPanel()
    layout.setVisible('panel', false)
    expect(layout.state).toMatchObject({ panel: false, panelMaximized: false })
    expect(new LayoutModel({ storage, key: 'w' }).state).toEqual(layout.state)
    storage.setItem('w', '{oops')
    expect(new LayoutModel({ storage, key: 'w', initial: { auxiliaryBar: true } }).state.auxiliaryBar).toBe(true)
  })
})
