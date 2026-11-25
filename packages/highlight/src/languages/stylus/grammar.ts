import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const KEYWORDS = words('if else unless for in return and or not is isnt defined')
const CONSTANTS = words('true false null inherit initial unset auto none transparent currentColor')

/** Whether pos follows only indentation: an indented line's first word. */
function indented(line: string, pos: number): boolean {
  if (pos === 0) return false
  for (let i = 0; i < pos; i++) if (line[i] !== ' ' && line[i] !== '\t') return false
  return true
}

/** An indented "name value" or "name: value" is a property; a lone word is a selector. */
const PROPERTY = /-?[A-Za-z][\w-]*(?=:\s|:$|\s+[^\s{,:&>+~])/y

// Stylus: CSS without braces, colons or semicolons. Indentation nests;
// $variables, mixins, @media and control flow.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /@[\w-]+/, token: 'keyword', push: 'values' },
      { match: /([\w$-]+)(\s*)(\?=|=)/, groups: ['variable', undefined, 'operator'], push: 'values', after: (p) => p === undefined },
      { match: /[\w-]+(?=\()/, token: 'function', push: 'values', after: (p) => p === undefined }, // a mixin: border-radius(n)
      {
        match: (line, pos) => {
          if (!indented(line, pos)) return -1
          PROPERTY.lastIndex = pos
          return PROPERTY.exec(line)?.[0].length ?? -1
        },
        token: 'property',
        push: 'values',
      },
      { match: /(?:if|else|unless|for|return)\b/, token: 'keyword', push: 'values', after: (p) => p === undefined },
      { match: /[.#][\w-]+|\{[^}]*\}/, token: 'function' }, // .class, #id, interpolation in a selector
      { match: /::?[\w-]+/, token: 'function' }, // :hover, ::before
      { match: /&/, token: 'operator' },
      { match: /\[[^\]]*\]/, token: 'property' },
      { match: /[A-Za-z][\w-]*|\*/, token: 'tag' },
      { match: /[>+~,]/, token: 'operator' },
      { match: /[(){}]/, token: 'punctuation' },
    ],
    // A value, to the end of the line.
    values: [
      { match: /$/, pop: true },
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /:/, token: 'punctuation' },
      { match: /"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?/, token: 'string' },
      { match: /#[\da-fA-F]{3,8}\b/, token: 'constant' },
      { match: /\$[\w-]+/, token: 'variable' },
      { match: /[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:%|[A-Za-z]+)?/, token: 'number' },
      { match: /[\w-]+(?=\()/, token: 'builtin' },
      { match: /!important\b/, token: 'keyword' },
      { match: /[A-Za-z_][\w-]*/, token: (t) => (KEYWORDS.has(t) ? 'keyword' : CONSTANTS.has(t) ? 'constant' : undefined) },
      { match: /\.\.\.?|==|!=|<=|>=|&&|\|\||[-+*/%<>=!?]/, token: 'operator' },
      { match: /[(),;{}[\]]/, token: 'punctuation' },
    ],
    comment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
