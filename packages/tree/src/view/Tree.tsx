import { useHover } from '@tensorai-workspace/overlays'
import { Codicon } from '@tensorai-workspace/icons/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { runTreeKey } from '../core/keys.js'
import type { TreeModel, TreeNode } from '../core/model.js'
import { EditBox, type TreeEditing } from './EditBox.js'
import { Scrollbar } from './Scrollbar.js'

export type { TreeEditing }

/** The tree sizes, measured. */
const ROW = 22
const INDENT = 8
const GUIDES = 16
const TWISTIE_PAD = 8
/** Rows rendered beyond each edge of the view. */
const OVERSCAN = 10

export interface TreeProps<T> {
  model: TreeModel<T>
  /** The accessible name. */
  label: string
  /** What's before the label, usually a file icon. `name` is the text being typed while the row is edited. */
  renderIcon?: (node: TreeNode<T>, name: string | undefined) => ReactNode
  /** The label; the source's text by default. */
  renderLabel?: (node: TreeNode<T>) => ReactNode
  /** Opening an item that can't expand: a preview on click and Space, for good on double-click, middle click and Enter. */
  onOpen?: (item: T, how: { preview: boolean }) => void
  /** A right-click or the menu key, on a row or (undefined) the space below. */
  onContextMenu?: (node: TreeNode<T> | undefined, at: { x: number; y: number }) => void
  /** What a row shows when the pointer rests on it, such as a full path. */
  tooltip?: (item: T) => string | undefined
  /** Before the tree's own keys. Call preventDefault to take the key. */
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void
  /** The row being named in place. */
  editing?: TreeEditing
  /** The row a context menu is open on, which stays outlined meanwhile. */
  menuTarget?: string
  multiSelect?: boolean
  /** Blank space to scroll to after the last row. */
  paddingBottom?: number
  className?: string
  style?: CSSProperties
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** A virtualized tree: only the rows in view are in the DOM. */
export function Tree<T>({ model, label, renderIcon, renderLabel, onOpen, onContextMenu, tooltip, onKeyDown, editing, menuTarget, multiSelect = true, paddingBottom = 0, className = '', style }: TreeProps<T>) {
  useSyncExternalStore(model.subscribe, () => model.version)
  const scroller = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ top: 0, height: 0 })
  const [editText, setEditText] = useState<string>()
  const hover = useHover()
  const prefix = useId()
  const { rows } = model
  const total = rows.length * ROW + paddingBottom

  useEffect(() => {
    void model.load()
  }, [model])

  // Keep track of the view's size.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => setView((v) => (v.height === el.clientHeight ? v : { ...v, height: el.clientHeight }))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Scroll to what the model asks for.
  const reveal = model.reveal
  useLayoutEffect(() => {
    const el = scroller.current
    const row = model.rowOf(reveal?.id)
    if (!el || !reveal || row < 0 || !el.clientHeight) return
    const top = row * ROW
    const height = el.clientHeight
    if (top >= el.scrollTop && top + ROW <= el.scrollTop + height) return
    if (reveal.center) el.scrollTop = top - Math.max(0, (height - ROW) / 2)
    else el.scrollTop = top < el.scrollTop ? top : top + ROW - height
  }, [model, reveal])

  // Naming a row starts with it in view, and ends with the focus back in the tree.
  const editId = editing?.id
  const editRow = model.rowOf(editId)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || editId === undefined) return
    setEditText(undefined)
    const top = model.rowOf(editId) * ROW
    if (top < el.scrollTop) el.scrollTop = top
    else if (el.clientHeight && top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW - el.clientHeight
    return () => {
      const now = document.activeElement
      if (!now || now === document.body || el.contains(now)) el.focus({ preventScroll: true })
    }
  }, [model, editId])

  // Without layout (tests), render a screenful.
  const height = view.height || 40 * ROW
  const first = Math.max(0, Math.floor(view.top / ROW) - OVERSCAN)
  const last = Math.min(rows.length, Math.ceil((view.top + height) / ROW) + OVERSCAN)
  const shown: number[] = []
  for (let i = first; i < last; i++) shown.push(i)
  // The focused row is aria-activedescendant and the edited one has the input, so those are always rendered.
  for (const i of [model.rowOf(model.focused?.id), editRow]) if (i >= 0 && (i < first || i >= last) && !shown.includes(i)) shown.push(i)

  const rowId = (id: string) => `${prefix}-${id}`
  const focusTree = () => scroller.current?.focus({ preventScroll: true })
  const mod = (e: MouseEvent) => (isMac ? e.metaKey : e.ctrlKey)

  const onRowClick = (e: MouseEvent, node: TreeNode<T>) => {
    if (e.button !== 0) return
    if (multiSelect && e.shiftKey) return model.select(node.id, 'range')
    if (multiSelect && mod(e)) return model.select(node.id, 'toggle')
    if (e.detail > 1) return
    model.select(node.id)
    if (node.expandable) void model.toggle(node.id)
    else onOpen?.(node.item, { preview: true })
  }

  const openMenu = (node: TreeNode<T> | undefined, at: { x: number; y: number }) => {
    if (node) {
      if (model.isSelected(node.id)) model.focus(node.id)
      else model.select(node.id)
    }
    onContextMenu?.(node, at)
  }

  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.nativeEvent.isComposing) return
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      const node = model.focused
      const box = (node && document.getElementById(rowId(node.id))) || scroller.current!
      const rect = box.getBoundingClientRect()
      openMenu(node, { x: rect.left + rect.width / 2, y: node ? rect.bottom : rect.top })
      return
    }
    const handled = runTreeKey(e, { model, multiSelect, mac: isMac, pageSize: Math.floor(height / ROW), open: (item, how) => onOpen?.(item, how) })
    if (handled) e.preventDefault()
  }

  const guides = model.activeGuides()
  return (
    <div className={`ws-tree ${className}`} style={style}>
      <div
        ref={scroller}
        className={`ws-tree-scroll ${menuTarget !== undefined ? 'ws-menu-open' : ''}`}
        role="tree"
        tabIndex={0}
        aria-label={label}
        aria-multiselectable={multiSelect}
        aria-activedescendant={model.focused ? rowId(model.focused.id) : undefined}
        onScroll={(e) => {
          hover.hide()
          const top = e.currentTarget.scrollTop
          setView((v) => (v.top === top ? v : { ...v, top }))
        }}
        onKeyDown={(e) => {
          hover.hide()
          keyDown(e)
        }}
        onClick={(e) => {
          // The space below the rows.
          if (e.target !== e.currentTarget && !(e.target as Element).classList.contains('ws-tree-rows')) return
          model.clearSelection()
          model.focus(undefined)
        }}
        onContextMenu={(e) => {
          if (e.defaultPrevented) return
          e.preventDefault()
          openMenu(undefined, { x: e.clientX, y: e.clientY })
        }}
      >
        <div className="ws-tree-rows" role="none" style={{ height: total }}>
          {shown.map((i) => {
            const node = rows[i]!
            const edited = editing?.id === node.id ? editing : undefined
            const focused = model.focused === node
            const selected = model.isSelected(node.id)
            const ancestors: TreeNode<T>[] = []
            for (let a = node.parent; a; a = a.parent) ancestors.unshift(a)
            const text = model.source.label(node.item)
            return (
              <div
                key={node.id}
                id={rowId(node.id)}
                role="treeitem"
                className={`ws-tree-row ${focused ? 'ws-focused' : ''} ${selected ? 'ws-selected' : ''} ${edited ? 'ws-editing' : ''}`}
                style={{ top: i * ROW }}
                aria-label={text || editing?.label}
                aria-level={node.depth + 1}
                aria-posinset={node.index + 1}
                aria-setsize={model.childrenOf(node.parent?.id)?.length}
                aria-expanded={node.expandable ? node.expanded : undefined}
                aria-selected={selected}
                aria-busy={node.loading || undefined}
                onMouseMove={(e) => hover.over(e, edited ? undefined : tooltip?.(node.item))}
                onMouseLeave={hover.hide}
                onMouseDown={(e) => {
                  hover.hide()
                  if (e.button === 1) e.preventDefault()
                  focusTree()
                  if (e.button === 0) model.focus(node.id, false)
                }}
                onClick={(e) => onRowClick(e, node)}
                onDoubleClick={(e) => {
                  if (!node.expandable && !e.shiftKey && !mod(e)) onOpen?.(node.item, { preview: false })
                }}
                onAuxClick={(e) => {
                  if (e.button === 1 && !node.expandable) onOpen?.(node.item, { preview: false })
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openMenu(node, { x: e.clientX, y: e.clientY })
                }}
              >
                <div className="ws-tree-indent" style={{ left: GUIDES }}>
                  {ancestors.map((a) => (
                    <div key={a.id} className={`ws-tree-guide ${guides.has(a.id) ? 'ws-active' : ''}`} />
                  ))}
                </div>
                <div className={`ws-tree-twistie ${node.expandable ? 'ws-expandable' : ''} ${node.expandable && !node.expanded ? 'ws-collapsed' : ''} ${node.slow ? 'ws-loading' : ''}`} style={{ paddingLeft: TWISTIE_PAD + node.depth * INDENT }}>
                  {node.expandable && <Codicon name={node.slow ? 'loading' : 'chevron-down'} />}
                </div>
                <div className="ws-tree-content">
                  {renderIcon?.(node, edited ? (editText ?? edited.value) : undefined)}
                  {edited ? (
                    <EditBox
                      key={edited.id}
                      above={(i + 3) * ROW > view.top + height && i > 2}
                      editing={{
                        ...edited,
                        onChange: (value) => {
                          setEditText(value)
                          edited.onChange?.(value)
                        },
                      }}
                    />
                  ) : (
                    <span className="ws-tree-label">{renderLabel ? renderLabel(node) : text}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {hover.element}
      <Scrollbar height={view.height} total={total} top={view.top} onScroll={(top) => scroller.current && (scroller.current.scrollTop = top)} />
    </div>
  )
}
