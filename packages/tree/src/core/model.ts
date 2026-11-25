/** Where a tree's items come from. */
export interface TreeSource<T> {
  /** A stable, unique id. An item keeps its place, expansion and selection across refreshes by its id. */
  id(item: T): string
  /** The text shown, also used by type-to-find. */
  label(item: T): string
  /** Whether the item can expand. */
  hasChildren(item: T): boolean
  /** An item's children in display order, or the roots for undefined. May be async. Called when they're first shown. */
  children(item: T | undefined): readonly T[] | Promise<readonly T[]>
}

export interface TreeModelOptions {
  /** Ids to expand as they appear, such as those saved from an earlier session. */
  expanded?: Iterable<string>
  /** Loading an item's children failed. The item collapses again. */
  onError?: (error: unknown, id: string | undefined) => void
}

/** An item in the tree. Read it; only the model changes it. */
export interface TreeNode<T> {
  readonly id: string
  readonly item: T
  readonly parent: TreeNode<T> | undefined
  /** 0 for roots. */
  readonly depth: number
  /** Place among its siblings, from 0. */
  readonly index: number
  readonly children: readonly TreeNode<T>[] | undefined
  readonly expandable: boolean
  readonly expanded: boolean
  readonly loading: boolean
  /** Loading for long enough (800 ms, the delay) to show a spinner. */
  readonly slow: boolean
}

type Node<T> = { -readonly [K in Exclude<keyof TreeNode<T>, 'parent' | 'children'>]: TreeNode<T>[K] } & {
  parent: Node<T> | undefined
  children: Node<T>[] | undefined
  /** Bumped to drop the results of an older load. */
  request: number
  pending: Promise<void> | undefined
}

/** What the view should scroll to. */
export interface RevealRequest {
  id: string
  /** Center it when it's out of view, as revealing a file does; otherwise scroll as little as possible. */
  center: boolean
}

export type SelectMode =
  /** Select only this. */
  | 'set'
  /** Add it, or remove it. */
  | 'toggle'
  /** Everything from the anchor to this. */
  | 'range'

const SLOW_MS = 800
const TYPE_RESET_MS = 800

/**
 * A tree's state: items, expansion, focus and selection, with no DOM. Children load when they're first needed. Views
 * subscribe and read `rows`, the visible items in order.
 */
export class TreeModel<T> {
  /** Increases with every change. */
  version = 0
  private readonly root: Node<T>
  private readonly nodes = new Map<string, Node<T>>()
  private readonly wanted: Set<string>
  private readonly listeners = new Set<() => void>()
  private rowCache: Node<T>[] | undefined
  private rowIndex: Map<string, number> | undefined
  private focusId: string | undefined
  private anchorId: string | undefined
  private selectedIds = new Set<string>()
  private lastReveal: RevealRequest | undefined
  private typed = ''
  private typedAt = -Infinity
  private readonly onError: TreeModelOptions['onError']

  constructor(readonly source: TreeSource<T>, options: TreeModelOptions = {}) {
    this.wanted = new Set(options.expanded)
    this.onError = options.onError
    this.root = { id: '', item: undefined as T, parent: undefined, depth: -1, index: 0, children: undefined, expandable: true, expanded: true, loading: false, slow: false, request: 0, pending: undefined }
  }

  // ------------------------------------------------------------ reading

  /** The visible items, top to bottom. */
  get rows(): readonly TreeNode<T>[] {
    if (!this.rowCache) {
      const rows: Node<T>[] = []
      const add = (nodes: Node<T>[]) => {
        for (const node of nodes) {
          rows.push(node)
          if (node.expanded && node.children) add(node.children)
        }
      }
      add(this.root.children ?? [])
      this.rowCache = rows
    }
    return this.rowCache
  }

  /** The row an item is on, or -1 while it's inside a collapsed item (or not in the tree). */
  rowOf(id: string | undefined): number {
    if (id === undefined) return -1
    if (!this.rowIndex) this.rowIndex = new Map(this.rows.map((node, i) => [node.id, i]))
    return this.rowIndex.get(id) ?? -1
  }

  node(id: string | undefined): TreeNode<T> | undefined {
    return id === undefined ? undefined : this.nodes.get(id)
  }

  /** An item's loaded children, or the loaded roots for undefined. Undefined until loaded. */
  childrenOf(id: string | undefined): readonly TreeNode<T>[] | undefined {
    return (id === undefined ? this.root : this.nodes.get(id))?.children
  }

  get focused(): TreeNode<T> | undefined {
    return this.node(this.focusId)
  }

