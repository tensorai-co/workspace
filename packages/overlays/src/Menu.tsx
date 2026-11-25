import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  /** Shown on the right. */
  keys?: string
  disabled?: boolean
  run: () => void
}

export interface MenuProps {
  /** Where it opens: the pointer, usually. */
  at: { x: number; y: number }
  /** Items, in groups separated by lines. */
  groups: MenuItem[][]
  /** It's to close: an item ran, or something else took over. Put the focus back where it was. */
  onClose: () => void
}

/** The context menu. */
export function Menu({ at, groups, onClose }: MenuProps) {
  const box = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState({ left: at.x, top: at.y })
  const items = groups.flat()
  const latest = useRef(onClose)
  latest.current = onClose

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const { offsetWidth: w, offsetHeight: h } = el
    // Beside the pointer, flipped where there's no room.
    setPlace({ left: at.x + w > innerWidth ? Math.max(0, at.x - w) : at.x, top: at.y + h > innerHeight ? Math.max(0, at.y - h >= 0 ? at.y - h : innerHeight - h) : at.y })
    el.focus({ preventScroll: true })
  }, [at.x, at.y])

  useEffect(() => {
    const close = (e: Event) => {
      if (!(e.target instanceof Node) || !box.current?.contains(e.target)) latest.current()
    }
    const closeNow = () => latest.current()
    document.addEventListener('mousedown', close, true)
    document.addEventListener('wheel', close, { capture: true, passive: true })
    window.addEventListener('blur', closeNow)
    window.addEventListener('resize', closeNow)
    return () => {
      document.removeEventListener('mousedown', close, true)
      document.removeEventListener('wheel', close, true)
      window.removeEventListener('blur', closeNow)
      window.removeEventListener('resize', closeNow)
    }
  }, [])

  const run = (item: MenuItem | undefined) => {
    if (!item || item.disabled) return
    onClose()
    item.run()
  }
  const move = (by: number) => {
    for (let i = 1; i <= items.length; i++) {
      const next = ((active < 0 && by < 0 ? 0 : active) + by * i + items.length * i) % items.length
      if (!items[next]!.disabled) return setActive(next)
    }
  }

  let index = -1
  return (
    <div
      ref={box}
      className="ws-menu"
      role="menu"
      tabIndex={-1}
      style={{ left: place.left, top: place.top }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => setActive(-1)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'ArrowDown') move(1)
        else if (e.key === 'ArrowUp') move(-1)
        else if (e.key === 'Home') setActive(items.findIndex((i) => !i.disabled))
        else if (e.key === 'End') setActive(items.findLastIndex((i) => !i.disabled))
        else if (e.key === 'Enter' || e.key === ' ') run(items[active])
        else if (e.key === 'Escape' || e.key === 'Tab') onClose()
        else return
        e.preventDefault()
      }}
    >
      {groups.map((group, g) => (
        <div key={g} role="group" className="ws-menu-group">
          {group.map((item) => {
            const i = ++index
            return (
              <div key={item.label} role="menuitem" aria-disabled={item.disabled || undefined} className={`ws-menu-item ${i === active ? 'ws-active' : ''}`} onMouseEnter={() => setActive(item.disabled ? -1 : i)} onMouseUp={(e) => e.button === 0 && run(item)}>
                <span className="ws-menu-label">{item.label}</span>
                {item.keys && <span className="ws-menu-keys">{item.keys}</span>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
