import { MemoryStorage } from '@tensorai-workspace/testing'
import { describe, expect, it, vi } from 'vitest'
import { CommandHistory, commandItems, CommandRegistry, ContextKeys, fileItems, keyCaps, lineItems, matchesCommand, matchesWords, scoreFile } from '../src/core/index.js'

const text = (label: string, m: { start: number; end: number }[] | null) => m?.map((x) => label.slice(x.start, x.end))

describe('matching', () => {
  it('matches commands by substring, or by the starts of words', () => {
    const label = 'View: Toggle Primary Side Bar Visibility'
    expect(text(label, matchesCommand('toggle side', label))).toEqual(['Toggle ', 'Side'])
    expect(text(label, matchesCommand('primary', label))).toEqual(['Primary'])
    expect(text(label, matchesWords('tpsb', label))).toEqual(['T', 'P', 'S', 'B'])
    expect(matchesCommand('xyz', label)).toBeNull()
    expect(text('Café: Open', matchesCommand('cafe', 'Café: Open'))).toEqual(['Café'])
  })

  it('scores files by name first, with runs and word starts counting', () => {
    const app = scoreFile('app', 'App.tsx', 'src')!
    const deep = scoreFile('app', 'mapping.ts', 'lib/apparatus')!
    expect(app.score).toBeGreaterThan(deep.score)
    expect(app.name).toEqual([{ start: 0, end: 3 }])
    expect(scoreFile('srcapp', 'App.tsx', 'src')).not.toBeNull()
    expect(scoreFile('src app', 'App.tsx', 'src')!.folder).toEqual([{ start: 0, end: 3 }])
    expect(scoreFile('zzz', 'App.tsx', 'src')).toBeNull()
  })
})

describe('quick items', () => {
  it('lists commands whose clause holds, the recently used first', () => {
    const commands = new CommandRegistry({ mac: true })
    const context = new ContextKeys()
    const run = vi.fn()
    commands.register(
      { id: 'a', title: 'Toggle Panel', category: 'View', keybinding: 'mod+j', run },
      { id: 'b', title: 'Save', category: 'File', keybinding: 'mod+s', run },
      { id: 'c', title: 'Hidden', category: 'View', when: 'never', run },
      { id: 'd', title: 'Close Editor', category: 'View', run },
    )
    const history = new CommandHistory(new MemoryStorage())
    expect(commandItems(commands, context, history, '', run).map((i) => i.label)).toEqual(['File: Save', 'View: Close Editor', 'View: Toggle Panel'])
    history.add('a')
    const items = commandItems(commands, context, history, '', run)
    expect(items.map((i) => [i.label, i.separator, i.border, i.keybinding])).toEqual([
      ['View: Toggle Panel', 'recently used', undefined, '⌘J'],
      ['File: Save', 'other commands', true, '⌘S'],
      ['View: Close Editor', undefined, undefined, undefined],
    ])
    items[0]!.run!()
    expect(run).toHaveBeenCalledWith('a')
    expect(commandItems(commands, context, history, 'qqq', run)[0]).toMatchObject({ label: 'No matching commands', disabled: true })
  })

  it('keeps the command history between sessions', () => {
    const storage = new MemoryStorage()
    const h = new CommandHistory(storage)
    h.add('x')
    h.add('y')
    h.add('x')
    expect(new CommandHistory(storage).recent).toEqual(['x', 'y'])
  })

  it('lists files, the recently opened first, and matched ones by score', () => {
    const files = ['/p/src/App.tsx', '/p/src/server.ts', '/p/README.md']
    const open = vi.fn()
    const all = fileItems(files, '/p', '', ['/p/README.md'], open)
    expect(all.map((i) => [i.label, i.description, i.separator])).toEqual([
      ['README.md', undefined, 'recently opened'],
      ['App.tsx', 'src', 'files'],
      ['server.ts', 'src', undefined],
    ])
    const found = fileItems(files, '/p', 'serv', [], open)
    expect(found.map((i) => i.label)).toEqual(['server.ts'])
    found[0]!.run!()
    expect(open).toHaveBeenCalledWith('/p/src/server.ts')
  })

  it('goes to a line, as ":12" or ":12:5"', () => {
    const go = vi.fn()
    expect(lineItems('', 40, { line: 3, column: 7 }, go)[0]!.label).toBe('Current Line: 3, Character: 7. Type a line number between 1 and 40 to navigate to.')
    const [to] = lineItems('12:5', 40, undefined, go)
    expect(to!.label).toBe('Go to line 12, character 5.')
    to!.run!()
    expect(go).toHaveBeenCalledWith(12, 5)
    expect(lineItems('99', 40, undefined, go)[0]!.label).toBe('Go to line 40.')
    expect(lineItems('5', undefined, undefined, go)[0]!.disabled).toBe(true)
  })

  it('splits keys into caps', () => {
    expect(keyCaps('⌥⌘B', true)).toEqual([['⌥', '⌘', 'B']])
    expect(keyCaps('⌘K ⌘0', true)).toEqual([['⌘', 'K'], ['⌘', '0']])
    expect(keyCaps('Ctrl+Shift+P', false)).toEqual([['Ctrl', 'Shift', 'P']])
  })
})
