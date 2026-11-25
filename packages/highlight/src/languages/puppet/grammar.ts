import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  class define node inherits include require contain if elsif else unless case default and or in
  function type plan apply undef application consumes produces site
`)
const TYPES = words(`
  String Integer Float Numeric Boolean Array Hash Optional Variant Enum Pattern Undef Any Data
  Scalar Struct Tuple Callable
`)
const CONSTANTS = words('true false undef present absent installed latest running stopped')
const BUILTINS = words(`
  notice warning err fail file template epp inline_template lookup hiera create_resources each map
  filter reduce defined realize tag tagged sprintf split join regsubst
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text) && text.length > 1) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// Puppet: classes and defined types of resources with attribute => values, $variables and "${interpolation}".
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\$(?:::)?[a-z_]\w*(?:::\w+)*/, token: 'variable' },
      { match: /([a-z]\w*(?:::\w+)*)(\s*)(\{)/, groups: ['tag', undefined, 'punctuation'], after: (p) => !p || p.text === '{' || p.text === '}' || p.text === ';' }, // a resource: package {
      { match: /([a-z_]\w*)(\s*)(=>|\+>)/, groups: ['property', undefined, 'operator'] }, // ensure =>
      { match: /\/(?:[^\/\\\n]|\\.)+\/(?=\s*[:,)\]}=]|\s+\{)/, token: 'regexp', after: (p) => !!p && (p.text === '=~' || p.text === '!~' || p.text === 'node' || p.text === ',' || p.text === '{') },
      { match: /\#.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: /'/, token: 'string', push: 'string1' },
      { match: new RegExp(`(class|define|node|type)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(function|plan)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /=>|\+>|->|~>|<-|<~|==|!=|=~|!~|<=|>=|<<|>>|[-+*/%<>=!?]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
      { match: /\$[A-Za-z_]\w*/, token: 'variable' },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"$\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    string1: [
      { match: /'/, token: 'string', pop: true },
      { match: /[^']+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
