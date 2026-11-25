import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  def let mut const if else for in while loop match return break continue export use module where
  try catch alias extern overlay hide source plugin
`)
const TYPES = words('int float string bool list record table duration filesize datetime nothing any binary path closure')

/** A command starts a line, or follows | ; ( { or a keyword like if. */
const commandStarts = (p: Token | undefined) => !p || /^(?:[|;({]|\{\|[^|]*\||=>)$/.test(p.text) || p.text === 'else'

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false' || text === 'null') return 'constant'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(def(?:-env)?|export def)(\s+)([\w-]+|"[^"\n]*")/, groups: ['keyword', undefined, 'function'] },
      { match: /\$"/, token: 'string', push: 'interpolated' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'[^'\n]*'?|`[^`\n]*`?/, token: 'string' },
      { match: /\$[A-Za-z_][\w-]*|\$env\.[\w-]+|\$in|\$it/, token: 'variable' },
      { match: /--?[A-Za-z][\w-]*/, token: 'property' }, // --flag
      { match: /(let|mut|const)(\s+)([\w-]+)/, groups: ['keyword', undefined, 'variable'] },
      { match: /(\{)(\|)([^|\n]*)(\|)/, groups: ['punctuation', 'operator', 'variable', 'operator'] }, // {|row| …}
      { match: /(?:and|or|not|mod|not-in|starts-with|ends-with|in)(?![\w-])/, token: 'operator', after: (p) => !!p && p.text !== 'for' && !commandStarts(p) },
      { match: /[A-Za-z_][\w-]*(?=:\s)/, token: 'property' }, // record field, typed parameter
      // A command, or a family's subcommand: str join, http get, into int.
      { match: /(?:(?:str|path|http|into|url|math|date|split|bits|bytes|random|from|to|format|hash|encode|decode) [a-z][\w-]*|[A-Za-z_][\w-]*)/, token: (t) => name(t) ?? (TYPES.has(t) ? 'builtin' : 'function'), after: commandStarts },
      { match: /[A-Za-z_][\w-]*/, token: (t) => name(t) ?? (TYPES.has(t) ? 'builtin' : undefined) },
      { match: /-?\d[\d_]*(?:\.\d+)?(?:b|kb|mb|gb|tb|kib|mib|gib|ns|us|ms|sec|min|hr|day|wk)?(?![\w.])/, token: 'number' },
      { match: /\.\.<?|=>|==|!=|<=|>=|=~|!~|\+\+|&&|\|\||[-+*/<>=!]|\b(?:and|or|not|mod|in|not-in|starts-with|ends-with)\b/, token: 'operator' },
      { match: /\|/, token: 'operator' },
      { match: /[()[\]{},;:.?]/, token: 'punctuation' },
    ],
    double: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
    ],
    // $"…(expr)…"
    interpolated: [
      { match: /[^"\\(]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /\(/, token: 'escape', push: 'subexpression' },
      { match: /"/, token: 'string', pop: true },
    ],
    subexpression: [
      { match: /\)/, token: 'escape', pop: true },
      { include: 'root' },
    ],
  },
}
