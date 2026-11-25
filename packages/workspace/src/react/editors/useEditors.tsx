import type { EditorView } from '@tensorai-workspace/editor'
import { isInside } from '@tensorai-workspace/explorer'
import type { FileSystem, InlineCompletionProvider, LanguageService, Location } from '@tensorai-workspace/host'
import { detectLanguage } from '@tensorai-workspace/languages'
import { lineOfAnchor, readMarkdown, syncScroll, type LinkTarget, type MarkdownView } from '@tensorai-workspace/markdown'
import { TabsModel } from '@tensorai-workspace/tabs'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CommandRegistry, ContextKeys } from '../../core/index.js'
import { isPreview, pathOf, previewId } from './tabIds.js'

/** One editor group: a tab strip of files and previews. */
export interface Group {
  id: number
  model: TabsModel<string>
}

export interface EditorsOptions {
  fs: FileSystem
  root: string
  commands: CommandRegistry
  context: ContextKeys
  /** Shows a message, such as a file that couldn't be read. */
  notify: (message: string) => void
  /** Files open when it starts; the first is active. */
  initialFiles?: readonly string[]
  /** AI ghost text for every editor. */
  completions?: InlineCompletionProvider
  /** Completions, hovers, problems and definitions for every editor. */
  languages?: LanguageService
}

/** Something an editor reports to whoever shows its position: the status bar. */
export type EditorUpdates = { subscribe: (listener: () => void) => () => void }

let nextGroup = 1
const makeGroup = (...paths: string[]): Group => {
  const model = new TabsModel<string>((path) => path)
  for (const path of paths) model.open(path)
  return { id: nextGroup++, model }
}

/**
 * The editor area's state: groups of tabs, the text of open files, previews of Markdown files and what's waiting to be
 * saved. Its commands go in the registry, and what's active goes in the context, so keys and menus can use them.
 */
