import type { Grammar } from '../../engine/grammar.js'

// Turtle: RDF triples. @prefix lines, subjects with ; and , separated
// predicates and objects, <IRIs>, prefixed:names, "literals"@en and ^^types.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /@(?:prefix|base)\b|(?:PREFIX|BASE)\b/i, token: 'keyword' },
      { match: /<[^<>"{}|^`\\\s]*>/, token: 'regexp' }, // an IRI
      { match: /"""/, token: 'string', push: 'longDouble' },
      { match: /'''/, token: 'string', push: 'longSingle' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /@[a-zA-Z]+(?:-[a-zA-Z\d]+)*/, token: 'meta' }, // "chat"@fr
      { match: /\^\^/, token: 'operator' },
      { match: /_:[\w.-]*\w/, token: 'variable' }, // a blank node
      { match: /a(?=\s)/, token: 'keyword' }, // rdf:type
      { match: /(?:true|false)(?![\w:])/, token: 'constant' },
      { match: /(?:[A-Za-z][\w.-]*)?:(?:[\w-]|\.(?=[\w-]))*/, token: 'type' }, // ex:name, :local
      { match: /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /[;,.[\]()]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:u[\da-fA-F]{4}|U[\da-fA-F]{8}|.)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /$/, pop: true },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\(?:u[\da-fA-F]{4}|U[\da-fA-F]{8}|.)/, token: 'escape' },
      { match: /[^'\\]+/, token: 'string' },
      { match: /$/, pop: true },
    ],
    longDouble: [
      { match: /"""/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^"\\]+|"/, token: 'string' },
    ],
    longSingle: [
      { match: /'''/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^'\\]+|'/, token: 'string' },
    ],
  },
}
