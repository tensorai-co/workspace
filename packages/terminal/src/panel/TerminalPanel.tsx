import type { Clipboard, TerminalHost } from '@tensorai-workspace/host'
import type { CodiconName } from '@tensorai-workspace/icons'
import { Codicon } from '@tensorai-workspace/icons/react'
import { Menu, useHover, type MenuItem } from '@tensorai-workspace/overlays'
import { Pane, Split } from '@tensorai-workspace/split'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { Terminals, type TerminalInstance } from '../core/terminals.js'
import { Terminal } from '../react/Terminal.js'
import type { TerminalView } from '../view/view.js'

/** The sizes for the list of terminals. */
const LIST_WIDTH = 120
const LIST_NARROW = 46
const LIST_WIDE = 80
const LIST_MAX = 500

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export interface TerminalPanelProps {
  /** The terminals, when the host keeps them: they then outlast the panel. */
  terminals?: Terminals
  /** Or where to open them, for as long as the panel lasts. */
  host?: TerminalHost
  cwd?: string
  clipboard?: Clipboard
  /** The row along the top. On by default; a host with its own puts `<TerminalActions>` there. */
  header?: boolean
  /** Buttons at the end of the header, such as maximize and close. */
  actions?: ReactNode
  onLink?: (uri: string) => void
  /** The last terminal closed. */
  onEmpty?: () => void
  /** Counts up when the active terminal should take the focus. */
  focus?: number
  className?: string
}

/** The terminal panel: the terminals, and a list of them when there are two or more. */
export function TerminalPanel({ terminals, host, cwd, clipboard, header = true, actions, onLink, onEmpty, focus = 0, className = '' }: TerminalPanelProps) {
  const [own, setOwn] = useState<Terminals>()
  const latest = useRef({ onEmpty })
  latest.current = { onEmpty }

  useEffect(() => {
    if (terminals || !host) return
    const made = new Terminals(host, { cwd })
    setOwn(made)
    return () => made.dispose()
  }, [terminals, host, cwd])

  const model = terminals ?? own
  // There's always one to begin with.
  useEffect(() => {
    if (model && !model.list.length) model.create()
  }, [model])
  useEffect(() => {
    if (!model) return
    let had = model.list.length
    return model.subscribe(() => {
      const now = model.list.length
      if (had && !now) latest.current.onEmpty?.()
      had = now
    })
  }, [model])

  if (!model) return <div className={`ws-terminal-panel ${className}`} />
  return (
    <section className={`ws-terminal-panel ${className}`}>
      {header && (
        <div className="ws-terminal-header">
          <div className="ws-terminal-heading">
            <i className="ws-joined ws-joined-start" aria-hidden="true" />
            <i className="ws-joined-edge" aria-hidden="true" />
            <span>Terminal</span>
          </div>
          <TerminalActions terminals={model}>{actions}</TerminalActions>
        </div>
      )}
      <TerminalBody terminals={model} clipboard={clipboard} onLink={onLink} focus={focus} />
    </section>
  )
}

const useTerminals = (terminals: Terminals) => useSyncExternalStore(terminals.subscribe, () => terminals.version)

/** The icons for the shells that have one. */
const SHELL_ICONS: Record<string, CodiconName> = { bash: 'terminal-bash', cmd: 'terminal-cmd', powershell: 'terminal-powershell', pwsh: 'terminal-powershell', tmux: 'terminal-tmux' }

const statusIcon = (t: TerminalInstance): CodiconName => (t.status === 'exited' ? 'error' : (SHELL_ICONS[t.name.replace(/\.exe$/, '')] ?? 'terminal'))

/** The buttons for a panel's header: the only terminal's name, new, kill and more. */
export function TerminalActions({ terminals, children }: { terminals: Terminals; children?: ReactNode }) {
  useTerminals(terminals)
  const [menu, setMenu] = useState<{ x: number; y: number }>()
  const { active, list } = terminals
  const button = (icon: CodiconName, label: string, run: (at: { x: number; y: number }) => void) => (
    <button
      type="button"
      className="ws-terminal-action"
      title={label}
      aria-label={label}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect()
        run({ x: box.left, y: box.bottom })
      }}
    >
      <Codicon name={icon} />
    </button>
  )
  return (
    <div className="ws-terminal-actions">
      {list.length === 1 && active && (
        <button type="button" className="ws-terminal-single" title={active.title} onClick={() => terminals.activate(active.id)}>
          <Codicon name={statusIcon(active)} />
          {active.title}
        </button>
      )}
      {button('add', 'New Terminal (⌃⇧`)', () => terminals.create())}
      {active && button('trash', 'Kill Terminal', () => terminals.close(active.id))}
      {button('ellipsis', 'Views and More Actions...', setMenu)}
      {children && <span className="ws-terminal-separator" />}
      {children}
      {menu && (
        <Menu
          at={menu}
          onClose={() => setMenu(undefined)}
          groups={[
            [
              { label: 'Next Terminal', disabled: list.length < 2, run: () => terminals.cycle(1) },
              { label: 'Previous Terminal', disabled: list.length < 2, run: () => terminals.cycle(-1) },
            ],
            [{ label: 'Clear Terminal', keys: isMac ? '⌘K' : undefined, disabled: !active, run: () => active?.screen.clear() }],
            [{ label: 'Kill All Terminals', disabled: !list.length, run: () => terminals.dispose() }],
          ]}
        />
      )}
    </div>
  )
}

