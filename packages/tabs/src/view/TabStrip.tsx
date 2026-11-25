import { useHover } from '@tensorai-co/workspace/overlays'
import { Codicon } from '@tensorai-co/workspace/icons/react'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { Tab, TabsModel } from '../core/model.js'
import { TabsScrollbar } from './TabsScrollbar.js'

/** How a tab looks. */
export interface TabInfo {
  label: string
  /** Before the label, 16px wide and 6px from it: a file icon, for instance. */
  icon?: ReactNode
  /** After the label and fainter, such as the folder when names repeat (see `distinguish`). */
  description?: string
  /** At the end of the label: a letter or a count. */
  badge?: string
  /** Shown when the pointer rests on it, such as the full path. */
  tooltip?: string
}

export interface TabStripProps<T> {
  model: TabsModel<T>
  /** The accessible name. */
  label: string
  describe: (tab: Tab<T>) => TabInfo
  /** A tab's close button, or a middle click. Closes the tab by default; give it to ask about unsaved changes first. */
  onClose?: (tab: Tab<T>) => void
  onContextMenu?: (tab: Tab<T>, at: { x: number; y: number }) => void
  /** A tab was chosen with the mouse or the keyboard, even if it was already active. */
  onSelect?: (tab: Tab<T>) => void
  /** Buttons at the right end, as TabAction. */
  actions?: ReactNode
  /** Tabs can be dragged between strips with the same drag type, and within a strip. Undefined turns dragging off. */
  dragType?: string
  className?: string
  style?: CSSProperties
}

/** The tab being dragged, which may have come from another strip. */
let dragged: { type: string; model: TabsModel<unknown>; id: string } | undefined

