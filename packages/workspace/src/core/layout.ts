import type { Storage } from '@tensorai-co/workspace/host'

/** The parts that can be shown and hidden. */
export type TogglePart = 'sidebar' | 'panel' | 'auxiliaryBar'

export interface LayoutState {
  sidebar: boolean
  panel: boolean
  auxiliaryBar: boolean
  /** The panel fills the editors' room too. */
  panelMaximized: boolean
  /** The view the sidebar shows: the id of its activity bar item. */
  view: string
}

export const DEFAULT_LAYOUT: LayoutState = { sidebar: true, panel: true, auxiliaryBar: false, panelMaximized: false, view: 'explorer' }

export interface LayoutOptions {
  storage?: Storage
  /** Where it's kept in `storage`. */
  key?: string
  /** How it starts when nothing was saved. */
  initial?: Partial<LayoutState>
}

/** Which parts are open and what the sidebar shows, kept between sessions. Sizes are kept by the panes themselves. */
export class LayoutModel {
  private listeners = new Set<() => void>()
  private current: LayoutState
  version = 0

  constructor(private readonly options: LayoutOptions = {}) {
    this.current = { ...DEFAULT_LAYOUT, ...options.initial, ...this.read() }
  }

  get state(): Readonly<LayoutState> {
    return this.current
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  isVisible(part: TogglePart): boolean {
    return this.current[part]
  }

  setVisible(part: TogglePart, visible: boolean): void {
    // Hiding a maximized panel brings the editors back for next time.
    this.update({ [part]: visible, ...(part === 'panel' && !visible ? { panelMaximized: false } : {}) })
  }

  toggle(part: TogglePart): void {
    this.setVisible(part, !this.current[part])
  }

  /** Shows a view in the sidebar. */
  showView(view: string): void {
    this.update({ view, sidebar: true })
  }

  /** What clicking an activity bar item does: shows its view, or hides the sidebar when it's showing already. */
  clickView(view: string): void {
    if (this.current.view === view && this.current.sidebar) this.update({ sidebar: false })
    else this.showView(view)
  }

  /** Maximizes the panel, or puts it back. Maximizing shows it. */
  toggleMaximizedPanel(): void {
    const panelMaximized = !this.current.panelMaximized
    this.update({ panelMaximized, ...(panelMaximized ? { panel: true } : {}) })
  }

  private update(change: Partial<LayoutState>) {
    const next = { ...this.current, ...change }
    if ((Object.keys(next) as (keyof LayoutState)[]).every((k) => next[k] === this.current[k])) return
    this.current = next
    this.version++
    this.write()
    for (const listener of [...this.listeners]) listener()
  }

  private read(): Partial<LayoutState> {
    const { storage, key } = this.options
    if (!storage || !key) return {}
    try {
      const value: unknown = JSON.parse(storage.getItem(key) ?? 'null')
      if (!value || typeof value !== 'object') return {}
      const saved = value as Record<string, unknown>
      const out: Partial<LayoutState> = {}
      for (const k of ['sidebar', 'panel', 'auxiliaryBar', 'panelMaximized'] as const) if (typeof saved[k] === 'boolean') out[k] = saved[k]
      if (typeof saved.view === 'string') out.view = saved.view
      return out
    } catch {
      // Not something we saved: start afresh.
      return {}
    }
  }

  private write() {
    const { storage, key } = this.options
    if (!storage || !key) return
    try {
      storage.setItem(key, JSON.stringify(this.current))
    } catch {
      // Nowhere to keep it.
    }
  }
}
