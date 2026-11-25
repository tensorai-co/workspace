import type { DirEntry, FileChange, FileSystem } from '@tensorai-workspace/host'
import { TreeModel, type TreeMessage } from '@tensorai-workspace/tree/core'
import { checkName, compareEntries } from './names.js'
import { baseName, dirName, isInside, joinPath, normalPath, topmost } from './paths.js'

/** A file or folder in the explorer. */
export interface ExplorerEntry extends DirEntry {
  /** The row a new file or folder is being named in. It isn't on disk. */
  draft?: boolean
}

/** A row being named: an existing one, or a new file or folder in `dir`. */
export interface ExplorerEdit {
  kind: 'rename' | 'file' | 'dir'
  /** The row's id in the tree. */
  id: string
  dir: string
  value: string
  selection: [from: number, to: number]
}

export interface ExplorerModelOptions {
  fs: FileSystem
  root: string
  /** Folders to open as they appear, such as those saved from an earlier session. */
  expanded?: Iterable<string>
  /** Something failed: show the message. */
  onError?: (message: string) => void
  onCreate?: (path: string, kind: 'file' | 'dir') => void
  onRename?: (from: string, to: string) => void
  onDelete?: (paths: string[]) => void
}

/** Changes on disk are gathered for this long before the tree reloads. */
const WATCH_MS = 50

/** The explorer's state and actions, with no DOM: a tree of a folder's files, kept current, and edited through a FileSystem. */
export class ExplorerModel {
  readonly tree: TreeModel<ExplorerEntry>
  readonly root: string
  private readonly fs: FileSystem
  private edit: ExplorerEdit | undefined
  private readonly stale = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly listeners = new Set<() => void>()
  private version = 0

  constructor(private readonly options: ExplorerModelOptions) {
    this.fs = options.fs
    this.root = normalPath(options.root)
    this.tree = new TreeModel<ExplorerEntry>(
      {
        id: (e) => e.path,
        label: (e) => e.name,
        hasChildren: (e) => e.kind === 'dir',
        children: async (e) => (await this.fs.list(e?.path ?? this.root)).sort(compareEntries),
      },
      { expanded: options.expanded, onError: (error) => this.report(error) },
    )
  }

  // ------------------------------------------------------------ reading

