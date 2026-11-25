import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  as break class continue do else for fun if in interface is object package return super throw try
  typealias typeof val var when while by catch constructor finally get import init set where
  abstract annotation companion const crossinline data enum external final infix inline inner
  internal lateinit noinline open operator out override private protected public reified sealed
  suspend tailrec vararg
`)
const CONSTANTS = words('true false null')
const VARIABLES = words('this super it')
const BUILTINS = words(`
  println print readln readLine listOf mutableListOf setOf mutableSetOf mapOf mutableMapOf arrayOf
  emptyList emptyMap emptySet require requireNotNull check checkNotNull error TODO lazy run let also
  apply with takeIf takeUnless repeat to
`)

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // MAX_SIZE
  if (/^[A-Z]\w*$/.test(text)) return 'type' // String, T
  return undefined
}

const IDENT = /(?:[A-Za-z_]\w*|`[^`\n]+`)/.source

export const grammar: Grammar = {
  states: {
    root: [
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { include: 'code' },
    ],
    code: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"""/, token: 'string', push: 'raw' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /'(?:[^'\\\n]|\\(?:u[\da-fA-F]{4}|.))'/, token: 'string' },
      { match: /@(?:\w+:)?[A-Za-z_][\w.]*/, token: 'meta' },
      { match: new RegExp(`(fun)(\\s+)((?:<[^>\\n]*>\\s*)?(?:[\\w.]+\\.)?)(${IDENT})`), groups: ['keyword', undefined, undefined, 'function'] },
      { match: new RegExp(`(class|interface|object|typealias)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: /(package|import)(\s+)([\w.]+(?:\.\*)?)/, groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*(?:<[\\w\\s,<>?*]*>)?\\s*[({])`), groups: ['punctuation', 'function'] },
      { match: /(\??\.)([A-Z][a-z]\w*)/, groups: ['punctuation', 'type'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`(::)(${IDENT})`), groups: ['operator', 'function'] },
      // A call, or a trailing lambda: f(x), list.map { }, launch {.
      {
        match: new RegExp(`${IDENT}(?=\\s*(?:<[\\w\\s,<>?*]*>)?\\s*\\()`),
        token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function'),
      },
      { match: new RegExp(`${IDENT}(?=\\s*\\{)`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)(?:[uU]?[lL]?|[fF])?/,
        token: 'number',
      },
      { match: /\?:|\?\.|!!|->|::|\.\.<?|\+\+|--|&&|\|\||===?|!==?|[-+*/%<>!=]=?|\?/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    // "$name" and "${expr}" in both kinds of string.
    template: [
      { match: /\$[A-Za-z_]\w*/, token: 'variable' },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
    ],
    string: [
      { match: /[^"\\$]+/, token: 'string' },
      { match: /\\(?:u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { include: 'template' },
      { match: /\$/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    raw: [
      { match: /[^"$]+/, token: 'string' },
      { include: 'template' },
      { match: /\$/, token: 'string' },
      { match: /"""/, token: 'string', pop: true },
      { match: /"/, token: 'string' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'code' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'code' },
    ],
    blockComment: [
      { match: /[^*/]+/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*/]/, token: 'comment' },
    ],
  },
}
