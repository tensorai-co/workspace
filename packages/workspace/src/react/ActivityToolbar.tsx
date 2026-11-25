import { ActivityBar } from './ActivityBar.js'
import type { WorkspaceApi } from './Workspace.js'

export interface ActivityToolbarProps {
  /** The workspace whose buttons these are, from its `onReady`. */
  workspace: WorkspaceApi
  className?: string
}

/**
 * The activity bar's buttons as a row, for a host's own bar: the application menu, an item per view and the activity
 * actions, working as they do at the side. Use it with `activityBar={false}` on the `<Workspace>`.
 */
export function ActivityToolbar({ workspace, className }: ActivityToolbarProps) {
  return (
    <ActivityBar
      orientation="horizontal"
      views={workspace.views}
      actions={workspace.activityActions}
      layout={workspace.layout}
      commands={workspace.commands}
      menu={workspace.menu}
      className={className}
    />
  )
}
