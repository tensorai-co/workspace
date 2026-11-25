import { describe, expect, it, vi } from 'vitest'
import { distinguish, runTabsKey, TabsModel } from '../src/core/index.js'

const make = (...ids: string[]) => {
  const model = new TabsModel<string>((s) => s)
  for (const id of ids) model.open(id)
  return model
}
/** The tabs as text: [] around the active one, ~ for a preview, * for unsaved changes. */
const show = (m: TabsModel<string>) =>
  m.tabs.map((t) => {
    const text = `${t.preview ? '~' : ''}${t.id}${t.dirty ? '*' : ''}`
    return m.active === t ? `[${text}]` : text
  }).join(' ')

describe('opening', () => {
  it('puts new tabs to the right of the active one', () => {
    const m = make('a', 'b', 'c')
    m.activate('a')
    m.open('d')
    expect(show(m)).toBe('a [d] b c')
    m.open('c')
    expect(show(m)).toBe('a d b [c]')
    m.open('e', { activate: false })
    expect(show(m)).toBe('a d b [c] e')
    m.open('f', { index: 0 })
    expect(show(m)).toBe('[f] a d b c e')
  })

  it('has one preview, which the next one replaces', () => {
    const m = make('a', 'b')
    m.open('p', { preview: true })
    expect(show(m)).toBe('a b [~p]')
    m.activate('a')
    m.open('q', { preview: true })
    expect(show(m)).toBe('a [~q] b')
    // Opening it for good keeps it, and so does editing it.
    m.open('q')
    expect(show(m)).toBe('a [q] b')
    m.open('r', { preview: true })
    m.setDirty('r', true)
    m.open('s', { preview: true })
    expect(show(m)).toBe('a q r* [~s] b')
    m.keep('s')
    expect(show(m)).toBe('a q r* [s] b')
    // Previewing a tab that's already open just shows it.
    m.open('a', { preview: true })
    expect(show(m)).toBe('[a] q r* s b')
  })
})

describe('closing', () => {
  it('goes back to the tab used before', () => {
    const m = make('a', 'b', 'c', 'd')
    m.activate('b')
    m.activate('d')
    m.close('d')
    expect(show(m)).toBe('a [b] c')
    m.close('a')
    expect(show(m)).toBe('[b] c')
    m.close('b')
    m.close('c')
    expect(m.active).toBeUndefined()
    m.open('z')
    expect(show(m)).toBe('[z]')
  })

  it('closes several at once, with one change', () => {
    const m = make('a', 'b', 'c', 'd')
    const heard = vi.fn()
    m.subscribe(heard)
    m.closeAll(['c', 'd', 'nope'])
    expect(show(m)).toBe('a [b]')
    expect(heard).toHaveBeenCalledTimes(1)
    m.closeAll()
    expect(show(m)).toBe('')
  })
})

describe('moving', () => {
  it('reorders, and moves to another list with its state', () => {
    const m = make('a', 'b', 'c')
    m.move('a', 2)
    expect(show(m)).toBe('b [c] a')
    m.move('a', 0)
    expect(show(m)).toBe('a b [c]')
    const other = make('x', 'y')
    m.setDirty('c', true)
    m.moveTo('c', other, 1)
    expect(show(m)).toBe('a [b]')
    expect(show(other)).toBe('x [c*] y')
    // It's already open there: that tab moves into place.
    m.open('x')
    m.moveTo('x', other, 2)
    expect(show(other)).toBe('c* y [x]')
  })

  it('follows a rename', () => {
    const m = make('a', 'b', 'c')
    m.setDirty('b', true)
    m.activate('b')
    m.replace('b', 'B')
    expect(show(m)).toBe('a [B*] c')
    m.activate('a')
    m.close('a')
    expect(show(m)).toBe('[B*] c')
    m.replace('B', 'c')
    expect(show(m)).toBe('[c*]')
  })
})

describe('saving', () => {
  it('restores what was open, leaving out what is gone', () => {
    const m = make('a', 'b', 'c')
    m.open('p', { preview: true })
    m.activate('b')
    const saved = JSON.parse(JSON.stringify(m.save()))
    const next = new TabsModel<string>((s) => s)
    next.restore(saved, (id) => (id === 'c' ? undefined : id))
    expect(show(next)).toBe('a [b] ~p')
    next.close('b')
    expect(show(next)).toBe('a [~p]')
    const none = new TabsModel<string>((s) => s)
    none.restore(saved, (id) => (id === 'b' ? undefined : id))
    expect(show(none)).toBe('a c [~p]')
  })
})

describe('keys', () => {
  const press = (model: TabsModel<string>, key: string, mods = {}, mac = true, close = (id: string) => void model.close(id)) => runTabsKey({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods }, { model, mac, close })

  it('cycles and closes', () => {
    const m = make('a', 'b', 'c')
    press(m, 'Tab', { ctrlKey: true })
    expect(show(m)).toBe('[a] b c')
    press(m, 'Tab', { ctrlKey: true, shiftKey: true })
    expect(show(m)).toBe('a b [c]')
    press(m, 'ArrowLeft', { metaKey: true, altKey: true })
    expect(show(m)).toBe('a [b] c')
    press(m, 'PageDown', { ctrlKey: true }, false)
    expect(show(m)).toBe('a b [c]')
    press(m, 'w', { metaKey: true })
    expect(show(m)).toBe('a [b]')
    expect(press(m, 'w')).toBe(false)
    expect(press(m, 'ArrowLeft')).toBe(false)
  })
})

describe('telling names apart', () => {
  it('uses the fewest folders', () => {
    expect(distinguish(['src/a.ts', 'src/b.ts'])).toEqual([undefined, undefined])
    expect(distinguish(['src/a/index.ts', 'src/b/index.ts', 'x.ts'])).toEqual(['…/a', '…/b', undefined])
    expect(distinguish(['one/lib/index.ts', 'two/lib/index.ts'])).toEqual(['one/lib', 'two/lib'])
    expect(distinguish(['index.ts', 'lib/index.ts'])).toEqual([undefined, 'lib'])
    expect(distinguish(['p/one/lib/index.ts', 'p/two/lib/index.ts'])).toEqual(['…/one/lib', '…/two/lib'])
    expect(distinguish(['a/x.ts', 'a/x.ts'])).toEqual([undefined, undefined])
  })
})
