import type { EditorView } from '@tensorai-co/workspace/editor'
import { Explorer } from '@tensorai-co/workspace/explorer'
import type { MenuItem } from '@tensorai-co/workspace/overlays'
import type { Clipboard, DocumentSymbol, FileSystem, InlineCompletionProvider, LanguageService, Storage, TerminalHost } from '@tensorai-co/workspace/host'
import { Pane, Split } from '@tensorai-co/workspace/split'
import { TabAction } from '@tensorai-co/workspace/tabs'
import { TerminalPanel, Terminals } from '@tensorai-co/workspace/terminal'
import { appearanceKey, appearanceStyle, type Appearance } from '@tensorai-co/workspace/theme'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { CommandHistory, commandItems, CommandRegistry, ContextKeys, evaluateWhen, fileItems, Keybindings, LayoutModel, lineItems, symbolItems, type Command, type KeybindingRule, type LayoutState, type QuickItem } from '../core/index.js'
import { ActivityBar, type ActivityAction, type ViewDescriptor } from './ActivityBar.js'
import { EditorArea } from './editors/EditorArea.js'
import { applicationMenu } from './menu.js'
import { useEditors } from './editors/useEditors.js'
import { QuickInput } from './QuickInput.js'
import { StatusBar } from './StatusBar.js'
import { Titlebar } from './Titlebar.js'

/** The host app's panel in the secondary side bar. */
export interface AuxiliaryBarContent {
  /** The name on its tab, such as "Chat". */
  title: string
  content: ReactNode
  /** Buttons at the right of its title. */
  actions?: ReactNode
  /** Its width at first, in pixels, until the user drags it: 300 by default. */
  size?: number
}

/** Places for the host app's own content. */
export interface WorkspaceSlots {
  /** Replaces the command center in the middle of the titlebar. */
  titlebarCenter?: ReactNode
  /** Status bar items: `<StatusItem>`s, or anything else. */
  statusLeft?: ReactNode
  statusRight?: ReactNode
}

/** What a host can do with a running workspace. */
export interface WorkspaceApi {
  commands: CommandRegistry
  context: ContextKeys
  layout: LayoutModel
  keybindings: Keybindings
  /** The terminals, once there's a terminal host. */
  terminals: Terminals | undefined
  /** The active group's editor, when it shows one. */
  editor: EditorView | undefined
  /** Opens a file: for good unless `preview`, and at a line if one is given. */
  open(path: string, options?: { preview?: boolean; line?: number }): void
  /** Shows a message for a few seconds. */
  notify(message: string): void
  /** Opens the quick input with a value: "" for files, ">" for commands, ":" to go to a line. */
  quickOpen(value?: string): void
  /** The sidebar's views, the Explorer first, as the activity bar lists them. */
  readonly views: readonly ViewDescriptor[]
  /** The buttons at the end of the activity bar. */
  readonly activityActions: readonly ActivityAction[]
  /** The application menu as it is now: every command with a category that applies, by category. */
  menu(): MenuItem[][]
}

