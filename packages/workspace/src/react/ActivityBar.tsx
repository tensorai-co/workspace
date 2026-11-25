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

/** A button at the end of the activity bar, such as Accounts or Manage. */
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
  /** What the application menu lists, or a function that reads it when it opens. Without items there's no menu. */
  menu: MenuItem[][] | (() => MenuItem[][])
  /**
   * "vertical" (the default): the bar at the side of the workspace. "horizontal": a row of toolbar buttons, for a
   * host's own bar; menus open below them.
   */
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

/** The activity bar: the application menu, an item per view, and actions at the end. */
export function ActivityBar({ views, actions = [], layout, commands, menu, orientation = 'vertical', className = '' }: ActivityBarProps) {
  useSyncExternalStore(layout.subscribe, () => layout.version)
  const [open, setOpen] = useState<{ at: { x: number; y: number }; groups: MenuItem[][] }>()
  const { view: current, sidebar } = layout.state
  const horizontal = orientation === 'horizontal'
  const icon = (value: CodiconName | ReactNode) => (typeof value === 'string' ? <Codicon name={value as CodiconName} size={horizontal ? 16 : 24} /> : value)
  /** Where a menu from a button opens: beside it at the side, under it in a row. */
  const below = (el: Element) => {
    const r = el.getBoundingClientRect()
    return horizontal ? { x: r.left, y: r.bottom + 2 } : { x: r.right, y: r.top }
  }

  return (
    <nav className={`ws-activitybar ${horizontal ? 'ws-horizontal' : ''} ${className}`} aria-label="Activity bar">
      {(typeof menu === 'function' || menu.length > 0) && (
        <div className="ws-activity-menu">
          <button
            type="button"
            className="ws-activity-menu-button"
            title="Application Menu"
            aria-label="Application Menu"
            aria-haspopup="menu"
            aria-expanded={!!open}
            onClick={(e) => setOpen({ at: below(e.currentTarget), groups: typeof menu === 'function' ? menu() : menu })}
          >
            <Codicon name="menu" />
          </button>
        </div>
      )}
      <div className="ws-activity-views" role="tablist" aria-orientation={orientation} aria-label="Active View Switcher">
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
              onClick={(e) => action.onClick(below(e.currentTarget))}
            >
              <span className="ws-activity-indicator" />
              {icon(action.icon)}
            </button>
          ))}
        </div>
      )}
      {open && <Menu at={open.at} groups={open.groups} onClose={() => setOpen(undefined)} />}
    </nav>
  )
}