export function useEditors({ fs, root, commands, context, notify, initialFiles = [], completions, languages }: EditorsOptions) {
  const [groups, setGroups] = useState<Group[]>(() => {
    const first = makeGroup(...initialFiles)
    if (initialFiles[0]) first.model.activate(initialFiles[0])
    return [first]
  })
  const [activeId, setActiveId] = useState(groups[0]!.id)
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [focus, setFocus] = useState(0)
  /** What each group shows, by its id: an editor of a file, or a preview of one. */
  const [editors, setEditors] = useState<Record<number, { path: string; view: EditorView }>>({})
  const [previews, setPreviews] = useState<Record<number, { path: string; view: MarkdownView }>>({})
  /** Files shown as their preview in their own tab, per group: "1:/path". */
  const [previewed, setPreviewed] = useState<ReadonlySet<string>>(new Set())
  /** Tabs with unsaved changes waiting for an answer, one at a time. */
  const [closing, setClosing] = useState<{ group: Group; ids: string[] }>()
  /** Word wrap turned on or off with ⌥Z, by file. Markdown wraps unless turned off. */
  const [wraps, setWraps] = useState<Record<string, boolean>>({})
  const wrapOf = (path: string) => wraps[path] ?? detectLanguage(path).id === 'markdown'

  const group = groups.find((g) => g.id === activeId) ?? groups[0]!
  useSyncExternalStore(group.model.subscribe, () => group.model.version)
  const activeTab = group.model.active?.id
  const activePath = activeTab === undefined ? undefined : pathOf(activeTab)
  const view = editors[group.id]?.view ?? null
  const all = useRef(groups)
  all.current = groups
  /** Where files were last scrolled to, in an editor or a preview. */
  const tops = useRef<Record<string, number>>({})
  /** A line (or an offset) to go to, once its file's editor is there. */
  const going = useRef<{ path: string; line: number; offset?: number }>(undefined)
  /** Cursor moves and edits, for the status bar. */
  const listeners = useRef(new Set<() => void>())
  const updates = useRef<EditorUpdates>({
    subscribe: (listener) => {
      listeners.current.add(listener)
      return () => listeners.current.delete(listener)
    },
  }).current
  const updated = useCallback(() => listeners.current.forEach((l) => l()), [])

  const read = useCallback(
    (path: string) => {
      fs.read(path).then(
        (data) => setTexts((t) => (path in t ? t : { ...t, [path]: new TextDecoder().decode(data) })),
        (e: Error) => notify(e.message),
      )
    },
    [fs, notify],
  )

  // A group whose last tab went away goes too, unless it's the only one.
  useEffect(() => {
    const stops = groups.map((g) =>
      g.model.subscribe(() => {
        if (g.model.tabs.length || all.current.length < 2) return
        setGroups((gs) => (gs.length > 1 ? gs.filter((x) => x !== g) : gs))
      }),
    )
    return () => stops.forEach((stop) => stop())
  }, [groups])

  const open = useCallback(
    (path: string, { preview }: { preview: boolean } = { preview: false }) => {
      group.model.open(path, { preview })
      // A preview leaves the focus in the tree.
      if (!preview) setFocus((n) => n + 1)
    },
    [group],
  )

  /** Puts the cursor on a line, when the file has an editor. */
  const arrive = (path: string, target: EditorView | undefined) => {
    const to = going.current
    if (!to || to.path !== path || !target) return
    // Strict mode makes each editor twice, at once.
    setTimeout(() => (going.current = going.current === to ? undefined : going.current))
    const { doc } = target.state
    const from = to.offset !== undefined ? Math.min(to.offset, doc.length) : doc.line(Math.min(doc.lines, to.line)).from
    target.dispatch({ selection: { anchor: from }, scrollIntoView: true })
    target.scrollToLine(Math.max(1, doc.lineAt(from).number - 3))
    target.focus()
  }

  /** Opens a file at a line: in the group that shows it, or has it, or this one. */
  const goTo = (g: Group, path: string, line?: number, offset?: number) => {
    const has = groups.find((o) => o.model.active?.id === path && !previewed.has(`${o.id}:${path}`)) ?? (g.model.get(path) ? g : (groups.find((o) => o.model.get(path)) ?? g))
    has.model.open(path)
    setPreviewed((p) => new Set([...p].filter((key) => key !== `${has.id}:${path}`)))
    setActiveId(has.id)
    if (line === undefined) return setFocus((n) => n + 1)
    going.current = { path, line, offset }
    const showing = editors[has.id]
    if (showing?.path === path) arrive(path, showing.view)
  }

  const openLink = async (g: Group, { path, line, anchor }: Extract<LinkTarget, { kind: 'file' }>) => {
    try {
      const text = texts[path] ?? new TextDecoder().decode(await fs.read(path))
      goTo(g, path, line ?? (anchor === undefined ? undefined : lineOfAnchor(readMarkdown(text), anchor)))
    } catch (e) {
      notify((e as Error).message)
    }
  }

  const togglePreview = (g: Group, path: string) => {
    const key = `${g.id}:${path}`
    g.model.keep(path)
    setPreviewed((p) => new Set(p.has(key) ? [...p].filter((k) => k !== key) : [...p, key]))
    setFocus((n) => n + 1)
  }

  /** Opens a preview in the next group, which is made if it isn't there. The focus stays where it is. */
  const previewToSide = (from: Group, path: string) => {
    const shown = groups.find((g) => g.model.tabs.some((t) => isPreview(t.id)))
    const tab = shown?.model.tabs.find((t) => isPreview(t.id))
    if (shown && tab) {
      if (tab.id !== previewId(path)) shown.model.replace(tab.id, previewId(path))
      return shown.model.activate(previewId(path))
    }
    const beside = groups[groups.indexOf(from) + 1]
    const next = beside ?? makeGroup()
    next.model.open(previewId(path))
    if (!beside) setGroups((gs) => gs.flatMap((g) => (g === from ? [g, next] : [g])))
  }

  // The preview follows the file that's being edited.
  useEffect(() => {
    if (activeTab === undefined || isPreview(activeTab) || detectLanguage(activeTab).id !== 'markdown') return
    for (const g of groups) {
      const tab = g.model.tabs.find((t) => isPreview(t.id))
      if (tab && g !== group && tab.id !== previewId(activeTab)) g.model.replace(tab.id, previewId(activeTab))
    }
  }, [activeTab, group, groups])

  // Each preview scrolls with an editor of its file.
  const editorOf = (path: string) => (editors[group.id]?.path === path ? editors[group.id] : Object.values(editors).find((e) => e.path === path))?.view
  useEffect(() => {
    const stops = Object.values(previews).map((p) => {
      const source = editorOf(p.path)
      return source && syncScroll(source, p.view)
    })
    return () => stops.forEach((stop) => stop?.())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editors, previews])

  /** A view of a file goes to where the last one was, and is remembered from there. */
  const restore = (path: string, v: EditorView | MarkdownView) => {
    const top = tops.current[path]
    if (top !== undefined) v.scrollToLine(top)
    v.onScroll(() => (tops.current[path] = v.topLine))
  }
  const showEditor = (g: Group, path: string, v: EditorView | null) => {
    setEditors(({ [g.id]: _, ...rest }) => (v ? { ...rest, [g.id]: { path, view: v } } : rest))
    if (!v) return
    restore(path, v)
    arrive(path, v)
  }
  const showPreview = (g: Group, path: string, v: MarkdownView | null) => {
    setPreviews(({ [g.id]: _, ...rest }) => (v ? { ...rest, [g.id]: { path, view: v } } : rest))
    if (v) restore(path, v)
  }

  const split = (from: Group) => {
    const tab = from.model.active
    if (!tab) return
    const next = makeGroup()
    next.model.open(tab.item, { dirty: tab.dirty })
    setGroups((gs) => gs.flatMap((g) => (g === from ? [g, next] : [g])))
    setActiveId(next.id)
    setFocus((n) => n + 1)
  }

  const save = async (path: string) => {
    try {
      await fs.write(path, new TextEncoder().encode(texts[path] ?? ''))
      for (const g of all.current) g.model.setDirty(path, false)
    } catch (e) {
      notify((e as Error).message)
    }
  }

  /** Closes tabs; those with changes that aren't open elsewhere are asked about first. */
  const close = (g: Group, ids: string[]) => {
    const ask = ids.filter((id) => g.model.get(id)?.dirty && !groups.some((o) => o !== g && o.model.get(id)))
    g.model.closeAll(ids.filter((id) => !ask.includes(id)))
    if (ask.length) {
      g.model.activate(ask[0]!)
      setClosing({ group: g, ids: ask })
    }
  }
  const answer = async (value: string | undefined) => {
    if (!closing) return
    const { group: g, ids } = closing
    const [path, ...rest] = ids
    setClosing(undefined)
    setFocus((n) => n + 1)
    if (path === undefined || (value !== 'save' && value !== 'discard')) return
    if (value === 'save') await save(path)
    else setTexts(({ [path]: _, ...others }) => others)
    g.model.close(path)
    if (rest.length) close(g, rest)
  }

  const change = (path: string, text: string) => {
    setTexts((t) => ({ ...t, [path]: text }))
    for (const other of groups) other.model.setDirty(path, true)
  }

  const renamed = (from: string, to: string) => {
    const move = (id: string) => (isInside(pathOf(id), from) ? (isPreview(id) ? previewId : String)(to + pathOf(id).slice(from.length)) : id)
    setTexts((t) => Object.fromEntries(Object.entries(t).map(([path, text]) => [move(path), text])))
    for (const g of groups) for (const t of g.model.tabs) if (move(t.id) !== t.id) g.model.replace(t.id, move(t.id))
  }
  const deleted = (paths: string[]) => {
    for (const g of groups) g.model.closeAll(g.model.tabs.filter((t) => paths.some((p) => isInside(pathOf(t.id), p))).map((t) => t.id))
  }

  // Back and forward through the files that were active, as the titlebar's arrows do.
  const history = useRef<{ stack: string[]; at: number; moving: boolean }>({ stack: [], at: -1, moving: false })
  useEffect(() => {
    const h = history.current
    if (activePath === undefined) return
    if (h.moving) h.moving = false
    else if (h.stack[h.at] !== activePath) {
      h.stack = [...h.stack.slice(0, h.at + 1), activePath].slice(-50)
      h.at = h.stack.length - 1
    }
    context.setAll({ canNavigateBack: h.at > 0, canNavigateForward: h.at < h.stack.length - 1 })
  }, [activePath, context])
  const navigate = (by: number) => {
    const h = history.current
    const to = h.stack[h.at + by]
    if (to === undefined) return
    h.at += by
    h.moving = true
    goTo(group, to)
    context.setAll({ canNavigateBack: h.at > 0, canNavigateForward: h.at < h.stack.length - 1 })
  }

  const markdown = activePath !== undefined && detectLanguage(activePath).id === 'markdown'
  const showingPreview = activeTab !== undefined && (isPreview(activeTab) || previewed.has(`${group.id}:${activeTab}`))

  // What's active, for `when` clauses.
  useEffect(() => {
    context.setAll({
      activeEditor: activePath ?? '',
      activeEditorLangId: activePath === undefined ? '' : detectLanguage(activePath).id,
      activeEditorIsPreview: showingPreview,
      activeEditorIsDirty: !!group.model.active?.dirty,
      editorGroupCount: groups.length,
    })
  })

  // The commands, registered once, always running against the latest state.
  const latest = useRef({ group, activePath, activeTab, markdown, showingPreview, save, close, split, togglePreview, previewToSide, navigate, view, wrapOf })
  latest.current = { group, activePath, activeTab, markdown, showingPreview, save, close, split, togglePreview, previewToSide, navigate, view, wrapOf }
  useEffect(
    () =>
      commands.register(
        {
          id: 'workbench.action.files.save',
          title: 'Save',
          category: 'File',
          keybinding: 'mod+s',
          run: () => {
            const { activePath: path } = latest.current
            if (path !== undefined) return latest.current.save(path)
          },
        },
        {
          id: 'workbench.action.closeActiveEditor',
          title: 'Close Editor',
          category: 'View',
          keybinding: 'mod+w',
          when: '!terminalFocus',
          run: () => {
            const { group: g, activeTab: id } = latest.current
            if (id !== undefined) latest.current.close(g, [id])
          },
        },
        {
          id: 'workbench.action.splitEditor',
          title: 'Split Editor Right',
          category: 'View',
          keybinding: 'mod+\\',
          run: () => latest.current.split(latest.current.group),
        },
        {
          id: 'markdown.showPreview',
          title: 'Open Preview',
          category: 'Markdown',
          keybinding: 'shift+mod+v',
          when: 'activeEditorLangId == markdown && !terminalFocus',
          run: () => {
            const { group: g, activePath: path, activeTab: id } = latest.current
            if (path !== undefined && id !== undefined && !isPreview(id)) latest.current.togglePreview(g, path)
          },
        },
        {
          id: 'markdown.showPreviewToSide',
          title: 'Open Preview to the Side',
          category: 'Markdown',
          keybinding: 'mod+k v',
          when: 'activeEditorLangId == markdown && !activeEditorIsPreview && editorAreaFocus',
          run: () => {
            const { group: g, activePath: path } = latest.current
            if (path !== undefined) latest.current.previewToSide(g, path)
          },
        },
        {
          id: 'editor.action.toggleWordWrap',
          title: 'Toggle Word Wrap',
          category: 'View',
          keybinding: 'alt+z',
          when: 'editorAreaFocus && !activeEditorIsPreview',
          run: () => {
            const { activePath: path, wrapOf: wrap } = latest.current
            if (path !== undefined) setWraps((w) => ({ ...w, [path]: !wrap(path) }))
          },
        },
        { id: 'editor.fold', title: 'Fold', category: 'View', keybinding: 'ctrl+shift+[', mac: 'alt+cmd+[', when: 'editorAreaFocus', run: () => latest.current.view?.fold() },
        { id: 'editor.unfold', title: 'Unfold', category: 'View', keybinding: 'ctrl+shift+]', mac: 'alt+cmd+]', when: 'editorAreaFocus', run: () => latest.current.view?.unfold() },
        { id: 'editor.toggleFold', title: 'Toggle Fold', category: 'View', keybinding: 'mod+k mod+l', when: 'editorAreaFocus', run: () => latest.current.view?.toggleFold() },
        { id: 'editor.foldAll', title: 'Fold All', category: 'View', keybinding: 'mod+k mod+0', when: 'editorAreaFocus', run: () => latest.current.view?.foldAll() },
        { id: 'editor.unfoldAll', title: 'Unfold All', category: 'View', keybinding: 'mod+k mod+j', when: 'editorAreaFocus', run: () => latest.current.view?.unfoldAll() },
        {
          id: 'workbench.action.navigateBack',
          title: 'Go Back',
          category: 'Go',
          keybinding: 'ctrl+-',
          when: 'canNavigateBack',
          run: () => latest.current.navigate(-1),
        },
        {
          id: 'workbench.action.navigateForward',
          title: 'Go Forward',
          category: 'Go',
          keybinding: 'ctrl+shift+-',
          when: 'canNavigateForward',
          run: () => latest.current.navigate(1),
        },
      ),
    [commands],
  )

  // Language features, when there's a service: the commands and keys.
  useEffect(() => {
    if (!languages) return
    const view = () => latest.current.view
    return commands.register(
      { id: 'editor.action.triggerSuggest', title: 'Trigger Suggest', keybinding: 'ctrl+space', when: 'editorAreaFocus && !activeEditorIsPreview', run: () => view()?.triggerSuggest() },
      { id: 'editor.action.revealDefinition', title: 'Go to Definition', keybinding: 'f12', when: 'editorAreaFocus && !activeEditorIsPreview', run: () => view()?.goToDefinition() },
      { id: 'editor.action.formatDocument', title: 'Format Document', keybinding: 'shift+alt+f', when: 'editorAreaFocus && !activeEditorIsPreview', run: () => view()?.format() },
      { id: 'editor.action.showHover', title: 'Show or Focus Hover', keybinding: 'mod+k mod+i', when: 'editorAreaFocus && !activeEditorIsPreview', run: () => view()?.showHover() },
    )
  }, [commands, languages])

  /** Opens a definition in another file. */
  const openLocation = useCallback(
    (location: Location) => {
      if (!location.path) return
      const g = latest.current.group
      goToRef.current(g, location.path, 1, location.from)
    },
    [],
  )
  const goToRef = useRef(goTo)
  goToRef.current = goTo

  return {
    fs,
    root,
    completions,
    languages,
    openLocation,
    wrapOf,
    groups,
    group,
    texts,
    read,
    focus,
    previewed,
    editors,
    previews,
    closing,
    activePath,
    /** The editor of the active group, if it shows one. */
    view,
    updates,
    updated,
    editorOf,
    setActiveId,
    open,
    goTo,
    openLink,
    togglePreview,
    previewToSide,
    showEditor,
    showPreview,
    split,
    save,
    close,
    answer,
    change,
    renamed,
    deleted,
    /** Gives the focus to the active editor. */
    focusEditor: () => setFocus((n) => n + 1),
  }
}

export type Editors = ReturnType<typeof useEditors>
