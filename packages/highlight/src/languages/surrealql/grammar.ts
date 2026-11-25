import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

// SurrealQL: SurrealDB's SQL. Records like person:tobie, graph edges with
// ->likes->, $parameters, DEFINE statements and objects in braces.
const KEYWORDS = words(`
  select from where group by order asc desc limit start fetch timeout parallel explain split only value
  create update upsert delete relate insert into set unset content merge patch replace return before
  after diff none null define remove table field index event function param analyzer namespace database
  user access scope token type schemafull schemaless permissions full for if else then end let begin
  commit cancel transaction use ns db live kill info show changes since sleep throw break continue
  and or not is in contains containsnot containsall containsany inside notinside outside intersects
  as on unique search assert default readonly flexible option array object string int float bool
  datetime duration record geometry decimal number any with noindex omit tempfiles
`)
const CONSTANTS = words('true false null none')

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:--|\/\/|#).*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /[rsdu]?"/, token: 'string', push: 'double' }, // r"person:1", d"2026-01-01"
      { match: /[rsdu]?'/, token: 'string', push: 'single' },
      { match: /\$[A-Za-z_]\w*/, token: 'variable' },
      { match: /([A-Za-z_]\w*)(:)([A-Za-z_]\w*|⟨[^⟩]*⟩|\d+|`[^`]*`)/, groups: ['type', 'operator', 'constant'] }, // person:tobie
      { match: /(<-|->|<->)([A-Za-z_]\w*)?/, groups: ['operator', 'type'] }, // ->likes->
      { match: /([A-Za-z_]\w*(?:::[A-Za-z_]\w*)+)(?=\s*\()/, token: 'builtin' }, // string::len()
      { match: /fn::[\w:]+/, token: 'function' },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => (KEYWORDS.has(t.toLowerCase()) ? 'keyword' : 'function') },
      { match: /[A-Za-z_]\w*/, token: (t) => (CONSTANTS.has(t.toLowerCase()) ? 'constant' : KEYWORDS.has(t.toLowerCase()) ? 'keyword' : undefined) },
      { match: /\d+(?:\.\d+)?(?:[eE][-+]?\d+)?(?:f|dec|ns|us|µs|ms|s|m|h|d|w|y)?/, token: 'number' },
      { match: /\?\?|\?:|==|!=|\*=|\?=|<=|>=|\+=|-=|&&|\|\||[-+*/%<>=!~?@]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^'\\]+/, token: 'string' },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
}
