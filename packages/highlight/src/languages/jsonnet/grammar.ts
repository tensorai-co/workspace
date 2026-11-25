import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('local function if then else for in import importstr importbin assert error tailstrict')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false' || text === 'null') return 'constant'
  if (text === 'self' || text === 'super' || text === '$') return 'variable'
  if (text === 'std') return 'builtin'
  return undefined
}

// Jsonnet: JSON with variables, functions, conditionals and object merging.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:\/\/|#).*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /\|\|\|-?\s*$/, token: 'string', push: 'textBlock' },
      { match: /@?"/, token: 'string', push: 'double' },
      { match: /@?'/, token: 'string', push: 'single' },
      // A field: name:, name+:, name::, name:::, "name":
      { match: /(?:[A-Za-z_]\w*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')(?=\s*\+?:{1,3}(?!:))/, token: 'property' },
      { match: /(local)(\s+)([A-Za-z_]\w*)(?=\s*\()/, groups: ['keyword', undefined, 'function'] },
      { match: /(\.)([A-Za-z_]\w*)(?=\s*\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_$]\w*/, token: name },
      { match: /\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /\+?:{1,3}|==|!=|<=|>=|&&|\|\||<<|>>|[-+*/%<>=!&|^~]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    double: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\(?:u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
    ],
    // ||| … |||: indented lines of text.
    textBlock: [
      { match: /\s*\|\|\|/, token: 'string', pop: true },
      { match: /.+/, token: 'string' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
