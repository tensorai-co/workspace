import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { lengthAt, words } from '../../language.js'

const KEYWORDS = words(`
  abstract as assert async await base break case catch class const continue covariant default
  deferred do dynamic else enum export extends extension external factory final finally for
  Function get hide if implements import in interface is late library mixin new on operator part
  required rethrow return sealed set show static super switch sync throw try typedef var when while
  with yield
`)
const TYPES = words('int double num bool void Never Object String List Map Set Iterable Future Stream Record Null')
const CONSTANTS = words('true false null')
const BUILTINS = words('print identical debugPrint')

function name(text: string): TokenType | undefined {
  if (text === 'this' || text === 'super') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

const IDENT = /[A-Za-z_$][\w$]*/.source

/** A string's state: "string/Q/r", Q its quotes (' " ''' """), r when raw. */
function openString(text: string): string {
  const raw = text.startsWith('r')
  return `string/${raw ? text.slice(1) : text}/${raw ? 'r' : ''}`
}

const VARIABLE = /\$[A-Za-z_]\w*/y
const ESCAPE = /\\(?:u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|.?)/y

const quote = (arg: string) => arg.slice(0, arg.lastIndexOf('/'))
const raw = (arg: string) => arg.endsWith('/r')

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /r?(?:'''|"""|'|")/, token: 'string', push: openString },
      { match: /@[A-Za-z_]\w*/, token: 'meta' },
      { match: new RegExp(`(class|mixin|enum|extension|typedef)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*(?:<[\\w\\s,<>?]*>)?\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:<[\\w\\s,<>?]*>)?\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: name },
      { match: /(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)/, token: 'number' },
      { match: /\?\?=?|\?\.|\.\.\.\??|\.\.|=>|===?|!=|&&|\|\||~\/=?|<<=?|>>>?=?|[-+*/%&|^<>!=]=?|[~?:]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string: [
      { match: (line, pos, arg) => (line.startsWith(quote(arg), pos) ? quote(arg).length : -1), token: 'string', pop: true },
      { match: (line, pos, arg) => (!raw(arg) && line.startsWith('${', pos) ? 2 : -1), token: 'escape', push: 'interpolation' },
      { match: (line, pos, arg) => (raw(arg) ? -1 : lengthAt(VARIABLE, line, pos)), token: 'variable' },
      { match: (line, pos, arg) => (raw(arg) ? -1 : lengthAt(ESCAPE, line, pos)), token: 'escape' },
      { match: (line, pos, arg) => { const q = quote(arg)[0]!; let i = pos; while (i < line.length && line[i] !== q && line[i] !== '\\' && line[i] !== '$') i++; return i > pos ? i - pos : -1 }, token: 'string' },
      { match: /./, token: 'string' },
      { match: (line, pos, arg) => (pos === line.length && quote(arg).length === 1 ? 0 : -1), pop: true },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    blockComment: [
      { match: /[^*/]+/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*/]/, token: 'comment' },
    ],
  },
}
