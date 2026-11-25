import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  addrspace align allowzero and anyframe anytype asm async await break callconv catch comptime const
  continue defer else enum errdefer error export extern fn for if inline linksection noalias
  noinline nosuspend opaque or orelse packed pub resume return struct suspend switch test
  threadlocal try union unreachable usingnamespace var volatile while
`)
const TYPES = words(`
  bool void noreturn type anyerror anyopaque comptime_int comptime_float isize usize c_char c_short
  c_int c_long c_longlong c_uint c_ulong f16 f32 f64 f80 f128
`)
const CONSTANTS = words('true false null undefined')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text) || /^[iu]\d+$/.test(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\\\\.*/, token: 'string' }, // a multiline string's line
      { match: /"/, token: 'string', push: 'string' },
      { match: /'(?:[^'\\\n]|\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|.))'/, token: 'string' },
      { match: /@[A-Za-z_]\w*/, token: 'builtin' }, // @import, @intCast
      { match: /(fn)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(\.)([A-Za-z_]\w*)(?=\s*\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /0x[\da-fA-F_]+(?:\.[\da-fA-F_]*)?(?:[pP][-+]?\d+)?|0o[0-7_]+|0b[01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /\.\.\.|\.\.|=>|\+\+|\*\*|\|\||<<=?|>>=?|[-+*/%&|^<>!=]=?|[+-]%=?|[+-]\|=?|[~?]|\.\*|\.\?/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
  },
}
