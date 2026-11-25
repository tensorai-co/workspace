import { CodeEditor, type EditorView } from '@tensorai-workspace/editor'
import { baseName, relativePath } from '@tensorai-workspace/explorer'
import { Codicon, FileIcon } from '@tensorai-workspace/icons/react'
import { detectLanguage } from '@tensorai-workspace/languages'
import { MarkdownPreview, type MarkdownView } from '@tensorai-workspace/markdown'
import { Menu, type MenuItem } from '@tensorai-workspace/overlays'
import { distinguish, runTabsKey, TabAction, TabStrip, type Tab } from '@tensorai-workspace/tabs'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CommandRegistry } from '../../core/index.js'
import { isPreview, pathOf } from './tabIds.js'
import type { Editors, Group } from './useEditors.js'

export interface EditorGroupProps {
  group: Group
  editors: Editors
  commands: CommandRegistry
}

/** One group: its tabs, the path, and the editor or preview of the active tab. */
export function EditorGroup({ group, editors: e, commands }: EditorGroupProps) {
  const { model } = group
  useSyncExternalStore(model.subscribe, () => model.version)
  const [menu, setMenu] = useState<{ tab: Tab<string>; at: { x: number; y: number } }>()
  const view = useRef<EditorView | null>(null)
  const preview = useRef<MarkdownView | null>(null)
  const active = group === e.group
  const id = model.active?.id
  const path = id === undefined ? undefined : pathOf(id)
  const text = path === undefined ? undefined : e.texts[path]
  const folders = distinguish(model.tabs.map((t) => relativePath(e.root, pathOf(t.id))))
  const markdown = path !== undefined && detectLanguage(path).id === 'markdown'
  const asPreview = id !== undefined && (isPreview(id) || e.previewed.has(`${group.id}:${id}`))
  const tip = (command: string, title?: string) => commands.tooltip(command, title)

  const { read } = e
  useEffect(() => {
    if (path !== undefined && text === undefined) read(path)
  }, [path, text, read])

  const take = () => (asPreview ? preview.current?.element.focus({ preventScroll: true }) : view.current?.focus())

  // Focus the editor when asked to, once it's there, and again if it's made anew with the focus in it.
  const done = useRef<{ focus: number; view: unknown }>({ focus: -1, view: null })
  useEffect(() => {
    const shown = asPreview ? preview.current : view.current
    if (!active || !shown || text === undefined) return
    if (done.current.focus === e.focus && (done.current.view === shown || document.activeElement !== document.body)) return
    done.current = { focus: e.focus, view: shown }
    take()
  })

  const lineOf = (file: string) => {
    const source = e.editorOf(file)
    return source && source.state.doc.lineAt(source.state.selection.main.head).number
  }

  const menuGroups = (tab: Tab<string>): MenuItem[][] => {
    const ids = model.tabs.map((t) => t.id)
    const copy = (value: string) => void navigator.clipboard?.writeText(value)
    const close = (which: string[]) => e.close(group, which)
    return [
      [
        { label: 'Close', keys: commands.keyLabel('workbench.action.closeActiveEditor'), run: () => close([tab.id]) },
        { label: 'Close Others', disabled: ids.length < 2, run: () => close(ids.filter((x) => x !== tab.id)) },
        { label: 'Close to the Right', disabled: ids[ids.length - 1] === tab.id, run: () => close(ids.slice(ids.indexOf(tab.id) + 1)) },
        { label: 'Close Saved', run: () => close(model.tabs.filter((t) => !t.dirty).map((t) => t.id)) },
        { label: 'Close All', run: () => close(ids) },
      ],
      [
        { label: 'Copy Path', run: () => copy(pathOf(tab.id)) },
        { label: 'Copy Relative Path', run: () => copy(relativePath(e.root, pathOf(tab.id))) },
      ],
      ...(tab.preview ? [[{ label: 'Keep Open', run: () => model.keep(tab.id) }]] : []),
      ...(markdown && !isPreview(tab.id) ? [[{ label: 'Open Preview', keys: commands.keyLabel('markdown.showPreview'), run: () => e.togglePreview(group, pathOf(tab.id)) }]] : []),
      [{ label: 'Split Right', run: () => e.split(group) }],
    ]
  }

  const actions = (
    <>
      {markdown && path !== undefined && !asPreview && (
        <>
          <TabAction icon="open-preview" label={tip('markdown.showPreviewToSide')} onClick={() => e.previewToSide(group, path)} />
          <TabAction icon="preview" label="Open as Preview" onClick={() => e.togglePreview(group, path)} />
        </>
      )}
      {asPreview && path !== undefined && <TabAction icon="file-code" label="Open Source File" onClick={() => e.goTo(group, path)} />}
      <TabAction icon="split-horizontal" label={tip('workbench.action.splitEditor')} onClick={() => e.split(group)} />
    </>
  )

  return (
    <div
      className="ws-group"
      onFocusCapture={() => e.setActiveId(group.id)}
      onMouseDownCapture={() => e.setActiveId(group.id)}
      onKeyDown={(event) => {
        if (!runTabsKey(event, { model, mac: commands.mac, close: (tab) => e.close(group, [tab]) })) return
        event.preventDefault()
      }}
    >
      <TabStrip
        model={model}
        label="Editor tabs"
        dragType="editor"
        describe={(tab) => {
          const name = baseName(pathOf(tab.id))
          return {
            label: isPreview(tab.id) ? `Preview ${name}` : name,
            icon: isPreview(tab.id) ? <Codicon name="preview" className="ws-preview-icon" /> : <FileIcon name={name} languageId={detectLanguage(tab.id).id} />,
            description: isPreview(tab.id) ? undefined : folders[model.indexOf(tab.id)],
            tooltip: isPreview(tab.id) ? `Preview ${name}` : tab.id,
          }
        }}
        onSelect={take}
        onClose={(tab) => e.close(group, [tab.id])}
        onContextMenu={(tab, at) => setMenu({ tab, at })}
        actions={actions}
      />
      {path !== undefined && asPreview ? (
        <div className="ws-editor-host">
          {text !== undefined && (
            <MarkdownPreview
              key={id}
              text={text}
              path={path}
              root={e.root}
              fs={e.fs}
              activeLine={lineOf(path) ?? 0}
              onOpen={(target) => void e.openLink(group, target)}
              onDoubleClick={(line) => e.goTo(group, path, line)}
              onView={(v) => {
                preview.current = v
                e.showPreview(group, path, v)
              }}
            />
          )}
        </div>
      ) : path !== undefined ? (
        <>
          <div className="ws-breadcrumbs">
            {relativePath(e.root, path)
              .split('/')
              .map((part, i, parts) => (
                <span key={i} className="ws-crumb">
                  {i === parts.length - 1 && <FileIcon name={part} languageId={detectLanguage(path).id} />}
                  {part}
                  {i < parts.length - 1 && <Codicon name="chevron-right" />}
                </span>
              ))}
          </div>
          <div className="ws-editor-host">
            {text !== undefined && (
              <CodeEditor
                key={path}
                path={path}
                value={text}
                onView={(v) => {
                  view.current = v
                  e.showEditor(group, path, v)
                }}
                onUpdate={e.updated}
                inlineCompletions={e.completions}
                languages={e.languages}
                onOpenLocation={e.openLocation}
                wordWrap={e.wrapOf(path)}
                onChange={(value) => e.change(path, value)}
              />
            )}
          </div>
        </>
      ) : (
        <div className="ws-group-empty" tabIndex={-1} />
      )}
      {menu && <Menu at={menu.at} groups={menuGroups(menu.tab)} onClose={() => setMenu(undefined)} />}
    </div>
  )
}
