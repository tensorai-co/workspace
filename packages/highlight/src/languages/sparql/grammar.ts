import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

// SPARQL: queries over RDF graphs. Keywords are any case.
const KEYWORDS = words(`
  base prefix select distinct reduced construct describe ask from named where order by asc desc limit
  offset values optional graph union minus filter bind service silent as group having insert delete
  data with using load clear drop create add move copy into default all not in exists a
`)
const BUILTINS = words(`
  str lang langmatches datatype bound iri uri bnode rand abs ceil floor round concat strlen ucase
  lcase encode_for_uri contains strstarts strends strbefore strafter year month day hours minutes
  seconds timezone tz now uuid struuid md5 sha1 sha256 sha512 coalesce if strlang strdt sameterm
  isiri isuri isblank isliteral isnumeric regex replace count sum min max avg sample group_concat
`)

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /<[^<>"{}|^`\\\s]*>/, token: 'regexp' }, // an IRI
      { match: /"""/, token: 'string', push: 'longDouble' },
      { match: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/, token: 'string' },
      { match: /@[a-zA-Z]+(?:-[a-zA-Z\d]+)*/, token: 'meta' }, // "chat"@fr
      { match: /\^\^/, token: 'operator' },
      { match: /[?$][A-Za-z_]\w*/, token: 'variable' },
      { match: /(?:[A-Za-z][\w.-]*)?:[\w.-]*/, token: 'type' }, // ex:name, :local
      { match: /_:[\w.-]+/, token: 'variable' }, // a blank node
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => (KEYWORDS.has(t.toLowerCase()) ? 'keyword' : BUILTINS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: /[A-Za-z]+/, token: (t) => (KEYWORDS.has(t.toLowerCase()) ? 'keyword' : t === 'true' || t === 'false' ? 'constant' : undefined) },
      { match: /[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /&&|\|\||!=|<=|>=|[=<>!*+/|^-]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    longDouble: [
      { match: /"""/, token: 'string', pop: true },
      { match: /[^"]+|"/, token: 'string' },
    ],
  },
}
