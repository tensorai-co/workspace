/** How a pane may be sized. All sizes are in pixels, along the split. */
export interface PaneSpec {
  id: string
  /** Its size at first, and after a double-click on its sash. Without one, it shares what's left. */
  size?: number
  /** 0 by default. */
  min?: number
  /** No limit by default. */
  max?: number
  /** It takes the room when the whole split grows, and gives it up first when it shrinks. */
  grow?: boolean
  /** Dragging it well below its minimum closes it, and dragging back opens it. */
  snap?: boolean
}

/** A pane as laid out. Read it; only the model changes it. */
export interface Pane {
  readonly id: string
  /** 0 while closed. */
  readonly size: number
  /** From the start of the split, gaps included. */
  readonly offset: number
  readonly visible: boolean
}

/** What `save` gives and `restore` takes, ready for JSON. */
export interface SavedSplit {
  [id: string]: { size: number; visible: boolean }
}

interface Item {
  spec: PaneSpec
  size: number
  visible: boolean
  /** The size to open at again. */
  open: number
}

export interface SplitModelOptions {
  /** Space between panes. 0 by default. */
  gap?: number
}

interface Drag {
  sash: number
  sizes: number[]
  minDelta: number
  maxDelta: number
  before: { item: Item; limit: number; visible: boolean } | undefined
  after: { item: Item; limit: number; visible: boolean } | undefined
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

/** The sizes of a row or column of panes, with no DOM. It sizes, snaps and resets them. */
export class SplitModel {
  /** Increases with every change. */
  version = 0
  readonly gap: number
  private items: Item[] = []
  private total = 0
  private laidOut = false
  private drag: Drag | undefined
  private saved: SavedSplit = {}
  private readonly listeners = new Set<() => void>()

  constructor(panes: readonly PaneSpec[] = [], options: SplitModelOptions = {}) {
    this.gap = options.gap ?? 0
    this.items = panes.map((spec) => this.item(spec))
  }

  // ------------------------------------------------------------ reading

  get panes(): readonly Pane[] {
    let offset = 0
    return this.items.map(({ spec, size, visible }) => {
      const pane = { id: spec.id, size: visible ? size : 0, offset, visible }
      if (visible) offset += size + this.gap
      return pane
    })
  }

  /**
   * The sashes, at the middle of the gap between two open panes. A snapped pane at either end keeps one, so it can be
   * dragged open again. `index` is a sash's handle in the other calls.
   */
  get sashes(): { index: number; position: number; enabled: boolean; atMin: boolean; atMax: boolean }[] {
    const { panes } = this
    const open = panes.flatMap((p, i) => (p.visible ? [i] : []))
    const closed = (i: number) => this.items[i]?.spec.snap && !this.items[i]!.visible
    const found: { index: number; position: number }[] = []
    if (open.length && closed(open[0]! - 1)) found.push({ index: open[0]! - 1, position: 0 })
    for (const [n, i] of open.entries()) if (n > 0) found.push({ index: i - 1, position: panes[i]!.offset - this.gap / 2 })
    if (open.length && closed(open[open.length - 1]! + 1)) found.push({ index: open[open.length - 1]!, position: this.total })
    return found.map((sash) => {
      const { min, max } = this.limits(sash.index)
      // At a minimum there's still somewhere to go when what's there can close, or open.
      const shrinks = min < 0 || !!this.snappable(sash.index, 'before')?.visible || this.snappable(sash.index, 'after')?.visible === false
      const grows = max > 0 || !!this.snappable(sash.index, 'after')?.visible || this.snappable(sash.index, 'before')?.visible === false
      return { ...sash, enabled: shrinks || grows, atMin: min >= 0 && max > 0, atMax: max <= 0 && min < 0 }
    })
  }

