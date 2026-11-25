import type { CodiconName } from '@tensorai-co/workspace/icons'
import { Codicon } from '@tensorai-co/workspace/icons/react'
import { Menu, type MenuItem } from '@tensorai-co/workspace/overlays'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import type { CommandRegistry, LayoutModel } from '../core/index.js'

/** A sidebar view with its item in the activity bar: the Explorer, Search, Source Control… */
export interface ViewDescriptor {
  id: string
  /** Its name, shown at the top of the sidebar and on its item. */
  title: string
  icon: CodiconName | ReactNode
  /** A key that shows it, such as `shift+mod+f`. */
  keybinding?: string
  /** What the sidebar shows. */
  content: ReactNode
  /** Buttons at the right of its title. */
  actions?: ReactNode
}

/** A button at the bottom of the activity bar, such as Accounts or Manage. */
export interface ActivityAction {
  id: string
  title: string
  icon: CodiconName | ReactNode
  onClick: (at: { x: number; y: number }) => void
}

export interface ActivityBarProps {
  views: readonly ViewDescriptor[]
  actions?: readonly ActivityAction[]
  layout: LayoutModel
  commands: CommandRegistry
  /** What the menu at the top lists. Without items there's no menu. */
  menu: MenuItem[][]
}

const icon = (value: CodiconName | ReactNode) => (typeof value === 'string' ? <Codicon name={value as CodiconName} size={24} /> : value)

/** The activity bar: the application menu, an item per view, and actions at the bottom. */
export function ActivityBar({ views, actions = [], layout, commands, menu }: ActivityBarProps) {
  useSyncExternalStore(layout.subscribe, () => layout.version)
  const [open, setOpen] = useState<{ x: number; y: number }>()
  const { view: current, sidebar } = layout.state

  return (
    <nav className="ws-activitybar" aria-label="Activity bar">
      {menu.length > 0 && (
        <div className="ws-activity-menu">
          <button
            type="button"
            className="ws-activity-menu-button"
            title="Application Menu"
            aria-label="Application Menu"
            aria-haspopup="menu"
            aria-expanded={!!open}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setOpen({ x: r.right, y: r.top })
            }}
          >
            <Codicon name="menu" />
          </button>
        </div>
      )}
      <div className="ws-activity-views" role="tablist" aria-orientation="vertical" aria-label="Active View Switcher">
        {views.map((view) => {
          const checked = view.id === current && sidebar
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={checked}
              className={`ws-activity-item ${checked ? 'ws-checked' : ''}`}
              title={commands.tooltip(`workbench.view.${view.id}`, view.title)}
              aria-label={view.title}
              onClick={() => layout.clickView(view.id)}
            >
              <span className="ws-activity-indicator" />
              {icon(view.icon)}
            </button>
          )
        })}
      </div>
      {actions.length > 0 && (
        <div className="ws-activity-actions" role="toolbar" aria-label="Manage">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="ws-activity-item"
              title={action.title}
              aria-label={action.title}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                action.onClick({ x: r.right, y: r.top })
              }}
            >
              <span className="ws-activity-indicator" />
              {icon(action.icon)}
            </button>
          ))}
        </div>
      )}
      {open && <Menu at={open} groups={menu} onClose={() => setOpen(undefined)} />}
    </nav>
  )
}
