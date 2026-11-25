import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  as break case catch class const continue default delete do dynamic each else extends final finally
  for function get if implements import in include instanceof interface internal is namespace native
  new override package private protected public return set static super switch throw try typeof use
  var void while with
`)
const TYPES = words(`
  int uint Number String Boolean Object Array Vector Function void Class XML XMLList Date RegExp
  Error
`)
const CONSTANTS = words('true false null undefined NaN Infinity')
const BUILTINS = words('trace parseInt parseFloat isNaN getDefinitionByName setTimeout')
const VARIABLES = words('this super')

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text) && text.length > 1) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// ActionScript 3: Flash and AIR. Packages, classes, typed var x:int, getters and setters.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(function)(\s+)(get|set)(\s+)([A-Za-z_$][\w$]*)/, groups: ['keyword', undefined, 'keyword', undefined, 'function'] },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: /'/, token: 'string', push: 'string1' },
      { match: /\[\w+(?:\([^)]*\))?\]/, token: 'meta' },
      { match: new RegExp(`(class|interface|package)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(function)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /=>|->|::|\.\.\.?|&&|\|\||<<=?|>>=?|[-+*/%&|^<>!=]=?|[~?:@#$]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    string1: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^'\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
