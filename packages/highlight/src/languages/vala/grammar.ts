import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  abstract as async base break case catch class const construct continue default delegate delete do
  dynamic else ensures enum errordomain extern finally for foreach get if in inline interface
  internal is lock namespace new out override owned params private protected public ref requires
  return set signal sizeof static struct switch throw throws try typeof unowned using value var
  virtual void volatile weak while yield
`)
const TYPES = words(`
  bool char uchar int uint long ulong short ushort int8 int16 int32 int64 uint8 uint16 uint32 uint64
  float double string unichar size_t ssize_t
`)
const CONSTANTS = words('true false null')
const BUILTINS = words('print stdout stderr')
const VARIABLES = words('this base')

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

// Vala: C#-like for GObject: signals, properties, async and @"$templates".
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /#\s*[a-z]+.*/, token: 'meta', after: (p) => p === undefined },
      { match: /"""/, token: 'string', push: 'string0' },
      { match: /@"/, token: 'string', push: 'string1' },
      { match: /"/, token: 'string', push: 'string2' },
      { match: /'/, token: 'string', push: 'string3' },
      { match: /\[[A-Z]\w*(?:\s*\([^)]*\))?\]/, token: 'meta' },
      { match: new RegExp(`(class|struct|enum|interface|namespace|errordomain)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /=>|->|::|\.\.\.?|&&|\|\||<<=?|>>=?|[-+*/%&|^<>!=]=?|[~?:@#$]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"""/, token: 'string', pop: true },
      { match: /[^"]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
    string1: [
      { match: /"/, token: 'string', pop: true },
      { match: /\$\(/, token: 'escape', push: 'interpolation' },
      { match: /\$[A-Za-z_]\w*/, token: 'variable' },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"$\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    string2: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    string3: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^'\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    interpolation: [
      { match: /\)/, token: 'escape', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { include: 'root' },
    ],
    parens: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { include: 'root' },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
