import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// WebAssembly's text format (.wat): S-expressions of modules and instructions.
const KEYWORDS = words(`
  module func param result local global memory table export import type elem data start mut offset
  item declare if then else end loop block br br_if br_table return call call_indirect unreachable
  nop drop select try catch throw rec struct array field sub final
`)
const TYPES = words('i32 i64 f32 f64 v128 funcref externref anyref eqref i31ref structref arrayref ref null')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (/^(?:[if](?:32|64)|v128|i8x16|i16x8|i32x4|i64x2|f32x4|f64x2|local|global|memory|table|ref|struct|array)\./.test(text)) return 'function' // i32.add, local.get
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;;.*/, token: 'comment' },
      { match: /\(;/, token: 'comment', push: 'blockComment' },
      { match: /"(?:[^"\\\n]|\\[\da-fA-F]{2}|\\.)*"?/, token: 'string' },
      { match: /\$[\w!#$%&'*+\-./:<=>?@\\^`|~]+/, token: 'variable' }, // $name
      { match: /[a-z][\w.]*(?:=\d+)?/, token: name },
      { match: /[-+]?(?:0x[\da-fA-F_]+(?:\.[\da-fA-F_]*)?(?:[pP][-+]?\d+)?|\d[\d_]*(?:\.[\d_]*)?(?:[eE][-+]?\d+)?|inf|nan(?::0x[\da-fA-F]+)?)/, token: 'number' },
      { match: /[()]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /\(;/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /;\)/, token: 'comment', pop: true },
      { match: /[^(;]+|[(;]/, token: 'comment' },
    ],
  },
}
