import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  abstract alias align asm assert auto body break case cast catch class const continue debug default
  delegate delete deprecated do else enum export extern final finally for foreach foreach_reverse
  function goto if immutable import in inout interface invariant is lazy macro mixin module new
  nothrow out override package pragma private protected public pure ref return scope shared static
  struct super switch synchronized template throw try typeid typeof union unittest version while
  with __gshared __traits __vector __parameters
`)
const TYPES = words(`
  void bool byte ubyte short ushort int uint long ulong cent ucent float double real ifloat idouble
  ireal cfloat cdouble creal char wchar dchar string wstring dstring size_t ptrdiff_t
`)
const CONSTANTS = words('true false null __FILE__ __LINE__ __MODULE__ __FUNCTION__')
const BUILTINS = words('writeln writefln writef write readln assert')
const VARIABLES = words('this super')

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

// D: C-like, with templates (!), ranges, mixins and contracts.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\+/, token: 'comment', push: 'nestedComment' }, // /+ … +/ nest
      { match: /#line.*/, token: 'meta', after: (p) => p === undefined },
      { match: /(\.)([A-Za-z_]\w*)(?=!\s*[(A-Za-z_])/, groups: ['punctuation', 'function'] }, // a template: x.map!(f)
      { match: /[A-Za-z_]\w*(?=!\s*[(A-Za-z_])(?!!=)/, token: 'function' },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /r"/, token: 'string', push: 'string3' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: /'/, token: 'string', push: 'string1' },
      { match: /`/, token: 'string', push: 'string2' },
      { match: /@[A-Za-z_][\w.]*/, token: 'meta' },
      { match: new RegExp(`(class|struct|enum|interface|union|template)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /=>|->|::|\.\.\.?|&&|\|\||<<=?|>>=?|[-+*/%&|^<>!=]=?|[~?:@#$]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    string1: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^'\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    string2: [
      { match: /`/, token: 'string', pop: true },
      { match: /[^`]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
    string3: [
      { match: /"/, token: 'string', pop: true },
      { match: /[^"]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
    nestedComment: [
      { match: /[^/+]+/, token: 'comment' },
      { match: /\/\+/, token: 'comment', push: 'nestedComment' },
      { match: /\+\//, token: 'comment', pop: true },
      { match: /[/+]/, token: 'comment' },
    ],
  },
}
