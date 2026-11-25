import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  syntax edition package import public weak option message enum service rpc returns stream oneof
  map repeated optional required reserved extensions extend to max group
`)
const SCALARS = words('double float int32 int64 uint32 uint64 sint32 sint64 fixed32 fixed64 sfixed32 sfixed64 bool string bytes')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (SCALARS.has(text)) return 'builtin'
  if (text === 'true' || text === 'false') return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // an enum value
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

// Protocol Buffers (proto2 and proto3) and gRPC services.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/, token: 'string' },
      { match: /(message|enum|service|extend)(\s+)([A-Za-z_][\w.]*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(rpc)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /\((?=[\w.]+\))/, token: 'punctuation' },
      { match: /[A-Za-z_]\w*(?=\s*=\s*\d)/, token: 'property' }, // a field's name: city = 1
      { match: /[A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)+/, token: 'type' }, // google.protobuf.Timestamp
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /-?(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|inf|nan)/, token: 'number' },
      { match: /[=<>]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
