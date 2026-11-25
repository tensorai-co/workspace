// What a document becomes: a tree of elements, ready for any view to draw. Only the tags and attributes named in
// html.ts ever appear in it, so a view can make them without another look.

export type ViewNode = string | ViewElement

export interface ViewElement {
  tag: string
  /** DOM attribute names. `href` and `src` are as written: resolve them with `resolveLink`. */
  attrs?: Record<string, string>
  /** The block's first and last source lines, counted from 1. Only blocks have them. */
  line?: number
  endLine?: number
  /** A heading's slug, or the name of an `<a name>`: where `#links` lead. */
  anchor?: string
  /** A code block (`pre`): its language, as written, and its code. */
  code?: { lang?: string; text: string; fenced: boolean }
  /** A task list's item, ticked or not. */
  checked?: boolean
  /** A front matter table. */
  frontMatter?: boolean
  children: ViewNode[]
}

/** Whether two trees are the same, so a view can keep what it drew. Without `lines`, they can be on different lines. */
export function sameNode(a: ViewNode | undefined, b: ViewNode | undefined, lines = true): boolean {
  if (a === b) return true
  if (!a || !b || typeof a === 'string' || typeof b === 'string') return false
  if (a.tag !== b.tag || (lines && (a.line !== b.line || a.endLine !== b.endLine)) || a.anchor !== b.anchor || a.checked !== b.checked || a.frontMatter !== b.frontMatter) return false
  if (a.code?.text !== b.code?.text || a.code?.lang !== b.code?.lang || a.code?.fenced !== b.code?.fenced) return false
  const keys = Object.keys(a.attrs ?? {})
  if (keys.length !== Object.keys(b.attrs ?? {}).length || keys.some((k) => a.attrs![k] !== b.attrs?.[k])) return false
  return a.children.length === b.children.length && a.children.every((c, i) => sameNode(c, b.children[i], lines))
}
