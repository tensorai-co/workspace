// The inline phase: turns a paragraph's or heading's text into inline nodes.
// It follows the spec's appendix: a delimiter stack for emphasis and
// strikethrough, a bracket stack for links and images.

import type * as A from './ast.js'
import { encodeUrl } from './url.js'
import { decodeEntity, ENTITY, unescape } from './entities.js'
import { charAt, charBefore, isEscapable, isPunctuation, isUnicodeWhitespace } from './scanner.js'

/** Link reference definitions, by normalized label. */
export type Refs = Map<string, { url: string; title?: string }>

/** How deeply inlines may nest (emphasis in links in emphasis…) before the rest is plain text. */
const MAX_INLINE_DEPTH = 32

// Character codes.
const C_NEWLINE = 10
const C_BANG = 33
const C_AMP = 38
const C_OPEN_PAREN = 40
const C_CLOSE_PAREN = 41
const C_STAR = 42
const C_COLON = 58
const C_LT = 60
const C_OPEN_BRACKET = 91
const C_BACKSLASH = 92
const C_CLOSE_BRACKET = 93
const C_UNDERSCORE = 95
const C_BACKTICK = 96
const C_TILDE = 126

/** The most nested parentheses a link destination may hold, as cmark allows (the spec asks for at least 3). */
const MAX_LINK_PARENS = 32

const ESCAPABLE = "[!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]"
const ESCAPED_CHAR = '\\\\' + ESCAPABLE

// Sticky patterns: each matches at lastIndex only, so nothing is sliced.
const RE_MAIN = /[^\n`[\]\\!<&*_~]+/y
const RE_TICKS = /`+/y
const RE_TICKS_ANYWHERE = /`+/g
const RE_SPNL = / *(?:\n *)?/y
const RE_INITIAL_SPACE = / */y
const RE_SPACE_AT_END_OF_LINE = / *(?:\n|$)/y
const RE_LINK_LABEL = /\[(?:[^\\[\]]|\\.){0,1000}\]/sy
const RE_DEST_BRACES = /<(?:[^<>\n\\\x00]|\\.)*>/y
const RE_LINK_TITLE = new RegExp(
  '"(?:' + ESCAPED_CHAR + '|\\\\[^\\\\]|[^\\\\"\\x00])*"' +
    "|'(?:" + ESCAPED_CHAR + "|\\\\[^\\\\]|[^\\\\'\\x00])*'" +
    '|\\((?:' + ESCAPED_CHAR + '|\\\\[^\\\\]|[^\\\\()\\x00])*\\)',
  'y',
)
const RE_EMAIL_AUTOLINK =
  /<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/y
const RE_AUTOLINK = /<([A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\x00-\x20]*)>/y

// Raw HTML, as the spec defines it. Matched only to know where it ends: it
// becomes an inlineHtml node, which renders as text.
const TAGNAME = '[A-Za-z][A-Za-z0-9-]*'
const ATTRIBUTE = '(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^"\'=<>`\\x00-\\x20]+|\'[^\']*\'|"[^"]*"))?)'
export const OPENTAG = '<' + TAGNAME + ATTRIBUTE + '*\\s*/?>'
export const CLOSETAG = '</' + TAGNAME + '\\s*[>]'
const RE_HTML_TAG = new RegExp(
  '(?:' + OPENTAG + '|' + CLOSETAG + '|<!-->|<!--->|<!--[\\s\\S]*?-->|[<][?][\\s\\S]*?[?][>]|<![A-Za-z]+[^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)',
  'y',
)

/** normalizeLabel is a link label as references are matched: trimmed, spaces collapsed, case-folded. */
export function normalizeLabel(label: string): string {
  const s = label.slice(1, -1).trim().replace(/[ \t\r\n]+/g, ' ')
  // Dotless i has no case folding of its own; folding around it keeps it apart from i.
  if (s.indexOf('\u0131') === -1) return s.toLowerCase().toUpperCase()
  return s.replace(/[^\u0131]+/g, (part) => part.toLowerCase().toUpperCase())
}

// The tree while it's being built: linked, so emphasis can be wrapped around
// a run of siblings cheaply.
class N {
  type: string
  value = ''
  url = ''
  title?: string
  parent: N | null = null
  first: N | null = null
  last: N | null = null
  prev: N | null = null
  next: N | null = null

  constructor(type: string, value = '') {
    this.type = type
    this.value = value
  }

