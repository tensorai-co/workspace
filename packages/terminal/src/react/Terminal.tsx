import type { Clipboard, TerminalHost } from '@tensorai-workspace/host'
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { TerminalInstance } from '../core/terminals.js'
import { TerminalView, type TerminalViewConfig } from '../view/view.js'

export interface TerminalProps extends Pick<TerminalViewConfig, 'onLink' | 'onContextMenu' | 'onKey' | 'onFocus' | 'copyOnSelect' | 'minimumContrast' | 'label'> {
  /** A terminal kept elsewhere, such as one of a `Terminals`. */
  terminal?: TerminalInstance
  /** Or where to open one, which lasts as long as this component. */
  host?: TerminalHost
  cwd?: string
  clipboard?: Clipboard
  autoFocus?: boolean
  className?: string
  style?: CSSProperties
  /** The view, once it exists. */
  onView?: (view: TerminalView | null) => void
}

/** One terminal, with no tabs: for any app that needs just that. */
export function Terminal({ terminal, host, cwd, clipboard, autoFocus, className = '', style, onView, label, copyOnSelect, minimumContrast, ...callbacks }: TerminalProps) {
  const parent = useRef<HTMLDivElement>(null)
  const latest = useRef({ ...callbacks, onView })
  latest.current = { ...callbacks, onView }

  useLayoutEffect(() => {
    const el = parent.current
    if (!el) return
    const own = !terminal && host ? new TerminalInstance('terminal', host, { cwd }) : undefined
    const it = terminal ?? own
    if (!it) return
    const view = new TerminalView({
      parent: el,
      screen: it.screen,
      label: label ?? 'Terminal',
      clipboard,
      copyOnSelect,
      minimumContrast,
      onInput: (data) => it.write(data),
      onResize: (cols, rows) => it.resize(cols, rows),
      onKey: (e) => latest.current.onKey?.(e) ?? false,
      onFocus: (focused) => latest.current.onFocus?.(focused),
      ...(callbacks.onLink ? { onLink: (uri: string) => latest.current.onLink?.(uri) } : {}),
      ...(callbacks.onContextMenu ? { onContextMenu: (at: { x: number; y: number }) => latest.current.onContextMenu?.(at) } : {}),
    })
    latest.current.onView?.(view)
    if (autoFocus) view.focus()
    return () => {
      latest.current.onView?.(null)
      view.destroy()
      own?.dispose()
    }
    // A view lasts as long as its terminal; callbacks are read when they're called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminal, host, cwd, clipboard, copyOnSelect, minimumContrast, label])

  return <div ref={parent} className={className} style={{ height: '100%', ...style }} />
}
