import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  BEGIN END alias and begin break case class def defined? do else elsif end ensure for if in module
  next not or redo rescue retry return super then undef unless until when while yield
`)
const CONSTANTS = words('true false nil __FILE__ __LINE__ __dir__ __method__')
const BUILTINS = words(`
  puts print p pp require require_relative include extend prepend attr_reader attr_writer
  attr_accessor private protected public module_function raise loop lambda proc format sprintf
  gets catch throw freeze binding block_given? rand sleep warn
`)

function name(text: string): TokenType | undefined {
  if (text === 'self') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // MAX_SIZE
  if (/^[A-Z]/.test(text)) return 'type' // User, ActiveRecord
  return undefined
}

/**
 * A slash starts a regular expression where a value is expected: at a
 * line's start, after an operator, an opening bracket, a comma or a keyword.
 */
function valueExpected(prev: Token | undefined): boolean {
  if (!prev) return true
  if (prev.type === 'keyword' || prev.type === 'operator') return true
  if (prev.type === 'builtin' || prev.type === 'function') return true // puts /x/
  return prev.type === 'punctuation' && /[([{,;]$/.test(prev.text)
}

/** %w[…], %q(…): the closing bracket for an opening one. */
const CLOSE: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' }

/** The heredoc's state: "heredocStart/~/EOS/i", with i when it interpolates. */
function heredoc(text: string): string {
  const m = /^<<([~-]?)(['"`]?)([A-Za-z_]\w*)\2$/.exec(text)!
  return `heredocStart/${m[1] || '_'}/${m[3]}/${m[2] === "'" ? '' : 'i'}`
}

const IDENT = /[A-Za-z_]\w*[?!]?/.source

export const grammar: Grammar = {
  states: {
    root: [
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { match: /=begin\b.*/, token: 'comment', push: 'docComment', after: (p) => p === undefined },
      { match: /__END__$/, token: 'meta', after: (p) => p === undefined },
      { include: 'code' },
    ],
    code: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /<<[~-]?(['"`]?)[A-Za-z_]\w*\1/, token: 'string', push: heredoc },
      { match: /"/, token: 'string', push: 'double/"' },
      { match: /`/, token: 'string', push: 'double/`' },
      { match: /'/, token: 'string', push: 'single' },
      // %w[a b], %i[a b], %q(…), %Q{…}, %(…), %r{…}
      { match: /%[qwiWI]?[([{<]/, token: 'string', push: (t) => `literal/${CLOSE[t.at(-1)!]}/${/[QWI]|^%[([{<]/.test(t) ? 'i' : ''}` },
      { match: /%r[([{<]/, token: 'regexp', push: (t) => `regex/${CLOSE[t.at(-1)!]}` },
      { match: /\/(?=[^\s/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n])*\/[imxounse]*/, token: 'regexp', after: valueExpected },
      { match: /:"(?:[^"\\\n]|\\.)*"|:[A-Za-z_]\w*[?!=]?|:(?:\[\]=?|<=>|===?|=~|!~|[-+*/%<>!~^&|]|\*\*|<<|>>)/, token: 'constant' }, // :symbol
      { match: /@@?[A-Za-z_]\w*|\$(?:[A-Za-z_]\w*|[!@&`'+~=/\\,;.<>_*$?:"]|\d+)/, token: 'variable' },
      { match: /[A-Za-z_]\w*[?!]?(?=:(?!:))/, token: 'property' }, // key: value
      { match: new RegExp(`(def)(\\s+)((?:self)?)(\\.?)(${IDENT}=?|\\[\\]=?|[-+*/%<>=!~^&|]+)`), groups: ['keyword', undefined, 'variable', 'punctuation', 'function'] },
      { match: /(class|module)(\s+)([A-Z][\w:]*)/, groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\.|&\\.)(${IDENT})`), groups: ['punctuation', 'function'] },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      {
        match: /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO]?[0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)(?:r|i|ri)?/,
        token: 'number',
      },
      { match: /\?(?:\\.|[^\s\\])(?![\w])/, token: 'string' }, // ?a, a character
      { match: /\*\*=?|<=>|===?|=~|!~|=>|->|\.\.\.?|::|&&=?|\|\|=?|<<=?|>>=?|&\.|[-+*/%<>!^&|~]=?|[=?:]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    // "…#{expr}…" and `…`: the argument is the closing quote.
    double: [
      { match: (line, pos, q) => (line[pos] === q ? 1 : -1), token: 'string', pop: true },
      { match: /\\(?:u\{[\da-fA-F ]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{1,2}|[0-7]{1,3}|.?)/, token: 'escape' },
      { match: /#\{/, token: 'escape', push: 'interpolation' },
      { match: /#[@$][A-Za-z_]\w*/, token: 'variable' },
      { match: (line, pos, q) => { let i = pos; while (i < line.length && line[i] !== q && line[i] !== '\\' && line[i] !== '#') i++; return i > pos ? i - pos : -1 }, token: 'string' },
      { match: /#/, token: 'string' },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\['\\]/, token: 'escape' },
      { match: /\\/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    // %w[…] and kin: "literal/]/i", with i when it interpolates.
    literal: [
      { match: (line, pos, arg) => (line[pos] === arg[0] ? 1 : -1), token: 'string', pop: true },
      { match: (line, pos, arg) => (arg.endsWith('i') && line.startsWith('#{', pos) ? 2 : -1), token: 'escape', push: 'interpolation' },
      { match: /\\./, token: 'escape' },
      { match: (line, pos, arg) => { let i = pos; while (i < line.length && line[i] !== arg[0] && line[i] !== '\\' && line[i] !== '#') i++; return i > pos ? i - pos : -1 }, token: 'string' },
      { match: /#/, token: 'string' },
    ],
    regex: [
      { match: (line, pos, close) => (line[pos] === close ? 1 + (/^[imxounse]*/.exec(line.slice(pos + 1, pos + 9))?.[0].length ?? 0) : -1), token: 'regexp', pop: true },
      { match: /#\{/, token: 'escape', push: 'interpolation' },
      { match: /\\./, token: 'regexp' },
      { match: (line, pos, close) => { let i = pos; while (i < line.length && line[i] !== close && line[i] !== '\\' && line[i] !== '#') i++; return i > pos ? i - pos : -1 }, token: 'regexp' },
      { match: /#/, token: 'regexp' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'code' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'code' },
    ],
    // The opening line's rest is code: <<~EOS.strip. The body starts on the next line.
    heredocStart: [
      { match: (line, pos) => (pos === line.length ? 0 : -1), next: (_t, arg) => `heredoc/${arg}` },
      { include: 'code' },
    ],
    heredoc: [
      {
        match: (line, pos, arg) => {
          const [kind, word] = arg.split('/')
          if (pos !== 0) return -1
          return (kind === '_' ? line : line.trim()) === word ? line.length : -1
        },
        token: 'string',
        pop: true,
      },
      { match: (line, pos, arg) => (arg.endsWith('/i') && line.startsWith('#{', pos) ? 2 : -1), token: 'escape', push: 'interpolation' },
      { match: (line, pos, arg) => (arg.endsWith('/i') ? -1 : line.length - pos || -1), token: 'string' },
      { match: /[^#]+|#/, token: 'string' },
    ],
    docComment: [
      { match: /=end\b.*/, token: 'comment', pop: true, after: (p) => p === undefined },
      { match: /.+/, token: 'comment' },
    ],
  },
}