  append(child: N): void {
    child.unlink()
    child.parent = this
    if (this.last) {
      this.last.next = child
      child.prev = this.last
    } else {
      this.first = child
    }
    this.last = child
  }

  insertAfter(sibling: N): void {
    sibling.unlink()
    sibling.next = this.next
    if (sibling.next) sibling.next.prev = sibling
    sibling.prev = this
    this.next = sibling
    sibling.parent = this.parent
    if (this.parent && !sibling.next) this.parent.last = sibling
  }

  unlink(): void {
    if (this.prev) this.prev.next = this.next
    else if (this.parent) this.parent.first = this.next
    if (this.next) this.next.prev = this.prev
    else if (this.parent) this.parent.last = this.prev
    this.parent = this.prev = this.next = null
  }
}

interface Delimiter {
  cc: number
  count: number
  origCount: number
  node: N
  prev: Delimiter | null
  next: Delimiter | null
  canOpen: boolean
  canClose: boolean
}

interface Bracket {
  node: N
  prev: Bracket | null
  prevDelimiter: Delimiter | null
  index: number
  image: boolean
  /** Its place in the order brackets opened. */
  seq: number
  bracketAfter: boolean
}

class InlineParser {
  subject = ''
  pos = 0
  delimiters: Delimiter | null = null
  brackets: Bracket | null = null
  /** Where the subject's last ")" is: a link opened after it can't be finished yet. */
  private lastCloseParen = -1
  /** Brackets opened so far. */
  private seq = 0
  /**
   * Link openers before this one can't make links: a link closed after
   * them, and links can't hold links. Images still can.
   */
  private linksFrom = 0

  constructor(
    private refs: Refs,
    /** The text is the end of a stream that's still arriving: finish what's unfinished. */
    private heal = false,
  ) {}

  /** Matches a sticky pattern at pos, moving past it. */
  private match(re: RegExp): string | null {
    re.lastIndex = this.pos
    const m = re.exec(this.subject)
    if (!m) return null
    this.pos = re.lastIndex
    return m[0]
  }

  private peek(): number {
    return this.pos < this.subject.length ? this.subject.charCodeAt(this.pos) : -1
  }

  private spnl(): void {
    this.match(RE_SPNL)
  }

  parse(text: string): N {
    const block = new N('root')
    this.subject = trimLineEnds(text)
    this.pos = 0
    this.delimiters = null
    this.brackets = null
    this.lastCloseParen = this.subject.lastIndexOf(')')
    this.seq = this.linksFrom = 0
    while (this.parseInline(block)) {}
    this.processEmphasis(null, block)
    return block
  }

  private parseInline(block: N): boolean {
    const c = this.peek()
    if (c === -1) return false
    let ok = false
    switch (c) {
      case C_NEWLINE:
        ok = this.parseNewline(block)
        break
      case C_BACKSLASH:
        ok = this.parseBackslash(block)
        break
      case C_BACKTICK:
        ok = this.parseBackticks(block)
        break
      case C_STAR:
      case C_UNDERSCORE:
      case C_TILDE:
        ok = this.handleDelim(c, block)
        break
      case C_OPEN_BRACKET:
        ok = this.parseOpenBracket(block)
        break
      case C_BANG:
        ok = this.parseBang(block)
        break
      case C_CLOSE_BRACKET:
        ok = this.parseCloseBracket(block)
        break
      case C_LT:
        ok = this.parseAutolink(block) || this.parseHtmlTag(block)
        break
      case C_AMP:
        ok = this.parseEntity(block)
        break
      default:
        ok = this.parseString(block)
    }
    if (!ok) {
      this.pos++
      block.append(new N('text', String.fromCharCode(c)))
    }
    return true
  }

  private parseNewline(block: N): boolean {
    this.pos++
    const last = block.last
    let hard = false
    if (last && last.type === 'text' && last.value.endsWith(' ')) {
      hard = last.value.endsWith('  ')
      last.value = last.value.replace(/ +$/, '')
    }
    block.append(hard ? new N('break') : new N('text', '\n'))
    this.match(RE_INITIAL_SPACE)
    return true
  }

  private parseBackslash(block: N): boolean {
    this.pos++
    const next = this.subject.charAt(this.pos)
    if (next === '\n') {
      this.pos++
      block.append(new N('break'))
    } else if (isEscapable(next)) {
      this.pos++
      block.append(new N('text', next))
    } else {
      block.append(new N('text', '\\'))
    }
    return true
  }