export interface WorkspaceProps {
  fs: FileSystem
  /** The folder the explorer shows. */
  root: string
  /** Where terminals run. Without one there's no panel. */
  terminals?: TerminalHost
  /** Where the layout and sizes are kept. */
  storage?: Storage
  /** The prefix of what's kept in `storage`. */
  storageKey?: string
  clipboard?: Clipboard
  /** AI ghost text in every editor, from any model. */
  completions?: InlineCompletionProvider
  /** Completions, hovers, problems, definitions and symbols in every editor, from a language service. */
  languages?: LanguageService
  /** What the command center shows. The folder's name by default. */
  title?: string
  /**
   * Whether to draw the titlebar: back and forward, the command center and the layout toggles. On by default; off for
   * a host with a bar of its own, which can drive the same commands through `onReady`'s API.
   */
  titlebar?: boolean
  /**
   * Whether to draw the activity bar at the side: the application menu, an item per view, and `activityActions`. On by
   * default; off for a host that puts the same buttons in a bar of its own with `<ActivityToolbar>`.
   */
  activityBar?: boolean
  /** Files open when it starts; the first is active. */
  initialFiles?: readonly string[]
  /** Folders open in the explorer when it starts. */
  expanded?: readonly string[]
  /** How the layout starts when nothing was saved. */
  initialLayout?: Partial<LayoutState>
  /** More sidebar views, each with an item in the activity bar after the Explorer. */
  views?: readonly ViewDescriptor[]
  /** Buttons at the bottom of the activity bar. */
  activityActions?: readonly ActivityAction[]
  /** The host's panel in the secondary side bar. Without it there's no secondary side bar. */
  auxiliaryBar?: AuxiliaryBarContent
  slots?: WorkspaceSlots
  /** More commands. One with the id of a built-in command replaces it. */
  commands?: readonly Command[]
  /** More keys for commands. They win over the built-in ones. */
  keybindings?: readonly KeybindingRule[]
  /** Whether keys are read as on a Mac. From the browser by default. */
  mac?: boolean
  onReady?: (api: WorkspaceApi | null) => void
  /** How it looks: the color theme, rounded cards or flat panes, corners, gaps, fonts and any color. */
  appearance?: Appearance
  className?: string
}

/** The parts focus can be in, from the `data-part` of the element that has it. */
const FOCUS_KEYS: Record<string, string> = { sidebar: 'sideBarFocus', editor: 'editorAreaFocus', panel: 'panelFocus', auxiliarybar: 'auxiliaryBarFocus' }

/** Every file under a folder, as Quick Open lists them, leaving out .git and node_modules. */
async function listFiles(fs: FileSystem, root: string, limit = 50_000): Promise<string[]> {
  const out: string[] = []
  const queue = [root]
  while (queue.length && out.length < limit) {
    const dir = queue.shift()!
    let entries
    try {
      entries = await fs.list(dir)
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.kind === 'dir') {
        if (e.name !== '.git' && e.name !== 'node_modules') queue.push(e.path)
      } else out.push(e.path)
    }
  }
  return out.sort()
}

