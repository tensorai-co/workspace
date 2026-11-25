import { describe, expect, it } from 'vitest'
import type { FileChange } from '@tensorai-co/workspace/host'
import { MemoryFileSystem } from '../src/index.js'

describe('MemoryFileSystem', () => {
  it('lists, creates, renames and deletes', async () => {
    const fs = new MemoryFileSystem({ 'src/main.tsx': 'x', 'README.md': '# hi', 'empty/': '' })
    expect((await fs.list('/')).map((e) => `${e.kind}:${e.path}`)).toEqual(['dir:/src', 'file:/README.md', 'dir:/empty'])
    await fs.createFile('/src/a.ts')
    await fs.createDir('/deep/er')
    await fs.rename('/src', '/lib')
    expect(fs.text('/lib/main.tsx')).toBe('x')
    expect(fs.exists('/src')).toBe(false)
    await fs.delete('/lib')
    expect(fs.exists('/lib/main.tsx')).toBe(false)
    await fs.write('/README.md', new TextEncoder().encode('new'))
    expect(new TextDecoder().decode(await fs.read('/README.md'))).toBe('new')
    expect(fs.calls.map((c) => c.method)).toEqual(['list', 'createFile', 'createDir', 'rename', 'delete', 'write', 'read'])
  })

  it('refuses what a disk would', async () => {
    const fs = new MemoryFileSystem({ 'a/b.ts': '', 'c.ts': '' })
    await expect(fs.createFile('/c.ts')).rejects.toThrow('already exists')
    await expect(fs.rename('/a', '/a/inner')).rejects.toThrow('into itself')
    await expect(fs.rename('/a/b.ts', '/c.ts')).rejects.toThrow('already exists')
    await expect(fs.list('/nope')).rejects.toThrow('No such folder')
    fs.fail('/a', 'Permission denied')
    await expect(fs.list('/a')).rejects.toThrow('Permission denied')
    fs.fail('/a', undefined)
    await expect(fs.list('/a')).resolves.toHaveLength(1)
  })

  it('reports changes under a watched folder', async () => {
    const fs = new MemoryFileSystem({ 'a/b.ts': '' })
    const seen: FileChange[] = []
    const stop = fs.watch('/a', (e) => seen.push(e))
    fs.change('/a/c.ts', 'hi')
    fs.change('/elsewhere.ts', 'hi')
    await fs.delete('/a/b.ts')
    stop()
    fs.change('/a/d.ts', 'hi')
    expect(seen).toEqual([{ path: '/a/c.ts', kind: 'created' }, { path: '/a/b.ts', kind: 'deleted' }])
  })
})
