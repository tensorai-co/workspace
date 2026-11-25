import type { Text } from '@tensorai-workspace/text'
import { EditorSelection, SelectionRange } from './selection.js'
import type { EditorState, TransactionSpec } from './state.js'

/** What to find, with the options. */
export interface SearchQuery {
  search: string
  caseSensitive?: boolean
  wholeWord?: boolean
  regexp?: boolean
  /** The replacement. With `regexp`, `$1`, `$&`, `\n` and `\u` work. */
  replace?: string
  /** Replacing "Foo" with "bar" gives "Bar", as the match was capitalized. */
  preserveCase?: boolean
}

export interface SearchMatch {
  from: number
  to: number
  /** The match and its groups, for replacing with a regular expression. */
  groups?: string[]
}

export interface SearchResult {
  matches: SearchMatch[]
  /** Why the search can't run, such as a regular expression that isn't valid. */
  error?: string
  /** There were more than `limit` matches; only the first are here. */
  limited: boolean
}

/** Past this many, matches aren't all found up front. */
export const MATCHES_LIMIT = 19999

/** The default word separators, for "Match Whole Word". */
const SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?'
const isSeparator = (ch: string | undefined) => ch === undefined || ch === '\n' || /\s/.test(ch) || SEPARATORS.includes(ch)

const escapeRegExp = (s: string) => s.replace(/[\\^$.*+?()[\]{}|\-/]/g, '\\$&')

/** A search that can match line breaks searches the whole text; others search line by line. */
const isMultiline = (query: SearchQuery) => (query.regexp ? /\\n|\\r|\\W|\\s|\n/.test(query.search) : query.search.includes('\n'))

/** The query as a regular expression, or why it can't be one. Undefined for an empty search. */
export function compileQuery(query: SearchQuery): RegExp | { error: string } | undefined {
  if (!query.search) return undefined
  const source = query.regexp ? query.search : escapeRegExp(query.search)
  const flags = `g${query.caseSensitive ? '' : 'i'}mu`
  try {
    return new RegExp(source, flags)
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Whether a match stands as a whole word: separators or its own edges on both sides. */
function isWholeWord(text: string, start: number, end: number): boolean {
  const left = isSeparator(text[start - 1]) || isSeparator(text[start])
  const right = isSeparator(text[end]) || (end > start && isSeparator(text[end - 1]))
  return left && right
}

/** Every match in the document, or in a range of it, up to `limit`. */
export function findMatches(doc: Text, query: SearchQuery, range?: { from: number; to: number }, limit = MATCHES_LIMIT): SearchResult {
  const re = compileQuery(query)
  if (!re) return { matches: [], limited: false }
  if ('error' in re) return { matches: [], error: re.error, limited: false }
  const from = range?.from ?? 0
  const to = range?.to ?? doc.length
  const matches: SearchMatch[] = []
  const keep = (text: string, offset: number, m: RegExpExecArray) => {
    const start = offset + m.index
    const end = start + m[0].length
    if (start < from || end > to) return true
    if (query.wholeWord && !isWholeWord(text, m.index, m.index + m[0].length)) return true
    matches.push(query.regexp ? { from: start, to: end, groups: [...m].map((g) => g ?? '') } : { from: start, to: end })
    return matches.length <= limit
  }
  const scan = (text: string, offset: number) => {
    re.lastIndex = 0
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (!keep(text, offset, m)) return false
      // An empty match would find itself forever.
      if (m[0].length === 0) re.lastIndex += text.codePointAt(re.lastIndex)! > 0xffff ? 2 : 1
    }
    return true
  }
  if (isMultiline(query)) scan(doc.slice(from, to), from)
  else {
    const first = doc.lineAt(from).number
    const last = doc.lineAt(to).number
    for (let n = first; n <= last; n++) {
      const line = doc.line(n)
      if (!scan(line.text, line.from)) break
    }
  }
  const limited = matches.length > limit
  return { matches: limited ? matches.slice(0, limit) : matches, limited }
}

/** the "preserve case": the replacement takes the case of what it replaces. */
export function preserveCase(match: string, replacement: string): string {
  if (!match || !replacement) return replacement
  for (const sep of ['-', '_']) {
    const other = sep === '-' ? '_' : '-'
    const both = match.includes(sep) && replacement.includes(sep) && match.split(sep).length === replacement.split(sep).length
    if (both && !(match.includes(other) && replacement.includes(other))) {
      const parts = match.split(sep)
      return replacement
        .split(sep)
        .map((r, i) => preserveCase(parts[i]!, r))
        .join(sep)
    }
  }
  if (match.toUpperCase() === match) return replacement.toUpperCase()
  if (match.toLowerCase() === match) return replacement.toLowerCase()
  if (match[0]!.toUpperCase() === match[0] && match[0]!.toLowerCase() !== match[0]) return replacement[0]!.toUpperCase() + replacement.slice(1)
  if (match[0]!.toUpperCase() !== match[0]) return replacement[0]!.toLowerCase() + replacement.slice(1)
  return replacement
}

/** The replacement for a match: groups, escapes and case changes with a regular expression. */
export function replacementFor(query: SearchQuery, match: string, groups?: string[]): string {
  const pattern = query.replace ?? ''
  let out = ''
  if (!query.regexp) out = pattern
  else {
    const ops: string[] = []
    const group = (index: number) => {
      let value = groups?.[index] ?? ''
      if (ops.length) {
        let text = ''
        let i = 0
        for (const op of ops) {
          if (i >= value.length) break
          if (op === 'U') ((text += value.slice(i).toUpperCase()), (i = value.length))
          else if (op === 'L') ((text += value.slice(i).toLowerCase()), (i = value.length))
          else ((text += op === 'u' ? value[i]!.toUpperCase() : value[i]!.toLowerCase()), i++)
        }
        value = text + value.slice(i)
        ops.length = 0
      }
      out += value
    }
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i]!
      const next = pattern[i + 1]
      if (ch === '\\' && next !== undefined) {
        i++
        if (next === 'n') out += '\n'
        else if (next === 't') out += '\t'
        else if (next === '\\') out += '\\'
        else if ('uUlL'.includes(next)) ops.push(next)
        else out += ch + next
      } else if (ch === '$' && next !== undefined) {
        if (next === '$') ((out += '$'), i++)
        else if (next === '&' || next === '0') (group(0), i++)
        else if (/[1-9]/.test(next)) {
          const two = pattern[i + 2]
          const index = two !== undefined && /\d/.test(two) ? Number(next + two) : Number(next)
          i += index >= 10 ? 2 : 1
          group(index)
        } else out += ch
      } else out += ch
    }
  }
  return query.preserveCase ? preserveCase(match, out) : out
}

