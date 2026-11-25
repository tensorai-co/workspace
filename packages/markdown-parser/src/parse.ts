import type * as A from './ast.js'
import { BlockParser, type BlockNode } from './blocks.js'
import { parseInlines, type Refs } from './inlines.js'

/**
 * MAX_LENGTH is the most text parsed as Markdown. Anything past it is a
 * plain-text paragraph, so a huge input can't stall the page.
 */
export const MAX_LENGTH = 100_000

export interface ParseOptions {
  /**
   * The text is an answer still streaming in. Its last block is finished as
   * it would most likely end: an open code span, emphasis or strikethrough
   * closes at the end; a link still being written shows as its text; an
   * image still being written, and a lone "-" or "=" on the last line (a
   * list or underline about to start), show nothing yet. A table shows as
   * soon as its delimiter row starts.
   */
  streaming?: boolean
}

/**
 * parse turns Markdown into a syntax tree: CommonMark, plus GitHub's
 * tables, task lists, strikethrough and extended autolinks. Raw HTML stays in
 * the tree as html and inlineHtml nodes, which renderers show as text.
 */
export function parse(text: string, opts: ParseOptions = {}): A.Root {
  const head = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH) : text
  const { lines, starts } = splitLines(head.indexOf('\0') === -1 ? head : head.replace(/\0/g, '�'))
  const refs: Refs = new Map()
  const doc = new BlockParser(refs, opts).parse(lines)

  const c = new Converter(refs, lines, starts)
  if (opts.streaming && lines.length > 0 && /\S/.test(lines[lines.length - 1]!)) c.healing = lastLeaf(doc, lines.length)
  const root: A.Root = { type: 'root', children: doc.children.map((b) => c.block(b)) }
  if (head.length < text.length) {
    root.children.push({ type: 'paragraph', position: { start: head.length, end: text.length }, children: [{ type: 'text', value: text.slice(head.length) }] })
  }
  return root
}

/** splitLines splits on \n, \r\n and \r, noting where each line starts. A final line ending adds no line. */
function splitLines(text: string): { lines: string[]; starts: number[] } {
  const lines: string[] = []
  const starts: number[] = []
  let i = 0
  while (i < text.length) {
    let j = i
    while (j < text.length && text.charCodeAt(j) !== 10 && text.charCodeAt(j) !== 13) j++
    lines.push(text.slice(i, j))
    starts.push(i)
    if (j < text.length && text.charCodeAt(j) === 13 && text.charCodeAt(j + 1) === 10) j++
    i = j + 1
  }
  return { lines, starts }
}

/** lastLeaf is the leaf block holding the last line, if it's one with inlines. */
function lastLeaf(doc: BlockNode, lineCount: number): BlockNode | undefined {
  let b: BlockNode | undefined = doc.children[doc.children.length - 1]
  while (b && b.children.length > 0 && b.kind !== 'table') b = b.children[b.children.length - 1]
  if (!b || b.endLine !== lineCount) return undefined
  return b.kind === 'paragraph' || b.kind === 'heading' || b.kind === 'table' ? b : undefined
}

const TASK = /^\[([ xX])\][ \t]+(?=\S)/

class Converter {
  /** The block whose inlines are healed, while streaming. */
  healing?: BlockNode

  constructor(
    private refs: Refs,
    private lines: string[],
    private starts: number[],
  ) {}

  private span(b: BlockNode): A.Position {
    const first = Math.min(Math.max(b.startLine, 1), this.lines.length)
    const last = Math.min(Math.max(b.endLine, first), this.lines.length)
    if (first === 0) return { start: 0, end: 0 }
    return { start: this.starts[first - 1]!, end: this.starts[last - 1]! + this.lines[last - 1]!.length }
  }

  private inlines(text: string, b: BlockNode): A.Inline[] {
    return parseInlines(text, this.refs, b === this.healing)
  }

  block(b: BlockNode): A.Block {
    const position = this.span(b)
    switch (b.kind) {
      case 'paragraph':
        return { type: 'paragraph', position, children: this.inlines(b.content, b) }
      case 'heading':
        return { type: 'heading', depth: b.level as A.Heading['depth'], position, children: this.inlines(b.content, b) }
      case 'thematicBreak':
        return { type: 'thematicBreak', position }
      case 'blockquote':
        return { type: 'blockquote', position, children: b.children.map((c) => this.block(c)) }
      case 'list': {
        const l = b.list!
        const list: A.List = { type: 'list', ordered: l.ordered, spread: !l.tight, position, children: b.children.map((c) => this.item(c)) }
        if (l.ordered) list.start = l.start
        return list
      }
      case 'code': {
        const code: A.Code = { type: 'code', position, value: b.content }
        const info = b.info ?? ''
        const word = info.match(/^\S+/)?.[0]
        if (word) {
          code.lang = word
          const meta = info.slice(word.length).trim()
          if (meta) code.meta = meta
        }
        return code
      }
      case 'html':
        return { type: 'html', position, value: b.content }
      case 'table': {
        const rows = b.rows!
        const lastRow = rows.length - 1
        return {
          type: 'table',
          align: b.align!,
          position,
          children: rows.map((cells, r) => ({
            type: 'tableRow',
            children: cells.map((cell, i) => ({
              type: 'tableCell',
              // Only the last cell of a table still being written can be unfinished.
              children: parseInlines(cell, this.refs, b === this.healing && r === lastRow && i === cells.length - 1),
            })),
          })),
        }
      }
      default:
        // The parser never gives a document or item here.
        return { type: 'paragraph', position, children: [] }
    }
  }

  private item(b: BlockNode): A.ListItem {
    const item: A.ListItem = { type: 'listItem', position: this.span(b), children: [] }
    // A task list item: "[ ]" or "[x]" and a space at the start of its text.
    const first = b.children[0]
    if (first?.kind === 'paragraph') {
      const m = TASK.exec(first.content)
      if (m) {
        item.checked = m[1] !== ' '
        first.content = first.content.slice(m[0].length)
      }
    }
    item.children = b.children.map((c) => this.block(c))
    return item
  }
}
