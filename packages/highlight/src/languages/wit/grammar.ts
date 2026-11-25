import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  package world interface import export use type record variant enum flags resource func static
  constructor include with as borrow own async
`)
const TYPES = words(`
  bool s8 s16 s32 s64 u8 u16 u32 u64 f32 f64 float32 float64 char string list option result tuple
  future stream
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  return undefined
}

const IDENT = /%?[a-z][\w-]*/.source

// WIT: WebAssembly component interfaces: packages, worlds, interfaces, records, variants and resources.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(package|import|export|use)(\s+)([\w-]+:[\w\-/]+(?:@[\w.-]+)?)/, groups: ['keyword', undefined, 'type'] },
      { match: /([a-z][\w-]*)(\s*)(:)(\s*)(func|static)\b/, groups: ['function', undefined, 'punctuation', undefined, 'keyword'] }, // get: func(
      { match: /([a-z][\w-]*)(\s*)(:)/, groups: ['property', undefined, 'punctuation'] },
      { match: /\/\/\/.*/, token: 'comment' },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /@(?:since|unstable|deprecated)(?:\([^)]*\))?/, token: 'meta' },
      { match: new RegExp(`(world|interface|record|variant|enum|flags|resource|type)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? 'function' },
      { match: new RegExp(IDENT), token: name },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /->|[:=@/]/, token: 'operator' },
      { match: /[()[\]{}<>,;.*]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
