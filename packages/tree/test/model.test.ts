import { describe, expect, it, vi } from 'vitest'
import { runTreeKey, TreeModel, type TreeSource } from '../src/core/index.js'

type Item = { id: string; kids?: Item[] }
const dir = (id: string, ...kids: Item[]): Item => ({ id, kids })
const file = (id: string): Item => ({ id })

const source = (roots: Item[], delay = false): TreeSource<Item> & { roots: Item[]; loads: string[] } => ({
  roots,
  loads: [],
  id: (i) => i.id,
  label: (i) => i.id.split('/').pop()!,
  hasChildren: (i) => !!i.kids,
  children(i) {
    this.loads.push(i?.id ?? '')
    const items = i ? i.kids! : this.roots
    return delay ? Promise.resolve(items) : items
  },
})

const sample = () => [dir('a', dir('a/b', file('a/b/c'), file('a/b/d')), file('a/e')), dir('f', file('f/g')), file('h')]
const make = (delay = false) => {
  const src = source(sample(), delay)
  return { src, model: new TreeModel(src) }
}
/** The rows as text: indent, then v or > for open and closed, * for selected, and [] around the focus. */
const show = (m: TreeModel<Item>) =>
  m.rows.map((n) => {
    const text = `${n.expandable ? (n.expanded ? 'v ' : '> ') : ''}${n.id}${m.isSelected(n.id) ? '*' : ''}`
    return '  '.repeat(n.depth) + (m.focused === n ? `[${text}]` : text)
  })
const press = (model: TreeModel<Item>, key: string, mods: Partial<{ shiftKey: boolean; metaKey: boolean }> = {}, open = vi.fn()) =>
  runTreeKey({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods }, { model, pageSize: 3, multiSelect: true, mac: true, open })

describe('loading', () => {
  it('loads children when they are first shown, and only then', async () => {
    const { src, model } = make(true)
    expect(show(model)).toEqual([])
    await model.load()
    expect(show(model)).toEqual(['> a', '> f', 'h'])
    await model.expand('a')
    expect(show(model)).toEqual(['v a', '  > a/b', '  a/e', '> f', 'h'])
    model.collapse('a')
    await model.expand('a')
    expect(src.loads).toEqual(['', 'a'])
  })

  it('opens what was open before, level by level', async () => {
    const src = source(sample(), true)
    const model = new TreeModel(src, { expanded: ['a/b', 'a', 'gone'] })
    await model.load()
    expect(show(model)).toEqual(['v a', '  v a/b', '    a/b/c', '    a/b/d', '  a/e', '> f', 'h'])
    expect(model.expandedIds.sort()).toEqual(['a', 'a/b', 'gone'])
  })

  it('closes an item again when loading fails, and reports it', async () => {
    const src = source(sample())
    const children = src.children
    src.children = function (i) {
      return i?.id === 'f' ? Promise.reject(new Error('no')) : children.call(this, i)
    }
    const errors: unknown[] = []
    const model = new TreeModel(src, { onError: (e, id) => errors.push([(e as Error).message, id]) })
    await model.load()
    await model.expand('f')
    expect(show(model)).toEqual(['> a', '> f', 'h'])
    expect(errors).toEqual([['no', 'f']])
  })

  it('shows a spinner only for slow loads', async () => {
    vi.useFakeTimers()
    const src = source(sample())
    let finish!: (items: Item[]) => void
    const children = src.children
    src.children = function (i) {
      return i?.id === 'f' ? new Promise<Item[]>((r) => (finish = r)) : children.call(this, i)
    }
    const model = new TreeModel(src)
    await model.load()
    const done = model.expand('f')
    expect(model.node('f')).toMatchObject({ loading: true, slow: false })
    vi.advanceTimersByTime(801)
    expect(model.node('f')).toMatchObject({ loading: true, slow: true })
    finish([file('f/g')])
    await done
    expect(model.node('f')).toMatchObject({ loading: false, slow: false })
    vi.useRealTimers()
  })

  it('ignores the results of a load that a newer one replaced', async () => {
    const answers: ((items: Item[]) => void)[] = []
    const model = new TreeModel<Item>({ id: (i) => i.id, label: (i) => i.id, hasChildren: () => false, children: () => new Promise((r) => answers.push(r)) })
    const first = model.load()
    const second = model.refresh()
    answers[1]!([file('new')])
    answers[0]!([file('old')])
    await Promise.all([first, second])
    expect(show(model)).toEqual(['new'])
  })
})

describe('refreshing', () => {
  it('keeps expansion, focus and selection by id', async () => {
    const { src, model } = make()
    await model.load()
    await model.expand('a')
    await model.expand('a/b')
    model.select('a/b/d')
    src.roots = [dir('0'), dir('a', file('a/a'), dir('a/b', file('a/b/d'))), file('h')]
    await model.refresh()
    expect(show(model)).toEqual(['> 0', 'v a', '  a/a', '  v a/b', '    [a/b/d*]', 'h'])
  })

  it('moves the focus to what took the place of a deleted item', async () => {
    const { src, model } = make()
    await model.load()
    model.select('f')
    src.roots = [dir('a'), file('h')]
    await model.refresh()
    expect(show(model)).toEqual(['> a', '[h]'])
    src.roots = [dir('a')]
    await model.refresh()
    expect(show(model)).toEqual(['[> a]'])
  })

  it('reloads a closed item when it next opens, with what was open inside it', async () => {
    const { src, model } = make()
    await model.load()
    await model.expand('a')
    await model.expand('a/b')
    model.collapse('a')
    src.roots[0]!.kids!.push(file('a/z'))
    await model.refresh('a')
    await model.expand('a')
    expect(show(model)).toEqual(['v a', '  v a/b', '    a/b/c', '    a/b/d', '  a/e', '  a/z', '> f', 'h'])
  })
})