  private parseBackticks(block: N): boolean {
    const ticks = this.match(RE_TICKS)
    if (ticks === null) return false
    const after = this.pos
    RE_TICKS_ANYWHERE.lastIndex = after
    let m: RegExpExecArray | null
    while ((m = RE_TICKS_ANYWHERE.exec(this.subject))) {
      if (m[0].length === ticks.length) {
        this.pos = m.index + m[0].length
        block.append(new N('inlineCode', codeSpanText(this.subject.slice(after, m.index))))
        return true
      }
    }
    // No closing run. While streaming, the span is still being written:
    // show it as code to the end.
    if (this.heal && /[^ \n]/.test(this.subject.slice(after))) {
      this.pos = this.subject.length
      block.append(new N('inlineCode', codeSpanText(this.subject.slice(after))))
      return true
    }
    this.pos = after
    block.append(new N('text', ticks))
    return true
  }

  private parseAutolink(block: N): boolean {
    let m = this.match(RE_EMAIL_AUTOLINK)
    let url: string | undefined
    if (m) {
      const addr = m.slice(1, -1)
      url = 'mailto:' + addr
      const link = new N('link')
      link.url = encodeUrl(url)
      link.append(new N('text', addr))
      block.append(link)
      return true
    }
    m = this.match(RE_AUTOLINK)
    if (m) {
      const dest = m.slice(1, -1)
      const link = new N('link')
      link.url = encodeUrl(dest)
      link.append(new N('text', dest))
      block.append(link)
      return true
    }
    return false
  }

  private parseHtmlTag(block: N): boolean {
    const m = this.match(RE_HTML_TAG)
    if (m === null) return false
    block.append(new N('inlineHtml', m))
    return true
  }

  private parseEntity(block: N): boolean {
    const m = this.match(ENTITY)
    if (m === null) return false
    const decoded = decodeEntity(m)
    if (decoded === undefined) {
      this.pos -= m.length
      return false
    }
    block.append(new N('text', decoded))
    return true
  }

  private parseString(block: N): boolean {
    const m = this.match(RE_MAIN)
    if (m === null) return false
    block.append(new N('text', m))
    return true
  }

  // Emphasis and strikethrough.

  private scanDelims(cc: number): { count: number; canOpen: boolean; canClose: boolean } | null {
    const start = this.pos
    let count = 0
    while (this.peek() === cc) {
      count++
      this.pos++
    }
    if (count === 0) return null
    const before = charBefore(this.subject, start)
    const after = charAt(this.subject, this.pos)
    this.pos = start
    const afterSpace = isUnicodeWhitespace(after)
    const afterPunct = isPunctuation(after)
    const beforeSpace = isUnicodeWhitespace(before)
    const beforePunct = isPunctuation(before)
    const left = !afterSpace && (!afterPunct || beforeSpace || beforePunct)
    const right = !beforeSpace && (!beforePunct || afterSpace || afterPunct)
    if (cc === C_UNDERSCORE) {
      return { count, canOpen: left && (!right || beforePunct), canClose: right && (!left || afterPunct) }
    }
    if (cc === C_TILDE && count > 2) return { count, canOpen: false, canClose: false }
    return { count, canOpen: left, canClose: right }
  }

  private handleDelim(cc: number, block: N): boolean {
    const res = this.scanDelims(cc)
    if (!res) return false
    const start = this.pos
    this.pos += res.count
    const node = new N('text', this.subject.slice(start, this.pos))
    block.append(node)
    if (res.canOpen || res.canClose) {
      this.delimiters = {
        cc,
        count: res.count,
        origCount: res.count,
        node,
        prev: this.delimiters,
        next: null,
        canOpen: res.canOpen,
        canClose: res.canClose,
      }
      if (this.delimiters.prev) this.delimiters.prev.next = this.delimiters
    }
    return true
  }

  private removeDelimiter(d: Delimiter): void {
    if (d.prev) d.prev.next = d.next
    if (d.next) d.next.prev = d.prev
    else this.delimiters = d.prev
  }

