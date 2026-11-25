import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { lengthAt, words } from '../../language.js'

const KEYWORDS = words(`
  abstract baremodule begin break catch const continue do else elseif end export finally for function
  global if import in isa let local macro module mutable primitive quote return struct try type
  using where while outer
`)
const CONSTANTS = words('true false nothing missing NaN Inf pi im undef')
const BUILTINS = words(`
  println print show length size push! pop! append! map filter reduce sum prod maximum minimum zeros
  ones collect enumerate zip sort sort! round floor ceil abs sqrt exp log string parse typeof
  isempty haskey get keys values error throw rand range eachindex first last
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

/** $name in a string. */
const VARIABLE = /\$[A-Za-z_]\w*/y

/** A name: letters from any script, but not the arrows and math symbols (∈, ≤) that are operators. */
const IDENT = /[A-Za-z_\u00a1-\u218f\u2400-\uffff][\w!\u00a1-\u218f\u2400-\uffff]*/.source

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#=/, token: 'comment', push: 'blockComment' },
      { match: /#.*/, token: 'comment' },
      { match: /r"(?:[^"\\\n]|\\.)*"[imsx]*/, token: 'regexp' }, // r"a+b"i
      { match: /(?:raw)?"""/, token: 'string', push: (t) => (t.startsWith('raw') ? 'triple/raw' : 'triple/') },
      { match: /(?:raw|b)?"/, token: 'string', push: (t) => (t.startsWith('raw') ? 'string/raw' : 'string/') },
      { match: /'(?:[^'\\\n]|\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{1,4}|U[\da-fA-F]{1,8}|.))'/, token: 'string' },
      { match: /`[^`\n]*`?/, token: 'string' }, // a command: `ls -la`
      { match: /@[A-Za-z_][\w.!]*/, token: 'meta' }, // @time, @assert
      { match: new RegExp(`:(?!:)${IDENT}`), token: 'constant', after: (p) => !p || p.type === 'operator' || /[(,[{=]$/.test(p.text) }, // :symbol
      { match: new RegExp(`(function|macro)(\\s+)((?:${IDENT}\\.)*)(${IDENT})`), groups: ['keyword', undefined, undefined, 'function'] },
      { match: new RegExp(`(struct|abstract\\s+type|primitive\\s+type|module)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\.)(${IDENT})(?=\\.?\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\.?\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: name },
      { match: /0x[\da-fA-F_]+|0b[01_]+|0o[0-7_]+|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d+)(?:[eEf][-+]?\d+)?(?:im)?/, token: 'number' },
      { match: /\.?(?:==|!=|<=|>=|=>|->|\|>|<\||&&|\|\||<:|>:|::|\.\.\.?|[-+*/\\^%÷∈∉≤≥≠&|<>=!~$'])/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    // "string/" interpolates $x and $(expr); "string/raw" doesn't.
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: (line, pos, raw) => (raw ? -1 : line[pos] === '\\' ? 2 : -1), token: 'escape' },
      { match: (line, pos, raw) => (!raw && line.startsWith('$(', pos) ? 2 : -1), token: 'escape', push: 'interpolation' },
      { match: (line, pos, raw) => (raw ? -1 : lengthAt(VARIABLE, line, pos)), token: 'variable' },
      { match: /[^"\\$]+|[\\$]/, token: 'string' },
    ],
    triple: [
      { match: /"""/, token: 'string', pop: true },
      { match: (line, pos, raw) => (!raw && line.startsWith('$(', pos) ? 2 : -1), token: 'escape', push: 'interpolation' },
      { match: (line, pos, raw) => (raw ? -1 : lengthAt(VARIABLE, line, pos)), token: 'variable' },
      { match: /[^"$]+|["$]/, token: 'string' },
    ],
    interpolation: [
      { match: /\)/, token: 'escape', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { include: 'root' },
    ],
    parens: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { include: 'root' },
    ],
    blockComment: [
      { match: /#=/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /=#/, token: 'comment', pop: true },
      { match: /[^#=]+|[#=]/, token: 'comment' },
    ],
  },
}
