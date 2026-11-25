import type { EditorView } from '@tensorai-workspace/editor'
import type { CodiconName } from '@tensorai-workspace/icons'
import { Codicon } from '@tensorai-workspace/icons/react'
import { detectLanguage } from '@tensorai-workspace/languages'
import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import type { Keybindings } from '../core/index.js'
import type { EditorUpdates } from './editors/useEditors.js'

export interface StatusItemProps {
  /** A codicon before the text. */
  icon?: CodiconName
  text?: ReactNode
  tooltip?: string
  /** Makes it a button, with the hover. */
  onClick?: () => void
  /** "remote" is the blue item at the far left. */
  kind?: 'remote'
}

/** One item of the status bar, for hosts to put in its slots. */
export function StatusItem({ icon, text, tooltip, onClick, kind }: StatusItemProps) {
  const body = (
    <>
      {icon && <Codicon name={icon} />}
      {icon && text !== undefined && ' '}
      {text}
    </>
  )
  const className = `ws-status-item ${kind ? `ws-status-${kind}` : ''}`
  return onClick ? (
    <button type="button" className={`${className} ws-status-command`} title={tooltip} aria-label={tooltip} onClick={onClick}>
      {body}
    </button>
  ) : (
    <span className={className} title={tooltip}>
      {body}
    </span>
  )
}

/** The cursor's place and the file's language on the right. */
function EditorStatus({ view, path, updates }: { view: EditorView | null; path: string | undefined; updates: EditorUpdates }) {
  // Only this part follows the cursor, so typing doesn't redraw the whole IDE.
  useSyncExternalStore(updates.subscribe, () => (view ? `${view.state.selection.main.head}:${view.state.selection.ranges.length}` : ''))
  if (path === undefined) return null
  const main = view?.state.selection.main
  const line = main && view.state.doc.lineAt(main.head)
  const count = view?.state.selection.ranges.length ?? 0
  return (
    <>
      {line && main && <StatusItem text={`Ln ${line.number}, Col ${main.head - line.from + 1}`} tooltip="Go to Line/Column" />}
      {count > 1 && <StatusItem text={`${count} selections`} />}
      <StatusItem text="Spaces: 4" tooltip="Select Indentation" />
      <StatusItem text="UTF-8" tooltip="Select Encoding" />
      <StatusItem text="LF" tooltip="Select End of Line Sequence" />
      <StatusItem text={detectLanguage(path).label} tooltip="Select Language Mode" />
    </>
  )
}

/** The problems in the open editors: errors, warnings, and infos when there are any. */
function Problems({ views }: { views: readonly EditorView[] }) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const stops = views.map((v) => v.diagnostics?.subscribe(listener))
      return () => stops.forEach((stop) => stop?.())
    },
    [views],
  )
  const key = useSyncExternalStore(subscribe, () =>
    views
      .map((v) => v.diagnostics?.counts)
      .reduce((sum, c) => (c ? [sum[0]! + c.errors, sum[1]! + c.warnings, sum[2]! + c.infos] : sum), [0, 0, 0])
      .join(','),
  )
  const [errors, warnings, infos] = key.split(',').map(Number) as [number, number, number]
  const parts = [errors && `Errors: ${errors}`, warnings && `Warnings: ${warnings}`, infos && `Infos: ${infos}`].filter(Boolean)
  const label = parts.join(', ') || 'No Problems'
  return (
    <span className="ws-status-item ws-status-problems" title={label} aria-label={label}>
      {/* One text node each: a flex box drops text nodes that are only spaces. */}
      <Codicon name="error" />
      {` ${errors} `}
      <Codicon name="warning" />
      {` ${warnings}`}
      {infos > 0 && (
        <>
          {' '}
          <Codicon name="info" />
          {` ${infos}`}
        </>
      )}
    </span>
  )
}

export interface StatusBarProps {
  keys: Keybindings
  view: EditorView | null
  path: string | undefined
  updates: EditorUpdates
  left?: ReactNode
  right?: ReactNode
  /** The editors whose problems it counts, when there's a language service. */
  problems?: readonly EditorView[]
}

/** The status bar: the host's items on the left, the editor's and the host's on the right. */
export function StatusBar({ keys, view, path, updates, left, right, problems }: StatusBarProps) {
  const chord = useSyncExternalStore(keys.subscribe, () => keys.chord)
  return (
    <footer className="ws-statusbar" aria-label="Status bar">
      <div className="ws-status-left">
        {left}
        {problems && <Problems views={problems} />}
        {chord && <StatusItem text={`(${chord}) was pressed. Waiting for second key of chord...`} />}
      </div>
      <div className="ws-status-right">
        <EditorStatus view={view} path={path} updates={updates} />
        {right}
      </div>
    </footer>
  )
}