  private processEmphasis(bottom: Delimiter | null, block?: N): void {
    // The lowest opener worth looking at, per closer kind (see the spec's
    // "openers_bottom"): asterisks and underscores by length mod 3 and
    // whether the closer can open; tildes by length.
    const openersBottom = new Map<string, Delimiter | null>()
    const bottomKey = (d: Delimiter) => (d.cc === C_TILDE ? `~${d.origCount}` : `${d.cc}:${d.canOpen ? 1 : 0}:${d.origCount % 3}`)

    let closer = this.delimiters
    while (closer !== null && closer.prev !== bottom) closer = closer.prev

    while (closer !== null) {
      if (!closer.canClose) {
        closer = closer.next
        continue
      }
      const key = bottomKey(closer)
      const floor = openersBottom.has(key) ? openersBottom.get(key)! : bottom
      let opener = closer.prev
      let found = false
      while (opener !== null && opener !== bottom && opener !== floor) {
        if (opener.cc === closer.cc && opener.canOpen) {
          if (closer.cc === C_TILDE) {
            if (opener.origCount === closer.origCount) {
              found = true
              break
            }
          } else {
            const oddMatch =
              (closer.canOpen || opener.canClose) &&
              closer.origCount % 3 !== 0 &&
              (opener.origCount + closer.origCount) % 3 === 0
            if (!oddMatch) {
              found = true
              break
            }
          }
        }
        opener = opener.prev
      }
      const oldCloser = closer
      if (!found || opener === null) {
        closer = closer.next
        openersBottom.set(key, oldCloser.prev)
        if (!oldCloser.canOpen) this.removeDelimiter(oldCloser)
        continue
      }
      const used = closer.cc === C_TILDE ? closer.count : closer.count >= 2 && opener.count >= 2 ? 2 : 1
      const type = closer.cc === C_TILDE ? 'delete' : used === 1 ? 'emphasis' : 'strong'
      opener.count -= used
      closer.count -= used
      opener.node.value = opener.node.value.slice(0, opener.node.value.length - used)
      closer.node.value = closer.node.value.slice(0, closer.node.value.length - used)
      const wrap = new N(type)
      let tmp = opener.node.next
      while (tmp && tmp !== closer.node) {
        const next = tmp.next
        wrap.append(tmp)
        tmp = next
      }
      opener.node.insertAfter(wrap)
      // Delimiters between the two can no longer match anything.
      if (opener.next !== closer) {
        opener.next = closer
        closer.prev = opener
      }
      if (opener.count === 0) {
        opener.node.unlink()
        this.removeDelimiter(opener)
      }
      if (closer.count === 0) {
        closer.node.unlink()
        const next = closer.next
        this.removeDelimiter(closer)
        closer = next
      }
    }

    // While streaming, an opener still waiting for its closer at the end of
    // the text is being written: close it at the end.
    if (this.heal && block && bottom === null) this.closeOpenDelimiters(block)

    while (this.delimiters !== null && this.delimiters !== bottom) this.removeDelimiter(this.delimiters)
  }

  /**
   * closeOpenDelimiters closes each opener still waiting at the end of the
   * text, newest first: everything after it goes into the emphasis, strong
   * or strikethrough it opens. "***" opens both strong and emphasis.
   */
  private closeOpenDelimiters(block: N): void {
    for (let d = this.delimiters; d !== null; d = d.prev) {
      if (!d.canOpen || d.count === 0) continue
      if (d.cc === C_TILDE && d.count !== 2) continue
      if (d.node.parent !== block || !hasText(d.node.next)) continue
      const use = d.cc === C_TILDE ? 2 : Math.min(d.count, 3)
      const types = d.cc === C_TILDE ? ['delete'] : use === 3 ? ['strong', 'emphasis'] : use === 2 ? ['strong'] : ['emphasis']
      d.node.value = d.node.value.slice(0, d.node.value.length - use)
      const outer = new N(types[0]!)
      let inner = outer
      for (const type of types.slice(1)) {
        const wrap = new N(type)
        inner.append(wrap)
        inner = wrap
      }
      let tmp = d.node.next
      while (tmp) {
        const next = tmp.next
        inner.append(tmp)
        tmp = next
      }
      d.node.insertAfter(outer)
      if (d.node.value === '') d.node.unlink()
    }
  }

  // Links and images.

  private addBracket(node: N, index: number, image: boolean): void {
    if (this.brackets) this.brackets.bracketAfter = true
    this.brackets = { node, prev: this.brackets, prevDelimiter: this.delimiters, index, image, seq: this.seq++, bracketAfter: false }
  }

