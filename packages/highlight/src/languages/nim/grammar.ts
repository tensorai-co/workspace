import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  addr and as asm bind block break case cast concept const continue converter defer discard
  distinct div do elif else end enum except export finally for from func if import in include
  interface is isnot iterator let macro method mixin mod nil not notin object of or out proc ptr
  raise ref return shl shr static template try tuple type using var when while xor yield
`)
const TYPES = words(`
  int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float float32 float64 bool char string
  cstring pointer void seq array openArray set range auto untyped typed
`)
const BUILTINS = words('echo len high low inc dec add del new assert doAssert result')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false') return 'constant'
  if (TYPES.has(text)) return 'builtin'
  if (BUILTINS.has(text)) return 'builtin'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#\[/, token: 'comment', push: 'blockComment' },
      { match: /#.*/, token: 'comment' },
      { match: /\{\./, token: 'meta', push: 'pragma' },
      { match: /[rR]?"""/, token: 'string', push: 'triple' },
      { match: /[rR]"(?:[^"\n]|"")*"?/, token: 'string' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /'(?:[^'\\\n]|\\(?:x[\da-fA-F]{2}|.))'/, token: 'string' },
      { match: /(proc|func|method|iterator|template|macro|converter)(\s+)(`[^`\n]+`|[A-Za-z_]\w*)(\*?)/, groups: ['keyword', undefined, 'function', 'operator'] },
      { match: /(\.)([A-Za-z_]\w*)(?=\s*[("])/, groups: ['punctuation', 'function'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /`[^`\n]+`/ },
      { match: /(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?)(?:'?[iIuUfF]\d*)?/, token: 'number' },
      { match: /\.\.<?|==|!=|<=|>=|->|=>|[-+*/%=<>@$~&|!?^.:\\]+/, token: 'operator' },
      { match: /[()[\]{},;]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|u\{?[\da-fA-F]+\}?|\d+|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    triple: [
      { match: /"""(?!")/, token: 'string', pop: true },
      { match: /[^"]+|"/, token: 'string' },
    ],
    pragma: [
      { match: /\.?\}/, token: 'meta', pop: true },
      { match: /"[^"\n]*"/, token: 'string' },
      { match: /[^.}"]+|\./, token: 'meta' },
    ],
    blockComment: [
      { match: /#\[/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\]#/, token: 'comment', pop: true },
      { match: /[^#\]]+|[#\]]/, token: 'comment' },
    ],
  },
}
