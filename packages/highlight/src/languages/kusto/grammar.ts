import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// Kusto Query Language (Azure Data Explorer, Log Analytics, Sentinel).
const OPERATORS = words(`
  where filter project project-away project-rename project-reorder extend summarize count take limit
  top sort order join union lookup mv-expand mv-apply parse parse-where evaluate render distinct
  sample sample-distinct search find make-series as invoke getschema serialize range datatable print
`)
const KEYWORDS = words(`
  let by on asc desc nulls first last and or not in has contains startswith endswith matches regex
  between kind inner outer leftouter rightouter fullouter leftanti rightanti leftsemi rightsemi with
  step from to of has_any has_all in~ !in !has !contains
`)
const BUILTINS = words(`
  ago now bin floor ceiling round abs strlen substring tolower toupper tostring toint tolong todouble
  todatetime totimespan iff iif case isempty isnotempty isnull isnotnull count dcount sum avg min max
  percentile percentiles make_list make_set arg_max arg_min countif sumif avgif dcountif
  startofday startofweek endofday format_datetime split strcat extract parse_json bag_unpack
  datetime timespan dynamic hash series_decompose
`)

/** A tabular operator follows a pipe. */
const afterPipe = (p: Token | undefined) => !!p && p.text === '|'

function name(text: string): TokenType | undefined {
  if (text === 'true' || text === 'false' || text === 'null') return 'constant'
  if (KEYWORDS.has(text)) return 'keyword'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /@?"(?:[^"\\\n]|\\.)*"?|@?'(?:[^'\\\n]|\\.)*'?|```/, token: 'string' },
      { match: /[a-z][\w-]*/, token: (t) => (OPERATORS.has(t) ? 'keyword' : name(t)), after: afterPipe },
      { match: /(let)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'variable'] },
      { match: /(datetime|timespan|dynamic)(\()([^)\n]*)(\))/, groups: ['builtin', 'punctuation', 'string', 'punctuation'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] }, // Properties.city
      { match: /[A-Za-z_][\w]*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_][\w]*/, token: (t) => name(t) ?? (/^[A-Z]/.test(t) ? 'type' : undefined) }, // tables are capitalized
      { match: /\d+(?:\.\d+)?(?:d|h|m|s|ms|microsecond|tick|day|days|hour|hours|minute|minutes|second|seconds)\b/, token: 'number' }, // a timespan
      { match: /\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /==|!=|<=|>=|=~|!~|\|/, token: 'operator' },
      { match: /[-+*/%<>=!]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
  },
}