  private parseOpenBracket(block: N): boolean {
    const start = this.pos
    this.pos++
    const node = new N('text', '[')
    block.append(node)
    this.addBracket(node, start, false)
    return true
  }

  private parseBang(block: N): boolean {
    const start = this.pos
    this.pos++
    if (this.peek() === C_OPEN_BRACKET) {
      this.pos++
      const node = new N('text', '![')
      block.append(node)
      this.addBracket(node, start + 1, true)
    } else {
      block.append(new N('text', '!'))
    }
    return true
  }

  private parseCloseBracket(block: N): boolean {
    this.pos++
    const start = this.pos
    const opener = this.brackets
    if (opener === null) {
      block.append(new N('text', ']'))
      return true
    }
    if (!opener.image && opener.seq < this.linksFrom) {
      block.append(new N('text', ']'))
      this.brackets = opener.prev
      return true
    }
    const image = opener.image
    const save = this.pos
    let url: string | null = null
    let title: string | null = null
    let matched = false

    // An inline link: [text](url "title").
    if (this.peek() === C_OPEN_PAREN) {
      this.pos++
      this.spnl()
      if ((url = this.parseLinkDestination()) !== null) {
        this.spnl()
        if (/[ \t\n\r]/.test(this.subject.charAt(this.pos - 1))) title = this.parseLinkTitle()
        this.spnl()
        if (this.peek() === C_CLOSE_PAREN) {
          this.pos++
          matched = true
        }
      }
      if (!matched) {
        // While streaming, "[text](https://exa" is a link still being
        // written: show its text, and an image nothing, until it's done.
        if (this.heal && this.lastCloseParen < save) {
          this.pos = this.subject.length
          this.brackets = opener.prev
          if (image) {
            while (this.delimiters !== opener.prevDelimiter && this.delimiters !== null) this.removeDelimiter(this.delimiters)
            let tmp: N | null = opener.node
            while (tmp) {
              const next: N | null = tmp.next
              tmp.unlink()
              tmp = next
            }
          } else {
            opener.node.unlink()
          }
          return true
        }
        this.pos = save
        url = title = null
      }
    }

    // A reference link: [text][label], [text][] or [text].
    if (!matched) {
      const beforeLabel = this.pos
      const n = this.parseLinkLabel()
      let label: string | undefined
      if (n > 2) label = this.subject.slice(beforeLabel, beforeLabel + n)
      else if (!opener.bracketAfter) label = this.subject.slice(opener.index, start)
      if (n === 0) this.pos = save
      if (label) {
        const ref = this.refs.get(normalizeLabel(label))
        if (ref) {
          url = ref.url
          title = ref.title ?? null
          matched = true
        }
      }
    }

    if (!matched) {
      this.brackets = opener.prev
      this.pos = start
      block.append(new N('text', ']'))
      return true
    }

    const node = new N(image ? 'image' : 'link')
    node.url = url ?? ''
    if (title) node.title = title
    let tmp = opener.node.next
    while (tmp) {
      const next = tmp.next
      node.append(tmp)
      tmp = next
    }
    block.append(node)
    this.processEmphasis(opener.prevDelimiter)
    this.brackets = opener.prev
    opener.node.unlink()
    // No links in links: earlier link openers can't match any more.
    if (!image) this.linksFrom = this.seq
    return true
  }

  /** Parses a link label, returning its length (0 for none). */
  parseLinkLabel(): number {
    const m = this.match(RE_LINK_LABEL)
    if (m === null || m.length > 1001) {
      if (m !== null) this.pos -= m.length
      return 0
    }
    return m.length
  }

  parseLinkDestination(): string | null {
    const braced = this.match(RE_DEST_BRACES)
    if (braced !== null) return encodeUrl(unescape(braced.slice(1, -1)))
    if (this.peek() === C_LT) return null
    const save = this.pos
    let parens = 0
    for (;;) {
      const c = this.peek()
      if (c === -1) break
      if (c === C_BACKSLASH && isEscapable(this.subject.charAt(this.pos + 1))) {
        this.pos += 2
      } else if (c === C_OPEN_PAREN) {
        this.pos++
        if (++parens > MAX_LINK_PARENS) break
      } else if (c === C_CLOSE_PAREN) {
        if (parens < 1) break
        this.pos++
        parens--
      } else if (c <= 32) {
        // Spaces and ASCII control characters end it.
        break
      } else {
        this.pos++
      }
    }
    if (this.pos === save && this.peek() !== C_CLOSE_PAREN) return null
    if (parens !== 0) {
      this.pos = save
      return null
    }
    return encodeUrl(unescape(this.subject.slice(save, this.pos)))
  }

