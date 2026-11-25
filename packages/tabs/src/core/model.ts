/** One tab. Read it; only the model changes it. */
export interface Tab<T> {
  readonly id: string
  readonly item: T
  /** Shown in italics, and replaced by the next preview. */
  readonly preview: boolean
  /** Has changes that aren't saved. */
  readonly dirty: boolean
}

export interface OpenOptions {
  /** Open as a preview: it takes the place of the one before. */
  preview?: boolean
  /** Where to put it; to the right of the active tab by default. */
  index?: number
  /** Make it the active tab. True by default. */
  activate?: boolean
  dirty?: boolean
}

/** What `save` gives and `restore` takes, ready for JSON. */
export interface SavedTabs {
  ids: string[]
  active?: string
  preview?: string
  /** Ids from the most to the least recently active. */
  recent: string[]
}

/**
 * A list of tabs, with no DOM and no idea what a tab holds. It follows the rules: one preview at a time, new tabs
 * open to the right of the active one, and closing the active tab returns to the one used before it.
 */
export class TabsModel<T> {
  /** Increases with every change. */
  version = 0
  private list: readonly Tab<T>[] = []
  private activeId: string | undefined
  /** From the most to the least recently active. */
  private recent: string[] = []
  private readonly listeners = new Set<() => void>()

  constructor(readonly idOf: (item: T) => string) {}

  /** Left to right. */
  get tabs(): readonly Tab<T>[] {
    return this.list
  }

  get active(): Tab<T> | undefined {
    return this.get(this.activeId)
  }

  /** From the most to the least recently active. */
  get byRecent(): readonly Tab<T>[] {
    return this.recent.map((id) => this.get(id)!)
  }

  get(id: string | undefined): Tab<T> | undefined {
    return id === undefined ? undefined : this.list.find((t) => t.id === id)
  }

  indexOf(id: string): number {
    return this.list.findIndex((t) => t.id === id)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ------------------------------------------------------------ opening

  /** Opens an item, or shows the tab it already has. Opening a preview for good keeps it. */
  open(item: T, options: OpenOptions = {}): Tab<T> {
    const id = this.idOf(item)
    const preview = (options.preview ?? false) && !options.dirty
    const old = this.get(id)
    if (old) {
      this.put(id, { item, preview: old.preview && preview, dirty: options.dirty ?? old.dirty })
      if (options.index !== undefined) this.place(id, options.index)
    } else {
      let index = options.index ?? (this.activeId === undefined ? this.list.length : this.indexOf(this.activeId) + 1)
      const replaced = preview ? this.list.findIndex((t) => t.preview) : -1
      const next = [...this.list]
      if (replaced >= 0) {
        const [gone] = next.splice(replaced, 1)
        if (index > replaced) index--
        this.recent = this.recent.filter((r) => r !== gone!.id)
        if (this.activeId === gone!.id) this.activeId = undefined
      }
      next.splice(Math.max(0, Math.min(next.length, index)), 0, { id, item, preview, dirty: options.dirty ?? false })
      this.list = next
      this.recent.push(id)
    }
    if ((options.activate ?? true) || this.activeId === undefined) this.use(id)
    this.changed()
    return this.get(id)!
  }

  /** Turns a preview into a tab that stays. */
  keep(id: string): void {
    if (!this.get(id)?.preview) return
    this.put(id, { preview: false })
    this.changed()
  }

  /** Marks unsaved changes. A preview with changes stays. */
  setDirty(id: string, dirty: boolean): void {
    const tab = this.get(id)
    if (!tab || tab.dirty === dirty) return
    this.put(id, { dirty, preview: tab.preview && !dirty })
    this.changed()
  }

  /** Replaces an item, as when its file is renamed. Its tab keeps its place and state. */
  replace(id: string, item: T): void {
    const tab = this.get(id)
    if (!tab) return
    const to = this.idOf(item)
    // Something else already has that id: this tab takes over.
    if (to !== id && this.get(to)) this.drop(to)
    this.list = this.list.map((t) => (t.id === id ? { ...t, id: to, item } : t))
    this.recent = this.recent.map((r) => (r === id ? to : r))
    if (this.activeId === id) this.activeId = to
    this.changed()
  }

  // ------------------------------------------------------------ activating

  activate(id: string): void {
    if (!this.get(id) || this.activeId === id) return
    this.use(id)
    this.changed()
  }

  /** Activates the tab `by` places along, going round the ends. */
  cycle(by: number): void {
    const { length } = this.list
    if (!length) return
    const at = this.activeId === undefined ? -1 : this.indexOf(this.activeId)
    this.activate(this.list[(((at + by) % length) + length) % length]!.id)
  }

  // ------------------------------------------------------------ closing and moving

  close(id: string): Tab<T> | undefined {
    const tab = this.get(id)
    if (!tab) return undefined
    this.drop(id)
    this.changed()
    return tab
  }

  /** Closes several at once, so the active tab changes only once. */
  closeAll(ids: readonly string[] = this.list.map((t) => t.id)): void {
    const gone = ids.filter((id) => this.get(id))
    if (!gone.length) return
    const all = new Set(gone)
    this.list = this.list.filter((t) => !all.has(t.id))
    this.recent = this.recent.filter((r) => !all.has(r))
    if (this.activeId !== undefined && all.has(this.activeId)) this.activeId = this.recent[0]
    this.changed()
  }

  /** Moves a tab so that it ends up at `index`. */
  move(id: string, index: number): void {
    if (!this.get(id)) return
    this.place(id, index)
    this.changed()
  }

  /** Moves a tab to another list, where it becomes the active one. */
  moveTo(id: string, target: TabsModel<T>, index?: number): void {
    const tab = this.get(id)
    if (!tab || target === this) return
    this.drop(id)
    this.changed()
    target.open(tab.item, { index, dirty: tab.dirty })
  }

  // ------------------------------------------------------------ saving

  save(): SavedTabs {
    return { ids: this.list.map((t) => t.id), active: this.activeId, preview: this.list.find((t) => t.preview)?.id, recent: [...this.recent] }
  }

  /** Restores saved tabs. `find` gives the item for an id, or undefined to leave it out. */
  restore(saved: SavedTabs, find: (id: string) => T | undefined): void {
    const list: Tab<T>[] = []
    for (const id of saved.ids) {
      const item = find(id)
      if (item !== undefined && !list.some((t) => t.id === id)) list.push({ id, item, preview: id === saved.preview, dirty: false })
    }
    const here = new Set(list.map((t) => t.id))
    this.list = list
    this.recent = [...new Set([...saved.recent.filter((id) => here.has(id)), ...here])]
    this.activeId = saved.active !== undefined && here.has(saved.active) ? saved.active : this.recent[0]
    this.changed()
  }

  // ------------------------------------------------------------ inside

  private put(id: string, change: Partial<Tab<T>>) {
    this.list = this.list.map((t) => (t.id === id ? { ...t, ...change } : t))
  }

  private place(id: string, index: number) {
    const tab = this.get(id)!
    const rest = this.list.filter((t) => t.id !== id)
    rest.splice(Math.max(0, Math.min(rest.length, index)), 0, tab)
    this.list = rest
  }

  private use(id: string) {
    this.activeId = id
    this.recent = [id, ...this.recent.filter((r) => r !== id)]
  }

  private drop(id: string) {
    this.list = this.list.filter((t) => t.id !== id)
    this.recent = this.recent.filter((r) => r !== id)
    if (this.activeId === id) this.activeId = this.recent[0]
  }

  private changed() {
    this.version++
    for (const listener of [...this.listeners]) listener()
  }
}
