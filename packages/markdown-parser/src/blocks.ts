// The block phase: reads the text line by line into blocks (quotes, lists,
// headings, code, paragraphs, tables), keeping each leaf block's raw text
// for the inline phase. It follows the spec's appendix, "A parsing strategy".

import type { Align } from './ast.js'
import { unescape } from './entities.js'
import { CLOSETAG, OPENTAG, parseReferences, type Refs } from './inlines.js'
import { CODE_INDENT, isBlank, isSpaceOrTab, Line } from './scanner.js'
import { fitRow, parseDelimiterRow, splitRow } from './tables.js'

/** How deeply quotes and lists may nest. Deeper markers are plain text. */
export const MAX_DEPTH = 24

/**
 * How many empty cells may be added to pad short table rows, across the
 * text. A short row past it ends its table instead, as a paragraph: short
 * rows under a very wide header would otherwise add cells far faster than
 * the text grows.
 */
export const MAX_PADDED_CELLS = 10_000

export type Kind = 'document' | 'blockquote' | 'list' | 'item' | 'heading' | 'thematicBreak' | 'code' | 'html' | 'paragraph' | 'table'

export interface ListData {
  ordered: boolean
  bullet: string
  start: number
  delimiter: string
  padding: number
  markerOffset: number
  tight: boolean
}

/** A block while it's parsed. Lines are numbered from 1. */
export interface BlockNode {
  kind: Kind
  parent: BlockNode | null
  children: BlockNode[]
  open: boolean
  startLine: number
  endLine: number
  /** The raw text of a paragraph, heading, code or HTML block. */
  content: string
  list?: ListData
  level?: number
  fenced?: boolean
  fenceChar?: string
  fenceLength?: number
  fenceOffset?: number
  info?: string
  htmlType?: number
  align?: Align[]
  /** A table's rows of raw cell text, the header first. */
  rows?: string[][]
}

