import { parse } from '@tensorai-workspace/markdown-parser'
import type { ViewElement, ViewNode } from './nodes.js'

// Raw HTML in Markdown, as GitHub allows it: these tags and attributes and no others. Nothing is ever handed to the
// browser as HTML; what's left is elements for the view to make.

const TAGS = new Set(
  ('a abbr b bdo blockquote br caption center cite code dd del details dfn div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ol p picture pre ' +
    'q rp rt ruby s samp small span strike strong sub summary sup table tbody td tfoot th thead time tr tt u ul var wbr').split(' '),
)
/** Gone with everything in them. */
const DROPPED = new Set('script style iframe object embed noembed noscript template textarea title select svg math xmp plaintext noframes'.split(' '))
const VOID = new Set('br hr img wbr area base col embed input link meta param source track'.split(' '))
const BLOCKS = new Set('blockquote center details div dl figcaption figure h1 h2 h3 h4 h5 h6 hr ol p pre table ul'.split(' '))

const EVERYWHERE = ['align', 'title', 'dir', 'lang']
const ATTRS: Record<string, string[]> = {
  a: ['href'],
  img: ['src', 'alt', 'width', 'height'],
  td: ['colspan', 'rowspan', 'valign', 'width'],
  th: ['colspan', 'rowspan', 'valign', 'width', 'scope'],
  table: ['width'],
  ol: ['start', 'type', 'reversed'],
  li: ['value'],
  details: ['open'],
  time: ['datetime'],
}

/** A tag: part of an element whose content is elsewhere. */
export interface Tag {
  tag: string
  close?: boolean
  /** Part of an element that goes with everything in it. */
  drop?: boolean
  element?: ViewElement
}

/** What's in a container, before its tags are paired: nodes, and tags to pair. */
export type Item = ViewNode | { html: Tag }

const isTag = (item: Item): item is { html: Tag } => typeof item === 'object' && 'html' in item

/** Decodes `&amp;` and the like. The Markdown parser knows every name. */
export function decodeEntities(text: string): string {
  return text.replace(/&(?:#\d{1,7}|#[xX][\da-fA-F]{1,6}|[a-zA-Z][a-zA-Z\d]{1,31});/g, (entity) => {
    const block = parse(entity).children[0]
    const node = block?.type === 'paragraph' ? block.children[0] : undefined
    return node?.type === 'text' ? node.value : entity
  })
}

const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function readAttrs(tag: string, source: string): Pick<ViewElement, 'attrs' | 'anchor'> {
  const allowed = ATTRS[tag]
  const out: Pick<ViewElement, 'attrs' | 'anchor'> = {}
  for (const m of source.matchAll(ATTRIBUTE)) {
    const name = m[1]!.toLowerCase()
    const value = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
    if (name === 'id' || (name === 'name' && tag === 'a')) out.anchor ??= value
    else if (EVERYWHERE.includes(name) || allowed?.includes(name)) (out.attrs ??= {})[name] ??= value
  }
  return out
}

/** Splits HTML into text and tags, leaving out what isn't allowed. Comments and declarations go too. */
export function readHtml(source: string): Item[] {
  const out: Item[] = []
  const pattern = /<!--[\s\S]*?(?:-->|$)|<[!?][\s\S]*?(?:>|$)|<(\/?)([a-zA-Z][a-zA-Z\d-]*)((?:[^"'>]|"[^"]*"|'[^']*')*)>/g
  let at = 0
  const text = (value: string) => {
    if (value) out.push(decodeEntities(value))
  }
  for (let m = pattern.exec(source); m; m = pattern.exec(source)) {
    text(source.slice(at, m.index))
    at = pattern.lastIndex
    const tag = m[2]?.toLowerCase()
    if (!tag) continue
    const close = m[1] === '/'
    if (DROPPED.has(tag)) {
      const end = close ? undefined : new RegExp(`</${tag}\\s*>`, 'i').exec(source.slice(at))
      if (end) at = pattern.lastIndex = at + end.index + end[0].length
      // Its end may be in another piece of HTML.
      else out.push({ html: { tag, close, drop: true } })
    } else if (TAGS.has(tag) && !(close && VOID.has(tag))) {
      out.push({ html: close ? { tag, close } : { tag, element: { tag, ...readAttrs(tag, m[3]!), children: [] } } })
    }
  }
  text(source.slice(at))
  return out
}

/** Tags an opening tag ends, as in `<li>one<li>two`, looking no further out than `within`. */
const ENDS: Record<string, { tags: string[]; within: string[] }> = {
  li: { tags: ['li'], within: ['ul', 'ol'] },
  dt: { tags: ['dt', 'dd'], within: ['dl'] },
  dd: { tags: ['dt', 'dd'], within: ['dl'] },
  tr: { tags: ['tr'], within: ['table', 'thead', 'tbody', 'tfoot'] },
  td: { tags: ['td', 'th'], within: ['tr', 'table'] },
  th: { tags: ['td', 'th'], within: ['tr', 'table'] },
  tbody: { tags: ['thead', 'tbody', 'tfoot'], within: ['table'] },
  tfoot: { tags: ['thead', 'tbody', 'tfoot'], within: ['table'] },
}
const ROWS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr'])

/** Pairs a container's tags into elements, as a browser would: what's left open ends with the container. */
export function nest(items: Item[]): ViewNode[] {
  const root: ViewElement = { tag: '', children: [] }
  const open = [root]
  const top = () => open[open.length - 1]!
  const closeTo = (index: number) => void (open.length = index)

  const end = (tags: string[], within: string[]) => {
    for (let i = open.length - 1; i > 0; i--) {
      if (tags.includes(open[i]!.tag)) return closeTo(i)
      if (within.includes(open[i]!.tag)) return
    }
  }
  const add = (node: ViewNode) => {
    if (typeof node !== 'string') {
      const rule = ENDS[node.tag]
      if (rule) end(rule.tags, rule.within)
      if (BLOCKS.has(node.tag)) end(['p'], ['td', 'th', 'li', 'div', 'blockquote', 'details', 'button'])
      // A table's rows are always in a section.
      if (node.tag === 'tr' && top().tag === 'table') {
        const body: ViewElement = { tag: 'tbody', children: [] }
        top().children.push(body)
        open.push(body)
      }
    } else if (ROWS.has(top().tag) && !node.trim()) return
    top().children.push(node)
  }

  for (let at = 0; at < items.length; at++) {
    const item = items[at]!
    if (!isTag(item)) add(item)
    else if (item.html.drop) {
      const end = items.findIndex((other, i) => i > at && isTag(other) && other.html.close && other.html.tag === item.html.tag)
      if (!item.html.close && end > 0) at = end
    }
    else if (item.html.close) {
      for (let i = open.length - 1; i > 0; i--) if (open[i]!.tag === item.html.tag) {
        closeTo(i)
        break
      }
    } else {
      const element = item.html.element!
      add(element)
      if (!VOID.has(element.tag)) open.push(element)
    }
  }
  return root.children
}
