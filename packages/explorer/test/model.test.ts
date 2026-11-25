import { MemoryFileSystem } from '@tensorai-workspace/testing'
import { describe, expect, it, vi } from 'vitest'
import { checkName, compareEntries, ExplorerModel, type ExplorerModelOptions } from '../src/core/index.js'

const files = { 'src/main.tsx': 'x', 'src/lib/a.ts': '', 'src/lib/b.ts': '', 'docs/guide.md': '', 'README.md': '', '.gitignore': '' }
const make = async (options: Partial<ExplorerModelOptions> = {}) => {
  const fs = new MemoryFileSystem(files)
  const errors: string[] = []
  const model = new ExplorerModel({ fs, root: '/', onError: (m) => errors.push(m), ...options })
  await model.tree.load()
  return { fs, model, errors }
}
const show = (m: ExplorerModel) => m.tree.rows.map((n) => '  '.repeat(n.depth) + (n.item.draft ? '<new>' : n.item.name) + (n.expanded ? '/' : '') + (m.tree.focused === n ? ' <' : ''))

describe('order', () => {
  it('sorts folders first, then by name', () => {
    const names = ['file10.ts', 'file2.ts', 'README.md', '.gitignore', 'Cargo.toml', 'a.ts', 'B.ts']
    const sorted = [...names.map((name) => ({ name, kind: 'file' })), { name: 'zed', kind: 'dir' }].sort(compareEntries).map((e) => e.name)
    expect(sorted).toEqual(['zed', '.gitignore', 'a.ts', 'B.ts', 'Cargo.toml', 'file2.ts', 'file10.ts', 'README.md'])
  })
})

describe('names', () => {
  it('are checked before they’re made', () => {
    expect(checkName('a.ts', ['b.ts'])).toBeUndefined()
    expect(checkName('lib/deep/a.ts', [])).toBeUndefined()
    expect(checkName('lib/', [])).toBeUndefined()
    expect(checkName('  ', [])).toMatchObject({ kind: 'error', text: 'A file or folder name must be provided.' })
    expect(checkName('/a', [])).toMatchObject({ kind: 'error', text: 'A file or folder name cannot start with a slash.' })
    expect(checkName('b.ts', ['b.ts'])).toMatchObject({ kind: 'error', text: expect.stringContaining('already exists') })
    expect(checkName('../a', [])).toMatchObject({ kind: 'error', text: expect.stringContaining('is not valid') })
    expect(checkName('a//b', [])).toMatchObject({ kind: 'error' })
    expect(checkName('a.ts ', [])).toMatchObject({ kind: 'warning' })
  })
})

describe('new files and folders', () => {
  it('names a file among its kind, makes it, selects and opens it', async () => {
    const onCreate = vi.fn()
    const { fs, model } = await make({ onCreate })
    await model.tree.expand('/src')
    model.tree.select('/src/main.tsx')
    await model.startNew('file')
    expect(show(model)).toEqual(['docs', 'src/', '  lib', '  <new>', '  main.tsx <', '.gitignore', 'README.md'])
    expect(await model.commitEdit('App.tsx')).toBe('/src/App.tsx')
    expect(show(model)).toEqual(['docs', 'src/', '  lib', '  App.tsx <', '  main.tsx', '.gitignore', 'README.md'])
    expect(fs.text('/src/App.tsx')).toBe('')
    expect(onCreate).toHaveBeenCalledWith('/src/App.tsx', 'file')
    expect(model.editing).toBeUndefined()
  })

  it('makes the folders on the way', async () => {
    const { fs, model } = await make()
    await model.startNew('file', '/docs')
    await model.commitEdit('api/v1/index.md')
    expect(fs.exists('/docs/api/v1/index.md')).toBe(true)
    expect(show(model)).toEqual(['docs/', '  api/', '    v1/', '      index.md <', '  guide.md', 'src', '.gitignore', 'README.md'])
  })

  it('makes folders, and can be cancelled', async () => {
    const { fs, model } = await make()
    await model.startNew('dir', '/')
    expect(show(model)[0]).toBe('<new>')
    model.cancelEdit()
    expect(show(model)).toEqual(['docs', 'src', '.gitignore', 'README.md'])
    await model.startNew('dir', '/')
    await model.commitEdit('tests')
    expect(fs.exists('/tests')).toBe(true)
    expect(show(model)).toEqual(['docs', 'src', 'tests <', '.gitignore', 'README.md'])
  })

  it('refuses a name that is taken, and reports what the disk refuses', async () => {
    const { fs, model, errors } = await make()
    await model.startNew('file', '/')
    expect(await model.commitEdit('README.md')).toBeUndefined()
    expect(model.editing).toBeDefined()
    fs.fail('/x.ts', 'Permission denied')
    expect(await model.commitEdit('x.ts')).toBeUndefined()
    expect(errors).toEqual(['Permission denied'])
    expect(show(model)).toEqual(['docs', 'src', '.gitignore', 'README.md'])
  })
})

