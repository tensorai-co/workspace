import { useRef, useState, type PointerEvent } from 'react'

/** The 3px scrollbar along the top of the tabs, shown while the pointer is over them. */
export function TabsScrollbar({ left, width, total, onScroll }: { left: number; width: number; total: number; onScroll: (left: number) => void }) {
  const drag = useRef<{ x: number; left: number } | undefined>(undefined)
  const [active, setActive] = useState(false)
  if (total <= width || width <= 0) return null
  const size = Math.max(20, Math.floor((width * width) / total))
  const scale = (total - width) / (width - size)

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const at = e.clientX - e.currentTarget.getBoundingClientRect().left
    let start = left
    if (at < left / scale || at > left / scale + size) onScroll((start = Math.max(0, Math.min(total - width, (at - size / 2) * scale))))
    drag.current = { x: e.clientX, left: start }
    e.currentTarget.setPointerCapture(e.pointerId)
    setActive(true)
  }
  const up = () => {
    drag.current = undefined
    setActive(false)
  }

  return (
    <div className={`ws-tabs-scrollbar ${active ? 'ws-active' : ''}`} aria-hidden="true" onPointerDown={down} onPointerMove={(e) => drag.current && onScroll(drag.current.left + (e.clientX - drag.current.x) * scale)} onPointerUp={up} onPointerCancel={up}>
      <div className="ws-tabs-slider" style={{ width: size, transform: `translateX(${left / scale}px)` }} />
    </div>
  )
}
