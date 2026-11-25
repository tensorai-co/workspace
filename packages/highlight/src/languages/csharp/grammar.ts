import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  abstract as base break case catch checked class const continue default delegate do else enum
  event explicit extern finally fixed for foreach goto if implicit in interface internal is lock
  namespace new operator out override params private protected public readonly record ref return
  sealed sizeof stackalloc static struct switch throw try typeof unchecked unsafe using virtual
  volatile while add and alias ascending async await by descending equals file from get global
  group init into join let managed nameof not on or orderby partial remove required scoped select
  set unmanaged value var when where with yield
`)
const TYPES = words(`
  bool byte char decimal double dynamic float int long nint nuint object sbyte short string uint
  ulong ushort void
`)
const CONSTANTS = words('true false null')
const VARIABLES = words('this base')

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z]$/.test(text)) return 'type' // a type parameter: T
  return undefined
}

/** A capitalized name where a type goes is one; elsewhere it's likely a property. */
const typeName = (text: string) => name(text) ?? (/^[A-Z]/.test(text) ? 'type' : undefined)

/** Where a type or namespace follows: new X, x is X, x as X, class A : B, List<X>, using System. */
function typeAfter(prev: Token | undefined): boolean {
  return !!prev && /^(?:new|is|as|:|<|typeof|nameof|where|using|namespace)$/.test(prev.text)
}

/** Where an attribute can start: a line's start, or after another attribute or a (. */
function attributeAllowed(prev: Token | undefined): boolean {
  return !prev || prev.type === 'meta' || prev.text === '(' || prev.text === ','
}

const IDENT = /@?[A-Za-z_]\w*/.source

/**
 * A string's state: its kind after the slash. "regular", "verbatim" (@"…",
 * "" escapes a quote, spans lines), or "raw/N" for N quotes; $ adds
 * interpolation: "$regular", "$verbatim", "$raw/3".
 */
function openString(text: string): string {
  const interpolated = text.includes('$') ? '$' : ''
  const quotes = /"+$/.exec(text)![0].length
  if (quotes >= 3) return `string/${interpolated}raw/${quotes}`
  return `string/${interpolated}${text.includes('@') ? 'verbatim' : 'regular'}`
}

const kind = (arg: string) => arg.replace(/^\$/, '').replace(/\/.*$/, '')
const interpolated = (arg: string) => arg.startsWith('$')

export const grammar: Grammar = {
  states: {
    root: [
      { match: /#\s*(?:if|elif|else|endif|define|undef|region|endregion|pragma|nullable|warning|error|line)\b.*/, token: 'meta', after: (p) => p === undefined },
      { include: 'code' },
    ],
    code: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /\$+"""+|"""+|\$@"|@\$"|\$"|@"|"/, token: 'string', push: openString },
      { match: /'(?:[^'\\\n]|\\(?:x[\da-fA-F]{1,4}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|.))'/, token: 'string' },
      { match: /\[(?:assembly:|return:)?\s*[A-Z]\w*(?:\.\w+)*(?:\([^)\n]*\))?\]/, token: 'meta', after: attributeAllowed },
      { match: new RegExp(`(class|struct|interface|enum|record|namespace|delegate\\s+\\w+)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*(?:<[\\w\\s,<>?]*>)?\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:<[\\w\\s,<>?]*>)?\\s*\\()`), token: (t) => (KEYWORDS.has(t) || TYPES.has(t) ? name(t) : 'function') },
      // Before ".", a generic's <…>, or a declared name: Console., List<int>, Guid id, Order? o, int[] a.
      { match: new RegExp(`${IDENT}(?=\\s*(?:\\.(?!\\.)|<[\\w\\s,<>?[\\]]*>|\\??\\s+@?[A-Za-z_]|\\??\\[\\]))`), token: typeName },
      { match: new RegExp(IDENT), token: typeName, after: typeAfter },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)(?:[uU][lL]?|[lL][uU]?|[fFdDmM])?/,
        token: 'number',
      },
      { match: /=>|\?\?=?|\?\.|::|\+\+|--|<<=?|>>>?=?|&&|\|\||\.\.|[-+*/%&|^<>!=]=?|[~?]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    string: [
      // The end: one quote, or a raw string's own number of them.
      {
        match: (line, pos, arg) => {
          if (kind(arg) === 'raw') {
            const n = Number(arg.slice(arg.lastIndexOf('/') + 1))
            return line.startsWith('"'.repeat(n), pos) ? n : -1
          }
          if (kind(arg) === 'verbatim' && line.startsWith('""', pos)) return -1
          return line[pos] === '"' ? 1 : -1
        },
        token: 'string',
        pop: true,
      },
      { match: (line, pos, arg) => (kind(arg) === 'verbatim' && line.startsWith('""', pos) ? 2 : -1), token: 'escape' },
      { match: (line, pos, arg) => (kind(arg) === 'regular' && line[pos] === '\\' ? 1 + (line.length > pos + 1 ? 1 : 0) : -1), token: 'escape' },
      { match: (line, pos, arg) => (interpolated(arg) && (line.startsWith('{{', pos) || line.startsWith('}}', pos)) ? 2 : -1), token: 'escape' },
      { match: (line, pos, arg) => (interpolated(arg) && line[pos] === '{' ? 1 : -1), token: 'escape', push: 'interpolation' },
      {
        match: (line, pos, arg) => {
          let i = pos
          while (i < line.length && line[i] !== '"' && line[i] !== '\\' && !(interpolated(arg) && (line[i] === '{' || line[i] === '}'))) i++
          if (i === pos && line[i] === '\\') i++ // a backslash in a verbatim or raw string
          return i > pos ? i - pos : -1
        },
        token: 'string',
      },
      { match: /./, token: 'string' },
      // A regular string ends with its line; verbatim and raw ones go on.
      { match: (line, pos, arg) => (pos === line.length && kind(arg) === 'regular' ? 0 : -1), pop: true },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { match: /:[^}"]*(?=\})/, token: 'escape' }, // a format: {x:N2}
      { include: 'code' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'code' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
