import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  let in each if then else try otherwise error and or not as is type meta section shared catch
`)
const TYPES = words(`
  any anynonnull binary date datetime datetimezone duration function list logical none null number
  record table text time type nullable optional
`)
const CONSTANTS = words('true false null')
const VARIABLES = words('_')

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  return undefined
}

const IDENT = /[A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)*/.source

// Power Query M: let … in expressions, #"quoted names", each and _, records and Table.* functions.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#\"(?:[^\"]|\"\")*\"/, token: 'variable' }, // #\"Changed Type\"
      { match: /#(?:date|datetime|datetimezone|duration|time|table|binary|shared|sections|infinity|nan)\b/, token: 'builtin' },
      { match: /\[[^\]\n]*\]/, token: 'property' }, // [Column]
      { match: /[A-Z]\w*(?:\.[A-Z]\w*)+(?=\s*\()/, token: 'builtin' }, // Table.AddColumn(
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? 'function' },
      { match: new RegExp(IDENT), token: name },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /=>|\?\?|<>|<=|>=|\.\.\.?|[-+*/&<>=?@!]/, token: 'operator' },
      { match: /[()[\]{},;]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /[^"]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
