import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  as async await break case catch class const continue debugger default delete do else export
  extends finally for from function if import in instanceof let new of return static switch throw
  try typeof var void while with yield
`)
const CONSTANTS = words('true false null undefined NaN Infinity')
const VARIABLES = words('this super arguments')
const BUILTINS = words(`
  Array ArrayBuffer BigInt Boolean DataView Date Error EvalError Function Intl JSON Map Math Number
  Object Promise Proxy RangeError ReferenceError Reflect RegExp Set String Symbol SyntaxError TypeError
  URIError URL URLSearchParams WeakMap WeakRef WeakSet console document globalThis window navigator
  fetch structuredClone queueMicrotask setTimeout setInterval clearTimeout clearInterval
  parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent require module exports process
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (VARIABLES.has(text)) return 'variable'
  if (BUILTINS.has(text)) return 'builtin'
  if (/^_*[A-Z][\w$]*[a-z][\w$]*$/.test(text)) return 'type' // PascalCase: a class
  return undefined
}

/**
 * A slash starts a regular expression where a value is expected: at the
 * start of a line, after an operator, an opening bracket, a comma or a
 * keyword like return. After a name, a number or a closing bracket, it's
 * division.
 */
function valueExpected(prev: Token | undefined): boolean {
  if (!prev) return true
  if (prev.type === 'keyword' || prev.type === 'operator') return true
  return prev.type === 'punctuation' && /[([{,;:]$/.test(prev.text)
}

const IDENT = /[A-Za-z_$][\w$]*/.source

export const grammar: Grammar = {
  states: {
    root: [{ include: 'code' }],
    code: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { match: /'/, token: 'string', push: 'single' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /`/, token: 'string', push: 'template' },
      {
        match: /\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\[\n])+\/[dgimsuvy]*/,
        token: 'regexp',
        after: valueExpected,
      },
      { match: new RegExp(`(function)(\\s*\\*?\\s*)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(class)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\??\\.)(\\s*)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(\\s*)(${IDENT})`), groups: ['punctuation', undefined, 'property'] },
      { match: new RegExp(`#${IDENT}`), token: 'property' },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? 'function' },
      { match: new RegExp(`${IDENT}(?=\\s*=\\s*(?:async\\s*)?(?:\\([^()]*\\)|${IDENT})\\s*=>)`), token: 'function' },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?/,
        token: 'number',
      },
      { match: /=>|\.\.\.|\?\?=?|\*\*=?|&&=?|\|\|=?|[!=]==?|<<=?|>>>?=?|\+\+|--|[-+*/%&|^~<>!?]=?|=/, token: 'operator' },
      { match: /[()[\]{},;:.]/, token: 'punctuation' },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\(?:u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|.?)/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    double: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    // A template literal spans lines; ${ } holds code, which can hold more templates.
    template: [
      { match: /[^`\\$]+/, token: 'string' },
      { match: /\\(?:u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|[\s\S])/, token: 'escape' },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
      { match: /\$/, token: 'string' },
      { match: /`/, token: 'string', pop: true },
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
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
