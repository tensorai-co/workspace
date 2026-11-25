import type { Grammar } from '../../engine/grammar.js'

// tasl: a typed schema language for RDF-style data. namespace prefixes,
// class and edge declarations, :: types, -> properties, <> units and [] lists.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(namespace)(\s+)([\w-]+)(\s+)(\S+)/, groups: ['keyword', undefined, 'type', undefined, 'regexp'] },
      { match: /(class|edge|type)(\s+)([\w-]+:[\w./-]*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(type)(\s+)([\w-]+)/, groups: ['keyword', undefined, 'type'] },
      { match: /(list|edge|class|type)\b/, token: 'keyword' },
      { match: /(?:string|uri|boolean|integer)\b/, token: 'builtin' }, // the literal types
      { match: /<[^>\s]*>/, token: 'regexp' }, // a URI
      { match: /[\w-]+:[\w./#-]*/, token: 'type' }, // ul:integer, s:name
      { match: /"(?:[^"\\]|\\.)*"/, token: 'string' },
      { match: /->|=>|::|[?|]/, token: 'operator' },
      { match: /[A-Za-z_][\w-]*/, token: 'variable' }, // a type variable
      { match: /[{}()[\]<>,;]/, token: 'punctuation' },
    ],
  },
}
