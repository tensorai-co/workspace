import type { Grammar } from '../../engine/grammar.js'

// JSON, and JSONC's comments. A string before a colon is a key.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"(?:[^"\\]|\\.)*"(?=\s*:)/, token: 'property' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /(?:true|false|null)\b/, token: 'constant' },
      { match: /[{}[\],:]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/, token: 'escape' },
      { match: /\\./, token: 'string' },
      { match: /"/, token: 'string', pop: true },
      // A string can't span lines: an unclosed one ends with its line.
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