/** The tab bar. */
export function TabStrip<T>({ model, label, describe, onClose, onContextMenu, onSelect, actions, dragType, className = '', style }: TabStripProps<T>) {
  useSyncExternalStore(model.subscribe, () => model.version)
  const list = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ left: 0, width: 0, total: 0 })
  /** Where a dragged tab would land: before the tab at this index. */
  const [drop, setDrop] = useState<number>()
  const hover = useHover()
  const { tabs, active } = model

  const measure = () => {
    const el = list.current
    if (!el) return
    const next = { left: el.scrollLeft, width: el.clientWidth, total: el.scrollWidth }
    setScroll((s) => (s.left === next.left && s.width === next.width && s.total === next.total ? s : next))
  }

  // Keep the scrollbar right, and the active tab in view.
  useLayoutEffect(measure)
  useLayoutEffect(() => {
    const el = list.current
    const tab = el?.querySelector<HTMLElement>('[aria-selected=true]')
    if (!el || !tab || !el.clientWidth) return
    const left = tab.offsetLeft
    // The last tab comes with the space after it.
    const right = tab.nextElementSibling ? left + tab.offsetWidth : el.scrollWidth
    if (left < el.scrollLeft || tab.offsetWidth > el.clientWidth) el.scrollLeft = left
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth
  }, [active?.id, tabs.length, scroll.width])

  useEffect(() => {
    const el = list.current
    if (!el) return
    // A wheel scrolls the tabs sideways, whichever way it turns.
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    }
    el.addEventListener('wheel', wheel, { passive: false })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(el)
    return () => {
      el.removeEventListener('wheel', wheel)
      observer?.disconnect()
    }
    // Once: measure reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = (tab: Tab<T>) => (onClose ? onClose(tab) : void model.close(tab.id))
  const choose = (tab: Tab<T>) => {
    model.activate(tab.id)
    onSelect?.(tab)
  }

  const keyDown = (e: KeyboardEvent<HTMLElement>, tab: Tab<T>) => {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return
    const at = model.indexOf(tab.id)
    const to = { ArrowLeft: at - 1, ArrowUp: at - 1, ArrowRight: at + 1, ArrowDown: at + 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (to !== undefined) {
      const next = tabs[Math.max(0, Math.min(tabs.length - 1, to))]!
      model.activate(next.id)
      // The keys move the focus with the active tab.
      list.current?.querySelectorAll<HTMLElement>('[role=tab]')[model.indexOf(next.id)]?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') choose(tab)
    else return
    e.preventDefault()
  }

  // ------------------------------------------------------------ dragging

  const dragOver = (e: DragEvent, index: number) => {
    if (dragType === undefined || dragged?.type !== dragType) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const from = dragged.model === (model as TabsModel<unknown>) ? model.indexOf(dragged.id) : -2
    // Either side of where it already is isn't a move.
    setDrop(index === from || index === from + 1 ? undefined : index)
  }
  const dragOverTab = (e: DragEvent<HTMLElement>, index: number) => {
    const box = e.currentTarget.getBoundingClientRect()
    dragOver(e, e.clientX < box.left + box.width / 2 ? index : index + 1)
  }
  const dropTab = (e: DragEvent) => {
    const from = dragged
    const index = drop
    setDrop(undefined)
    if (dragType === undefined || from?.type !== dragType) return
    e.preventDefault()
    e.stopPropagation()
    dragged = undefined
    if (index === undefined) return
    if (from.model === (model as TabsModel<unknown>)) {
      const at = model.indexOf(from.id)
      model.move(from.id, index > at ? index - 1 : index)
    } else from.model.moveTo(from.id, model as TabsModel<unknown>, index)
  }
  useEffect(() => {
    if (drop === undefined) return
    // The drag may end anywhere.
    const end = () => setDrop(undefined)
    window.addEventListener('dragend', end)
    return () => window.removeEventListener('dragend', end)
  }, [drop])

  return (
    <div className={`ws-tabs ${className}`} style={style} hidden={!tabs.length}>
      <div className="ws-tabs-scroll">
        <div
          ref={list}
          className="ws-tabs-list"
          role="tablist"
          aria-label={label}
          onScroll={() => {
            hover.hide()
            measure()
          }}
          onDragOver={(e) => dragOver(e, tabs.length)}
          onDragLeave={(e) => {
            if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setDrop(undefined)
          }}
          onDrop={dropTab}
        >
          {tabs.map((tab, i) => {
            const info = describe(tab)
            const selected = active === tab
            const before = drop === i
            const after = drop === tabs.length && i === tabs.length - 1
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={selected}
                aria-label={[info.label, info.description, tab.preview ? 'preview' : '', tab.dirty ? 'unsaved' : ''].filter(Boolean).join(', ')}
                tabIndex={selected ? 0 : -1}
                className={`ws-tab ${selected ? 'ws-active' : ''} ${tab.preview ? 'ws-preview' : ''} ${tab.dirty ? 'ws-dirty' : ''} ${before ? 'ws-drop-before' : ''} ${after ? 'ws-drop-after' : ''}`}
                draggable={dragType !== undefined}
                onMouseMove={(e) => hover.over(e, info.tooltip)}
                onMouseLeave={hover.hide}
                onMouseDown={(e) => {
                  hover.hide()
                  if (e.button === 0) model.activate(tab.id)
                  // A middle click closes; don't start scrolling instead.
                  else if (e.button === 1) e.preventDefault()
                }}
                // After mousedown: the browser has moved the focus here by now, so the host can take it.
                onClick={() => onSelect?.(tab)}
                onDoubleClick={() => model.keep(tab.id)}
                onAuxClick={(e) => e.button === 1 && close(tab)}
                onContextMenu={(e: MouseEvent) => {
                  if (!onContextMenu) return
                  e.preventDefault()
                  hover.hide()
                  onContextMenu(tab, { x: e.clientX, y: e.clientY })
                }}
                onKeyDown={(e) => {
                  hover.hide()
                  keyDown(e, tab)
                }}
                onDragStart={(e) => {
                  if (dragType === undefined) return
                  hover.hide()
                  dragged = { type: dragType, model: model as TabsModel<unknown>, id: tab.id }
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('application/x-ws-tab', tab.id)
                }}
                onDragEnd={() => (dragged = undefined)}
                onDragOver={(e) => dragOverTab(e, i)}
              >
                <div className={selected ? 'ws-joined' : 'ws-tab-fill'} />
                {selected && <div className="ws-joined-edge" />}
                <div className="ws-tab-divider" />
                <div className="ws-tab-label">
                  {info.icon}
                  <span className="ws-tab-name">{info.label}</span>
                  {info.description && <span className="ws-tab-description">{info.description}</span>}
                  {info.badge && <span className="ws-tab-badge">{info.badge}</span>}
                </div>
                <div className="ws-tab-actions">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Close ${info.label}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      close(tab)
                    }}
                  >
                    <Codicon name="circle-filled" className="ws-tab-dot" />
                    <Codicon name="close-small" className="ws-tab-close" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <TabsScrollbar {...scroll} onScroll={(left) => list.current && (list.current.scrollLeft = left)} />
      </div>
      {actions && <div className="ws-tabs-actions">{actions}</div>}
      {hover.element}
    </div>
  )
}