/** The first match after `pos`, going round to the start; or before it, going round to the end. */
export function nearestMatch(matches: readonly SearchMatch[], pos: number, backward = false): SearchMatch | undefined {
  if (!matches.length) return undefined
  if (backward) {
    for (let i = matches.length - 1; i >= 0; i--) if (matches[i]!.from < pos) return matches[i]
    return matches[matches.length - 1]
  }
  return matches.find((m) => m.from >= pos) ?? matches[0]
}

/** Which match the selection is, from 0; -1 when it isn't one. */
export function matchIndex(matches: readonly SearchMatch[], state: EditorState): number {
  const { from, to } = state.selection.main
  let lo = 0
  let hi = matches.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const m = matches[mid]!
    if (m.from === from && m.to === to) return mid
    if (m.from < from || (m.from === from && m.to < to)) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

const select = (m: SearchMatch): TransactionSpec => ({ selection: EditorSelection.single(m.from, m.to), userEvent: 'select', scrollIntoView: true })

/** Selects the next match after the selection, going round. */
export function findNext(state: EditorState, matches: readonly SearchMatch[]): TransactionSpec | null {
  const m = nearestMatch(matches, state.selection.main.to)
  return m ? select(m) : null
}

/** Selects the match before the selection, going round. */
export function findPrevious(state: EditorState, matches: readonly SearchMatch[]): TransactionSpec | null {
  const m = nearestMatch(matches, state.selection.main.from, true)
  return m ? select(m) : null
}

/** Puts a cursor on every match, as `⌥Enter` does. */
export function selectAllMatches(matches: readonly SearchMatch[]): TransactionSpec | null {
  if (!matches.length) return null
  return { selection: EditorSelection.create(matches.map((m) => new SelectionRange(m.from, m.to))), userEvent: 'select' }
}

/** Replaces the match the selection is on and selects the next; with the selection on none, only selects the next. */
export function replaceNext(state: EditorState, query: SearchQuery, matches: readonly SearchMatch[]): TransactionSpec | null {
  const at = matchIndex(matches, state)
  if (at < 0) return findNext(state, matches)
  const m = matches[at]!
  const insert = replacementFor(query, state.sliceDoc(m.from, m.to), m.groups)
  const shift = insert.length - (m.to - m.from)
  // The next match, in the text after the replacement.
  const next = matches.length > 1 ? (matches[at + 1] ?? matches[0])! : undefined
  const selection = next ? (next.from >= m.to ? EditorSelection.single(next.from + shift, next.to + shift) : EditorSelection.single(next.from, next.to)) : EditorSelection.single(m.from + insert.length)
  return { changes: { from: m.from, to: m.to, insert }, selection, userEvent: 'input.replace', scrollIntoView: true }
}

/** Replaces every match, as one undo step. */
export function replaceAll(state: EditorState, query: SearchQuery, range?: { from: number; to: number }): TransactionSpec | null {
  const { matches } = findMatches(state.doc, query, range, Infinity)
  if (!matches.length) return null
  return { changes: matches.map((m) => ({ from: m.from, to: m.to, insert: replacementFor(query, state.sliceDoc(m.from, m.to), m.groups) })), userEvent: 'input.replace' }
}
