// The YAML between `---` lines at the top of a file, as a table. This reads the YAML people write there: nested keys
// and lists, quotes, `[a, b]`, `{a: b}`, `|` and `>`. Anything else (anchors, tags) is shown as it's written.

export type Yaml = string | null | Yaml[] | { [key: string]: Yaml }

export interface FrontMatter {
  /** The YAML itself. */
  source: string
  /** How much of the text it takes, with its marker lines. */
  length: number
  /** Its lines, with the markers. */
  lines: number
}

const OPEN = /^---[ \t]*(?:\r\n|\n|\r)/

/** Finds front matter at the start of a text. */
export function findFrontMatter(text: string): FrontMatter | undefined {
  const first = OPEN.exec(text)
  if (!first) return undefined
  const end = /^---[ \t]*(?:\r\n|\n|\r|$(?![\s\S]))/m
  const rest = text.slice(first[0].length)
  const last = end.exec(rest)
  if (!last) return undefined
  const source = rest.slice(0, last.index)
  return { source: source.replace(/\r\n?/g, '\n').replace(/\n$/, ''), length: first[0].length + last.index + last[0].length, lines: 2 + (source.match(/\r\n|\n|\r/g)?.length ?? 0) }
}

interface Line {
  indent: number
  text: string
  raw: string
}

class Unreadable extends Error {}

/** Reads front matter's YAML, or returns undefined when it's past what this reads. */
export function readYaml(source: string): Yaml | undefined {
  const lines: Line[] = source.split('\n').map((raw) => ({ indent: raw.length - raw.trimStart().length, text: raw.trim(), raw }))
  let at = 0
  const skip = () => {
    while (at < lines.length && (!lines[at]!.text || lines[at]!.text.startsWith('#'))) at++
    return lines[at]
  }

  const value = (text: string, indent: number): Yaml => {
    const bare = stripComment(text)
    if (!bare) {
      const next = skip()
      return next && next.indent > indent ? block(next.indent) : next && next.indent === indent && /^-(?:\s|$)/.test(next.text) ? block(indent, true) : null
    }
    const folded = /^([|>])[-+]?$/.exec(bare)
    if (folded) return blockText(folded[1] === '>', indent)
    // Plain text goes on over lines indented further.
    if (!/^["'[{&*!|>%@`]/.test(bare)) {
      const parts = [bare]
      while (at < lines.length && lines[at]!.text && lines[at]!.indent > indent && !/^(?:- |[^\s:]+:(?:\s|$))/.test(lines[at]!.text)) parts.push(stripComment(lines[at++]!.text))
      return scalar(parts.join(' '))
    }
    return flow(bare)
  }

  const blockText = (fold: boolean, indent: number): string => {
    const parts: string[] = []
    let inner = 0
    while (at < lines.length && (!lines[at]!.text || lines[at]!.indent > indent)) {
      const line = lines[at++]!
      if (line.text) inner ||= line.indent
      parts.push(line.text ? line.raw.slice(inner) : '')
    }
    while (parts.length && !parts[parts.length - 1]) parts.pop()
    return fold ? parts.join('\n').replace(/([^\n])\n(?!\n)/g, '$1 ') : parts.join('\n')
  }

  const block = (indent: number, list = false): Yaml => {
    if (list || /^-(?:\s|$)/.test(lines[at]!.text)) {
      const out: Yaml[] = []
      for (let line = skip(); line && line.indent === indent && /^-(?:\s|$)/.test(line.text); line = skip()) {
        const rest = line.text.slice(1).trimStart()
        if (KEY.test(rest)) {
          // A map that starts on the item's own line: its keys line up after the dash.
          const inner = indent + (line.text.length - rest.length)
          lines[at] = { indent: inner, text: rest, raw: ' '.repeat(inner) + rest }
          out.push(block(inner))
        } else {
          at++
          out.push(value(rest, indent))
        }
      }
      return out
    }
    const out: { [key: string]: Yaml } = {}
    for (let line = skip(); line && line.indent >= indent; line = skip()) {
      const m = KEY.exec(line.text)
      if (!m || line.indent !== indent) throw new Unreadable()
      at++
      out[m[1] !== undefined ? (flow(m[1]) as string) : m[2]!] = value(m[3] ?? '', indent)
    }
    return out
  }

  try {
    const first = skip()
    if (!first) return null
    const out = KEY.test(first.text) || /^-(?:\s|$)/.test(first.text) ? block(first.indent) : value(lines[at++]!.text, -1)
    return skip() ? undefined : out
  } catch (e) {
    if (e instanceof Unreadable) return undefined
    throw e
  }
}

const KEY = /^(?:("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')|([^\s#'"[\]{},&*!|>%@`-][^#]*?|-[^\s#][^#]*?))\s*:(?:\s+(.*))?$/

function stripComment(text: string): string {
  if (/^["']/.test(text)) return text.replace(/^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')\s+#.*$/, '$1')
  return text.replace(/(?:^|\s)#.*$/, '').trim()
}

function scalar(text: string): Yaml {
  if (/^(?:null|Null|NULL|~)?$/.test(text)) return null
  return /^[-+]?\d{1,15}(?:\.\d+)?$/.test(text) ? String(Number(text)) : text
}

/** A value on one line: quoted, `[a, b]`, `{a: b}` or plain. */
function flow(source: string): Yaml {
  let at = 0
  const space = () => {
    while (source[at] === ' ' || source[at] === '\t') at++
  }
  const read = (stop: string): Yaml => {
    space()
    const c = source[at]
    if (c === '"' || c === "'") return quoted(c)
    if (c === '[') {
      const out: Yaml[] = []
      for (at++, space(); source[at] !== ']'; space()) {
        out.push(read(',]'))
        space()
        if (source[at] === ',') at++
        else if (source[at] !== ']') throw new Unreadable()
      }
      at++
      return out
    }
    if (c === '{') {
      const out: { [key: string]: Yaml } = {}
      for (at++, space(); source[at] !== '}'; space()) {
        const key = read(':,}')
        space()
        if (source[at] === ':') {
          at++
          out[String(key)] = read(',}')
        } else out[String(key)] = null
        space()
        if (source[at] === ',') at++
        else if (source[at] !== '}') throw new Unreadable()
      }
      at++
      return out
    }
    if (c === undefined || '&*!|>%@`'.includes(c)) throw new Unreadable()
    const from = at
    while (at < source.length && !stop.includes(source[at]!)) at++
    return scalar(source.slice(from, at).trim())
  }
  const quoted = (quote: string): string => {
    let out = ''
    for (at++; at < source.length; at++) {
      const c = source[at]!
      if (c === quote) {
        if (quote === '"' || source[at + 1] !== "'") {
          at++
          return out
        }
        out += c
        at++
      } else if (c === '\\' && quote === '"') {
        const next = source[++at]
        out += next === 'n' ? '\n' : next === 't' ? '\t' : (next ?? '')
      } else out += c
    }
    throw new Unreadable()
  }
  const out = read('')
  space()
  if (at < source.length) throw new Unreadable()
  return out
}

/** Writes a value back as YAML, for a cell that holds a map. */
export function writeYaml(value: Yaml, indent = ''): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((v) => `${indent}- ${writeYaml(v, `${indent}  `).trimStart()}`).join('\n')
  return Object.entries(value)
    .map(([k, v]) => `${indent}${k}:${typeof v === 'object' && v !== null ? `\n${writeYaml(v, `${indent}  `)}` : ` ${writeYaml(v)}`}`)
    .join('\n')
}
