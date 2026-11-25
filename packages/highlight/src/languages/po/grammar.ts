import type { Grammar } from '../../engine/grammar.js'

// Gettext PO files: msgid and msgstr pairs, #: references, #, flags and
// "strings" with escapes and printf placeholders.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#,.*/, token: 'meta' }, // #, fuzzy, c-format
      { match: /#[:|].*/, token: 'variable' }, // #: src/file.c:12
      { match: /#.*/, token: 'comment' },
      { match: /(msgctxt|msgid_plural|msgid|msgstr)(\[\d+\])?/, groups: ['keyword', 'number'] },
      { match: /"/, token: 'string', push: 'string' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[hlLqjzt]*[diouxXeEfFgGaAcspn%]|\{\w*\}/, token: 'variable' },
      { match: /[^"\\%{]+|[%{]/, token: 'string' },
      { match: /$/, pop: true },
    ],
  },
}
