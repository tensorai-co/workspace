import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const DIRECTIVES = words('open close commodity balance pad note document event price query custom txn')

// Beancount: plain-text accounting. Dated directives, transactions with
// postings to Accounts:Like:This, amounts and currencies, #tags and ^links.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /^\*.*/, token: 'comment' }, // org-mode style headings
      { match: /(option|plugin|include|pushtag|poptag|pushmeta|popmeta)\b/, token: 'keyword', after: (p) => p === undefined },
      { match: /\d{4}-\d{2}-\d{2}/, token: 'number', after: (p) => p === undefined },
      { match: /[*!](?=\s)/, token: 'operator' }, // a transaction's flag
      { match: /[a-z]+/, token: (t) => (DIRECTIVES.has(t) ? 'keyword' : undefined), after: (p) => p?.type === 'number' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /(?:Assets|Liabilities|Equity|Income|Expenses)(?::[\p{L}\d][\p{L}\d-]*)+/u, token: 'type' },
      { match: /[a-z][\w-]*(?=:\s)/, token: 'property' }, // metadata: key: value
      { match: /#[\w-]+/, token: 'meta' },
      { match: /\^[\w-]+/, token: 'variable' },
      { match: /[-+]?\d[\d,]*(?:\.\d+)?/, token: 'number' },
      { match: /[A-Z][A-Z\d'._-]*[A-Z\d]|[A-Z]/, token: 'constant' }, // a currency: USD, VTI
      { match: /@@?|[{}]|[-+*/]/, token: 'operator' },
      { match: /(?:TRUE|FALSE|NULL)\b/, token: 'constant' },
      { match: /[:,]/, token: 'punctuation' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
  },
}