/** The terminals themselves, each kept as it was while another shows. */
function TerminalBody({ terminals, clipboard, onLink, focus }: { terminals: Terminals; clipboard?: Clipboard; onLink?: (uri: string) => void; focus: number }) {
  useTerminals(terminals)
  const views = useRef(new Map<string, TerminalView>())
  const [menu, setMenu] = useState<{ id: string; at: { x: number; y: number } }>()
  const { active, list } = terminals
  const activeId = active?.id

  // A terminal that's made or chosen takes the focus; the ones there at first don't.
  const shown = useRef(activeId)
  const focused = useRef(focus)
  useLayoutEffect(() => {
    const changed = shown.current !== activeId && shown.current !== undefined
    const asked = focused.current !== focus
    shown.current = activeId
    focused.current = focus
    if ((changed || asked) && activeId) views.current.get(activeId)?.focus()
  }, [activeId, focus])

  const menuGroups = (id: string): MenuItem[][] => {
    const view = views.current.get(id)
    return [
      [{ label: 'New Terminal', run: () => terminals.create() }],
      [
        { label: 'Copy', keys: isMac ? '⌘C' : 'Ctrl+Shift+C', disabled: !view || view.selection.isEmpty, run: () => void view?.copy() },
        { label: 'Paste', keys: isMac ? '⌘V' : 'Ctrl+Shift+V', run: () => void view?.pasteFromClipboard().catch(() => {}) },
        { label: 'Select All', keys: isMac ? '⌘A' : undefined, run: () => view?.selection.selectAll() },
      ],
      [{ label: 'Clear', keys: isMac ? '⌘K' : undefined, run: () => view?.clear() }],
      [{ label: 'Kill Terminal', run: () => terminals.close(id) }],
    ]
  }

  const stack = (
    <div className="ws-terminal-stack">
      {list.map((t) => (
        <div key={t.id} className="ws-terminal-slot" hidden={t.id !== activeId}>
          <Terminal
            terminal={t}
            clipboard={clipboard}
            label={`Terminal, ${t.title}`.slice(0, 80)}
            onLink={onLink}
            onContextMenu={(at) => setMenu({ id: t.id, at })}
            onKey={(e) => {
              // Any key closes one whose process is gone.
              if (t.status !== 'exited' || e.metaKey || e.ctrlKey || e.altKey || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return false
              terminals.close(t.id)
              return true
            }}
            onView={(view) => {
              if (view) views.current.set(t.id, view)
              else views.current.delete(t.id)
              if (view && t.id === activeId && shown.current === activeId && list.length > 1) view.focus()
            }}
          />
        </div>
      ))}
    </div>
  )

  return (
    <div className="ws-terminal-body">
      <Split direction="row" className="ws-terminal-split">
        <Pane id="terminals" min={100} grow>
          {stack}
        </Pane>
        {list.length > 1 && (
          <Pane id="list" size={LIST_WIDTH} min={LIST_NARROW} max={LIST_MAX}>
            <TerminalList terminals={terminals} onFocus={() => activeId && views.current.get(activeId)?.focus()} />
          </Pane>
        )}
      </Split>
      {menu && (
        <Menu
          at={menu.at}
          groups={menuGroups(menu.id)}
          onClose={() => {
            setMenu(undefined)
            views.current.get(menu.id)?.focus()
          }}
        />
      )}
    </div>
  )
}

/** The terminal tabs: the list beside the terminals. */
function TerminalList({ terminals, onFocus }: { terminals: Terminals; onFocus: () => void }) {
  useTerminals(terminals)
  const box = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  const hover = useHover()
  const { active, list } = terminals

  useLayoutEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setNarrow(el.clientWidth > 0 && el.clientWidth < (LIST_NARROW + LIST_WIDE) / 2))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const keyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const at = list.findIndex((t) => t === active)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') terminals.activate(list[Math.max(0, Math.min(list.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]!.id)
      else if (e.key === 'Home') terminals.activate(list[0]!.id)
      else if (e.key === 'End') terminals.activate(list[list.length - 1]!.id)
      else if (e.key === 'Enter') onFocus()
      else if ((e.key === 'Delete' || e.key === 'Backspace') && active) terminals.close(active.id)
      else return
      e.preventDefault()
      // The keys work on the list: keep the focus in it.
      requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('[aria-selected=true]')?.focus())
    },
    [terminals, list, active, onFocus],
  )

  return (
    <div ref={box} className={`ws-terminal-list ${narrow ? 'ws-narrow' : ''}`} role="tablist" aria-orientation="vertical" aria-label="Terminal tabs" onKeyDown={keyDown}>
      {list.map((t) => (
        <div
          key={t.id}
          role="tab"
          aria-selected={t === active}
          aria-label={t.status === 'exited' ? `${t.title}, exited` : t.title}
          tabIndex={t === active ? 0 : -1}
          className={`ws-terminal-tab ${t === active ? 'ws-active' : ''} ${t.status === 'exited' ? 'ws-exited' : ''}`}
          onMouseMove={(e) => hover.over(e, t.screen.cwd ? `${t.title} — ${t.screen.cwd}` : t.title)}
          onMouseLeave={hover.hide}
          onMouseDown={hover.hide}
          onClick={() => {
            terminals.activate(t.id)
            onFocus()
          }}
          onAuxClick={(e) => e.button === 1 && terminals.close(t.id)}
        >
          <Codicon name={statusIcon(t)} />
          {!narrow && <span className="ws-terminal-name">{t.title}</span>}
          {!narrow && (
            <button
              type="button"
              tabIndex={-1}
              className="ws-terminal-kill"
              aria-label={`Kill ${t.title}`}
              onClick={(e) => {
                e.stopPropagation()
                terminals.close(t.id)
              }}
            >
              <Codicon name="trash" />
            </button>
          )}
        </div>
      ))}
      {hover.element}
    </div>
  )
}
