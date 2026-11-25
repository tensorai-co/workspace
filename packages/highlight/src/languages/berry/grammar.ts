import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('if elif else while for def end class break continue return var static do import as try except raise')
const CONSTANTS = words('true false nil')
const BUILTINS = words(`
  print input type classname classof size super assert compile isinstance issubclass number int real
  bool str list map range bytes call module open tasmota
`)

function name(text: string): TokenType | undefined {
  if (text === 'self') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (BUILTINS.has(text)) return 'builtin'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

// Berry: a small scripting language for microcontrollers (Tasmota): def …
// end, classes, # and #- -# comments, f-strings.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#-/, token: 'comment', push: 'blockComment' },
      { match: /#.*/, token: 'comment' },
      { match: /f(?=["'])/, token: 'string' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /(def)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(class)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(\.)([A-Za-z_]\w*)(?=\s*\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /0[xX][\da-fA-F]+|(?:\d+(?:\.(?!\.)\d*)?|\.\d+)(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /\.\.|:=|->|==|!=|<=|>=|<<|>>|&&|\|\||[-+*/%&|^]=?|[<>=!~?:]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { include: 'stringBody' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { include: 'stringBody' },
    ],
    stringBody: [
      { match: /\\(?:x[\da-fA-F]{2}|[0-7]{3}|.?)/, token: 'escape' },
      { match: /\{[^}"'\n]*\}/, token: 'escape' }, // f"{x:.2f}"
      { match: /[^"'\\{]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^-]+/, token: 'comment' },
      { match: /-#/, token: 'comment', pop: true },
      { match: /-/, token: 'comment' },
    ],
  },
}
