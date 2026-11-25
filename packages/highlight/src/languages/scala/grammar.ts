import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { lengthAt, words } from '../../language.js'

const KEYWORDS = words(`
  abstract case catch class def do else enum export extends final finally for forSome given if
  implicit import lazy match new object override package private protected return sealed then throw
  trait try type using val var while with yield end extension inline opaque transparent derives
`)
const CONSTANTS = words('true false null')
const BUILTINS = words('println print require assert ???')

function name(text: string): TokenType | undefined {
  if (text === 'this' || text === 'super') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

const IDENT = /(?:[A-Za-z_]\w*|`[^`\n]+`)/.source

/** A string's state: "string/Q/i", Q its quotes (" or """), i when it interpolates (s"", f"", raw""). */
function openString(text: string): string {
  const prefix = /^[A-Za-z_]\w*/.exec(text)?.[0]
  const quotes = text.slice(prefix?.length ?? 0)
  return `string/${quotes}/${prefix ? (prefix === 'raw' ? 'r' : 'i') : ''}`
}

const quotes = (arg: string) => arg.slice(0, arg.lastIndexOf('/'))
const kind = (arg: string) => arg.slice(arg.lastIndexOf('/') + 1)

const ESCAPE = /\\(?:u[\da-fA-F]{4}|.?)/y
const SIMPLE = /\$[A-Za-z_]\w*/y

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /(?:[A-Za-z_]\w*)?(?:"""|")/, token: 'string', push: openString },
      { match: /'(?:[^'\\\n]|\\(?:u[\da-fA-F]{4}|.))'/, token: 'string' },
      { match: /'[A-Za-z_]\w*/, token: 'constant' }, // a symbol: 'name
      { match: /@[A-Za-z_][\w.]*/, token: 'meta' },
      { match: new RegExp(`(def)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(class|object|trait|enum|type)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\.)(${IDENT})(?=\\s*(?:\\[[^\\]\\n]*\\])?\\s*[({])`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:\\[[^\\]\\n]*\\])?\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: name },
      { match: /(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)[lLfFdD]?/, token: 'number' },
      { match: /=>|<-|->|<:|>:|<%|::|:::|\+\+|&&|\|\||[-+*/%&|^<>!=~?:#@]+/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string: [
      { match: (line, pos, arg) => { const q = quotes(arg); if (!line.startsWith(q, pos)) return -1; let n = q.length; while (q.length === 3 && line[pos + n] === '"') n++; return n }, token: 'string', pop: true },
      { match: (line, pos, arg) => (kind(arg) !== '' && line.startsWith('$$', pos) ? 2 : -1), token: 'escape' },
      { match: (line, pos, arg) => (kind(arg) !== '' && line.startsWith('${', pos) ? 2 : -1), token: 'escape', push: 'interpolation' },
      { match: (line, pos, arg) => (kind(arg) !== '' ? lengthAt(SIMPLE, line, pos) : -1), token: 'variable' },
      { match: (line, pos, arg) => (quotes(arg) === '"' && kind(arg) !== 'r' ? lengthAt(ESCAPE, line, pos) : -1), token: 'escape' },
      { match: /[^"\\$]+|["\\$]/, token: 'string' },
      { match: (line, pos, arg) => (pos === line.length && quotes(arg) === '"' ? 0 : -1), pop: true },
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
