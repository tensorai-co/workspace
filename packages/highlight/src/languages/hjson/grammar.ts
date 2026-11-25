import type { Grammar } from '../../engine/grammar.js'

// Hjson: JSON for people. Keys without quotes, values without quotes to the
// end of the line, ''' multi-line strings, and #, // and /* */ comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:#|\/\/).*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /'''/, token: 'string', push: 'multiline' },
      { match: /"(?:[^"\\]|\\.)*"(?=\s*:)|'(?:[^'\\]|\\.)*'(?=\s*:)/, token: 'property' },
      { match: /[^\s,:[\]{}"'#/]+(?=\s*:)/, token: 'property' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /(?:true|false|null)(?=\s*(?:[,\]}]|#|\/\/|$))/, token: 'constant' },
      { match: /-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?(?=\s*(?:[,\]}]|#|\/\/|$))/, token: 'number' },
      { match: /[:,]/, token: 'punctuation' },
      { match: /[[\]{}]/, token: 'punctuation' },
      { match: /[^\s,[\]{}][^\n]*/, token: 'string' }, // a quoteless string: to the end of the line
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:u[\da-fA-F]{4}|.)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\(?:u[\da-fA-F]{4}|.)/, token: 'escape' },
      { match: /[^'\\]+/, token: 'string' },
    ],
    multiline: [
      { match: /'''/, token: 'string', pop: true },
      { match: /[^']+|'/, token: 'string' },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
}
