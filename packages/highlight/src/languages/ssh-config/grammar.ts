import type { Grammar } from '../../engine/grammar.js'

// OpenSSH client and server config: Host and Match blocks, Keyword value
// lines, # comments and %h-style tokens.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment', after: (p) => p === undefined },
      { match: /(Host|Match)(\s+)(.*)/i, groups: ['keyword', undefined, 'type'], after: (p) => p === undefined },
      { match: /([A-Za-z]+)(\s*=\s*|\s+)/, groups: ['property', undefined], push: 'value', after: (p) => p === undefined },
    ],
    value: [
      { match: /$/, pop: true },
      { match: /\s+/ },
      { match: /"[^"\n]*"?/, token: 'string' },
      { match: /(?:yes|no|ask|auto|any|none|always|confirm)(?=\s|$)/i, token: 'constant' },
      { match: /\d+[smhdw]?(?=\s|$)/, token: 'number' },
      { match: /%[%CdhikLlnprTu]|\$\{\w+\}/, token: 'variable' },
      { match: /[^\s"%$]+|[%$]/, token: 'string' },
    ],
  },
}
