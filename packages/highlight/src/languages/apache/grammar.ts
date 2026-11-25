import type { Grammar } from '../../engine/grammar.js'

// Apache httpd config: <Sections>, Directives and their arguments,
// %{VARIABLES}, rewrite flags [L,R=301] and # comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment', after: (p) => p === undefined },
      { match: /(<\/?)([A-Za-z]\w*)/, groups: ['punctuation', 'tag'], push: 'section', after: (p) => p === undefined },
      { match: /[A-Za-z]\w*/, token: 'keyword', push: 'arguments', after: (p) => p === undefined },
    ],
    section: [
      { match: />/, token: 'punctuation', pop: true },
      { include: 'values' },
    ],
    arguments: [
      { match: /$/, pop: true },
      { match: /\\$/, token: 'operator' }, // continues on the next line
      { include: 'values' },
    ],
    values: [
      { match: /[ \t]+/ },
      { match: /"/, token: 'string', push: 'string' },
      { match: /%\{[\w:]+\}|\$\{\w+\}|[$%]\d/, token: 'variable' }, // %{HTTP_HOST}, ${APACHE_LOG_DIR}, $1
      { match: /\[[A-Z,=\d\w:-]+\]/, token: 'meta' }, // [L,R=301,NC]
      { match: /(?:On|Off|All|None|any|granted|denied)(?![\w-])/i, token: 'constant' },
      { match: /\d+(?:\.\d+){0,3}(?::\d+)?(?![\w./-])/, token: 'number' },
      { match: /\*:\d+|\*/, token: 'constant' },
      { match: /[^\s"%$>[\\]+|[%$[\\]/, token: 'string' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /%\{[\w:]+\}|\$\{\w+\}|%[a-zA-Z{}]+|[$%]\d/, token: 'variable' },
      { match: /[^"\\%$]+|[%$]/, token: 'string' },
    ],
  },
}
