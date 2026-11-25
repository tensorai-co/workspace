import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  and break by catch class continue delete do else extends finally for if in instanceof is isnt loop
  new not of or own return super switch then throw try typeof unless until when while yield await
  import export from as default
`)
const CONSTANTS = words('true false null undefined yes no on off NaN Infinity')
const BUILTINS = words('console Math JSON Object Array String Number Promise require module exports process')

function name(text: string): TokenType | undefined {
  if (text === 'this') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (BUILTINS.has(text)) return 'builtin'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

/** A slash starts a regular expression where a value can start. */
const valueStarts = (p: Token | undefined) =>
  !p || p.type === 'operator' || p.type === 'keyword' || (p.type === 'punctuation' && /[([{,]$/.test(p.text))

// CoffeeScript: JavaScript with significant indentation, -> functions,
// @properties, #{interpolation} and ### block comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /###(?!#)/, token: 'comment', push: 'blockComment' },
      { match: /#.*/, token: 'comment' },
      { match: /"""/, token: 'string', push: 'tripleDouble' },
      { match: /'''/, token: 'string', push: 'tripleSingle' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /`/, token: 'string', push: 'embedded' },
      { match: /\/\/\//, token: 'regexp', push: 'heregex' },
      { match: /\/(?![\s=/])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[gimsuy]*/, token: 'regexp', after: valueStarts },
      { match: /@[A-Za-z_$][\w$]*/, token: 'variable' }, // @name is this.name
      { match: /@/, token: 'variable' },
      { match: /(class)(\s+)([A-Za-z_$][\w$.]*)/, groups: ['keyword', undefined, 'type'] },
      // name = (args) -> and name: ->
      { match: /([A-Za-z_$][\w$]*)(\s*)([:=])(?=\s*(?:\([^)]*\)\s*)?[-=]>)/, groups: ['function', undefined, 'operator'] },
      { match: /(\.|::)([A-Za-z_$][\w$]*)(?=\s*\(|\s+["'@])/, groups: ['punctuation', 'function'] },
      { match: /(\.|::)([A-Za-z_$][\w$]*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_$][\w$]*(?=\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_$][\w$]*/, token: name },
      { match: /0[xX][\da-fA-F]+|0[bB][01]+|0[oO][0-7]+|(?:\d[\d_]*(?:\.(?!\.)\d*)?|\.\d+)(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /[-=]>|\.\.\.?|\?\.|\?=|\*\*=?|\/\/=?|%%=?|&&=?|\|\|=?|<<=?|>>>?=?|[-+*/%&|^<>!=]=?|[~?]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { include: 'interpolated' },
    ],
    tripleDouble: [
      { match: /"""/, token: 'string', pop: true },
      { include: 'interpolated' },
    ],
    interpolated: [
      { match: /#\{/, token: 'escape', push: 'interpolation' },
      { match: /\\./, token: 'escape' },
      { match: /[^"#\\]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^'\\]+/, token: 'string' },
    ],
    tripleSingle: [
      { match: /'''/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^'\\]+|'/, token: 'string' },
    ],
    embedded: [
      { match: /`/, token: 'string', pop: true },
      { match: /[^`]+/, token: 'string' },
    ],
    heregex: [
      { match: /\/\/\/[gimsuy]*/, token: 'regexp', pop: true },
      { match: /#\{/, token: 'escape', push: 'interpolation' },
      { match: /\s#.*/, token: 'comment' },
      { match: /[^/#\s]+|\s+|[/#]/, token: 'regexp' },
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
      { match: /###/, token: 'comment', pop: true },
      { match: /[^#]+|#/, token: 'comment' },
    ],
  },
}
