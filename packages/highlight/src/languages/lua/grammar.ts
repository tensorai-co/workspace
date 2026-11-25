import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('and break do else elseif end for function goto if in local not or repeat return then until while')
const CONSTANTS = words('true false nil')
const BUILTINS = words(`
  assert collectgarbage dofile error getmetatable ipairs load loadfile next pairs pcall print rawequal
  rawget rawlen rawset require select setmetatable tonumber tostring type unpack xpcall
  coroutine debug io math os package string table utf8 _G _ENV _VERSION
`)

function name(text: string): TokenType | undefined {
  if (text === 'self') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (BUILTINS.has(text)) return 'builtin'
  return undefined
}

/** A long bracket's level: [==[ is "2". */
const level = (text: string) => String(text.split('=').length - 1)

export const grammar: Grammar = {
  states: {
    root: [
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { match: /\s+/ },
      { match: /--\[=*\[/, token: 'comment', push: (t) => `longComment/${level(t)}` },
      { match: /--.*/, token: 'comment' },
      { match: /\[=*\[/, token: 'string', push: (t) => `longString/${level(t)}` },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /(function)(\s+)([A-Za-z_][\w.]*[.:])?([A-Za-z_]\w*)/, groups: ['keyword', undefined, undefined, 'function'] },
      { match: /([.:])([A-Za-z_]\w*)(?=\s*[("'{]|\s*\[=*\[)/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*[("'{]|\s*\[=*\[)/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /0[xX](?:[\da-fA-F]*\.?[\da-fA-F]+)(?:[pP][+-]?\d+)?|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /\.\.\.|\.\.|==|~=|<=|>=|\/\/|<<|>>|::|[-+*/%^#&|~<>=]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    double: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|\d{1,3}|z|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|\d{1,3}|z|.?)/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    // [[…]] and [==[…]==]: to a ] with the same number of =.
    longString: [
      { match: (line, pos, n) => (line.startsWith(`]${'='.repeat(Number(n))}]`, pos) ? Number(n) + 2 : -1), token: 'string', pop: true },
      { match: /[^\]]+|\]/, token: 'string' },
    ],
    longComment: [
      { match: (line, pos, n) => (line.startsWith(`]${'='.repeat(Number(n))}]`, pos) ? Number(n) + 2 : -1), token: 'comment', pop: true },
      { match: /[^\]]+|\]/, token: 'comment' },
    ],
  },
}
