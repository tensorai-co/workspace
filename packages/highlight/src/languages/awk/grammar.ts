import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('BEGIN END BEGINFILE ENDFILE function func if else while for do break continue next nextfile exit return delete in getline print printf')
const BUILTINS = words(`
  length substr index split sub gsub gensub match sprintf tolower toupper system close fflush int sqrt
  exp log sin cos atan2 rand srand strftime systime asort asorti
`)
const VARIABLES = words('NR NF FNR FS OFS RS ORS FILENAME SUBSEP RSTART RLENGTH ENVIRON ARGC ARGV CONVFMT OFMT IGNORECASE')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (VARIABLES.has(text)) return 'variable'
  return undefined
}

/** A slash starts a regex where a value or pattern is expected. */
const regexAllowed = (p: Token | undefined) => !p || p.type === 'keyword' || p.type === 'operator' || /[({,;!~]$/.test(p.text)

export const grammar: Grammar = {
  states: {
    root: [
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /\/(?:\\.|\[[^\]\n]*\]|[^/\\\n])+\//, token: 'regexp', after: regexAllowed },
      { match: /\$(?:\d+|NF|[A-Za-z_]\w*|\()/, token: 'variable' }, // $0, $1, $NF
      { match: /(function|func)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /[A-Za-z_]\w*(?=\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /\+\+|--|\*\*=?|&&|\|\||!~|[-+*/%^<>!=]=?|[~?:|]/, token: 'operator' },
      { match: /[()[\]{},;]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
  },
}