describe('keys', () => {
  it('moves, opens and closes with the keys', async () => {
    const { model } = make()
    await model.load()
    press(model, 'ArrowDown')
    expect(show(model)[0]).toBe('[> a]')
    press(model, 'ArrowRight')
    press(model, 'ArrowRight')
    expect(show(model).slice(0, 2)).toEqual(['v a', '  [> a/b]'])
    press(model, 'ArrowLeft')
    expect(show(model)[0]).toBe('[v a]')
    press(model, 'ArrowLeft')
    expect(show(model)).toEqual(['[> a]', '> f', 'h'])
    press(model, 'End')
    expect(show(model)[2]).toBe('[h]')
    press(model, 'ArrowDown')
    expect(show(model)[2]).toBe('[h]')
    press(model, 'PageUp')
    expect(show(model)[0]).toBe('[> a]')
    press(model, '*')
    expect(show(model)).toEqual(['[v a]', '  > a/b', '  a/e', 'v f', '  f/g', 'h'])
    press(model, 'ArrowLeft', { metaKey: true })
    expect(show(model)).toEqual(['[> a]', '> f', 'h'])
  })

  it('moving the focus leaves the selection; shift extends it', async () => {
    const { model } = make()
    await model.load()
    model.select('a')
    press(model, 'ArrowDown')
    expect(show(model)).toEqual(['> a*', '[> f]', 'h'])
    press(model, 'ArrowUp', { shiftKey: true })
    expect(show(model)).toEqual(['[> a*]', '> f*', 'h'])
    press(model, 'a', { metaKey: true })
    expect(model.selection).toEqual(['a', 'f', 'h'])
    press(model, 'Escape')
    expect(model.selection).toEqual([])
  })

  it('Space previews a file, Enter opens it, and either toggles a folder', async () => {
    const { model } = make()
    const open = vi.fn()
    await model.load()
    press(model, 'End')
    press(model, ' ', {}, open)
    press(model, 'Enter', {}, open)
    expect(open.mock.calls).toEqual([[file('h'), { preview: true }], [file('h'), { preview: false }]])
    press(model, 'Home')
    press(model, ' ', {}, open)
    expect(show(model)[0]).toBe('[v a]')
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('finds by typing', async () => {
    const model = new TreeModel(source(['src', 'spec', 'server', 'README.md', 'my notes'].map(file)))
    await model.load()
    model.typeToFind('s', 0)
    expect(model.focused?.id).toBe('src')
    model.typeToFind('e', 300)
    expect(model.focused?.id).toBe('server')
    // After a pause, one letter at a time goes round the matches.
    model.typeToFind('s', 2000)
    expect(model.focused?.id).toBe('src')
    model.typeToFind('s', 4000)
    expect(model.focused?.id).toBe('spec')
    // Anywhere in the name, when nothing starts with it.
    model.typeToFind('n', 6000)
    expect(model.focused?.id).toBe('my notes')
    expect(model.typeToFind('zz', 8000)).toBe(false)
  })
})

describe('selection', () => {
  it('toggles, and takes ranges from the anchor', async () => {
    const { model } = make()
    await model.load()
    await model.expand('a')
    model.select('a/b')
    model.select('h', 'toggle')
    expect(model.selection).toEqual(['a/b', 'h'])
    model.select('a/b', 'toggle')
    expect(model.selection).toEqual(['h'])
    model.select('a/e')
    model.select('h', 'range')
    expect(model.selection).toEqual(['a/e', 'f', 'h'])
    model.select('a', 'range')
    expect(model.selection).toEqual(['a', 'a/b', 'a/e'])
  })

  it('closing a folder takes the focus out of it', async () => {
    const { model } = make()
    await model.load()
    await model.expand('a')
    await model.expand('a/b')
    model.select('a/b/c')
    model.collapse('a')
    expect(show(model)).toEqual(['[> a]', '> f', 'h'])
    expect(model.selection).toEqual([])
  })

  it('the active guides belong to what holds the focus and selection', async () => {
    const { model } = make()
    await model.load()
    await model.expand('a')
    await model.expand('a/b')
    model.select('a/b/c')
    expect([...model.activeGuides()]).toEqual(['a/b'])
    model.select('a')
    expect([...model.activeGuides()]).toEqual(['a'])
    model.select('h')
    expect([...model.activeGuides()]).toEqual([])
  })
})

describe('revealing', () => {
  it('opens the way to an item', async () => {
    const { model } = make(true)
    expect(await model.revealPath(['a', 'a/b', 'a/b/d'])).toBe(true)
    expect(show(model)).toEqual(['v a', '  v a/b', '    a/b/c', '    [a/b/d*]', '  a/e', '> f', 'h'])
    expect(model.reveal).toEqual({ id: 'a/b/d', center: true })
    expect(await model.revealPath(['a', 'nope', 'x'])).toBe(false)
  })
})

describe('size', () => {
  it('handles 100,000 rows', async () => {
    const model = new TreeModel(source([dir('big', ...Array.from({ length: 100_000 }, (_, i) => file(`big/${i}`)))]))
    await model.load()
    await model.expand('big')
    expect(model.rows).toHaveLength(100_001)
    model.focusLast()
    const start = performance.now()
    for (let i = 0; i < 1000; i++) model.moveFocus(-1)
    expect(model.focused?.id).toBe('big/98999')
    // A thousand arrow presses: well under a frame's worth each.
    expect(performance.now() - start).toBeLessThan(200)
  })
})
