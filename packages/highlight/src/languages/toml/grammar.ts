import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'

/** A key starts a line, or follows { or , in an inline table, or a dot in a dotted key. */
function keyAllowed(prev: Token | undefined): boolean {
  return !prev || /^(?:\{|,|\.)$/.test(prev.text)
}

const KEY = /[A-Za-z0-9_-]+|"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/.source

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      // [table], [[array.of.tables]]
      { match: /\[\[?[^\]\n]*\]\]?/, token: 'type', after: (p) => p === undefined },
      { match: new RegExp(`(?:${KEY})(?=\\s*[.=])`), token: 'property', after: keyAllowed },
      { match: /"""/, token: 'string', push: 'multiline' },
      { match: /'''/, token: 'string', push: 'multilineLiteral' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /'[^'\n]*'?/, token: 'string' },
      { match: /(?:true|false)(?![\w-])/, token: 'constant' },
      // Dates and times: 1979-05-27, 07:32:00, 1979-05-27T07:32:00.999-07:00.
      { match: /\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:\d{2})?)?|\d{2}:\d{2}:\d{2}(?:\.\d+)?/, token: 'number' },
      { match: /[+-]?(?:0x[\da-fA-F_]+|0o[0-7_]+|0b[01_]+|inf|nan|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)(?![\w-])/, token: 'number' },
      { match: /=/, token: 'operator' },
      { match: /[[\]{},.]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:u[\da-fA-F]{4}|U[\da-fA-F]{8}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    multiline: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:u[\da-fA-F]{4}|U[\da-fA-F]{8}|.?)/, token: 'escape' },
      { match: /"""(?!")/, token: 'string', pop: true },
      { match: /"/, token: 'string' },
    ],
    multilineLiteral: [
      { match: /[^']+/, token: 'string' },
      { match: /'''(?!')/, token: 'string', pop: true },
      { match: /'/, token: 'string' },
    ],
  },
}
