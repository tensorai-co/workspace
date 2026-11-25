import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  access all self contract account entitlement mapping pub priv fun let var if else while for in
  return break continue switch case default resource struct event emit enum interface transaction
  prepare execute pre post import from create destroy init attachment to remove as as? as! nil auth
  view require
`)
const TYPES = words(`
  Int Int8 Int16 Int32 Int64 Int128 Int256 UInt UInt8 UInt16 UInt32 UInt64 UInt128 UInt256 Word8
  Word16 Word32 Word64 Fix64 UFix64 Address String Character Bool Void AnyStruct AnyResource Never
  Path StoragePath PublicPath Capability Type
`)
const CONSTANTS = words('true false nil')
const BUILTINS = words('panic assert log getAccount getCurrentBlock unsafeRandom revertibleRandom')
const VARIABLES = words('self')

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text) && text.length > 1) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// Cadence (Flow): resource-oriented contracts: access(all), resources with @, <- moves and &references.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /@(?=[A-Z{\[])/, token: 'operator' }, // @Vault: a resource type
      { match: /\/(?:storage|public|private)\/\w+/, token: 'constant' }, // /storage/vault
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: new RegExp(`(contract|resource|struct|event|enum|interface|attachment|entitlement)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(fun)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /<-!|<-|<->|\?\?|->|&&|\|\||<<|>>|[-+*/%&|^<>!=]=?|[~?:]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
