import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  query mutation subscription fragment on type interface union enum input scalar schema extend
  directive implements repeatable
`)
const CONSTANTS = words('true false null')
const SCALARS = words('ID Int Float String Boolean')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (SCALARS.has(text)) return 'builtin'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // an enum value: ADMIN
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+|,/ },
      { match: /#.*/, token: 'comment' },
      { match: /"""/, token: 'string', push: 'block' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /\$[A-Za-z_]\w*/, token: 'variable' },
      { match: /@[A-Za-z_]\w*/, token: 'meta' },
      { match: /(query|mutation|subscription|fragment)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /[A-Za-z_]\w*(?=\s*:)/, token: (t) => (/^[A-Z]/.test(t) && !/^[A-Z][A-Z\d_]+$/.test(t) ? 'type' : 'property') }, // name:, alias:
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /\.\.\.|[!=|&]/, token: 'operator' },
      { match: /[{}()[\]:]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    block: [
      { match: /\\"""/, token: 'escape' },
      { match: /"""/, token: 'string', pop: true },
      { match: /[^"\\]+|["\\]/, token: 'string' },
    ],
  },
}
