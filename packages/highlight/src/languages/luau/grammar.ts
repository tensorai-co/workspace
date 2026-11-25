import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('and break continue do else elseif end export for function if in local not or repeat return then type until while')
const CONSTANTS = words('true false nil')
const BUILTINS = words(`
  assert collectgarbage dofile error getmetatable ipairs load loadfile next pairs pcall print rawequal
  rawget rawlen rawset require select setmetatable tonumber tostring type unpack xpcall
  coroutine debug math os string table utf8 bit32 buffer task typeof game workspace script Instance
  Vector3 Vector2 CFrame Color3 UDim2 Enum
`)
/** The types annotations name: x: number, (string) -> boolean. */
const TYPES = words('number string boolean any nil never unknown thread userdata buffer vector')

function name(text: string): TokenType | undefined {
  if (text === 'self') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (BUILTINS.has(text)) return 'builtin'
  if (TYPES.has(text)) return 'type'
  return undefined
}

/** A long bracket's level: [==[ is "2". */
const level = (text: string) => String(text.split('=').length - 1)

// Luau: Roblox's Lua, with types, continue, compound assignment and `{interpolated}` strings.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { match: /\s+/ },
      { match: /--\[=*\[/, token: 'comment', push: (t) => `longComment/${level(t)}` },
      { match: /--.*/, token: 'comment' },
      { match: /\[=*\[/, token: 'string', push: (t) => `longString/${level(t)}` },
      { match: /"/, token: 'string', push: 'double' },
      { match: /`/, token: 'string', push: 'template' },
      // type Point = { x: number }, export type
      { match: /(type)(\s+)([A-Za-z_]\w*)(?=\s*(?:<[^>]*>)?\s*=)/, groups: ['keyword', undefined, 'type'] },
      // An annotation: local x: number, (a: string): boolean
      { match: /(:)(\s*)([A-Za-z_]\w*)(?![\w(]|\s*[("'{])/, groups: ['operator', undefined, 'type'], after: (p) => !!p && (p.type === undefined || p.text === ')') },
      { match: /@[A-Za-z_]\w*/, token: 'meta' }, // @native, @checked
      { match: /'/, token: 'string', push: 'single' },
      { match: /(function)(\s+)([A-Za-z_][\w.]*[.:])?([A-Za-z_]\w*)/, groups: ['keyword', undefined, undefined, 'function'] },
      { match: /([.:])([A-Za-z_]\w*)(?=\s*[("'{]|\s*\[=*\[)/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*[("'{]|\s*\[=*\[)/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /0[xX](?:[\da-fA-F]*\.?[\da-fA-F]+)(?:[pP][+-]?\d+)?|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /\.\.=|\/\/=|[-+*/%^]=|\.\.\.|\.\.|==|~=|<=|>=|\/\/|->|::|[-+*/%^#&|~<>=?]/, token: 'operator' },
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
    // `Hello {name}`: an interpolated string.
    template: [
      { match: /`/, token: 'string', pop: true },
      { match: /\{/, token: 'escape', push: 'interpolation' },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|\d{1,3}|z|.?)/, token: 'escape' },
      { match: /[^`{\\]+/, token: 'string' },
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