const RE_HTML_OPEN = [
  /./, // no type 0
  /^<(?:script|pre|textarea|style)(?:\s|>|$)/i,
  /^<!--/,
  /^<[?]/,
  /^<![A-Za-z]/,
  /^<!\[CDATA\[/,
  /^<[/]?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[123456]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|[/]?[>]|$)/i,
  new RegExp('^(?:' + OPENTAG + '|' + CLOSETAG + ')\\s*$', 'i'),
]
const RE_HTML_CLOSE = [/./, /<\/(?:script|pre|textarea|style)>/i, /-->/, /\?>/, />/, /\]\]>/]
const RE_THEMATIC_BREAK = /^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:-[ \t]*){3,}$/
const RE_MAYBE_SPECIAL = /^[#`~*+_=<>0-9-]/
const RE_BULLET = /^[*+-]/
const RE_ORDERED = /^(\d{1,9})([.)])/
const RE_ATX = /^#{1,6}(?:[ \t]+|$)/
const RE_FENCE = /^`{3,}(?!.*`)|^~{3,}/
const RE_CLOSING_FENCE = /^(?:`{3,}|~{3,})(?=[ \t]*$)/
const RE_SETEXT = /^(?:=+|-+)[ \t]*$/
const RE_MAYBE_DELIMITER_ROW = /^[ \t|:-]*-[ \t|:-]*$/
/** While streaming, a last line of one or two - or = is still being written. */
const RE_PARTIAL_UNDERLINE = /^ {0,3}(?:-{1,2}|={1,2})[ \t]*$/

export interface BlockOptions {
  /** The text is an answer still streaming in. */
  streaming?: boolean
}

export class BlockParser {
  doc: BlockNode = block('document', null, 1)
  tip: BlockNode = this.doc
  private oldTip: BlockNode = this.doc
  private lastMatched: BlockNode = this.doc
  private allClosed = true
  private line = new Line()
  private lineNumber = 0
  private lineCount = 0
  private streaming: boolean
  /** Empty cells added to short table rows so far (MAX_PADDED_CELLS). */
  private paddedCells = 0

  constructor(
    private refs: Refs,
    opts: BlockOptions = {},
  ) {
    this.streaming = !!opts.streaming
  }

  parse(lines: string[]): BlockNode {
    let n = lines.length
    if (this.streaming && n > 1 && RE_PARTIAL_UNDERLINE.test(lines[n - 1]!)) n--
    this.lineCount = n
    for (let i = 0; i < n; i++) this.incorporateLine(lines[i]!)
    while (this.tip !== this.doc) this.finalize(this.tip, n)
    this.finalize(this.doc, n)
    return this.doc
  }

  private incorporateLine(text: string): void {
    const line = this.line
    let container = this.doc
    this.oldTip = this.tip
    this.lineNumber++
    line.reset(text)

    // 1. Each open container this line continues.
    for (;;) {
      const last = container.children[container.children.length - 1]
      if (!last || !last.open) break
      container = last
      line.findNextNonspace()
      const r = this.continues(container)
      if (r === 2) return // a closing code fence: the line is used up
      if (r === 1) {
        container = container.parent!
        break
      }
    }
    this.allClosed = container === this.oldTip
    this.lastMatched = container

    // 2. A table's delimiter row turns the paragraph's last line into its header.
    if (container.kind === 'paragraph' && this.allClosed) {
      line.findNextNonspace()
      if (!line.indented && this.tryTable(container)) return
    }

    // 3. New blocks this line starts.
    let matchedLeaf = container.kind !== 'paragraph' && container.kind !== 'table' && acceptsLines(container.kind)
    while (!matchedLeaf) {
      line.findNextNonspace()
      if (!line.indented && !RE_MAYBE_SPECIAL.test(text.charAt(line.nextNonspace))) {
        line.advanceNextNonspace()
        break
      }
      const res = this.tryStarts(container)
      if (res === 0) {
        line.advanceNextNonspace()
        break
      }
      container = this.tip
      if (res === 2) matchedLeaf = true
    }

    // 4. What's left is text: a lazy continuation of an open paragraph, or
    // a line of the container it's in.
    if (!this.allClosed && !line.blank && this.tip.kind === 'paragraph') {
      this.addLine()
    } else {
      this.closeUnmatched()
      if (container.kind === 'table') {
        if (!line.blank) {
          const t = container
          const cells = splitRow(line.rest())
          const padding = Math.max(0, t.align!.length - cells.length)
          if (this.paddedCells + padding > MAX_PADDED_CELLS) {
            this.addChild('paragraph')
            line.advanceNextNonspace()
            this.addLine()
          } else {
            this.paddedCells += padding
            t.rows!.push(fitRow(cells, t.align!.length))
            t.endLine = this.lineNumber
          }
        }
      } else if (acceptsLines(container.kind)) {
        this.addLine()
        const type = container.htmlType ?? 0
        if (container.kind === 'html' && type >= 1 && type <= 5 && RE_HTML_CLOSE[type]!.test(text.slice(line.offset))) {
          this.finalize(container, this.lineNumber)
        }
      } else if (line.offset < text.length && !line.blank) {
        this.addChild('paragraph')
        line.advanceNextNonspace()
        this.addLine()
      }
    }
  }

  /** 0: the line continues the block. 1: it doesn't. 2: it ends it and is used up. */
  private continues(b: BlockNode): 0 | 1 | 2 {
    const line = this.line
    switch (b.kind) {
      case 'document':
      case 'list':
        return 0
      case 'blockquote':
        if (!line.indented && line.at(line.nextNonspace) === 62) {
          line.advanceNextNonspace()
          line.advance(1, false)
          if (isSpaceOrTab(line.at(line.offset))) line.advance(1, true)
          return 0
        }
        return 1
      case 'item': {
        const l = b.list!
        if (line.indent >= l.markerOffset + l.padding) {
          line.advance(l.markerOffset + l.padding, true)
        } else if (line.blank && b.children.length > 0) {
          line.advanceNextNonspace()
        } else {
          return 1
        }
        return 0
      }
      case 'heading':
      case 'thematicBreak':
        return 1
      case 'code':
        if (b.fenced) {
          const rest = line.text.slice(line.nextNonspace)
          const m = line.indent <= 3 && rest.charAt(0) === b.fenceChar ? RE_CLOSING_FENCE.exec(rest) : null
          if (m && m[0].length >= b.fenceLength!) {
            this.finalize(b, this.lineNumber)
            return 2
          }
          for (let i = b.fenceOffset!; i > 0 && isSpaceOrTab(line.at(line.offset)); i--) line.advance(1, true)
          return 0
        }
        if (line.indent >= CODE_INDENT) line.advance(CODE_INDENT, true)
        else if (line.blank) line.advanceNextNonspace()
        else return 1
        return 0
      case 'html':
        return line.blank && (b.htmlType === 6 || b.htmlType === 7) ? 1 : 0
      case 'paragraph':
      case 'table':
        return line.blank ? 1 : 0
    }
  }

  /** Tries each kind of block start: 0 none, 1 a container, 2 a leaf. */
  private tryStarts(container: BlockNode): 0 | 1 | 2 {
    const line = this.line
    const text = line.text
    const rest = text.slice(line.nextNonspace)
    const deep = depth(container) >= MAX_DEPTH

    // Block quote.
    if (!line.indented && !deep && line.at(line.nextNonspace) === 62) {
      line.advanceNextNonspace()
      line.advance(1, false)
      if (isSpaceOrTab(line.at(line.offset))) line.advance(1, true)
      this.closeUnmatched()
      this.addChild('blockquote')
      return 1
    }

    // ATX heading.
    let m: RegExpExecArray | null
    if (!line.indented && (m = RE_ATX.exec(rest))) {
      line.advanceNextNonspace()
      line.advance(m[0].length, false)
      this.closeUnmatched()
      const h = this.addChild('heading')
      h.level = m[0].trim().length
      h.content = text.slice(line.offset).replace(/^[ \t]*#+[ \t]*$/, '').replace(/[ \t]+#+[ \t]*$/, '')
      line.advance(text.length - line.offset, false)
      return 2
    }

    // Fenced code.
    if (!line.indented && (m = RE_FENCE.exec(rest))) {
      const length = m[0].length
      this.closeUnmatched()
      const c = this.addChild('code')
      c.fenced = true
      c.fenceLength = length
      c.fenceChar = m[0][0]
      c.fenceOffset = line.indent
      line.advanceNextNonspace()
      line.advance(length, false)
      return 2
    }

    // HTML block.
    if (!line.indented && line.at(line.nextNonspace) === 60) {
      for (let type = 1; type <= 7; type++) {
        const lazy = !this.allClosed && !line.blank && this.tip.kind === 'paragraph'
        if (RE_HTML_OPEN[type]!.test(rest) && (type < 7 || (container.kind !== 'paragraph' && !lazy))) {
          this.closeUnmatched()
          // The spaces before it are part of the block.
          const b = this.addChild('html')
          b.htmlType = type
          return 2
        }
      }
    }

    // Setext heading: an underline below a paragraph.
    if (!line.indented && container.kind === 'paragraph' && (m = RE_SETEXT.exec(rest))) {
      this.closeUnmatched()
      // Link reference definitions at its start stay a paragraph of their own.
      const defs = parseReferences(container.content, new Map())
      if (container.content.length > defs) {
        const defLines = container.content.slice(0, defs).split('\n').length - 1
        const h = block('heading', container.parent, container.startLine + defLines)
        h.level = m[0][0] === '=' ? 1 : 2
        h.content = container.content.slice(defs)
        const siblings = container.parent!.children
        const i = siblings.indexOf(container)
        if (defs > 0) {
          container.content = container.content.slice(0, defs)
          container.open = false
          container.endLine = container.startLine + defLines - 1
          siblings.splice(i + 1, 0, h)
        } else {
          siblings[i] = h
        }
        this.tip = h
        line.advance(text.length - line.offset, false)
        return 2
      }
      return 0
    }

    // Thematic break.
    if (!line.indented && RE_THEMATIC_BREAK.test(rest)) {
      this.closeUnmatched()
      this.addChild('thematicBreak')
      line.advance(text.length - line.offset, false)
      return 2
    }

    // List item.
    if ((!line.indented || container.kind === 'list') && !deep) {
      const data = this.parseListMarker(container)
      if (data) {
        this.closeUnmatched()
        if (this.tip.kind !== 'list' || !listsMatch(container.list, data)) this.addChild('list').list = data
        this.addChild('item').list = data
        return 1
      }
    }

    // Indented code.
    if (line.indented && this.tip.kind !== 'paragraph' && !line.blank) {
      line.advance(CODE_INDENT, true)
      this.closeUnmatched()
      this.addChild('code')
      return 2
    }

    return 0
  }

  private parseListMarker(container: BlockNode): ListData | undefined {
    const line = this.line
    if (line.indent >= 4) return undefined
    const rest = line.text.slice(line.nextNonspace)
    const data: ListData = { ordered: false, bullet: '', start: 1, delimiter: '', padding: 0, markerOffset: line.indent, tight: true }
    let m: RegExpExecArray | null
    if ((m = RE_BULLET.exec(rest))) {
      data.bullet = m[0]
    } else if ((m = RE_ORDERED.exec(rest)) && (container.kind !== 'paragraph' || m[1] === '1')) {
      data.ordered = true
      data.start = parseInt(m[1]!, 10)
      data.delimiter = m[2]!
    } else {
      return undefined
    }
    const markerLength = m[0].length
    const after = line.at(line.nextNonspace + markerLength)
    if (!(after === -1 || after === 9 || after === 32)) return undefined
    // Interrupting a paragraph needs a non-empty first line.
    if (container.kind === 'paragraph' && isBlank(line.text.slice(line.nextNonspace + markerLength))) return undefined

    line.advanceNextNonspace()
    line.advance(markerLength, true)
    const spacesStartCol = line.column
    const spacesStartOffset = line.offset
    do {
      line.advance(1, true)
    } while (line.column - spacesStartCol < 5 && isSpaceOrTab(line.at(line.offset)))
    const blankItem = line.at(line.offset) === -1
    const spaces = line.column - spacesStartCol
    if (spaces >= 5 || spaces < 1 || blankItem) {
      data.padding = markerLength + 1
      line.column = spacesStartCol
      line.offset = spacesStartOffset
      line.partialTab = false
      if (isSpaceOrTab(line.at(line.offset))) line.advance(1, true)
    } else {
      data.padding = markerLength + spaces
    }
    return data
  }

  /**
   * tryTable checks whether this line is a delimiter row for the
   * paragraph's last line. If so, that line becomes a table's header.
   */
  private tryTable(p: BlockNode): boolean {
    const line = this.line
    const delimiter = line.text.slice(line.nextNonspace)
    if (!RE_MAYBE_DELIMITER_ROW.test(delimiter)) return false
    // The header is the paragraph's last line. Its content ends with "\n".
    const cut = p.content.lastIndexOf('\n', p.content.length - 2)
    const header = p.content.slice(cut + 1, -1)
    if (!header.includes('|') && !delimiter.includes('|')) return false
    const partial = this.streaming && this.lineNumber === this.lineCount
    const align = parseDelimiterRow(delimiter, partial)
    if (!align) return false
    const cells = splitRow(header)
    if (align.length !== cells.length) {
      if (!partial || align.length > cells.length) return false
      while (align.length < cells.length) align.push(null)
    }

    const table = block('table', p.parent, this.lineNumber - 1)
    table.align = align
    table.rows = [cells]
    table.endLine = this.lineNumber
    const siblings = p.parent!.children
    const i = siblings.indexOf(p)
    if (cut !== -1) {
      p.content = p.content.slice(0, cut + 1)
      p.open = false
      p.endLine = this.lineNumber - 2
      siblings.splice(i + 1, 0, table)
    } else {
      siblings[i] = table
    }
    this.tip = table
    return true
  }

  private addLine(): void {
    this.tip.content += this.line.rest() + '\n'
  }

  private addChild(kind: Kind): BlockNode {
    while (!canContain(this.tip.kind, kind)) this.finalize(this.tip, this.lineNumber - 1)
    const b = block(kind, this.tip, this.lineNumber)
    this.tip.children.push(b)
    this.tip = b
    return b
  }

  private closeUnmatched(): void {
    if (this.allClosed) return
    while (this.oldTip !== this.lastMatched) {
      const parent = this.oldTip.parent!
      this.finalize(this.oldTip, this.lineNumber - 1)
      this.oldTip = parent
    }
    this.allClosed = true
  }

  private finalize(b: BlockNode, lineNumber: number): void {
    b.open = false
    if (b.kind !== 'table') b.endLine = lineNumber
    switch (b.kind) {
      case 'document':
        this.takeReferences(b)
        break
      case 'list': {
        b.list!.tight = !isLoose(b)
        const last = b.children[b.children.length - 1]
        if (last) b.endLine = last.endLine
        break
      }
      case 'item': {
        const last = b.children[b.children.length - 1]
        b.endLine = last ? last.endLine : b.startLine
        break
      }
      case 'code':
        if (b.fenced) {
          const nl = b.content.indexOf('\n')
          b.info = unescape(b.content.slice(0, nl)).trim()
          b.content = b.content.slice(nl + 1)
        } else {
          const lines = b.content.split('\n')
          while (lines.length > 0 && /^[ \t]*$/.test(lines[lines.length - 1]!)) lines.pop()
          b.content = lines.join('\n') + '\n'
          b.endLine = b.startLine + lines.length - 1
        }
        break
      case 'html':
        b.content = b.content.replace(/\n$/, '')
        break
    }
    this.tip = b.parent ?? this.doc
  }

  /** takeReferences moves link reference definitions out of paragraphs, in document order. */
  private takeReferences(root: BlockNode): void {
    const stack: BlockNode[] = [root]
    while (stack.length) {
      const b = stack.pop()!
      for (let i = b.children.length - 1; i >= 0; i--) stack.push(b.children[i]!)
      if (b.kind !== 'paragraph' || b.content.charCodeAt(0) !== 91) continue
      const taken = parseReferences(b.content, this.refs)
      if (taken === 0) continue
      b.startLine += b.content.slice(0, taken).split('\n').length - 1
      b.content = b.content.slice(taken)
      if (isBlank(b.content)) {
        const siblings = b.parent!.children
        siblings.splice(siblings.indexOf(b), 1)
      }
    }
  }
}

function block(kind: Kind, parent: BlockNode | null, line: number): BlockNode {
  return { kind, parent, children: [], open: true, startLine: line, endLine: line, content: '' }
}

function acceptsLines(kind: Kind): boolean {
  return kind === 'paragraph' || kind === 'code' || kind === 'html'
}

function canContain(parent: Kind, child: Kind): boolean {
  switch (parent) {
    case 'document':
    case 'blockquote':
    case 'item':
      return child !== 'item'
    case 'list':
      return child === 'item'
    default:
      return false
  }
}

function depth(b: BlockNode): number {
  let n = 0
  for (let p = b.parent; p; p = p.parent) n++
  return n
}

function listsMatch(a: ListData | undefined, b: ListData): boolean {
  return !!a && a.ordered === b.ordered && a.delimiter === b.delimiter && a.bullet === b.bullet
}

/** A block followed by a blank line before its next sibling. */
function endsWithBlankLine(b: BlockNode, next: BlockNode | undefined): boolean {
  return !!next && b.endLine !== next.startLine - 1
}

/** A list is loose when its items, or the blocks in them, are separated by blank lines. */
function isLoose(list: BlockNode): boolean {
  const items = list.children
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (endsWithBlankLine(item, items[i + 1])) return true
    for (let j = 0; j < item.children.length; j++) {
      if (endsWithBlankLine(item.children[j]!, item.children[j + 1])) return true
    }
  }
  return false
}
