import { MAX_LENGTH, parse, type Block, type Inline, type ListItem, type Table } from '@tensorai-workspace/markdown-parser'
import { findFrontMatter, readYaml, writeYaml, type FrontMatter, type Yaml } from './frontMatter.js'
import { nest, readHtml, type Item } from './html.js'
import { sameNode, type ViewElement, type ViewNode } from './nodes.js'
import { Slugs } from './slugs.js'

export interface MarkdownDocument {
  nodes: ViewNode[]
  /** A key for each node, which it keeps when other blocks come and go around it. */
  keys: number[]
  /** How many lines the text has. */
  lines: number
}

/**
 * Turns Markdown into elements to draw, each block with the source lines it came from. Blocks that are the same as in
 * `previous` are the same objects, so a view can skip them.
 */
export function readMarkdown(text: string, previous?: MarkdownDocument): MarkdownDocument {
  const starts = lineStarts(text)
  const reader = new Reader(starts)
  const front = findFrontMatter(text)
  const nodes: ViewNode[] = []
  if (front) nodes.push(...frontMatter(front))
  nodes.push(...nest(chunks(text, front?.length ?? 0).flatMap(({ from, source, length }) => reader.blocks(parse(source).children, from, length))))
  if (!previous) return { nodes, keys: nodes.map((_, i) => i), lines: starts.length }
  const keys = matchKeys(previous, nodes)
  const old = new Map(previous.keys.map((key, i) => [key, previous.nodes[i]!]))
  return { nodes: nodes.map((node, i) => (sameNode(old.get(keys[i]!), node) ? old.get(keys[i]!)! : node)), keys, lines: starts.length }
}

/** Blocks that are the same at the start and end keep their keys; between them, those of the same kind in the same place. */
function matchKeys(previous: MarkdownDocument, nodes: ViewNode[]): number[] {
  const before = previous.nodes
  const shorter = Math.min(before.length, nodes.length)
  let start = 0
  while (start < shorter && sameNode(before[start], nodes[start], false)) start++
  let end = 0
  while (end < shorter - start && sameNode(before[before.length - 1 - end], nodes[nodes.length - 1 - end], false)) end++
  let next = Math.max(-1, ...previous.keys) + 1
  const kind = (node: ViewNode | undefined) => (typeof node === 'object' ? node.tag : undefined)
  return nodes.map((node, i) => {
    if (i < start) return previous.keys[i]!
    if (i >= nodes.length - end) return previous.keys[before.length - (nodes.length - i)]!
    return i < before.length - end && kind(before[i]) === kind(node) ? previous.keys[i]! : next++
  })
}

function lineStarts(text: string): number[] {
  const out = [0]
  for (const m of text.matchAll(/\r\n|\n|\r/g)) out.push(m.index + m[0].length)
  return out
}

/** The parser shows what's past its limit as plain text, so longer files are parsed in parts that end before a heading. */
const CHUNK = Math.floor(MAX_LENGTH * 0.8)

interface Chunk {
  from: number
  /** What to parse: the part, and the link definitions from the rest of the text. */
  source: string
  /** The part's own length. */
  length: number
}

function chunks(text: string, from: number): Chunk[] {
  if (text.length - from <= MAX_LENGTH) return [{ from, source: text.slice(from), length: text.length - from }]
  const parts: [number, number][] = []
  let fence: string | undefined
  let start = from
  let heading = from
  let at = from
  while (at < text.length) {
    const newline = text.indexOf('\n', at)
    const end = newline < 0 ? text.length : newline + 1
    const line = text.slice(at, end)
    const mark = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    if (mark && !fence) fence = mark
    else if (mark && fence && mark[0] === fence[0] && mark.length >= fence.length && !line.trim().slice(mark.length).trim()) fence = undefined
    else if (!fence && /^#{1,6}[ \t]/.test(line)) heading = at
    if (end - start > CHUNK && heading > start) {
      parts.push([start, heading])
      start = heading
    }
    at = end
  }
  parts.push([start, text.length])
  const definitions = (text.match(/^ {0,3}\[[^\]\n]+\]:[ \t]*\S.*$/gm) ?? []).join('\n')
  const spare = definitions.length < MAX_LENGTH - CHUNK - 2 ? `\n\n${definitions}` : ''
  return parts.map(([a, b]) => ({ from: a, source: text.slice(a, b) + spare, length: b - a }))
}

class Reader {
  private readonly slugs = new Slugs()

  constructor(private readonly starts: number[]) {}

