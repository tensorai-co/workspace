import type { Storage } from '@tensorai-co/workspace/host'
import { Children, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { SplitModel, type PaneSpec, type SavedSplit } from '../core/model.js'
import { Sash } from './Sash.js'

export interface PaneProps extends PaneSpec {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /** Whether it's open, when the host decides. Without it, only dragging opens and closes it. */
  visible?: boolean
  /** It was opened or closed by dragging. */
  onVisibleChange?: (visible: boolean) => void
}

/** A pane of a Split. It must be a direct child. */
export function Pane(_props: PaneProps): ReactNode {
  throw new Error('A Pane must be a direct child of a Split')
}

export interface SplitProps {
  /** "row" sets panes side by side, "column" one above the other. */
  direction: 'row' | 'column'
  /** Space between panes, with the sash in it. Without a gap, panes meet at a line. */
  gap?: number
  /** Where the sizes are kept, under `storageKey`. */
  storage?: Storage
  storageKey?: string
  /** Panes. Anything falsy is left out, so panes can be conditional. */
  children?: ReactNode
  /** The model, once it exists: for resizing or opening panes. */
  onModel?: (model: SplitModel | null) => void
  className?: string
  style?: CSSProperties
}

const read = (storage: Storage | undefined, key: string | undefined): SavedSplit | undefined => {
  if (!storage || !key) return undefined
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? 'null')
    return value && typeof value === 'object' ? (value as SavedSplit) : undefined
  } catch {
    // Not something we saved: start afresh.
    return undefined
  }
}

/** Panes in a row or a column, resized by the sashes between them. */
export function Split({ direction, gap = 0, storage, storageKey, children, onModel, className = '', style }: SplitProps) {
  const row = direction === 'row'
  const panes = Children.toArray(children).filter((c): c is ReactElement<PaneProps> => isValidElement(c) && c.type === Pane)
  const specs: PaneSpec[] = panes.map(({ props: { id, size, min, max, grow, snap } }) => ({ id, size, min, max, grow, snap }))

  const model = useMemo(() => {
    const m = new SplitModel(specs, { gap })
    const saved = read(storage, storageKey)
    if (saved) m.restore(saved)
    return m
    // A new model only for another split; panes that come and go are set below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gap, storage, storageKey])
  useSyncExternalStore(model.subscribe, () => model.version)

  const box = useRef<HTMLDivElement>(null)
  const latest = useRef({ panes, onModel })
  latest.current = { panes, onModel }

  // Follow the panes and what the host shows. A drag may have closed one since, which only a change of the prop undoes.
  const applied = useRef<{ model?: SplitModel; visible: Map<string, boolean> }>({ visible: new Map() })
  useLayoutEffect(() => {
    if (applied.current.model !== model) applied.current = { model, visible: new Map() }
    model.setPanes(specs)
    const seen = new Map<string, boolean>()
    for (const { props } of panes) {
      if (props.visible === undefined) continue
      seen.set(props.id, props.visible)
      if (applied.current.visible.get(props.id) !== props.visible) model.setVisible(props.id, props.visible)
    }
    applied.current.visible = seen
  })

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => model.layout(row ? el.clientWidth : el.clientHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [model, row])

  // Save what changes, once it stops changing.
  useEffect(() => {
    if (!storage || !storageKey) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = model.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        storage.setItem(storageKey, JSON.stringify(model.save()))
      }, 100)
    })
    return () => {
      stop()
      if (timer === undefined) return
      clearTimeout(timer)
      storage.setItem(storageKey, JSON.stringify(model.save()))
    }
  }, [model, storage, storageKey])

  useEffect(() => {
    latest.current.onModel?.(model)
    return () => latest.current.onModel?.(null)
  }, [model])

  // The grips show while the pointer moves and go 2 seconds after it stops.
  useEffect(() => {
    if (!gap) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const moved = () => {
      clearTimeout(timer)
      box.current?.removeAttribute('data-grips-hidden')
      timer = setTimeout(() => box.current?.setAttribute('data-grips-hidden', ''), 2000)
    }
    moved()
    window.addEventListener('mousemove', moved, { capture: true, passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', moved, true)
    }
  }, [gap])

  /** What was open when a drag started, to tell hosts what it opened and closed. */
  const openBefore = useRef(new Map<string, boolean>())
  const report = () => {
    for (const { props } of latest.current.panes) {
      const now = model.isVisible(props.id)
      if (openBefore.current.get(props.id) !== now) props.onVisibleChange?.(now)
    }
  }

  const laid = new Map(model.panes.map((p) => [p.id, p]))
  const px = (n: number) => `${n}px`
  return (
    <div ref={box} className={`ws-split ws-${direction} ${gap ? 'ws-gaps' : ''} ${className}`} style={style}>
      {panes.map(({ props }, i) => {
        const pane = laid.get(props.id)
        const visible = pane?.visible ?? false
        const first = !panes.slice(0, i).some((p) => laid.get(p.props.id)?.visible)
        const place: CSSProperties = row ? { left: px(pane?.offset ?? 0), width: px(pane?.size ?? 0) } : { top: px(pane?.offset ?? 0), height: px(pane?.size ?? 0) }
        return (
          <div key={props.id} className={`ws-pane ${first ? 'ws-first' : ''} ${props.className ?? ''}`} style={{ ...props.style, ...place, ...(visible ? undefined : { display: 'none' }) }}>
            {props.children}
          </div>
        )
      })}
      {model.sashes.map((sash) => (
        <Sash
          key={sash.index}
          row={row}
          position={sash.position}
          state={!sash.enabled ? 'disabled' : sash.atMin ? 'min' : sash.atMax ? 'max' : 'free'}
          onStart={() => {
            openBefore.current = new Map(model.panes.map((p) => [p.id, p.visible]))
            model.startDrag(sash.index)
          }}
          onMove={(delta) => model.dragTo(delta)}
          onEnd={() => {
            model.endDrag()
            report()
          }}
          onReset={() => model.reset(sash.index)}
        />
      ))}
    </div>
  )
}