  /** The row being named, if any. */
  get editing(): ExplorerEdit | undefined {
    return this.edit
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getVersion = (): number => this.version

  /** What an action applies to: the whole selection when `path` is part of it, otherwise just `path`. */
  targets(path: string): string[] {
    const { selection } = this.tree
    return selection.includes(path) ? topmost(selection) : [path]
  }

  /** The folder a new file goes in: the focused folder, or the one the focused file is in. */
  get targetDir(): string {
    const entry = this.tree.focused?.item
    if (!entry) return this.root
    return entry.kind === 'dir' ? entry.path : dirName(entry.path)
  }

  // ------------------------------------------------------------ staying current

  /** Follows changes made outside, if the file system can watch. Returns a function that stops. */
  watch(): () => void {
    const stop = this.fs.watch?.(this.root, (change) => this.changedOutside(change))
    return () => {
      stop?.()
      clearTimeout(this.timer)
      this.timer = undefined
    }
  }

  private changedOutside(change: FileChange) {
    if (change.kind === 'changed') return
    this.stale.add(dirName(normalPath(change.path)))
    this.flushSoon()
  }

  private flushSoon() {
    if (this.timer !== undefined || this.edit || !this.stale.size) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      if (this.edit) return
      const dirs = topmost([...this.stale])
      this.stale.clear()
      for (const dir of dirs) void this.refreshDir(dir)
    }, WATCH_MS)
  }

  /** Reloads the whole tree. */
  refresh(): Promise<void> {
    this.cancelEdit()
    this.stale.clear()
    return this.tree.refresh()
  }

  private refreshDir(dir: string): Promise<void> {
    if (dir === this.root) return this.tree.refresh()
    return this.tree.refresh(dir)
  }

  /** Opens the way to a file or folder, selects it and scrolls to it. */
  reveal(path: string): Promise<boolean> {
    const target = normalPath(path)
    if (target === this.root || !isInside(target, this.root)) return Promise.resolve(false)
    const ids = [target]
    for (let dir = dirName(target); dir !== this.root; dir = dirName(dir)) ids.unshift(dir)
    return this.tree.revealPath(ids)
  }

  // ------------------------------------------------------------ naming

  /** Adds a row to name a new file or folder in. `dir` defaults to where the focus is. */
  async startNew(kind: 'file' | 'dir', dir = this.targetDir): Promise<void> {
    this.cancelEdit()
    await this.tree.load()
    const parent = dir === this.root ? undefined : dir
    if (parent !== undefined) {
      await this.tree.expand(parent)
      if (!this.tree.node(parent)?.expanded) return
    }
    const id = joinPath(dir, '\0new')
    const siblings = this.tree.childrenOf(parent) ?? []
    // First among its kind places it.
    const index = kind === 'dir' ? 0 : siblings.filter((n) => n.item.kind === 'dir').length
    this.edit = { kind, id, dir, value: '', selection: [0, 0] }
    this.tree.insert(parent, { name: '', path: id, kind, size: 0, draft: true }, index)
    this.changed()
  }

  /** Starts renaming a file or folder. A file's extension isn't selected, so typing keeps it. */
  startRename(path = this.tree.focused?.id): void {
    this.cancelEdit()
    const entry = this.tree.node(path)?.item
    if (!entry) return
    const dot = entry.name.lastIndexOf('.')
    this.tree.select(entry.path)
    this.edit = { kind: 'rename', id: entry.path, dir: dirName(entry.path), value: entry.name, selection: [0, entry.kind !== 'dir' && dot > 0 ? dot : entry.name.length] }
    this.changed()
  }

  /** What's wrong with the name being typed. */
  check(value: string): TreeMessage | undefined {
    const { edit } = this
    if (!edit) return undefined
    const siblings = this.tree.childrenOf(edit.dir === this.root ? undefined : edit.dir) ?? []
    return checkName(value, siblings.filter((n) => n.id !== edit.id).map((n) => n.item.name))
  }

  cancelEdit(): void {
    this.endEdit()
  }

  /** Accepts the name. Resolves to the path it made, or undefined if nothing was. */
  async commitEdit(value: string): Promise<string | undefined> {
    const { edit } = this
    if (!edit || this.check(value)?.kind === 'error') return undefined
    const name = value.replace(/[\\/]+$/, '')
    const path = joinPath(edit.dir, name)
    this.endEdit()
    if (edit.kind === 'rename' && path === edit.id) return undefined
    try {
      const parent = dirName(path)
      if (parent !== edit.dir) await this.fs.createDir(parent)
      if (edit.kind === 'file') await this.fs.createFile(path)
      else if (edit.kind === 'dir') await this.fs.createDir(path)
      else await this.fs.rename(edit.id, path)
    } catch (error) {
      this.report(error)
      await this.refreshDir(edit.dir)
      return undefined
    }
    // What was open inside a renamed folder stays open.
    if (edit.kind === 'rename') {
      const open = this.tree.expandedIds.filter((id) => isInside(id, edit.id)).map((id) => path + id.slice(edit.id.length))
      await this.tree.expandAll(open)
    }
    await this.refreshDir(edit.dir)
    await this.reveal(path)
    if (edit.kind === 'rename') this.options.onRename?.(edit.id, path)
    else this.options.onCreate?.(path, edit.kind)
    return path
  }

  private endEdit() {
    const { edit } = this
    if (!edit) return
    this.edit = undefined
    if (edit.kind !== 'rename') this.tree.remove(edit.id)
    this.changed()
    this.flushSoon()
  }

  // ------------------------------------------------------------ deleting

  /** Deletes files and folders. Ask first: this doesn't. */
  async delete(paths: readonly string[]): Promise<void> {
    this.cancelEdit()
    const gone: string[] = []
    for (const path of topmost(paths)) {
      try {
        await this.fs.delete(path)
        gone.push(path)
      } catch (error) {
        this.report(error)
      }
    }
    for (const path of gone) this.tree.remove(path)
    if (gone.length) this.options.onDelete?.(gone)
    await Promise.all(topmost([...new Set(paths.map(dirName))]).map((dir) => this.refreshDir(dir)))
  }

  /** The question to ask before deleting these, in the words. */
  deleteQuestion(paths: readonly string[]): { message: string; detail: string } {
    const detail = 'This action is irreversible!'
    const [only] = paths
    if (paths.length === 1 && only !== undefined) {
      const dir = this.tree.node(only)?.item.kind === 'dir'
      return { message: `Are you sure you want to permanently delete '${baseName(only)}'${dir ? ' and its contents' : ''}?`, detail }
    }
    const dirs = paths.filter((p) => this.tree.node(p)?.item.kind === 'dir').length
    const what = dirs === 0 ? `${paths.length} files` : dirs === paths.length ? `${paths.length} directories and their contents` : `${paths.length} files/directories and their contents`
    return { message: `Are you sure you want to permanently delete the following ${what}?`, detail: `${paths.slice(0, 10).map(baseName).join('\n')}${paths.length > 10 ? `\n...${paths.length - 10} additional files not shown` : ''}\n\n${detail}` }
  }

  // ------------------------------------------------------------ changes

  private report(error: unknown) {
    this.options.onError?.(error instanceof Error ? error.message : String(error))
  }

  private changed() {
    this.version++
    for (const listener of [...this.listeners]) listener()
  }
}
