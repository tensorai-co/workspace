import type { MenuItem } from '@tensorai-co/workspace/overlays'
import type { CommandRegistry, ContextKeys } from '../core/index.js'

const CATEGORIES = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help']

/** The application menu: every command with a category that applies now, by category, in VS Code's order. */
export function applicationMenu(commands: CommandRegistry, context: ContextKeys): MenuItem[][] {
  const by = new Map<string, MenuItem[]>()
  for (const c of commands.list()) {
    if (!c.category || !context.matches(c.when)) continue
    const list = by.get(c.category) ?? []
    list.push({ label: c.title, keys: commands.keyLabel(c.id), run: () => void commands.execute(c.id) })
    by.set(c.category, list)
  }
  const order = (name: string) => (CATEGORIES.includes(name) ? CATEGORIES.indexOf(name) : CATEGORIES.length)
  return [...by.entries()].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b)).map(([, items]) => items)
}
