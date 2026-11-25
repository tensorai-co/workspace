import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  class module interface type def end alias attr_reader attr_writer attr_accessor include extend prepend
  public private self instance singleton out in unchecked use as untyped
`)
const TYPES = words('void untyped bool boolish top bot nil true false self instance class')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return TYPES.has(text) ? 'builtin' : 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (/^_?[A-Z]/.test(text)) return 'type'
  return undefined
}

// RBS: Ruby's type signatures. Classes, modules and interfaces, and
// def name: (Args) -> Return.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(def)(\s+)((?:self\??\.)?[A-Za-z_]\w*[?!=]?|[-+*/%<>=!~[\]^&|`]+)(\s*)(:)/, groups: ['keyword', undefined, 'function', undefined, 'operator'] },
      { match: /(class|module|interface)(\s+)((?:::)?[A-Z_][\w:]*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(type)(\s+)([a-z_][\w:]*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(attr_(?:reader|writer|accessor))(\s+)([a-z_]\w*)/, groups: ['keyword', undefined, 'property'] },
      { match: /@@?[a-z_]\w*/, token: 'variable' },
      { match: /%a\{[^}]*\}/, token: 'meta' },
      { match: /:"(?:[^"\\]|\\.)*"|:[A-Za-z_]\w*[?!=]?/, token: 'constant' },
      { match: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, token: 'string' },
      { match: /[A-Za-z_]\w*[?!]?(?=:)(?!::)/, token: 'property' }, // a keyword argument: name: String
      { match: /_?[A-Za-z_]\w*/, token: name },
      { match: /-?\d+(?:\.\d+)?/, token: 'number' },
      { match: /->|::|\*\*|[|&?*<>=^]/, token: 'operator' },
      { match: /[()[\]{},.:]/, token: 'punctuation' },
    ],
  },
}