  isVisible(id: string): boolean {
    return this.find(id)?.visible ?? false
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ------------------------------------------------------------ panes

  /**
   * Changes the panes. The ones that stay keep their sizes. A new one without a size splits the room of the pane before
   * it, as splitting an editor does; a removed one leaves its room to its neighbors.
   */
  setPanes(panes: readonly PaneSpec[]): void {
    const old = new Map(this.items.map((it) => [it.spec.id, it]))
    if (panes.length === this.items.length && panes.every((p, i) => this.items[i]!.spec.id === p.id)) {
      // The same panes: only their limits may differ.
      panes.forEach((spec, i) => (this.items[i]!.spec = spec))
      return
    }
    const gone = this.items.filter((it) => !panes.some((p) => p.id === it.spec.id))
    const next: Item[] = panes.map((spec) => {
      const kept = old.get(spec.id)
      if (kept) kept.spec = spec
      return kept ?? this.item(spec)
    })
    if (this.laidOut) {
      for (const it of gone) {
        if (!it.visible) continue
        const at = this.items.indexOf(it)
        const heir = [...this.items.slice(0, at).reverse(), ...this.items.slice(at + 1)].find((n) => n.visible && next.includes(n) && !n.spec.size) ?? [...this.items.slice(0, at).reverse(), ...this.items.slice(at + 1)].find((n) => n.visible && next.includes(n))
        if (heir) heir.size += it.size + this.gap
      }
      next.forEach((it, i) => {
        if (old.has(it.spec.id) || !it.visible) return
        const from = [...next.slice(0, i).reverse(), ...next.slice(i + 1)].find((n) => n.visible && old.has(n.spec.id))
        if (!from) return
        const want = it.spec.size ?? Math.floor((from.size - this.gap) / 2)
        const size = clamp(want, it.spec.min ?? 0, it.spec.max ?? Infinity)
        it.size = size
        from.size -= size + this.gap
      })
    }
    this.drag = undefined
    this.items = next
    if (this.laidOut) this.fit()
    this.changed()
  }

  /** Opens or closes a pane. It opens at the size it had. */
  setVisible(id: string, visible: boolean): void {
    const item = this.find(id)
    if (!item || item.visible === visible) return
    this.show(item, visible)
    if (this.laidOut) this.fit(this.items.indexOf(item))
    this.changed()
  }

  /** Sets a pane's size, as far as the others allow. */
  resize(id: string, size: number): void {
    const item = this.find(id)
    if (!item?.visible || !this.laidOut) return
    item.size = clamp(size, item.spec.min ?? 0, item.spec.max ?? Infinity)
    this.fit(this.items.indexOf(item))
    this.changed()
  }

  // ------------------------------------------------------------ layout

  /** Gives the split its length. */
  layout(total: number): void {
    if (this.laidOut && total === this.total) return
    const before = this.total
    this.total = total
    if (!this.laidOut) {
      if (total <= 0) return
      this.laidOut = true
      this.start()
    } else if (!this.items.some((it) => it.visible && it.spec.grow) && before > 0 && !this.items.some((it) => it.visible && it.spec.size !== undefined)) {
      // Panes with no size of their own keep their proportions.
      const room = this.room()
      const used = this.items.reduce((sum, it) => sum + (it.visible ? it.size : 0), 0)
      for (const it of this.items) if (it.visible && used > 0) it.size = Math.round((it.size / used) * room)
    }
    this.fit()
    this.changed()
  }

  /** Back to the size a pane asked for; without one, the panes beside the sash share their room equally. */
  reset(sash: number): void {
    const beside = [this.items[sash], this.items[sash + 1]]
    const sized = beside.find((it) => it?.visible && it.spec.size !== undefined)
    if (sized) {
      sized.size = clamp(sized.spec.size!, sized.spec.min ?? 0, sized.spec.max ?? Infinity)
      this.fit(this.items.indexOf(sized))
    } else {
      const open = this.items.filter((it) => it.visible && it.spec.size === undefined)
      const room = open.reduce((sum, it) => sum + it.size, 0)
      for (const it of open) it.size = Math.floor(room / open.length)
      this.fit()
    }
    this.changed()
  }

  // ------------------------------------------------------------ dragging

  startDrag(sash: number): void {
    const { min, max } = this.limits(sash)
    const near = (side: 'before' | 'after') => {
      const item = this.snappable(sash, side)
      if (!item) return undefined
      // Past half its minimum it closes, and at half of it it opens again.
      const half = Math.floor((item.spec.min ?? 0) / 2)
      const limit = side === 'before' ? (item.visible ? min - half : min + half) : item.visible ? max + half : max - half
      return { item, limit, visible: item.visible }
    }
    this.drag = { sash, sizes: this.items.map((it) => it.size), minDelta: min, maxDelta: max, before: near('before'), after: near('after') }
  }

  /** Moves the sash `delta` pixels from where its drag started. */
  dragTo(delta: number): void {
    const { drag } = this
    if (!drag) return
    this.items.forEach((it, i) => (it.size = drag.sizes[i]!))
    for (const [side, snap] of [
      ['before', drag.before],
      ['after', drag.after],
    ] as const) {
      if (!snap) continue
      const past = side === 'before' ? delta < snap.limit : delta > snap.limit
      const visible = side === 'before' ? (snap.visible ? !past : delta >= snap.limit) : snap.visible ? !past : delta <= snap.limit
      if (visible !== snap.item.visible) this.show(snap.item, visible)
      if (visible !== snap.visible) {
        // A pane that closed leaves its room to the other side, and one that opened takes its least size from there.
        const min = snap.item.spec.min ?? 0
        if (visible) snap.item.size = Math.max(min, snap.item.open)
        const at = this.items.indexOf(snap.item)
        const heirs = side === 'before' ? this.items.slice(at + 1) : this.items.slice(0, at).reverse()
        const heir = heirs.find((it) => it.visible)
        if (heir) {
          if (visible) {
            const target = clamp(side === 'before' ? delta : -delta, min, snap.item.spec.max ?? Infinity)
            snap.item.size = target
            heir.size = drag.sizes[this.items.indexOf(heir)]! - target - this.gap
          } else heir.size = drag.sizes[this.items.indexOf(heir)]! + drag.sizes[at]! + this.gap
        }
      }
    }
    const snapped = (drag.before && drag.before.item.visible !== drag.before.visible) || (drag.after && drag.after.item.visible !== drag.after.visible)
    if (!snapped) this.shift(drag.sash, clamp(delta, drag.minDelta, drag.maxDelta))
    this.changed()
  }

  endDrag(): void {
    this.drag = undefined
    this.fit()
    this.changed()
  }

  // ------------------------------------------------------------ saving

  save(): SavedSplit {
    return Object.fromEntries(this.items.map((it) => [it.spec.id, { size: Math.round(it.visible ? it.size : it.open), visible: it.visible }]))
  }

  /** Restores saved sizes, for the panes there are now and any added later. Call before the first layout. */
  restore(saved: SavedSplit): void {
    this.saved = saved
    for (const it of this.items) Object.assign(it, this.item(it.spec))
    if (this.laidOut) {
      this.fit()
      this.changed()
    }
  }

  // ------------------------------------------------------------ inside

  private item(spec: PaneSpec): Item {
    const kept = this.saved[spec.id]
    const size = kept && Number.isFinite(kept.size) && kept.size > 0 ? kept.size : (spec.size ?? 0)
    return { spec, size, visible: kept?.visible ?? true, open: size }
  }

  private find(id: string): Item | undefined {
    return this.items.find((it) => it.spec.id === id)
  }

  private show(item: Item, visible: boolean) {
    if (!visible) item.open = item.size
    item.visible = visible
    if (visible) item.size = Math.max(item.spec.min ?? 0, item.open)
  }

  /** The length there is for panes. */
  private room(): number {
    const open = this.items.filter((it) => it.visible).length
    return Math.max(0, this.total - Math.max(0, open - 1) * this.gap)
  }

  /** The first layout: panes without a size share what's left. */
  private start() {
    const loose = this.items.filter((it) => it.visible && it.size === 0)
    const left = this.room() - this.items.reduce((sum, it) => sum + (it.visible ? it.size : 0), 0)
    for (const it of loose) it.size = Math.max(it.spec.min ?? 0, Math.floor(left / loose.length))
  }

  /**
   * Makes the sizes add up to the room there is. Panes that grow take or give first, then those without a size of their
   * own, then the rest from the end. `except` goes last: it's the one whose size was just set.
   */
  private fit(except = -1) {
    const open = this.items.filter((it) => it.visible)
    for (const it of open) it.size = clamp(it.size, it.spec.min ?? 0, it.spec.max ?? Infinity)
    let left = this.room() - open.reduce((sum, it) => sum + it.size, 0)
    const rank = (it: Item) => (this.items.indexOf(it) === except ? 3 : it.spec.grow ? 0 : it.spec.size === undefined ? 1 : 2)
    const order = [...open].reverse().sort((a, b) => rank(a) - rank(b))
    for (const it of order) {
      if (Math.abs(left) < 1e-6) break
      const size = clamp(it.size + left, it.spec.min ?? 0, it.spec.max ?? Infinity)
      left -= size - it.size
      it.size = size
    }
    // Too small for every minimum: the panes that grow go below theirs, so nothing runs past the end.
    for (const it of order) {
      if (left > -1e-6) break
      const size = Math.max(0, it.size + left)
      left -= size - it.size
      it.size = size
    }
  }

  /** How far a sash can move either way without closing anything. */
  private limits(sash: number): { min: number; max: number } {
    const sum = (list: Item[], f: (it: Item) => number) => list.reduce((total, it) => total + (it.visible ? f(it) : 0), 0)
    const before = this.items.slice(0, sash + 1)
    const after = this.items.slice(sash + 1)
    const shrink = (list: Item[]) => sum(list, (it) => it.size - Math.min(it.size, it.spec.min ?? 0))
    const grow = (list: Item[]) => sum(list, (it) => Math.max(0, (it.spec.max ?? Infinity) - it.size))
    return { min: -Math.min(shrink(before), grow(after)) || 0, max: Math.min(shrink(after), grow(before)) || 0 }
  }

  /** The pane a drag of this sash can close or open: the outermost on that side, when the rest there are closed. */
  private snappable(sash: number, side: 'before' | 'after'): Item | undefined {
    const list = side === 'before' ? this.items.slice(0, sash + 1).reverse() : this.items.slice(sash + 1)
    const open = list.filter((it) => it.visible)
    if (open.length === 1 && open[0]!.spec.snap) return open[0]
    if (open.length === 0 && list[0]?.spec.snap) return list[0]
    return undefined
  }

  /** Moves room across a sash, taking from the nearest panes first. */
  private shift(sash: number, delta: number) {
    const take = (list: Item[], amount: number) => {
      let left = amount
      for (const it of list) {
        if (!it.visible) continue
        const size = clamp(it.size + left, Math.min(it.size, it.spec.min ?? 0), it.spec.max ?? Infinity)
        left -= size - it.size
        it.size = size
      }
    }
    take(this.items.slice(0, sash + 1).reverse(), delta)
    take(this.items.slice(sash + 1), -delta)
  }

  private changed() {
    this.version++
    for (const listener of [...this.listeners]) listener()
  }
}
