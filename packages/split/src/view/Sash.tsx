import { useEffect, useRef, useState, type PointerEvent } from 'react'

/** The default delay before a sash lights up. */
const HOVER_MS = 300

interface SashProps {
  row: boolean
  /** Its middle, from the start of the split. */
  position: number
  state: 'free' | 'min' | 'max' | 'disabled'
  onStart: () => void
  onMove: (delta: number) => void
  onEnd: () => void
  onReset: () => void
}

/** The 4px handle between two panes. */
export function Sash({ row, position, state, onStart, onMove, onEnd, onReset }: SashProps) {
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const start = useRef<number>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const at = (e: PointerEvent) => (row ? e.clientX : e.clientY)
  const end = () => {
    if (start.current === undefined) return
    start.current = undefined
    setActive(false)
    onEnd()
  }

  return (
    <div
      role="separator"
      aria-orientation={row ? 'vertical' : 'horizontal'}
      aria-disabled={state === 'disabled' || undefined}
      className={`ws-sash ws-${state} ${hovered ? 'ws-hover' : ''} ${active ? 'ws-active' : ''}`}
      style={row ? { left: position - 2 } : { top: position - 2 }}
      onPointerEnter={() => {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setHovered(true), HOVER_MS)
      }}
      onPointerLeave={() => {
        clearTimeout(timer.current)
        setHovered(false)
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || state === 'disabled') return
        // Keeps the focus where it is, and text from being selected.
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        start.current = at(e)
        setActive(true)
        onStart()
      }}
      onPointerMove={(e) => start.current !== undefined && onMove(at(e) - start.current)}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={() => state !== 'disabled' && onReset()}
    />
  )
}
