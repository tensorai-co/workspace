import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'

/** The hover delay. */
const DELAY_MS = 500
/** How far right of the pointer it starts. */
const OFFSET = 10

interface Shown {
  text: string
  x: number
  top: number
  bottom: number
}

export interface Hover {
  /** Call from onMouseMove, with what to show for the element the event is on. Nothing shows without text. */
  over: (e: MouseEvent<HTMLElement>, text: string | undefined) => void
  /** Call from onMouseLeave, and on clicks, keys and scrolling. */
  hide: () => void
  /** The tooltip, to render once. */
  element: ReactNode
}

/** A tooltip: after the pointer rests, below the element, or above it when there's no room. */
export function useHover(): Hover {
  const [shown, setShown] = useState<Shown>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(shown)
  latest.current = shown
  useEffect(() => () => clearTimeout(timer.current), [])

  const hide = useCallback(() => {
    clearTimeout(timer.current)
    if (latest.current) setShown(undefined)
  }, [])

  const over = useCallback((e: MouseEvent<HTMLElement>, text: string | undefined) => {
    if (!text || e.buttons !== 0 || latest.current) return
    const target = e.currentTarget
    const x = e.clientX
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!target.isConnected) return
      const box = target.getBoundingClientRect()
      setShown({ text, x: x + OFFSET, top: box.top, bottom: box.bottom })
    }, DELAY_MS)
  }, [])

  return useMemo(() => ({ over, hide, element: shown ? <Tooltip {...shown} /> : null }), [over, hide, shown])
}

function Tooltip({ text, x, top, bottom }: Shown) {
  const box = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState({ left: x, top: bottom })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    setAt({ left: Math.max(0, Math.min(x, innerWidth - el.offsetWidth)), top: bottom + el.offsetHeight > innerHeight ? top - el.offsetHeight : bottom })
  }, [x, top, bottom])
  return (
    <div ref={box} className="ws-hover" role="tooltip" style={at}>
      {text}
    </div>
  )
}
