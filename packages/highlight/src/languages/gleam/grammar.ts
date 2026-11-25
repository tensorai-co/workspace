import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('as assert auto case const delegate derive echo else fn if implement import let macro opaque panic pub test todo type use')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'True' || text === 'False' || text === 'Nil') return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /@[a-z_]\w*/, token: 'meta' }, // @external, @deprecated
      { match: /(fn)(\s+)([a-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(type)(\s+)([A-Z]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(import)(\s+)([a-z_][\w/]*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(\.)([a-z_]\w*)(?=\s*\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([a-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[a-z_]\w*(?=:\s)/, token: 'property' }, // a label: name:
      { match: /[a-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:e-?\d+)?/, token: 'number' },
      { match: /\|>|->|<-|<>|\.\.|==|!=|<=\.?|>=\.?|&&|\|\||[-+*/%]\.?|[<>]\.?|[=!|#]/, token: 'operator' },
      { match: /[()[\]{},:.]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:u\{[\da-fA-F]+\}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
    ],
  },
}
