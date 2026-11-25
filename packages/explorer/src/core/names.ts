import type { TreeMessage } from '@tensorai-workspace/tree/core'

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const exact = new Intl.Collator(undefined, { numeric: true })

/** The default order: folders first, then names with numbers counted ("file2" before "file10"), ignoring case. */
export function compareEntries(a: { name: string; kind: string }, b: { name: string; kind: string }): number {
  if ((a.kind === 'dir') !== (b.kind === 'dir')) return a.kind === 'dir' ? -1 : 1
  return collator.compare(a.name, b.name) || exact.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
}

/**
 * What's wrong with a name being typed, in the words. A name may hold slashes, to make or move into folders on the
 * way. `siblings` are the names already in the folder.
 */
export function checkName(value: string, siblings: readonly string[]): TreeMessage | undefined {
  const name = value.replace(/[\\/]+$/, '')
  if (!name.trim()) return { kind: 'error', text: 'A file or folder name must be provided.' }
  if (value.startsWith('/')) return { kind: 'error', text: 'A file or folder name cannot start with a slash.' }
  const segments = name.split('/')
  if (segments.some((s) => !s || s === '.' || s === '..' || s.includes('\0'))) return { kind: 'error', text: `The name ${name} is not valid as a file or folder name. Please choose a different name.` }
  if (segments.length === 1 && siblings.includes(name)) return { kind: 'error', text: `A file or folder ${name} already exists at this location. Please choose a different name.` }
  if (segments.some((s) => s !== s.trim())) return { kind: 'warning', text: 'Leading or trailing whitespace detected in file or folder name.' }
  return undefined
}