  parseLinkTitle(): string | null {
    const m = this.match(RE_LINK_TITLE)
    return m === null ? null : unescape(m.slice(1, -1))
  }

  /**
   * parseReference reads a link reference definition at the start of s into
   * refs, returning how many characters it took (0 for none).
   */
  parseReference(s: string): number {
    this.subject = s
    this.pos = 0
    const n = this.parseLinkLabel()
    if (n === 0) return 0
    const raw = s.slice(0, n)
    if (this.peek() !== C_COLON) return 0
    this.pos++
    this.spnl()
    const url = this.parseLinkDestination()
    if (url === null) return 0
    const beforeTitle = this.pos
    this.spnl()
    let title: string | null = null
    if (this.pos !== beforeTitle) title = this.parseLinkTitle()
    if (title === null) this.pos = beforeTitle
    let atLineEnd = true
    if (this.match(RE_SPACE_AT_END_OF_LINE) === null) {
      if (title === null) {
        atLineEnd = false
      } else {
        // The title isn't at the end of the line, but the definition may
        // still stand without it.
        title = null
        this.pos = beforeTitle
        atLineEnd = this.match(RE_SPACE_AT_END_OF_LINE) !== null
      }
    }
    if (!atLineEnd) return 0
    const label = normalizeLabel(raw)
    if (label === '') return 0
    if (!this.refs.has(label)) this.refs.set(label, title === null ? { url } : { url, title })
    return this.pos
  }
}

function hasText(n: N | null): boolean {
  for (; n; n = n.next) {
    if (n.type !== 'text' || /\S/.test(n.value)) return true
  }
  return false
}

/** A code span's text: line endings become spaces, and one space each side is dropped when both are there. */
function codeSpanText(s: string): string {
  s = s.replace(/\n/g, ' ')
  if (s.length > 2 && s[0] === ' ' && s[s.length - 1] === ' ' && /[^ ]/.test(s)) return s.slice(1, -1)
  return s
}

/** trimLineEnds drops spaces, tabs and line endings at both ends, and nothing else. */
function trimLineEnds(s: string): string {
  let a = 0
  let b = s.length
  const space = (c: number) => c === 32 || c === 9 || c === 10 || c === 13
  while (a < b && space(s.charCodeAt(a))) a++
  while (b > a && space(s.charCodeAt(b - 1))) b--
  return s.slice(a, b)
}

/** parseReferences takes definitions off the start of s, returning how much it took. */
export function parseReferences(s: string, refs: Refs): number {
  const p = new InlineParser(refs)
  let taken = 0
  while (s.charCodeAt(taken) === C_OPEN_BRACKET) {
    const n = p.parseReference(s.slice(taken))
    if (n === 0) break
    taken += n
  }
  return taken
}

/**
 * parseInlines turns text into inline nodes. heal: the text is the end of an
 * answer still streaming in, so unfinished code spans, emphasis, links and
 * images are finished or hidden.
 */
export function parseInlines(text: string, refs: Refs, heal = false): A.Inline[] {
  const root = new InlineParser(refs, heal).parse(text)
  return autolink(convert(root, 0))
}

/** convert turns the linked tree into AST nodes, merging adjacent text. */
function convert(parent: N, depth: number): A.Inline[] {
  const out: A.Inline[] = []
  const pushText = (value: string) => {
    if (value === '') return
    const last = out[out.length - 1]
    if (last && last.type === 'text') last.value += value
    else out.push({ type: 'text', value })
  }
  for (let n = parent.first; n; n = n.next) {
    if (depth >= MAX_INLINE_DEPTH && n.first) {
      pushText(plainText(n))
      continue
    }
    switch (n.type) {
      case 'text':
        pushText(n.value)
        break
      case 'inlineCode':
        out.push({ type: 'inlineCode', value: n.value })
        break
      case 'inlineHtml':
        out.push({ type: 'inlineHtml', value: n.value })
        break
      case 'break':
        out.push({ type: 'break' })
        break
      case 'emphasis':
      case 'strong':
      case 'delete':
        out.push({ type: n.type, children: convert(n, depth + 1) })
        break
      case 'link':
        out.push({ type: 'link', url: n.url, ...(n.title ? { title: n.title } : {}), children: convert(n, depth + 1) })
        break
      case 'image':
        out.push({ type: 'image', url: n.url, ...(n.title ? { title: n.title } : {}), alt: plainText(n) })
        break
    }
  }
  return out
}

