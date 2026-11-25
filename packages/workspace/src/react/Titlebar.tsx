import type { CodiconName } from '@tensorai-workspace/icons'
import { Codicon } from '@tensorai-workspace/icons/react'
import { Menu } from '@tensorai-workspace/overlays'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import type { CommandRegistry, ContextKeys, LayoutModel } from '../core/index.js'

export interface TitlebarProps {
  commands: CommandRegistry
  context: ContextKeys
  layout: LayoutModel
  /** What the command center shows: the folder's name, usually. */
  title: string
  /** Replaces the command center. */
  center?: ReactNode
  /** Whether there's a panel to toggle. */
  panel: boolean
  /** Whether there's a secondary side bar to toggle. */
  auxiliaryBar: boolean
}

/** A button in the titlebar: 22px, with the toolbar hover. */
function TitleAction({ icon, label, onClick, disabled, pressed }: { icon: CodiconName; label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; pressed?: boolean }) {
  return (
    <button type="button" className="ws-title-action" title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Codicon name={icon} />
    </button>
  )
}

/** The titlebar: back and forward, the command center, and the layout toggles. */
export function Titlebar({ commands, context, layout, title, center, panel: hasPanel, auxiliaryBar }: TitlebarProps) {
  useSyncExternalStore(layout.subscribe, () => layout.version)
  useSyncExternalStore(context.subscribe, () => context.version)
  useSyncExternalStore(commands.subscribe, () => commands.version)
  const [menu, setMenu] = useState<{ x: number; y: number }>()
  const { sidebar, panel, auxiliaryBar: aux } = layout.state
  const tip = (id: string, title?: string) => commands.tooltip(id, title)
  const run = (id: string) => () => void commands.execute(id)
  const quickOpen = commands.has('workbench.action.quickOpen')

  return (
    <header className="ws-titlebar">
      <div className="ws-titlebar-left" />
      <div className="ws-titlebar-center">
        {center ?? (
          <div className="ws-command-center">
            <TitleAction icon="arrow-left" label={tip('workbench.action.navigateBack')} disabled={!context.get('canNavigateBack')} onClick={run('workbench.action.navigateBack')} />
            <TitleAction icon="arrow-right" label={tip('workbench.action.navigateForward')} disabled={!context.get('canNavigateForward')} onClick={run('workbench.action.navigateForward')} />
            <div className="ws-command-center-box">
              <button
                type="button"
                className="ws-command-center-label"
                title={quickOpen ? tip('workbench.action.quickOpen', 'Search') : title}
                tabIndex={quickOpen ? 0 : -1}
                onClick={quickOpen ? run('workbench.action.quickOpen') : undefined}
              >
                <span>{title}</span>
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="ws-titlebar-right">
        <div className="ws-title-actions" role="toolbar" aria-label="Title actions">
          <TitleAction icon="layout" label="Customize Layout..." onClick={(e) => setMenu({ x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().bottom + 2 })} />
          <TitleAction icon={sidebar ? 'layout-sidebar-left' : 'layout-sidebar-left-off'} label={tip('workbench.action.toggleSidebarVisibility', 'Toggle Primary Side Bar')} pressed={sidebar} onClick={run('workbench.action.toggleSidebarVisibility')} />
          {hasPanel && <TitleAction icon={panel ? 'layout-panel' : 'layout-panel-off'} label={tip('workbench.action.togglePanel')} pressed={panel} onClick={run('workbench.action.togglePanel')} />}
          {auxiliaryBar && <TitleAction icon={aux ? 'layout-sidebar-right' : 'layout-sidebar-right-off'} label={tip('workbench.action.toggleAuxiliaryBar', 'Toggle Secondary Side Bar')} pressed={aux} onClick={run('workbench.action.toggleAuxiliaryBar')} />}
        </div>
      </div>
      {menu && (
        <Menu
          at={menu}
          onClose={() => setMenu(undefined)}
          groups={[
            [
              { label: `${sidebar ? 'Hide' : 'Show'} Primary Side Bar`, keys: commands.keyLabel('workbench.action.toggleSidebarVisibility'), run: run('workbench.action.toggleSidebarVisibility') },
              ...(auxiliaryBar ? [{ label: `${aux ? 'Hide' : 'Show'} Secondary Side Bar`, keys: commands.keyLabel('workbench.action.toggleAuxiliaryBar'), run: run('workbench.action.toggleAuxiliaryBar') }] : []),
              ...(hasPanel ? [{ label: `${panel ? 'Hide' : 'Show'} Panel`, keys: commands.keyLabel('workbench.action.togglePanel'), run: run('workbench.action.togglePanel') }] : []),
            ],
            ...(hasPanel ? [[{ label: layout.state.panelMaximized ? 'Restore Panel Size' : 'Maximize Panel', run: run('workbench.action.toggleMaximizedPanel') }]] : []),
          ]}
        />
      )}
    </header>
  )
}
