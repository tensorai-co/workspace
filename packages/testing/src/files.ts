import type { DirEntry, FileChange, FileSystem } from '@tensorai-workspace/host'

/** One call made to a MemoryFileSystem. */
export interface FileCall {
  method: 'list' | 'read' | 'write' | 'createFile' | 'createDir' | 'rename' | 'delete'
  args: string[]
}

export interface MemoryFileSystemOptions {
  /** How long each call takes, in milliseconds. 0 (the default) settles as soon as promises can. */
  delay?: number
}

type Node = { kind: 'file'; data: Uint8Array } | { kind: 'dir'; children: Map<string, Node> }

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const split = (path: string) => path.split('/').filter(Boolean)

/** Files in memory, made from a plain object of path → text. Paths ending in "/" are empty folders. */
export class MemoryFileSystem implements FileSystem {
  /** Every call so far, in order. */
  readonly calls: FileCall[] = []
  /** Milliseconds each call takes. */
  delay: number
  private readonly root: Node & { kind: 'dir' } = { kind: 'dir', children: new Map() }
  private readonly failures = new Map<string, Error>()
  private readonly watchers = new Set<{ path: string; onChange: (event: FileChange) => void }>()

  constructor(files: Record<string, string> = {}, options: MemoryFileSystemOptions = {}) {
    this.delay = options.delay ?? 0
    for (const [path, text] of Object.entries(files)) {
      const segments = split(path)
      if (path.endsWith('/')) this.makeDir(segments)
      else this.makeDir(segments.slice(0, -1)).children.set(segments[segments.length - 1]!, { kind: 'file', data: encoder.encode(text) })
    }
  }

  /** Makes calls on a path fail with this message, until it's cleared with undefined. */
  fail(path: string, message: string | undefined): void {
    const key = this.normal(path)
    if (message === undefined) this.failures.delete(key)
    else this.failures.set(key, new Error(message))
  }

  /** A file's text, or undefined if there's no such file. Not counted as a call. */
  text(path: string): string | undefined {
    const node = this.find(path)
    return node?.kind === 'file' ? decoder.decode(node.data) : undefined
  }

  /** Whether a file or folder is there. Not counted as a call. */
  exists(path: string): boolean {
    return this.find(path) !== undefined
  }

  /** Changes files as something outside the IDE would: not counted as a call, and reported to watchers. */
  change(path: string, text: string | undefined): void {
    const segments = split(path)
    const name = segments[segments.length - 1]!
    const dir = this.makeDir(segments.slice(0, -1))
    const had = dir.children.has(name)
    if (text === undefined) dir.children.delete(name)
    else dir.children.set(name, { kind: 'file', data: encoder.encode(text) })
    this.emit(path, text === undefined ? 'deleted' : had ? 'changed' : 'created')
  }

  async list(dir: string): Promise<DirEntry[]> {
    await this.begin('list', dir)
    const base = this.normal(dir)
    return [...this.dirAt(dir).children].map(([name, node]) => ({
      name,
      path: base === '/' ? `/${name}` : `${base}/${name}`,
      kind: node.kind,
      size: node.kind === 'file' ? node.data.length : 0,
    }))
  }

  async read(path: string): Promise<Uint8Array> {
    await this.begin('read', path)
    const node = this.find(path)
    if (node?.kind !== 'file') throw new Error(`No such file: ${path}`)
    return node.data.slice()
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    await this.begin('write', path)
    const { dir, name } = this.slot(path)
    const had = dir.children.get(name)
    if (had?.kind === 'dir') throw new Error(`${path} is a folder`)
    dir.children.set(name, { kind: 'file', data: data.slice() })
    this.emit(path, had ? 'changed' : 'created')
  }

  async createFile(path: string): Promise<void> {
    await this.begin('createFile', path)
    const { dir, name } = this.slot(path)
    if (dir.children.has(name)) throw new Error(`${path} already exists`)
    dir.children.set(name, { kind: 'file', data: new Uint8Array() })
    this.emit(path, 'created')
  }

  async createDir(path: string): Promise<void> {
    await this.begin('createDir', path)
    const had = this.exists(path)
    this.makeDir(split(path))
    if (!had) this.emit(path, 'created')
  }

  async rename(from: string, to: string): Promise<void> {
    await this.begin('rename', from, to)
    const source = this.slot(from)
    const node = source.dir.children.get(source.name)
    if (!node) throw new Error(`No such file or folder: ${from}`)
    if (`${this.normal(to)}/`.startsWith(`${this.normal(from)}/`)) throw new Error(`Cannot move ${from} into itself`)
    const target = this.slot(to)
    if (target.dir.children.has(target.name)) throw new Error(`${to} already exists`)
    source.dir.children.delete(source.name)
    target.dir.children.set(target.name, node)
    this.emit(from, 'deleted')
    this.emit(to, 'created')
  }

  async delete(path: string): Promise<void> {
    await this.begin('delete', path)
    const { dir, name } = this.slot(path)
    if (!dir.children.delete(name)) throw new Error(`No such file or folder: ${path}`)
    this.emit(path, 'deleted')
  }

  watch(path: string, onChange: (event: FileChange) => void): () => void {
    const watcher = { path: this.normal(path), onChange }
    this.watchers.add(watcher)
    return () => this.watchers.delete(watcher)
  }

  private async begin(method: FileCall['method'], ...args: string[]) {
    this.calls.push({ method, args })
    if (this.delay > 0) await new Promise((resolve) => setTimeout(resolve, this.delay))
    for (const path of args) {
      const failure = this.failures.get(this.normal(path))
      if (failure) throw failure
    }
  }

  private normal(path: string): string {
    return `/${split(path).join('/')}`
  }

  private find(path: string): Node | undefined {
    let node: Node | undefined = this.root
    for (const segment of split(path)) node = node?.kind === 'dir' ? node.children.get(segment) : undefined
    return node
  }

  private dirAt(path: string): Node & { kind: 'dir' } {
    const node = this.find(path)
    if (node?.kind !== 'dir') throw new Error(`No such folder: ${path}`)
    return node
  }

  private slot(path: string) {
    const segments = split(path)
    const name = segments.pop()
    if (name === undefined) throw new Error('The root folder cannot be changed')
    return { dir: this.dirAt(`/${segments.join('/')}`), name }
  }

  private makeDir(segments: string[]): Node & { kind: 'dir' } {
    let dir = this.root
    for (const segment of segments) {
      let next = dir.children.get(segment)
      if (!next) dir.children.set(segment, (next = { kind: 'dir', children: new Map() }))
      if (next.kind !== 'dir') throw new Error(`${segment} is a file`)
      dir = next
    }
    return dir
  }

  private emit(path: string, kind: FileChange['kind']) {
    const at = this.normal(path)
    for (const w of [...this.watchers]) if (w.path === '/' || at === w.path || at.startsWith(`${w.path}/`)) w.onChange({ path: at, kind })
  }
}
