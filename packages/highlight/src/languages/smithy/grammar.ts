import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  namespace use metadata apply service operation resource structure union enum intEnum list map set
  string blob boolean byte short integer long float double bigInteger bigDecimal timestamp document
  member with for input output errors operations resources identifiers create read update delete put
  list version
`)
const CONSTANTS = words('true false null')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text) && text.length > 1) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// Smithy: AWS's API models: services, operations, structures and shapes with @traits.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\$version|\$\w+/, token: 'meta' },
      { match: /([a-z_]\w*)(\s*)(:=)/, groups: ['property', undefined, 'operator'] }, // input := {
      { match: /([a-z_]\w*)(\s*)(:)/, groups: ['property', undefined, 'punctuation'] },
      { match: /\/\/\/.*/, token: 'comment' },
      { match: /\/\/.*/, token: 'comment' },
      { match: /"""/, token: 'string', push: 'string0' },
      { match: /"/, token: 'string', push: 'string1' },
      { match: /@[\w.#]+/, token: 'meta' },
      { match: new RegExp(`(service|operation|resource|structure|union|enum|intEnum|list|map|set|namespace|string|integer|timestamp)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? 'function' },
      { match: new RegExp(IDENT), token: name },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /:=|=|[:#?]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"""/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
    string1: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
  },
}