/** The whole IDE, laid out. */
export function Workspace(props: WorkspaceProps) {
  const { fs, root, terminals: host, storage, storageKey = 'workspace', clipboard, slots = {}, auxiliaryBar, activityActions, onReady } = props
  const services = useMemo(() => {
    const commands = new CommandRegistry({ mac: props.mac })
    const context = new ContextKeys()
    return { commands, context, keys: new Keybindings(commands, context) }
    // One set for the workspace's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const { commands, context, keys } = services
  const layout = useMemo(() => new LayoutModel({ storage, key: `${storageKey}.layout`, initial: props.initialLayout }), [storage, storageKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useSyncExternalStore(layout.subscribe, () => layout.version)
  useSyncExternalStore(commands.subscribe, () => commands.version)
  const state = layout.state

  const [terminals, setTerminals] = useState<Terminals>()
  useEffect(() => {
    if (!host) return
    const made = new Terminals(host, { cwd: root })
    setTerminals(made)
    return () => {
      made.dispose()
      setTerminals(undefined)
    }
  }, [host, root])

  const [message, setMessage] = useState<{ text: string; n: number }>()
  const notify = useCallback((text: string) => setMessage((m) => ({ text, n: (m?.n ?? 0) + 1 })), [])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(undefined), 4000)
    return () => clearTimeout(timer)
  }, [message])

  // The quick input: its value while open, where the focus goes back to, and what it lists.
  const [quick, setQuick] = useState<string>()
  const returnFocus = useRef<{ el: HTMLElement | null; context: Record<string, unknown> }>({ el: null, context: {} })
  const history = useMemo(() => new CommandHistory(storage, `${storageKey}.commandHistory`), [storage, storageKey])
  const [files, setFiles] = useState<string[]>([])
  /** The active file's symbols, for `@`; undefined while they're asked for. */
  const [symbols, setSymbols] = useState<DocumentSymbol[]>()
  const recentFiles = useRef<string[]>([])

  const editors = useEditors({ fs, root, commands, context, notify, initialFiles: props.initialFiles, completions: props.completions, languages: props.languages })
  const [terminalFocus, setTerminalFocus] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  const explorer: ViewDescriptor = {
    id: 'explorer',
    title: 'Explorer',
    icon: 'files',
    keybinding: 'shift+mod+e',
    content: (
      <Explorer
        fs={fs}
        root={root}
        activePath={editors.activePath}
        expanded={props.expanded}
        clipboard={clipboard}
        onOpen={editors.open}
        onRename={editors.renamed}
        onDelete={editors.deleted}
        onError={notify}
      />
    ),
  }
  const views = [explorer, ...(props.views ?? [])]
  const view = views.find((v) => v.id === state.view) ?? explorer

  // Where the focus is, and what's showing, for `when` clauses.
  useEffect(() => {
    const update = () => {
      const el = document.activeElement
      const part = el instanceof Element && box.current?.contains(el) ? el.closest('[data-part]')?.getAttribute('data-part') : undefined
      context.setAll({
        ...Object.fromEntries(Object.entries(FOCUS_KEYS).map(([p, key]) => [key, part === p])),
        terminalFocus: part === 'panel' && !!el?.closest('.ws-terminal-panel'),
        inputFocus: !!el?.matches('input, textarea, [contenteditable=""], [contenteditable="true"]'),
      })
    }
    const later = () => setTimeout(update)
    update()
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', later)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', later)
    }
  }, [context])
  useEffect(() => {
    context.setAll({
      isMac: commands.mac,
      sideBarVisible: state.sidebar,
      panelVisible: !!terminals && state.panel,
      panelMaximized: state.panelMaximized,
      auxiliaryBarVisible: !!auxiliaryBar && state.auxiliaryBar,
      activeViewlet: state.sidebar ? `workbench.view.${state.view}` : '',
    })
  })

  // The workspace's own commands, registered once and run against the latest state.
  useEffect(() => {
    const path = editors.activePath
    if (path) recentFiles.current = [path, ...recentFiles.current.filter((p) => p !== path)].slice(0, 20)
  }, [editors.activePath])

  const openQuick = (value = '') => {
    // The palette shows what applies where the focus was.
    if (quick === undefined) returnFocus.current = { el: document.activeElement as HTMLElement | null, context: context.snapshot() }
    setQuick(value)
    if (!/^[>:@]/.test(value)) void listFiles(fs, root).then(setFiles)
  }
  const closeQuick = () => {
    if (quick === undefined) return
    setQuick(undefined)
    returnFocus.current.el?.focus({ preventScroll: true })
  }

  // The active file's symbols, asked for when `@` starts.
  const listingSymbols = quick?.startsWith('@') ?? false
  useEffect(() => {
    const view = editors.view
    setSymbols(undefined)
    if (!listingSymbols || !view) return
    let live = true
    view.symbols().then(
      (list) => live && setSymbols(list),
      () => live && setSymbols([]),
    )
    return () => {
      live = false
    }
  }, [listingSymbols, editors.view])

  const latest = useRef({ terminals, editors, auxiliaryBar, views, activityActions, openQuick })
  latest.current = { terminals, editors, auxiliaryBar, views, activityActions, openQuick }
  useEffect(() => {
    const focused = (key: string) => !!context.get(key)
    const showTerminal = (create = false) => {
      const t = latest.current.terminals
      if (!t) return
      if (create || !t.list.length) t.create()
      layout.setVisible('panel', true)
      setTerminalFocus((n) => n + 1)
    }
    const hidePanel = () => {
      const had = focused('panelFocus')
      layout.setVisible('panel', false)
      if (had) latest.current.editors.focusEditor()
    }
    return commands.register(
      {
        id: 'workbench.action.toggleSidebarVisibility',
        title: 'Toggle Primary Side Bar Visibility',
        category: 'View',
        keybinding: 'mod+b',
        run: () => {
          const had = focused('sideBarFocus')
          layout.toggle('sidebar')
          if (had) latest.current.editors.focusEditor()
        },
      },
      {
        id: 'workbench.action.togglePanel',
        title: 'Toggle Panel',
        category: 'View',
        keybinding: 'mod+j',
        when: 'hasPanel',
        run: () => (layout.state.panel ? hidePanel() : showTerminal()),
      },
      {
        id: 'workbench.action.toggleMaximizedPanel',
        title: 'Toggle Maximized Panel',
        category: 'View',
        when: 'hasPanel',
        run: () => layout.toggleMaximizedPanel(),
      },
      {
        id: 'workbench.action.terminal.toggleTerminal',
        title: 'Toggle Terminal',
        category: 'View',
        keybinding: 'ctrl+`',
        when: 'hasPanel',
        run: () => {
          if (!layout.state.panel) showTerminal()
          else if (focused('terminalFocus')) hidePanel()
          else showTerminal()
        },
      },
      {
        id: 'workbench.action.terminal.new',
        title: 'New Terminal',
        category: 'Terminal',
        keybinding: 'ctrl+shift+`',
        when: 'hasPanel',
        run: () => showTerminal(true),
      },
      {
        id: 'workbench.action.toggleAuxiliaryBar',
        title: 'Toggle Secondary Side Bar Visibility',
        category: 'View',
        keybinding: 'alt+mod+b',
        when: 'hasAuxiliaryBar',
        run: () => {
          const had = focused('auxiliaryBarFocus')
          layout.toggle('auxiliaryBar')
          if (had) latest.current.editors.focusEditor()
        },
      },
      {
        id: 'workbench.action.showCommands',
        title: 'Show All Commands',
        keybinding: 'shift+mod+p',
        run: () => latest.current.openQuick('>'),
      },
      {
        id: 'workbench.action.quickOpen',
        title: 'Go to File...',
        category: 'Go',
        keybinding: 'mod+p',
        run: () => latest.current.openQuick(''),
      },
      {
        id: 'workbench.action.gotoLine',
        title: 'Go to Line/Column...',
        category: 'Go',
        keybinding: 'ctrl+g',
        run: () => latest.current.openQuick(':'),
      },
      {
        id: 'workbench.action.gotoSymbol',
        title: 'Go to Symbol in Editor...',
        category: 'Go',
        keybinding: 'shift+mod+o',
        run: () => latest.current.openQuick('@'),
      },
      {
        id: 'workbench.action.focusActiveEditorGroup',
        title: 'Focus Active Editor Group',
        category: 'View',
        run: () => latest.current.editors.focusEditor(),
      },
    )
  }, [commands, context, layout])
  // F1 opens the palette too.
  useEffect(() => commands.bind({ key: 'f1', command: 'workbench.action.showCommands', secondary: true }), [commands])
  useEffect(() => context.setAll({ hasPanel: !!terminals, hasAuxiliaryBar: !!auxiliaryBar, inQuickOpen: quick !== undefined }))

  // A command for each view, with its key: "workbench.view.explorer".
  const viewKeys = views.map((v) => `${v.id}:${v.title}:${v.keybinding ?? ''}`).join('|')
  useEffect(
    () =>
      commands.register(
        ...latest.current.views.map((v) => ({
          id: `workbench.view.${v.id}`,
          title: `Show ${v.title}`,
          category: 'View',
          keybinding: v.keybinding,
          run: () => layout.showView(v.id),
        })),
      ),
    [commands, layout, viewKeys],
  )

  // The host's commands and keys, over the built-in ones.
  useEffect(() => (props.commands?.length ? commands.register(...props.commands) : undefined), [commands, props.commands])
  useEffect(() => (props.keybindings?.length ? commands.bind(...props.keybindings) : undefined), [commands, props.keybindings])

  const api = useMemo<WorkspaceApi>(
    () => ({
      commands,
      context,
      layout,
      keybindings: keys,
      get terminals() {
        return latest.current.terminals
      },
      get editor() {
        return latest.current.editors.view ?? undefined
      },
      open: (path, { preview = false, line } = {}) => {
        const e = latest.current.editors
        if (line !== undefined) e.goTo(e.group, path, line)
        else e.open(path, { preview })
      },
      notify,
      quickOpen: (value = '') => latest.current.openQuick(value),
      get views() {
        return latest.current.views
      },
      get activityActions() {
        return latest.current.activityActions ?? []
      },
      menu: () => applicationMenu(commands, context),
    }),
    [commands, context, layout, keys, notify],
  )
  useEffect(() => {
    onReady?.(api)
    return () => onReady?.(null)
  }, [api, onReady])

  // The application menu, read when it opens: the commands, and what's true then.
  const menu = useCallback(() => applicationMenu(commands, context), [commands, context])

  // What the quick input lists, by what its value starts with.
  const quickItems = useMemo((): QuickItem[] => {
    if (quick === undefined) return []
    if (quick.startsWith('>')) {
      const before = returnFocus.current.context
      return commandItems(commands, { matches: (when) => evaluateWhen(when, (k) => before[k]) }, history, quick.slice(1).trim(), (id) => {
        history.add(id)
        commands.execute(id)
      })
    }
    const view = editors.view
    if (quick.startsWith('@')) {
      if (!view) return [{ id: 'none', label: 'To go to a symbol, first open a text editor with symbol information.', disabled: true }]
      if (!props.languages?.symbols) return [{ id: 'none', label: 'The active text editor does not provide symbol information.', disabled: true }]
      return symbolItems(symbols, quick.slice(1), (symbol) => {
        const at = Math.min(symbol.selection?.from ?? symbol.from, view.state.doc.length)
        view.dispatch({ selection: { anchor: at }, userEvent: 'select', scrollIntoView: true })
        view.focus()
      })
    }
    if (quick.startsWith(':')) {
      const head = view?.state.selection.main.head
      const line = view && head !== undefined ? view.state.doc.lineAt(head) : undefined
      return lineItems(quick.slice(1), view?.state.doc.lines, line && head !== undefined ? { line: line.number, column: head - line.from + 1 } : undefined, (n, column) => {
        if (!view) return
        const target = view.state.doc.line(n)
        view.dispatch({ selection: { anchor: target.from + Math.min(target.text.length, column - 1) }, userEvent: 'select', scrollIntoView: true })
        view.focus()
      })
    }
    return fileItems(files, root, quick, recentFiles.current, (path) => editors.open(path))
    // The registry and the context are read when it lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick, files, root, commands.version, editors.view, history, symbols])

  const panelShown = !!terminals && state.panel
  const look = props.appearance
  const lookKey = appearanceKey(look)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lookStyle = useMemo(() => appearanceStyle(look) as CSSProperties, [lookKey])
  const gap = look?.layout === 'flat' ? 0 : (look?.gap ?? 4)
  const problemViews = useMemo(() => (props.languages ? Object.values(editors.editors).map((e) => e.view) : undefined), [props.languages, editors.editors])

  return (
    <div
      ref={box}
      className={`ws-workspace ${props.titlebar === false ? 'ws-no-titlebar' : ''} ${props.activityBar === false ? 'ws-no-activitybar' : ''} ${props.className ?? ''}`}
      data-theme={look?.theme}
      data-layout={look?.layout}
      data-appearance={look ? lookKey : undefined}
      style={lookStyle}
      onKeyDownCapture={(e) => {
        // Keys in dialogs and menus over the workspace are theirs.
        if (!box.current?.contains(e.target as Node) || e.nativeEvent.isComposing) return
        const result = keys.handle(e.nativeEvent)
        if (result.kind === 'none') return
        e.preventDefault()
        e.stopPropagation()
      }}
      onBlurCapture={() => keys.cancel()}
    >
      {props.titlebar !== false && <Titlebar commands={commands} context={context} layout={layout} title={props.title ?? (root.split('/').filter(Boolean).pop() || root)} center={slots.titlebarCenter} panel={!!terminals} auxiliaryBar={!!auxiliaryBar} />}
      <div className={`ws-parts ${state.sidebar ? '' : 'ws-no-sidebar'}`}>
        {props.activityBar !== false && <ActivityBar views={views} actions={activityActions} layout={layout} commands={commands} menu={menu} />}
        <Split direction="row" gap={gap} storage={storage} storageKey={`${storageKey}.columns`} className="ws-columns">
          <Pane id="sidebar" size={256} min={170} snap visible={state.sidebar} onVisibleChange={(v) => layout.setVisible('sidebar', v)}>
            <aside className="ws-part ws-sidebar" data-part="sidebar" aria-label={view.title}>
              <div className="ws-sidebar-title">
                <h2>{view.title}</h2>
                {view.actions && <div className="ws-part-actions">{view.actions}</div>}
              </div>
              {views.map((v) => (
                <div key={v.id} className="ws-sidebar-view" hidden={v !== view}>
                  {v.content}
                </div>
              ))}
            </aside>
          </Pane>
          <Pane id="main" min={220} grow>
            <Split direction="column" gap={gap} storage={storage} storageKey={`${storageKey}.rows`}>
              <Pane id="editors" min={70} grow visible={!(panelShown && state.panelMaximized)}>
                <main className="ws-part ws-editors" data-part="editor">
                  <EditorArea editors={editors} commands={commands} />
                </main>
              </Pane>
              {terminals && (
                <Pane id="panel" size={248} min={77} snap visible={state.panel} onVisibleChange={(v) => layout.setVisible('panel', v)}>
                  <div className="ws-part ws-panel" data-part="panel">
                    <TerminalPanel
                      terminals={terminals}
                      clipboard={clipboard}
                      focus={terminalFocus}
                      onEmpty={() => {
                        layout.setVisible('panel', false)
                        editors.focusEditor()
                      }}
                      actions={
                        <>
                          <TabAction
                            icon={state.panelMaximized ? 'screen-normal' : 'screen-full'}
                            label={state.panelMaximized ? 'Restore Panel Size' : 'Maximize Panel'}
                            onClick={() => layout.toggleMaximizedPanel()}
                          />
                          <TabAction icon="close" label={commands.tooltip('workbench.action.togglePanel', 'Hide Panel')} onClick={() => void commands.execute('workbench.action.togglePanel')} />
                        </>
                      }
                    />
                  </div>
                </Pane>
              )}
            </Split>
          </Pane>
          {auxiliaryBar && (
            <Pane id="auxiliarybar" size={auxiliaryBar.size ?? 300} min={170} snap visible={state.auxiliaryBar} onVisibleChange={(v) => layout.setVisible('auxiliaryBar', v)}>
              <aside className="ws-part ws-auxiliarybar" data-part="auxiliarybar" aria-label={auxiliaryBar.title}>
                <div className="ws-part-title">
                  <div className="ws-part-tab">
                    <i className="ws-joined ws-joined-flush" aria-hidden="true" />
                    <i className="ws-joined-edge" aria-hidden="true" />
                    <span>{auxiliaryBar.title}</span>
                  </div>
                  <div className="ws-part-actions">
                    {auxiliaryBar.actions}
                    {auxiliaryBar.actions && <span className="ws-part-separator" />}
                    <TabAction icon="close" label={commands.tooltip('workbench.action.toggleAuxiliaryBar', 'Hide Secondary Side Bar')} onClick={() => void commands.execute('workbench.action.toggleAuxiliaryBar')} />
                  </div>
                </div>
                <div className="ws-part-body">{auxiliaryBar.content}</div>
              </aside>
            </Pane>
          )}
        </Split>
      </div>
      <StatusBar keys={keys} view={editors.view} path={editors.activePath} updates={editors.updates} left={slots.statusLeft} right={slots.statusRight} problems={problemViews} />
      {quick !== undefined && (
        <QuickInput
          value={quick}
          onValue={setQuick}
          items={quickItems}
          mac={commands.mac}
          placeholder={quick === '' ? 'Search files by name (append : to go to line)' : undefined}
          onClose={closeQuick}
          onAccept={(item) => {
            closeQuick()
            item.run?.()
          }}
        />
      )}
      {message && (
        <div key={message.n} className="ws-toast" role="alert">
          {message.text}
        </div>
      )}
    </div>
  )
}
