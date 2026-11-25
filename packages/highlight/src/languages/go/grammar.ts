import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  break case chan const continue default defer else fallthrough for func go goto if import interface
  map package range return select struct switch type var
`)
const CONSTANTS = words('true false nil iota')
/** The predeclared types. */
const TYPES = words(`
  any bool byte comparable complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune
  string uint uint8 uint16 uint32 uint64 uintptr
`)
const BUILTINS = words('append cap clear close complex copy delete imag len make max min new panic print println real recover')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (TYPES.has(text)) return 'builtin'
  if (BUILTINS.has(text)) return 'builtin'
  return undefined
}

/** A call: a builtin, a conversion to a predeclared type, or a function. */
function call(text: string): TokenType {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text) || BUILTINS.has(text)) return 'builtin'
  return 'function'
}

const IDENT = /[A-Za-z_]\w*/.source

/**
 * A capitalized name before { is a composite literal's type (Server{…}),
 * except where a block follows a value: range X {, if x == Y {.
 */
function literalAllowed(prev: Token | undefined): boolean {
  if (!prev) return true
  if (prev.type === 'keyword') return prev.text === 'return'
  if (prev.type === 'operator') return !/^(?:[=!<>]=|[<>]|&&|\|\|)$/.test(prev.text)
  return true
}

/** A capitalized name after *, [] or ] is a type: *Server, []Item, map[string]Value. */
function typePosition(prev: Token | undefined): boolean {
  return !!prev && /(?:^\*|\[\]|\])$/.test(prev.text)
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /`/, token: 'string', push: 'raw' },
      { match: /'(?:[^'\\\n]|\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|[0-7]{3}|.))'/, token: 'string' },
      { match: new RegExp(`(func)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(type)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      // A field or method: pkg.Name, s.field, s.Method(.
      { match: new RegExp(`(\\.)(${IDENT})(?=\\s*[([])`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: call },
      // A composite literal or a type in a declaration: Point{...}, []Item, *Server.
      { match: new RegExp(`${IDENT}(?=\\s*\\{)`), token: (t) => name(t) ?? (/^[A-Z]/.test(t) ? 'type' : undefined), after: literalAllowed },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (/^[A-Z]/.test(t) ? 'type' : undefined), after: typePosition },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0[xX][\da-fA-F_]+(?:\.[\da-fA-F_]*)?(?:[pP][+-]?\d+)?|0[oO]?[0-7_]+(?![\d.eE])|0[bB][01_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)i?/,
        token: 'number',
      },
      { match: /:=|\.\.\.|<-|&&|\|\||<<=?|>>=?|&\^=?|\+\+|--|[-+*/%&|^<>=!]=?|~/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|[0-7]{3}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    // A raw string spans lines and has no escapes.
    raw: [
      { match: /[^`]+/, token: 'string' },
      { match: /`/, token: 'string', pop: true },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
