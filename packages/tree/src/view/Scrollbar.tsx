import { useRef, useState, type PointerEvent } from 'react'

/** The overlay scrollbar: 8px, over the rows, shown while the pointer is over the list or it's scrolling. */
export function Scrollbar({ height, total, top, onScroll }: { height: number; total: number; top: number; onScroll: (top: number) => void }) {
  const drag = useRef<{ y: number; top: number } | undefined>(undefined)
  const [active, setActive] = useState(false)
  if (total <= height || height <= 0) return null
  const size = Math.max(20, Math.floor((height * height) / total))
  const range = height - size
  const scale = (total - height) / range

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const box = e.currentTarget.getBoundingClientRect()
    const at = e.clientY - box.top
    let start = top
    // On the track: jump there, then drag from it.
    if (at < top / scale || at > top / scale + size) onScroll((start = Math.max(0, Math.min(total - height, (at - size / 2) * scale))))
    drag.current = { y: e.clientY, top: start }
    e.currentTarget.setPointerCapture(e.pointerId)
    setActive(true)
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) onScroll(drag.current.top + (e.clientY - drag.current.y) * scale)
  }
  const up = () => {
    drag.current = undefined
    setActive(false)
  }

  return (
    <div className={`ws-tree-scrollbar ${active ? 'ws-active' : ''}`} aria-hidden="true" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onMouseDown={(e) => e.preventDefault()}>
      <div className="ws-tree-slider" style={{ height: size, transform: `translateY(${top / scale}px)` }} />
    </div>
  )
}