/** plainText is a subtree's text, without markup. It walks with a stack, never recursion. */
function plainText(root: N): string {
  let s = ''
  const stack: N[] = []
  for (let n = root.last; n; n = n.prev) stack.push(n)
  while (stack.length) {
    const n = stack.pop()!
    if (n.type === 'image') {
      s += plainText(n)
    } else if (n.first) {
      for (let c = n.last; c; c = c.prev) stack.push(c)
    } else if (n.type !== 'break') {
      s += n.value
    } else {
      s += '\n'
    }
  }
  return s
}

// GitHub's extended autolinks: www.example.com, https://example.com and
// someone@example.com in plain text, outside links and code.

const RE_EXTENDED = /(?:(?:https?|ftp):\/\/|www\.)[^\s<]*|[A-Za-z0-9._+-]+@[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+/g

function autolink(nodes: A.Inline[]): A.Inline[] {
  const out: A.Inline[] = []
  for (const n of nodes) {
    if (n.type === 'text') out.push(...linkText(n.value))
    else if (n.type === 'emphasis' || n.type === 'strong' || n.type === 'delete') out.push({ ...n, children: autolink(n.children) })
    else out.push(n)
  }
  return out
}

function linkText(text: string): A.Inline[] {
  if (!/www\.|:\/\/|@/.test(text)) return [{ type: 'text', value: text }]
  const out: A.Inline[] = []
  let last = 0
  RE_EXTENDED.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RE_EXTENDED.exec(text))) {
    const start = m.index
    const before = start === 0 ? '' : text[start - 1]!
    if (before !== '' && !/[\s*_~(]/.test(before)) continue
    const found = m[0].includes('@') && !m[0].includes('/') && !m[0].startsWith('www.') ? email(m[0]) : webLink(m[0])
    if (!found) continue
    if (start > last) out.push({ type: 'text', value: text.slice(last, start) })
    out.push({ type: 'link', url: encodeUrl(found.url), children: [{ type: 'text', value: found.text }] })
    last = start + found.text.length
    RE_EXTENDED.lastIndex = last
  }
  if (last === 0) return [{ type: 'text', value: text }]
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

/** A valid domain: segments of letters, digits, _ and -, with no _ in the last two. */
function validDomain(domain: string): boolean {
  const parts = domain.split('.')
  if (parts.length < 2 || parts.some((p) => p === '' || !/^[A-Za-z0-9_-]+$/.test(p))) return false
  return !parts.slice(-2).some((p) => p.includes('_'))
}

function webLink(candidate: string): { text: string; url: string } | undefined {
  const www = candidate.startsWith('www.')
  const scheme = www ? '' : candidate.slice(0, candidate.indexOf('://') + 3)
  // The domain runs to the first character a domain can't hold, less any
  // trailing dots: "www.example.com." ends a sentence.
  const domain = /^[A-Za-z0-9._-]*/.exec(candidate.slice(scheme.length))![0].replace(/[._-]+$/, '')
  if (!validDomain(domain)) return undefined
  let text = candidate
  for (;;) {
    const before = text
    text = text.replace(/[?!.,:*_~]+$/, '')
    if (text.endsWith(')')) {
      const open = text.split('(').length - 1
      const close = text.split(')').length - 1
      if (close > open) text = text.slice(0, -1)
    }
    const entity = /&[A-Za-z0-9]+;$/.exec(text)
    if (entity) text = text.slice(0, entity.index)
    if (text === before) break
  }
  if (text.length <= scheme.length + (www ? 4 : 0)) return undefined
  return { text, url: www ? 'http://' + text : text }
}

function email(candidate: string): { text: string; url: string } | undefined {
  let text = candidate.replace(/\.+$/, '')
  if (/[-_]$/.test(text)) return undefined
  const at = text.indexOf('@')
  if (at < 1 || !/\./.test(text.slice(at))) return undefined
  if (!validDomain(text.slice(at + 1))) return undefined
  return { text, url: 'mailto:' + text }
}
