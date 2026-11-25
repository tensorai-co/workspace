import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  break case catch classdef continue else elseif end enumeration events for function global if
  methods otherwise parfor persistent properties return spmd switch try while arguments
`)
const BUILTINS = words(`
  disp fprintf sprintf printf zeros ones eye rand randn size length numel max min sum mean median
  std abs sqrt exp log round floor ceil mod isempty strcmp strcat num2str str2num str2double plot
  figure hold xlabel ylabel title legend grid axis error warning isfield fieldnames cellfun arrayfun
  linspace find any all sort unique reshape repmat cell struct containers
`)
const CONSTANTS = words('true false pi Inf NaN eps i j end nargin nargout')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (BUILTINS.has(text)) return 'builtin'
  return undefined
}

/** ' is a transpose after a value (a', x(1)', [1 2]'), and a string anywhere else. */
const transposes = (p: Token | undefined) => !!p && (p.type === undefined || p.type === 'number' || p.type === 'constant' || /[)\]}'.]$/.test(p.text))

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /%\{\s*$/, token: 'comment', push: 'blockComment', after: (p) => p === undefined },
      { match: /%.*/, token: 'comment' },
      { match: /\.\.\..*/, token: 'comment' }, // a continuation, and its comment
      { match: /\.?'/, token: 'operator', after: transposes },
      { match: /'/, token: 'string', push: 'single' },
      { match: /"/, token: 'string', push: 'double' },
      // function [a, b] = name(x), function out = name(x), function name(x)
      { match: /(function)(\s+)((?:\[[^\]\n]*\]|[A-Za-z_]\w*)\s*=\s*)?([A-Za-z_][\w.]*)/, groups: ['keyword', undefined, undefined, 'function'] },
      { match: /(classdef)(\s+)((?:\([^)\n]*\)\s*)?)([A-Za-z_]\w*)/, groups: ['keyword', undefined, undefined, 'type'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?[ij]?|0[xX][\da-fA-F]+/, token: 'number' },
      { match: /\.\*|\.\/|\.\\|\.\^|==|~=|<=|>=|&&|\|\||[-+*/\\^<>=&|~:@]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    single: [
      { match: /''/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
      { match: /[^']+/, token: 'string' },
      { match: /$/, pop: true },
    ],
    double: [
      { match: /""/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /[^"]+/, token: 'string' },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /^\s*%\}\s*$/, token: 'comment', pop: true },
      { match: /.+/, token: 'comment' },
    ],
  },
}
