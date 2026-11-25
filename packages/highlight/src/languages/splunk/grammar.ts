import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const OPERATORS = words('AND OR NOT XOR by BY as AS over OVER where WHERE output OUTPUT outputnew OUTPUTNEW')
const FUNCTIONS = words(`
  count dc distinct_count sum avg mean min max median mode range stdev values list first last earliest
  latest perc p95 p99 rate if case coalesce isnull isnotnull isnum isstr len lower upper substr replace
  split mvcount mvindex mvjoin mvfilter round floor ceil abs pow sqrt now relative_time strftime strptime
  tostring tonumber match like cidrmatch md5 sha256 spath json_extract
`)

// Splunk's search language (SPL): a search, then | command arguments,
// field=value pairs, functions and ``` comments ```.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /```/, token: 'comment', push: 'comment' },
      { match: /`[\w-]+(?:\([^)]*\))?`/, token: 'meta' }, // a macro: `my_macro(1)`
      { match: /(\|)(\s*)([a-z]\w*)/, groups: ['punctuation', undefined, 'keyword'] }, // | stats
      { match: /\[/, token: 'punctuation', push: 'subsearch' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /'[^'\n]*'/, token: 'variable' }, // 'field name'
      { match: /([\w.:{}*-]+)(\s*)(!=|<=|>=|==|=|<|>)/, groups: ['property', undefined, 'operator'] },
      { match: /[\w.]+(?=\()/, token: (t) => (FUNCTIONS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: (t) => (OPERATORS.has(t) ? 'operator' : t === 'true' || t === 'false' || t === 'null' ? 'constant' : undefined) },
      { match: /-?\d+(?:\.\d+)?[smhdwy]?(?![\w*])/, token: 'number' },
      { match: /[-+*/%.]|[<>]=?|!=/, token: 'operator' },
      { match: /[(),*]/, token: 'punctuation' },
      { match: /\S/ },
    ],
    subsearch: [
      { match: /\]/, token: 'punctuation', pop: true },
      { include: 'root' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
    comment: [
      { match: /```/, token: 'comment', pop: true },
      { match: /[^`]+|`/, token: 'comment' },
    ],
  },
}
