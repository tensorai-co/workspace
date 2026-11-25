import type { Grammar } from '../../engine/grammar.js'

// RON (Rusty Object Notation): Rust's values as data. Structs(field: value),
// enum variants, [lists], {maps}, Some(…), 'c' chars, r#"raw"# strings and
// #![enable(…)] extensions.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /#!\[[^\]\n]*\]/, token: 'meta' },
      { match: /r(#*)"/, token: 'string', push: (t) => `raw/${t.slice(1, -1)}` },
      { match: /b?"/, token: 'string', push: 'string' },
      { match: /b?'(?:[^'\\]|\\(?:u\{[\da-fA-F]+\}|x[\da-fA-F]{2}|.))'/, token: 'string' },
      { match: /(?:true|false|None)(?![\w])/, token: 'constant' },
      { match: /Some(?=\s*\()/, token: 'constant' },
      { match: /[A-Z]\w*/, token: 'type' }, // a struct or variant: Item, Color
      { match: /([a-z_]\w*)(\s*)(:)/, groups: ['property', undefined, 'punctuation'] },
      { match: /[-+]?(?:0x[\da-fA-F_]+|0o[0-7_]+|0b[01_]+|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d+)(?:[eE][-+]?\d+)?|inf|NaN)(?:[iuf](?:8|16|32|64|128|size))?/, token: 'number' },
      { match: /[a-z_]\w*/ },
      { match: /[()[\]{},:]/, token: 'punctuation' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:u\{[\da-fA-F]+\}|x[\da-fA-F]{2}|.)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
    raw: [
      { match: (line, pos, hashes) => (line.startsWith(`"${hashes}`, pos) ? hashes.length + 1 : -1), token: 'string', pop: true },
      { match: /[^"]+|"/, token: 'string' },
    ],
    comment: [
      { match: /\/\*/, token: 'comment', push: 'comment' }, // they nest
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^/*]+|[/*]/, token: 'comment' },
    ],
  },
}
