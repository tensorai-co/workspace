import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  asm auto_cast bit_set break case cast context continue defer distinct do dynamic else enum
  fallthrough for foreign if import in map matrix not_in or_else or_return or_break or_continue
  package proc return struct switch transmute typeid union using when where
`)
const TYPES = words(`
  bool b8 b16 b32 b64 int i8 i16 i32 i64 i128 uint u8 u16 u32 u64 u128 uintptr f16 f32 f64 complex32
  complex64 complex128 quaternion64 quaternion128 quaternion256 rune string cstring rawptr typeid
  any byte
`)
const CONSTANTS = words('true false nil')
const BUILTINS = words(`
  len cap size_of align_of offset_of type_of type_info_of typeid_of min max abs clamp make new free
  delete append
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text) && text.length > 1) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// Odin: procedures with ::, distinct types, #directives and @attributes.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /([A-Za-z_]\w*)(\s*)(::)(\s*)(proc)\b/, groups: ['function', undefined, 'operator', undefined, 'keyword'] },
      { match: /([A-Za-z_]\w*)(\s*)(::)(\s*)(struct|enum|union|distinct|bit_set)\b/, groups: ['type', undefined, 'operator', undefined, 'keyword'] },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: /'/, token: 'string', push: 'string1' },
      { match: /`/, token: 'string', push: 'string2' },
      { match: /@\([^)\n]*\)|@[A-Za-z_]\w*|#[A-Za-z_]\w*/, token: 'meta' },
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
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