  /** The line, from 1, that has an offset. */
  private lineAt(offset: number): number {
    let low = 0
    let high = this.starts.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (this.starts[mid]! <= offset) low = mid
      else high = mid - 1
    }
    return low + 1
  }

  private lines(block: { position: { start: number; end: number } }, from: number): { line: number; endLine: number } {
    const line = this.lineAt(from + block.position.start)
    return { line, endLine: Math.max(line, this.lineAt(from + Math.max(block.position.start, block.position.end - 1))) }
  }

  /** The items for some blocks. Those past `length` aren't the text's own. */
  blocks(blocks: Block[], from: number, length = Infinity, tight = false): Item[] {
    return blocks.filter((b) => b.position.start < length).flatMap((b) => this.block(b, from, tight))
  }

  private block(b: Block, from: number, tight: boolean): Item[] {
    const lines = this.lines(b, from)
    switch (b.type) {
      case 'paragraph':
        // A tight list's items hold their text without a paragraph around it.
        return tight ? this.inline(b.children) : [{ tag: 'p', ...lines, children: nest(this.inline(b.children)) }]
      case 'heading':
        return [{ tag: `h${b.depth}`, ...lines, anchor: this.slugs.add(plainText(b.children)), children: nest(this.inline(b.children)) }]
      case 'thematicBreak':
        return [{ tag: 'hr', ...lines, children: [] }]
      case 'blockquote':
        return [{ tag: 'blockquote', ...lines, children: nest(this.blocks(b.children, from)) }]
      case 'list': {
        const attrs = b.ordered && b.start !== undefined && b.start !== 1 ? { attrs: { start: String(b.start) } } : undefined
        return [{ tag: b.ordered ? 'ol' : 'ul', ...lines, ...attrs, children: b.children.map((item) => this.item(item, from, !b.spread)) }]
      }
      case 'code': {
        const text = b.value.replace(/\n$/, '')
        // Fences take lines of their own.
        const fenced = lines.endLine - lines.line + 1 > (b.value ? text.split('\n').length : 0)
        return [{ tag: 'pre', ...lines, code: { ...(b.lang && { lang: b.lang }), text, fenced }, children: [] }]
      }
      case 'html':
        // An empty block holds the place in the source.
        return [{ tag: 'div', ...lines, children: [] }, ...readHtml(b.value)]
      case 'table':
        return [this.table(b, lines)]
    }
  }

  private item(item: ListItem, from: number, tight: boolean): ViewElement {
    const element: ViewElement = { tag: 'li', ...this.lines(item, from), children: nest(this.blocks(item.children, from, Infinity, tight)) }
    if (item.checked !== undefined) {
      element.checked = item.checked
      const box: ViewElement = { tag: 'input', attrs: { type: 'checkbox', ...(item.checked && { checked: '' }) }, children: [] }
      const first = element.children[0]
      ;(typeof first === 'object' && first.tag === 'p' ? first : element).children.unshift(box, ' ')
    }
    return element
  }

  private table(t: Table, lines: { line: number; endLine: number }): ViewElement {
    const [head, ...body] = t.children
    const row = (cells: NonNullable<typeof head>, tag: 'th' | 'td', line: number): ViewElement => ({
      tag: 'tr',
      line,
      endLine: line,
      children: cells.children.map((cell, i) => ({
        tag,
        ...(t.align[i] && { attrs: { align: t.align[i] } }),
        children: nest(this.inline(cell.children)),
      })),
    })
    const { line } = lines
    const children: ViewElement[] = head ? [{ tag: 'thead', line, endLine: line, children: [row(head, 'th', line)] }] : []
    if (body.length) children.push({ tag: 'tbody', line: line + 2, endLine: lines.endLine, children: body.map((r, i) => row(r, 'td', line + 2 + i)) })
    return { tag: 'table', ...lines, children }
  }

  private inline(nodes: Inline[]): Item[] {
    return nodes.flatMap((n): Item[] => {
      switch (n.type) {
        case 'text':
          return [n.value]
        case 'emphasis':
          return [{ tag: 'em', children: nest(this.inline(n.children)) }]
        case 'strong':
          return [{ tag: 'strong', children: nest(this.inline(n.children)) }]
        case 'delete':
          return [{ tag: 's', children: nest(this.inline(n.children)) }]
        case 'inlineCode':
          return [{ tag: 'code', children: [n.value] }]
        case 'break':
          return [{ tag: 'br', children: [] }]
        case 'link':
          return [{ tag: 'a', attrs: { href: n.url, ...(n.title && { title: n.title }) }, children: nest(this.inline(n.children)) }]
        case 'image':
          return [{ tag: 'img', attrs: { src: n.url, alt: n.alt, ...(n.title && { title: n.title }) }, children: [] }]
        case 'inlineHtml':
          return readHtml(n.value)
      }
    })
  }
}

/** A heading's words, without their marks. */
function plainText(nodes: Inline[]): string {
  return nodes.map((n) => ('children' in n ? plainText(n.children) : n.type === 'text' || n.type === 'inlineCode' ? n.value : n.type === 'image' ? n.alt : '')).join('')
}

function frontMatter(front: FrontMatter): ViewNode[] {
  const value = readYaml(front.source)
  const common = { line: 1, endLine: front.lines, frontMatter: true }
  if (value === undefined) return [{ tag: 'pre', ...common, code: { lang: 'yaml', text: front.source, fenced: true }, children: [] }]
  const entries = value === null ? [] : typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : [['', value] as const]
  if (!entries.length) return []
  const rows = entries.map(([key, v]): ViewElement => ({ tag: 'tr', children: [{ tag: 'th', children: [key] }, { tag: 'td', children: cell(v) }] }))
  return [{ tag: 'table', ...common, attrs: { title: 'Frontmatter' }, children: [{ tag: 'tbody', children: rows }] }]
}

function cell(value: Yaml): ViewNode[] {
  if (value === null) return []
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.length ? [{ tag: 'ul', children: value.map((v) => ({ tag: 'li', children: cell(v) })) }] : []
  return [{ tag: 'code', children: [writeYaml(value)] }]
}

/** The line a heading or named anchor is on, for opening a file at `#anchor`. */
export function lineOfAnchor(doc: MarkdownDocument, anchor: string): number | undefined {
  const wanted = anchor.toLowerCase()
  const find = (nodes: ViewNode[], line?: number): number | undefined => {
    for (const node of nodes) {
      if (typeof node === 'string') continue
      const at = node.line ?? line
      if (node.anchor?.toLowerCase() === wanted) return at
      const inside = find(node.children, at)
      if (inside !== undefined) return inside
    }
  }
  return find(doc.nodes)
}
