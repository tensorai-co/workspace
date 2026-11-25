import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  targetScope metadata param var resource module output existing for in if import using as with
  func type extension extends provider assert
`)
const TYPES = words('string int bool object array resourceInput resourceOutput')
const BUILTINS = words(`
  resourceGroup subscription tenant managementGroup deployment environment uniqueString concat
  format toLower toUpper length contains empty first last union intersection json string int bool
  base64 guid newGuid utcNow resourceId reference listKeys split replace substring trim range
  loadTextContent loadJsonContent getSecret
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (text === 'true' || text === 'false' || text === 'null') return 'constant'
  return undefined
}

// Bicep: Azure's language for deploying resources.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /'''/, token: 'string', push: 'multiline' },
      { match: /'/, token: 'string', push: 'string' },
      { match: /@[A-Za-z_]\w*/, token: 'meta' }, // @description(…), @secure()
      { match: /(param|var|output|resource|module|func|type)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'variable'] },
      { match: /[A-Za-z_]\w*(?=\s*:)/, token: 'property', after: (p) => !p || p.text === '{' || p.text === ',' },
      { match: /(\.)([A-Za-z_]\w*)(?=\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /\d+/, token: 'number' },
      { match: /==|!=|<=|>=|&&|\|\||\?\?|=~|!~|[-+*/%<>=!?:]|\.!/, token: 'operator' },
      { match: /[()[\]{},.]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^'\\$]+/, token: 'string' },
      { match: /\\(?:u\{[\da-fA-F]+\}|.)/, token: 'escape' },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
      { match: /\$/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    multiline: [
      { match: /'''/, token: 'string', pop: true },
      { match: /[^']+|'/, token: 'string' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { include: 'root' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
