import type { TabsModel } from './model.js'

/** A key press, as a DOM KeyboardEvent has it. */
export interface TabsKey {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

export interface TabsKeyContext<T> {
  model: TabsModel<T>
  mac: boolean
  /** Closes a tab, after asking about unsaved changes. */
  close: (id: string) => void
}

/**
 * The keys for a group of tabs: next and previous (`⌃Tab`, `⌃⇧Tab`, `⌥⌘→`, `⌥⌘←`, or `Ctrl+PageDown` and
 * `Ctrl+PageUp`) and close (`⌘W`). A browser keeps some of these to itself. Returns whether the key did something.
 */
export function runTabsKey<T>(e: TabsKey, { model, mac, close }: TabsKeyContext<T>): boolean {
  const only = (keys: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>>) => (['ctrlKey', 'metaKey', 'altKey', 'shiftKey'] as const).every((k) => e[k] === (keys[k] ?? false))
  let by = 0
  if (e.key === 'Tab' && only({ ctrlKey: true })) by = 1
  else if (e.key === 'Tab' && only({ ctrlKey: true, shiftKey: true })) by = -1
  else if (mac && only({ metaKey: true, altKey: true })) by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  else if (!mac && only({ ctrlKey: true })) by = e.key === 'PageDown' ? 1 : e.key === 'PageUp' ? -1 : 0
  if (by) {
    model.cycle(by)
    return true
  }
  if (e.key.toLowerCase() === 'w' && only(mac ? { metaKey: true } : { ctrlKey: true }) && model.active) {
    close(model.active.id)
    return true
  }
  return false
}
