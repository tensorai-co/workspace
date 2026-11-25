import type { TreeModel } from './model.js'

/** A key press, as a DOM KeyboardEvent has it. */
export interface TreeKey {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

export interface TreeKeyContext<T> {
  model: TreeModel<T>
  /** Rows that fit in the view. */
  pageSize: number
  multiSelect: boolean
  mac: boolean
  /** Opens the focused item. A preview is a look that leaves the focus in the tree. */
  open: (item: T, how: { preview: boolean }) => void
}

/** Runs the default tree keys. Returns whether the key did something. */
export function runTreeKey<T>(e: TreeKey, { model, pageSize, multiSelect, mac, open }: TreeKeyContext<T>): boolean {
  const mod = mac ? e.metaKey : e.ctrlKey
  const plain = !e.ctrlKey && !e.metaKey && !e.altKey
  const node = model.focused

  if (plain) {
    const move = (by: number) => {
      if (e.shiftKey && multiSelect) model.extendSelection(by)
      else model.moveFocus(by)
      return true
    }
    const page = Math.max(1, pageSize - 1)
    switch (e.key) {
      case 'ArrowDown':
        return move(1)
      case 'ArrowUp':
        return move(-1)
      case 'PageDown':
        return move(page)
      case 'PageUp':
        return move(-page)
      case 'Home':
        model.focusFirst()
        return true
      case 'End':
        model.focusLast()
        return true
      case 'ArrowLeft':
        model.focusOut()
        return true
      case 'ArrowRight':
        model.focusIn()
        return true
      case 'Enter':
        if (!node) return false
        model.select(node.id)
        if (node.expandable) void model.toggle(node.id)
        else open(node.item, { preview: false })
        return true
      case ' ':
        if (model.isTyping()) break
        if (!node) return false
        if (node.expandable) void model.toggle(node.id)
        else {
          model.select(node.id)
          open(node.item, { preview: true })
        }
        return true
      case 'Escape':
        model.clearSelection()
        return true
      case '*':
        if (node) void model.expandSiblings(node.id)
        return true
    }
    if (e.key.length === 1) return model.typeToFind(e.key)
    return false
  }

  if (mac && e.metaKey && !e.ctrlKey && !e.altKey && e.key === 'ArrowLeft') {
    model.collapseAll()
    return true
  }
  if (mod && !e.altKey && !e.shiftKey && multiSelect && e.key.toLowerCase() === 'a') {
    model.selectAll()
    return true
  }
  if (mac && e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey && e.key === 'ArrowDown' && node) {
    model.select(node.id)
    if (node.expandable) void model.toggle(node.id)
    else open(node.item, { preview: false })
    return true
  }
  return false
}