  /** The selected ids, in the order shown. */
  get selection(): string[] {
    return [...this.selectedIds].sort((a, b) => this.rowOf(a) - this.rowOf(b))
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id)
  }

  /** The roots are loading for the first time. */
  get loading(): boolean {
    return this.root.loading
  }

  /** Ids of every expanded item, visible or not: save these to restore the tree later. */
  get expandedIds(): string[] {
    const ids = [...this.nodes.values()].filter((n) => n.expanded).map((n) => n.id)
    return [...new Set([...ids, ...this.wanted])]
  }

  /** The latest request to scroll an item into view. A new object each time. */
  get reveal(): RevealRequest | undefined {
    return this.lastReveal
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * The items whose indent guides are active: what holds the focus and the selection. That's the item itself when it's
   * open, and its parent otherwise.
   */
  activeGuides(): ReadonlySet<string> {
    const ids = new Set<string>()
    for (const id of [...this.selectedIds, this.focusId]) {
      const node = this.node(id)
      if (!node) continue
      const owner = node.expanded && node.children?.length ? node : node.parent
      if (owner && owner !== this.root) ids.add(owner.id)
    }
    return ids
  }

  // ------------------------------------------------------------ loading

  /** Loads the roots, if they aren't already. */
  load(): Promise<void> {
    return this.root.children ? Promise.resolve() : this.fetch(this.root)
  }

  /** Reloads an item's children (the whole tree for undefined), and those of everything open inside it. */
  async refresh(id?: string): Promise<void> {
    const node = id === undefined ? this.root : this.nodes.get(id)
    if (!node) return
    if (node !== this.root && !node.expanded) {
      // Closed: forget the children, so they load when it opens.
      this.dropChildren(node, true)
      this.changed()
      return
    }
    await this.fetch(node, true)
  }

  private fetch(node: Node<T>, again = false): Promise<void> {
    if (node.pending && !again) return node.pending
    const request = ++node.request
    const id = node === this.root ? undefined : node.id
    let result: readonly T[] | Promise<readonly T[]>
    try {
      result = this.source.children(id === undefined ? undefined : node.item)
    } catch (error) {
      this.failed(node, error)
      return Promise.resolve()
    }
    if (Array.isArray(result)) return this.loaded(node, result as readonly T[])

    const first = !node.children
    node.loading = first
    let timer: ReturnType<typeof setTimeout> | undefined
    if (first) {
      timer = setTimeout(() => {
        if (node.request !== request || !node.loading) return
        node.slow = true
        this.changed()
      }, SLOW_MS)
      this.changed()
    }
    const current = () => node.request === request && (node === this.root || this.nodes.get(node.id) === node)
    const pending = (result as Promise<readonly T[]>).then(
      (items) => (current() ? this.loaded(node, items) : undefined),
      (error: unknown) => {
        if (current()) this.failed(node, error)
      },
    ).finally(() => {
      clearTimeout(timer)
      if (node.pending === pending) node.pending = undefined
    })
    node.pending = pending
    return pending
  }

  private async loaded(node: Node<T>, items: readonly T[]): Promise<void> {
    node.loading = false
    node.slow = false
    const old = new Map(node.children?.map((c) => [c.id, c]))
    const again: Node<T>[] = []
    node.children = items.map((item, index) => {
      const id = this.source.id(item)
      const expandable = this.source.hasChildren(item)
      const kept = old.get(id)
      if (kept) {
        old.delete(id)
        kept.item = item
        kept.index = index
        if (kept.expandable !== expandable) {
          kept.expandable = expandable
          kept.expanded = false
          this.dropChildren(kept, false)
        } else if (kept.expanded) again.push(kept)
        else this.dropChildren(kept, true)
        return kept
      }
      const child = this.makeNode(item, node, index)
      if (child.expanded) again.push(child)
      return child
    })
    for (const gone of old.values()) this.forget(gone, false)
    this.changed()
    await Promise.all(again.map((child) => this.fetch(child, true)))
  }

  private failed(node: Node<T>, error: unknown) {
    node.loading = false
    node.slow = false
    if (node === this.root) node.children ??= []
    else if (!node.children) node.expanded = false
    this.changed()
    this.onError?.(error, node === this.root ? undefined : node.id)
  }

  private makeNode(item: T, parent: Node<T>, index: number): Node<T> {
    const id = this.source.id(item)
    const expandable = this.source.hasChildren(item)
    const node: Node<T> = { id, item, parent: parent === this.root ? undefined : parent, depth: parent.depth + 1, index, children: undefined, expandable, expanded: expandable && this.wanted.delete(id), loading: false, slow: false, request: 0, pending: undefined }
    this.nodes.set(id, node)
    return node
  }

  private forget(node: Node<T>, remember: boolean) {
    this.dropChildren(node, remember)
    if (this.nodes.get(node.id) === node) this.nodes.delete(node.id)
  }

  /** Unloads a node's children. `remember` keeps what was open among them, for when they load again. */
  private dropChildren(node: Node<T>, remember: boolean) {
    for (const child of node.children ?? []) {
      if (remember && child.expanded) this.wanted.add(child.id)
      this.forget(child, remember)
    }
    node.children = undefined
    node.request++
    node.loading = false
    node.slow = false
    node.pending = undefined
  }

  // ------------------------------------------------------------ expansion

  /** Opens an item. Settles once its children are loaded. */
  async expand(id: string): Promise<void> {
    const node = this.nodes.get(id)
    if (!node?.expandable) return
    if (!node.expanded) {
      node.expanded = true
      this.changed()
    }
    if (!node.children) await this.fetch(node)
  }

  collapse(id: string, recursive = false): void {
    const node = this.nodes.get(id)
    if (!node) return
    const close = (n: Node<T>) => {
      n.expanded = false
      if (recursive) n.children?.forEach(close)
    }
    close(node)
    this.changed()
  }

  toggle(id: string): Promise<void> {
    if (!this.nodes.get(id)?.expanded) return this.expand(id)
    this.collapse(id)
    return Promise.resolve()
  }

  /** Opens an item and every sibling that can open. */
  async expandSiblings(id: string): Promise<void> {
    const node = this.nodes.get(id)
    if (!node) return
    const siblings = (node.parent ?? this.root).children ?? []
    await Promise.all(siblings.map((s) => this.expand(s.id)))
  }

  collapseAll(): void {
    this.wanted.clear()
    for (const node of this.nodes.values()) node.expanded = false
    this.changed()
  }

  /** Opens these ids as they appear, and any that are already here. */
  async expandAll(ids: Iterable<string>): Promise<void> {
    const now: string[] = []
    for (const id of ids) {
      if (this.nodes.has(id)) now.push(id)
      else this.wanted.add(id)
    }
    await Promise.all(now.map((id) => this.expand(id)))
  }

  /**
   * Opens the way to an item, then focuses, selects and scrolls to it. `path` is its ids from the root to itself.
   * Resolves to whether it was found.
   */
  async revealPath(path: readonly string[]): Promise<boolean> {
    await this.load()
    for (const id of path.slice(0, -1)) {
      if (!this.nodes.has(id)) return false
      await this.expand(id)
    }
    const id = path[path.length - 1]
    if (id === undefined || !this.nodes.has(id)) return false
    this.focusId = this.anchorId = id
    this.selectedIds = new Set([id])
    this.lastReveal = { id, center: true }
    this.emit()
    return true
  }

  // ------------------------------------------------------------ editing in place

  /** Adds an item that isn't in the source, such as the row a new file is named in. A refresh of its parent drops it. */
  insert(parentId: string | undefined, item: T, index: number): void {
    const parent = parentId === undefined ? this.root : this.nodes.get(parentId)
    if (!parent) return
    parent.children ??= []
    parent.children.splice(index, 0, this.makeNode(item, parent, index))
    parent.children.forEach((c, i) => (c.index = i))
    this.changed()
  }

  /** Takes an item out of the tree. The source isn't touched. */
  remove(id: string): void {
    const node = this.nodes.get(id)
    if (!node) return
    const parent = node.parent ?? this.root
    parent.children = parent.children?.filter((c) => c !== node)
    parent.children?.forEach((c, i) => (c.index = i))
    this.forget(node, false)
    this.changed()
  }

  // ------------------------------------------------------------ focus and selection

  focus(id: string | undefined, scroll = true): void {
    if (id !== undefined && !this.nodes.has(id)) return
    this.focusId = id
    if (id !== undefined && scroll) this.lastReveal = { id, center: false }
    this.emit()
  }

  select(id: string, mode: SelectMode = 'set'): void {
    if (!this.nodes.has(id)) return
    if (mode === 'set') {
      this.selectedIds = new Set([id])
      this.anchorId = id
    } else if (mode === 'toggle') {
      if (!this.selectedIds.delete(id)) this.selectedIds.add(id)
      this.anchorId = id
    } else {
      const from = this.rowOf(this.anchorId ?? this.focusId ?? id)
      const to = this.rowOf(id)
      if (to < 0) return
      const start = from < 0 ? to : from
      this.anchorId ??= this.rows[start]!.id
      this.selectedIds = new Set(this.rows.slice(Math.min(start, to), Math.max(start, to) + 1).map((n) => n.id))
    }
    this.focusId = id
    this.lastReveal = { id, center: false }
    this.emit()
  }

  selectAll(): void {
    this.selectedIds = new Set(this.rows.map((n) => n.id))
    this.emit()
  }

  clearSelection(): void {
    if (!this.selectedIds.size) return
    this.selectedIds = new Set()
    this.anchorId = undefined
    this.emit()
  }

  /** Focuses the row `by` rows away, stopping at the ends. */
  moveFocus(by: number): void {
    const { rows } = this
    if (!rows.length) return
    const from = this.rowOf(this.focusId)
    const to = from < 0 ? (by > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, from + by))
    this.focus(rows[to]!.id)
  }

  /** Extends the selection by `by` rows from the focus. */
  extendSelection(by: number): void {
    const from = this.rowOf(this.focusId)
    if (from < 0) return this.moveFocus(by)
    if (!this.selectedIds.has(this.focusId!)) this.anchorId = this.focusId
    this.select(this.rows[Math.max(0, Math.min(this.rows.length - 1, from + by))]!.id, 'range')
  }

  focusFirst(): void {
    this.focus(this.rows[0]?.id)
  }

  focusLast(): void {
    this.focus(this.rows[this.rows.length - 1]?.id)
  }

  /** Left arrow: closes an open item, or moves to its parent. */
  focusOut(): void {
    const node = this.focused
    if (!node) return
    if (node.expanded) this.collapse(node.id)
    else if (node.parent) this.focus(node.parent.id)
  }

  /** Right arrow: opens a closed item, or moves to its first child. */
  focusIn(): void {
    const node = this.focused
    if (!node?.expandable) return
    if (!node.expanded) void this.expand(node.id)
    else if (node.children?.[0]) this.focus(node.children[0].id)
  }

  /**
   * Type-to-find: focuses the next item whose label starts with what's been typed, or failing that contains it.
   * Letters typed within 800 ms of each other add up. Returns whether anything matched.
   */
  typeToFind(text: string, now = performance.now()): boolean {
    this.typed = now - this.typedAt < TYPE_RESET_MS ? this.typed + text.toLowerCase() : text.toLowerCase()
    this.typedAt = now
    const { rows } = this
    const at = this.rowOf(this.focusId)
    // One letter moves on to the next match; more letters refine the current one.
    const start = Math.max(0, this.typed.length === 1 ? at + 1 : at)
    for (const matches of [(s: string) => s.startsWith(this.typed), (s: string) => s.includes(this.typed)]) {
      for (let i = 0; i < rows.length; i++) {
        const node = rows[(start + i) % rows.length]!
        if (!matches(this.source.label(node.item).toLowerCase())) continue
        this.focus(node.id)
        return true
      }
    }
    return false
  }

  /** Whether letters typed now continue an earlier type-to-find, so a space is text and not a command. */
  isTyping(now = performance.now()): boolean {
    return now - this.typedAt < TYPE_RESET_MS
  }

  // ------------------------------------------------------------ changes

  /** The rows changed: puts focus and selection back on visible items, then tells views. */
  private changed() {
    const oldRow = this.focusId === undefined ? -1 : (this.rowIndex?.get(this.focusId) ?? -1)
    this.rowCache = undefined
    this.rowIndex = undefined
    if (this.focusId !== undefined && this.rowOf(this.focusId) < 0) {
      // Inside something that closed: focus that. Gone: focus what took its place.
      let owner = this.nodes.get(this.focusId)?.parent
      while (owner && this.rowOf(owner.id) < 0) owner = owner.parent
      this.focusId = owner?.id ?? (oldRow >= 0 ? this.rows[Math.min(oldRow, this.rows.length - 1)]?.id : undefined)
    }
    for (const id of this.selectedIds) if (this.rowOf(id) < 0) this.selectedIds.delete(id)
    if (this.anchorId !== undefined && this.rowOf(this.anchorId) < 0) this.anchorId = undefined
    this.emit()
  }

  private emit() {
    this.version++
    // Index the rows as they are now, so that if the focused item goes, its place is known.
    if (this.focusId !== undefined) this.rowOf(this.focusId)
    for (const listener of [...this.listeners]) listener()
  }
}