describe('renaming', () => {
  it('selects the name without its extension', async () => {
    const { model } = await make()
    const at = (path: string) => (model.startRename(path), model.editing!.selection)
    expect(at('/README.md')).toEqual([0, 6])
    expect(at('/.gitignore')).toEqual([0, 10])
    expect(at('/src')).toEqual([0, 3])
  })

  it('keeps what was open inside a folder', async () => {
    const onRename = vi.fn()
    const { fs, model } = await make({ onRename })
    await model.tree.expand('/src')
    await model.tree.expand('/src/lib')
    model.startRename('/src')
    await model.commitEdit('app')
    expect(fs.text('/app/main.tsx')).toBe('x')
    expect(show(model)).toEqual(['app/ <', '  lib/', '    a.ts', '    b.ts', '  main.tsx', 'docs', '.gitignore', 'README.md'])
    expect(onRename).toHaveBeenCalledWith('/src', '/app')
  })

  it('does nothing for the same name', async () => {
    const { fs, model } = await make()
    model.startRename('/README.md')
    await model.commitEdit('README.md')
    expect(fs.calls.map((c) => c.method)).toEqual(['list'])
    expect(model.editing).toBeUndefined()
  })
})

describe('deleting', () => {
  it('deletes the selection, without the parts inside other parts', async () => {
    const onDelete = vi.fn()
    const { fs, model } = await make({ onDelete })
    await model.tree.expand('/src')
    model.tree.select('/src')
    model.tree.select('/src/main.tsx', 'toggle')
    model.tree.select('/README.md', 'toggle')
    expect(model.targets('/src')).toEqual(['/src', '/README.md'])
    expect(model.targets('/docs')).toEqual(['/docs'])
    await model.delete(model.targets('/src'))
    expect(fs.exists('/src')).toBe(false)
    expect(onDelete).toHaveBeenCalledWith(['/src', '/README.md'])
    expect(show(model)).toEqual(['docs', '.gitignore <'])
  })

  it("asks in the words", async () => {
    const { model } = await make()
    expect(model.deleteQuestion(['/README.md']).message).toBe("Are you sure you want to permanently delete 'README.md'?")
    expect(model.deleteQuestion(['/src']).message).toBe("Are you sure you want to permanently delete 'src' and its contents?")
    expect(model.deleteQuestion(['/README.md', '/.gitignore']).message).toBe('Are you sure you want to permanently delete the following 2 files?')
  })
})

describe('staying current', () => {
  it('follows changes made outside, but not while a row is being named', async () => {
    vi.useFakeTimers()
    const { fs, model } = await make()
    const stop = model.watch()
    await model.tree.expand('/src')
    fs.change('/src/new.ts', '')
    await vi.advanceTimersByTimeAsync(60)
    expect(show(model)).toContain('  new.ts')
    await model.startNew('file', '/src')
    fs.change('/src/other.ts', '')
    await vi.advanceTimersByTimeAsync(60)
    expect(show(model)).toContain('  <new>')
    expect(show(model)).not.toContain('  other.ts')
    model.cancelEdit()
    await vi.advanceTimersByTimeAsync(60)
    expect(show(model)).toContain('  other.ts')
    stop()
    fs.change('/src/late.ts', '')
    await vi.advanceTimersByTimeAsync(60)
    expect(show(model)).not.toContain('  late.ts')
    vi.useRealTimers()
  })

  it('reveals a file, opening the way', async () => {
    const { model } = await make()
    expect(await model.reveal('/src/lib/b.ts')).toBe(true)
    expect(show(model)).toEqual(['docs', 'src/', '  lib/', '    a.ts', '    b.ts <', '  main.tsx', '.gitignore', 'README.md'])
    expect(await model.reveal('/nope/x')).toBe(false)
    expect(await model.reveal('/')).toBe(false)
  })
})

it('works in a folder that is not the root of the file system', async () => {
  const { model } = await make({ root: '/src/' })
  expect(show(model)).toEqual(['lib', 'main.tsx'])
  await model.startNew('file')
  expect(await model.commitEdit('z.ts')).toBe('/src/z.ts')
  expect(await model.reveal('/README.md')).toBe(false)
})
