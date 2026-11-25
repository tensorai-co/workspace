import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('package import for in if let')
const TYPES = words('int float string bool bytes number null uint int8 int16 int32 int64 uint8 uint16 uint32 uint64 float32 float64 rune top')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false' || text === 'null') return 'constant'
  if (TYPES.has(text)) return 'builtin'
  return undefined
}

// CUE: JSON's superset for configuration, with types and constraints as values.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /@[A-Za-z_]\w*(?:\([^)\n]*\))?/, token: 'meta' }, // @tag(env)
      { match: /#*"""/, token: 'string', push: (t) => `multi/${t.length - 3}` },
      { match: /#*"/, token: 'string', push: (t) => `string/${t.length - 1}` },
      { match: /'(?:[^'\\\n]|\\.)*'/, token: 'string' }, // bytes
      // A field: name:, "name":, #Def:, _hidden:, name?:, name!:
      { match: /(?:#?_?[A-Za-z$][\w$]*|"(?:[^"\\\n]|\\.)*")[?!]?(?=\s*:(?!=))/, token: 'property' },
      { match: /#[A-Za-z_$][\w$]*/, token: 'type' }, // a definition: #Config
      { match: /([A-Za-z_][\w]*)(\.)([A-Za-z_]\w*)(?=\()/, groups: ['type', 'punctuation', 'function'] }, // strings.ToUpper(
      { match: /[A-Za-z_$][\w$]*(?=\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_$][\w$]*/, token: name },
      { match: /0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][-+]?\d+)?(?:[KMGTP]i?)?/, token: 'number' },
      { match: /\.\.\.|==|!=|<=|>=|=~|!~|&&|\|\||[-+*/&|<>=!?:]/, token: 'operator' },
      { match: /[()[\]{},.]/, token: 'punctuation' },
    ],
    // "…\(expr)…", with #"…"# raw forms: the argument is the # count.
    string: [
      { match: (line, pos, n) => (line.startsWith('"' + '#'.repeat(Number(n)), pos) ? 1 + Number(n) : -1), token: 'string', pop: true },
      { match: (line, pos, n) => (line.startsWith('\\' + '#'.repeat(Number(n)) + '(', pos) ? 2 + Number(n) : -1), token: 'escape', push: 'interpolation' },
      { match: (line, pos, n) => (line.startsWith('\\' + '#'.repeat(Number(n)), pos) ? 2 + Number(n) : -1), token: 'escape' },
      { match: /[^"\\]+|["\\]/, token: 'string' },
      { match: /$/, pop: true },
    ],
    multi: [
      { match: (line, pos, n) => (line.startsWith('"""' + '#'.repeat(Number(n)), pos) ? 3 + Number(n) : -1), token: 'string', pop: true },
      { match: (line, pos, n) => (line.startsWith('\\' + '#'.repeat(Number(n)) + '(', pos) ? 2 + Number(n) : -1), token: 'escape', push: 'interpolation' },
      { match: /[^"\\]+|["\\]/, token: 'string' },
    ],
    interpolation: [
      { match: /\)/, token: 'escape', pop: true },
      { include: 'root' },
    ],
  },
}
