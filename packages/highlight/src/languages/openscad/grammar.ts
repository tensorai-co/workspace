import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('module function if else for let each intersection_for include use assert echo')
const CONSTANTS = words('true false undef PI')
const BUILTINS = words(`
  cube sphere cylinder polyhedron square circle polygon text import surface translate rotate scale
  resize mirror multmatrix color offset hull minkowski union difference intersection linear_extrude
  rotate_extrude projection render children abs sign sin cos tan acos asin atan atan2 floor round
  ceil ln len log pow sqrt exp min max norm cross concat lookup str chr ord search version
  parent_module is_undef is_list is_num is_string
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// OpenSCAD: solid models from modules, transformations and $special variables.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(include|use)(\s*)(<[^>\n]*>)/, groups: ['keyword', undefined, 'string'] },
      { match: /\$[a-z]+/, token: 'variable' }, // $fn, $fa, $t
      { match: /[#%!*](?=\s*[a-z_])/, token: 'operator', after: (p) => !p || p.text === ';' || p.text === '{' || p.text === '}' || p.text === ')' }, // debug modifiers
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: new RegExp(`(module|function)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /==|!=|<=|>=|&&|\|\||[-+*/%^<>=!?:]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
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
