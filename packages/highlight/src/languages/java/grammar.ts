import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  abstract assert break case catch class const continue default do else enum exports extends final
  finally for goto if implements import instanceof interface module native new non-sealed open opens
  package permits private protected provides public record requires return sealed static strictfp
  super switch synchronized throw throws to transient transitive try uses var when while with yield
`)
const TYPES = words('boolean byte char double float int long short void')
const CONSTANTS = words('true false null')
const VARIABLES = words('this super')

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
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
      // A text block: """ to the end of the line, then lines up to the closing """.
      { match: /"""/, token: 'string', push: 'textBlock' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /'(?:[^'\\\n]|\\(?:u+[\da-fA-F]{4}|[0-7]{1,3}|.))'/, token: 'string' },
      { match: /@(?!interface\b)[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/, token: 'meta' },
      { match: new RegExp(`(class|interface|enum|record|@interface)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(package|import(?:\\s+static)?)(\\s+)([\\w.]+(?:\\.\\*)?)`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Z][a-z][\w$]*)/, groups: ['punctuation', 'type'] }, // Map.Entry
      { match: new RegExp(`(\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`(::)(${IDENT})`), groups: ['operator', 'function'] }, // Order::total
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => (KEYWORDS.has(t) || VARIABLES.has(t) ? name(t) : /^[A-Z]/.test(t) && !/^[A-Z][A-Z\d_]+$/.test(t) ? 'type' : 'function') },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0[xX][\da-fA-F_]+(?:\.[\da-fA-F_]*)?(?:[pP][+-]?\d+)?|0[bB][01_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)[lLfFdD]?/,
        token: 'number',
      },
      { match: /->|::|\+\+|--|<<=?|>>>?=?|&&|\|\||[-+*/%&|^<>!=]=?|[~?]/, token: 'operator' },
      { match: /[()[\]{},;.:@]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:u+[\da-fA-F]{4}|[0-7]{1,3}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    textBlock: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:u+[\da-fA-F]{4}|[0-7]{1,3}|.?)/, token: 'escape' },
      { match: /"""/, token: 'string', pop: true },
      { match: /"/, token: 'string' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
