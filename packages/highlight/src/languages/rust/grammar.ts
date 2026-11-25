import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  as async await break const continue crate dyn else enum extern fn for if impl in let loop match
  mod move mut pub ref return static struct super trait type union unsafe use where while yield
  macro_rules
`)
const PRIMITIVES = words('bool char str i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64')
const CONSTANTS = words('true false')

function name(text: string): TokenType | undefined {
  if (text === 'self') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (PRIMITIVES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // MAX_SIZE
  if (/^[A-Z]/.test(text)) return 'type' // String, Self, Option, T
  return undefined
}

const IDENT = /(?:r#)?[A-Za-z_]\w*/.source

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /#!?\[/, token: 'meta', push: 'attribute' },
      // r"…", r#"…"#, br##"…"##: no escapes, ended by " and as many #.
      { match: /[bc]?r#*"/, token: 'string', push: (t) => `raw/${t.length - t.indexOf('r') - 2}` },
      { match: /[bc]?"/, token: 'string', push: 'string' },
      { match: /b?'(?:[^'\\\n]|\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]{1,6}\}|.))'/, token: 'string' },
      { match: /'[A-Za-z_]\w*(?!')/, token: 'variable' }, // a lifetime: 'a, 'static
      { match: new RegExp(`${IDENT}!(?=\\s*[([{])`), token: 'builtin' }, // println!, vec![…]
      { match: new RegExp(`(fn)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(struct|enum|trait|type|union)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(mod)(\\s+)(${IDENT})`), groups: ['keyword', undefined, undefined] },
      { match: new RegExp(`(\\.)(${IDENT})(?=\\s*(?:::\\s*<[^>\\n]*>\\s*)?\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\.)(${IDENT}|\\d+)`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:::\\s*<[^>\\n]*>\\s*)?\\()`), token: (t) => name(t) ?? 'function' },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0x[\da-fA-F_]+|0o[0-7_]+|0b[01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)(?:[iu](?:8|16|32|64|128|size)|f32|f64)?/,
        token: 'number',
      },
      { match: /::|->|=>|\.\.=?|&&|\|\||<<=?|>>=?|[-+*/%&|^<>!=]=?|[?@~]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    // #[derive(Debug)], #![allow(dead_code)]: to the matching ].
    attribute: [
      { match: /\]/, token: 'meta', pop: true },
      { match: /\[/, token: 'meta', push: 'attribute' },
      { match: /"(?:[^"\\]|\\.)*"/, token: 'string' },
      { match: /[^\]["]+/, token: 'meta' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]{1,6}\}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
    ],
    raw: [
      { match: (line, pos, hashes) => (line.startsWith('"' + '#'.repeat(Number(hashes)), pos) ? Number(hashes) + 1 : -1), token: 'string', pop: true },
      { match: /[^"]+|"/, token: 'string' },
    ],
    blockComment: [
      { match: /[^*/]+/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*/]/, token: 'comment' },
    ],
  },
}
