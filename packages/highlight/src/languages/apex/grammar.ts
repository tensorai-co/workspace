import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// Apex: Salesforce's Java-like language. Its words are any case; SOQL in [ ] is SQL.
const KEYWORDS = words(`
  abstract after before break catch class continue default delete do else enum extends final finally
  for global if implements inherited insert instanceof interface merge new on override private
  protected public return sharing static super switch testmethod this throw transient trigger
  try undelete update upsert virtual void webservice when while with without
`)
const TYPES = words('blob boolean date datetime decimal double id integer long object string time list map set sobject')
const CONSTANTS = words('true false null')
const VARIABLES = words('this super')

function name(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (VARIABLES.has(lower)) return 'variable'
  if (KEYWORDS.has(lower)) return 'keyword'
  if (TYPES.has(lower)) return 'builtin'
  if (CONSTANTS.has(lower)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // MAX_SIZE
  if (/^[A-Z]\w*$/.test(text)) return 'type' // String, T
  return undefined
}

const IDENT = /[A-Za-z_$][\w$]*/.source

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /'/, token: 'string', push: 'string' },
      // [SELECT Id FROM Account WHERE …]: SOQL, colored as SQL.
      { match: /\[(?=\s*(?:(?:select|find)\b|$))/i, token: 'punctuation', push: '@soql' },
      { match: /@(?!interface\b)[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/, token: 'meta' },
      { match: new RegExp(`(class|interface|enum|record|@interface)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(package|import(?:\\s+static)?)(\\s+)([\\w.]+(?:\\.\\*)?)`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`(::)(${IDENT})`), groups: ['operator', 'function'] }, // Order::total
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (/^[A-Z]/.test(t) && !/^[A-Z][A-Z\d_]+$/.test(t) ? 'type' : 'function') },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0[xX][\da-fA-F_]+(?:\.[\da-fA-F_]*)?(?:[pP][+-]?\d+)?|0[bB][01_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)[lLfFdD]?/,
        token: 'number',
      },
      { match: /->|::|\+\+|--|<<=?|>>>?=?|&&|\|\||[-+*/%&|^<>!=]=?|[~?]/, token: 'operator' },
      { match: /[()[\]{},;.:@]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\(?:u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
  embeds: {
    soql: { language: 'sql', end: /\]/ },
  },
}
