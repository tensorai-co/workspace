import type { Clipboard, FileSystem } from '@tensorai-co/workspace/host'
import { Codicon, FileIcon } from '@tensorai-co/workspace/icons/react'
import type { CodiconName } from '@tensorai-co/workspace/icons'
import { detectLanguage } from '@tensorai-co/workspace/languages'
import { Dialog, Menu, type MenuItem } from '@tensorai-co/workspace/overlays'
import { Tree, type TreeNode } from '@tensorai-co/workspace/tree'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from 'react'
import { ExplorerModel, type ExplorerEntry } from '../core/model.js'
import { baseName, normalPath, relativePath } from '../core/paths.js'

export interface ExplorerProps {
  fs: FileSystem
  /** The folder to show. */
  root: string
  /** The section's title; the folder's name by default. */
  title?: string
  /** A file was opened: a preview on a single click, for good on a double one. */
  onOpen?: (path: string, how: { preview: boolean }) => void
  /** A file or folder was made. New files are opened too. */
  onCreate?: (path: string, kind: 'file' | 'dir') => void
  onRename?: (from: string, to: string) => void
  onDelete?: (paths: string[]) => void
  /** Something failed: show the message. */
  onError?: (message: string) => void
  /** The file shown in the editor. The tree reveals it as it changes. */
  activePath?: string
  /** Folders open at first, such as those saved from an earlier session. */
  expanded?: readonly string[]
  /** For hosts without `navigator.clipboard`. */
  clipboard?: Clipboard
  /** Asks before deleting. Defaults to the dialog. */
  confirmDelete?: (paths: string[], question: { message: string; detail: string }) => Promise<boolean>
  /** The model, once it exists: for running actions or saving what's open. */
  onModel?: (model: ExplorerModel | null) => void
  className?: string
  style?: CSSProperties
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const KEYS = isMac
  ? { rename: 'Enter', delete: '⌘Backspace', copyPath: '⌥⌘C', copyRelative: '⇧⌥⌘C' }
  : { rename: 'F2', delete: 'Delete', copyPath: 'Shift+Alt+C', copyRelative: undefined }

const renderIcon = (node: TreeNode<ExplorerEntry>, name: string | undefined) => {
  if (node.item.kind === 'dir') return null
  const file = name ?? node.item.name
  return <FileIcon name={file} languageId={detectLanguage(file).id} />
}

/** The Folders view: a section header with actions, over the tree of a folder's files. */
export function Explorer({ fs, root, title, onOpen, onCreate, onRename, onDelete, onError, activePath, expanded, clipboard, confirmDelete, onModel, className = '', style }: ExplorerProps) {
  const latest = useRef({ onOpen, onCreate, onRename, onDelete, onError, onModel })
  latest.current = { onOpen, onCreate, onRename, onDelete, onError, onModel }
  const first = useRef(expanded)
  const model = useMemo(
    () =>
      new ExplorerModel({
        fs,
        root,
        expanded: first.current,
        onError: (message) => latest.current.onError?.(message),
        onRename: (from, to) => latest.current.onRename?.(from, to),
        onDelete: (paths) => latest.current.onDelete?.(paths),
        onCreate: (path, kind) => {
          latest.current.onCreate?.(path, kind)
          if (kind === 'file') latest.current.onOpen?.(path, { preview: false })
        },
      }),
    [fs, root],
  )
  useSyncExternalStore(model.subscribe, model.getVersion)
  const loading = useSyncExternalStore(model.tree.subscribe, () => model.tree.loading)
  const [open, setOpen] = useState(true)
  const [menu, setMenu] = useState<{ path: string | undefined; at: { x: number; y: number } }>()
  const [deleting, setDeleting] = useState<string[]>()
  const box = useRef<HTMLElement>(null)

  useEffect(() => model.watch(), [model])
  useEffect(() => {
    latest.current.onModel?.(model)
    return () => latest.current.onModel?.(null)
  }, [model])
  useEffect(() => {
    if (activePath !== undefined && model.tree.focused?.id !== normalPath(activePath)) void model.reveal(activePath)
  }, [model, activePath])

  const focusTree = useCallback(() => box.current?.querySelector<HTMLElement>('[role=tree]')?.focus({ preventScroll: true }), [])

  const copy = async (paths: string[]) => {
    try {
      await (clipboard ?? navigator.clipboard).writeText(paths.join('\n'))
    } catch (error) {
      onError?.(error instanceof Error ? error.message : String(error))
    }
  }

  const askDelete = async (path: string | undefined) => {
    if (path === undefined) return
    const paths = model.targets(path)
    if (!confirmDelete) return setDeleting(paths)
    if (await confirmDelete(paths, model.deleteQuestion(paths))) await model.delete(paths)
    focusTree()
  }

  const startNew = (kind: 'file' | 'dir', dir?: string) => {
    setOpen(true)
    void model.startNew(kind, dir)
  }

  const keyDown = (e: KeyboardEvent<HTMLElement>) => {
    const path = model.tree.focused?.id
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey
    const rename = isMac ? plain && e.key === 'Enter' : plain && e.key === 'F2'
    const remove = isMac ? e.metaKey && !e.ctrlKey && !e.altKey && e.key === 'Backspace' : !e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'Delete'
    const copyPath = e.altKey && !e.ctrlKey && e.code === 'KeyC' && (isMac ? e.metaKey : e.shiftKey && !e.metaKey)
    if (path === undefined) return
    if (rename) model.startRename(path)
    else if (remove) void askDelete(path)
    else if (copyPath) void copy(isMac && e.shiftKey ? model.targets(path).map((p) => relativePath(model.root, p)) : model.targets(path))
    else return
    e.preventDefault()
  }

  const menuGroups = (path: string | undefined): MenuItem[][] => {
    const entry = model.tree.node(path)?.item
    const dir = entry === undefined ? model.root : entry.kind === 'dir' ? entry.path : undefined
    const groups: MenuItem[][] = []
    if (dir !== undefined)
      groups.push([
        { label: 'New File...', run: () => startNew('file', dir) },
        { label: 'New Folder...', run: () => startNew('dir', dir) },
      ])
    else
      groups.push([
        { label: 'Open', run: () => onOpen?.(entry!.path, { preview: false }) },
      ])
    const targets = path === undefined ? [model.root] : model.targets(path)
    groups.push([
      { label: 'Copy Path', keys: KEYS.copyPath, run: () => void copy(targets) },
      ...(path === undefined ? [] : [{ label: 'Copy Relative Path', keys: KEYS.copyRelative, run: () => void copy(targets.map((p) => relativePath(model.root, p))) }]),
    ])
    if (path !== undefined)
      groups.push([
        { label: 'Rename...', keys: KEYS.rename, disabled: targets.length > 1, run: () => model.startRename(path) },
        { label: model.trash ? 'Delete' : 'Delete Permanently', keys: KEYS.delete, run: () => void askDelete(path) },
      ])
    return groups
  }

  const name = title ?? (baseName(model.root) || model.root)
  const action = (icon: CodiconName, label: string, run: () => void) => (
    <button
      type="button"
      className="ws-explorer-action"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        run()
      }}
    >
      <Codicon name={icon} />
    </button>
  )

  const edit = model.editing
  return (
    <section ref={box} className={`ws-explorer ${className}`} style={style}>
      <div
        className="ws-explorer-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`Explorer Section: ${name}`}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') setOpen(!open)
          else if (e.key === 'ArrowLeft') setOpen(false)
          else if (e.key === 'ArrowRight') setOpen(true)
          else return
          e.preventDefault()
        }}
      >
        <Codicon name={open ? 'chevron-down' : 'chevron-right'} className="ws-explorer-twistie" />
        <h3 className="ws-explorer-title" title={model.root}>
          {name}
        </h3>
        {open && (
          <div className="ws-explorer-actions">
            {action('new-file', 'New File...', () => startNew('file'))}
            {action('new-folder', 'New Folder...', () => startNew('dir'))}
            {action('refresh', 'Refresh Explorer', () => void model.refresh())}
            {action('collapse-all', 'Collapse Folders in Explorer', () => model.tree.collapseAll())}
          </div>
        )}
      </div>
      {open && (
        <div className="ws-explorer-body">
          {loading && <div className="ws-explorer-progress" role="progressbar" aria-label="Loading" />}
          <Tree
            model={model.tree}
            label="Files Explorer"
            paddingBottom={22}
            renderIcon={renderIcon}
            tooltip={(entry) => entry.path}
            onOpen={(entry, how) => onOpen?.(entry.path, how)}
            onContextMenu={(node, at) => {
              model.cancelEdit()
              setMenu({ path: node?.id, at })
            }}
            onKeyDown={keyDown}
            menuTarget={menu?.path}
            editing={
              edit && {
                id: edit.id,
                value: edit.value,
                selection: edit.selection,
                label: 'Type file name. Press Enter to confirm or Escape to cancel.',
                validate: (value) => model.check(value),
                onCommit: (value) => void model.commitEdit(value),
                onCancel: () => model.cancelEdit(),
              }
            }
          />
        </div>
      )}
      {menu && (
        <Menu
          at={menu.at}
          groups={menuGroups(menu.path)}
          onClose={() => {
            setMenu(undefined)
            focusTree()
          }}
        />
      )}
      {deleting && (
        <Dialog
          {...model.deleteQuestion(deleting)}
          buttons={[
            { label: model.trash ? 'Move to Trash' : 'Delete', value: 'delete' },
            { label: 'Cancel', value: 'cancel' },
          ]}
          onAnswer={(answer) => {
            setDeleting(undefined)
            focusTree()
            if (answer === 'delete') void model.delete(deleting)
          }}
        />
      )}
    </section>
  )
}
