import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  actor as associatedtype async await break case catch class consume continue convenience default defer
  deinit didSet do dynamic else enum extension fallthrough fileprivate final for func get guard if
  import in indirect infix init inout internal is lazy let mutating nonisolated nonmutating open
  operator optional override package postfix precedencegroup prefix private protocol public repeat
  required rethrows return set some any static struct subscript super switch throw throws try
  typealias unowned var weak where while willSet macro borrowing consuming each
`)
const CONSTANTS = words('true false nil')
const BUILTINS = words('print debugPrint dump fatalError precondition assert min max abs zip stride type')

function name(text: string): TokenType | undefined {
  if (text === 'self') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type' // String, Self, T
  return undefined
}

const IDENT = /(?:[A-Za-z_]\w*|`[^`\n]+`)/.source

/**
 * A string's state: "string/N/H", N quotes (1 or 3) and H the # count of a
 * raw string, whose escapes and interpolation take as many #: \#(x).
 */
function openString(text: string): string {
  const hashes = /^#*/.exec(text)![0].length
  const quotes = text.length - hashes
  return `string/${quotes}/${hashes}`
}

const parts = (arg: string) => arg.split('/').map(Number) as [number, number]

export const grammar: Grammar = {
  states: {
    root: [
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { include: 'code' },
    ],
    code: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /#*(?:"""|")/, token: 'string', push: openString },
      { match: /#(?:if|elseif|else|endif|available|unavailable|selector|keyPath|file|fileID|line|function|warning|error|sourceLocation|Preview)\b/, token: 'meta' },
      { match: /#[A-Za-z_]\w*/, token: 'builtin' }, // a macro: #expect, #Predicate
      { match: /@[A-Za-z_]\w*/, token: 'meta' }, // @State, @MainActor
      { match: new RegExp(`(func)(\\s+)(${IDENT}|[-+*/%<>=!&|^~?.]+)`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(class|struct|enum|protocol|extension|actor|typealias|associatedtype)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\.)(${IDENT})(?=\\s*[({])`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\.)(${IDENT}|\\d+)`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:<[\\w\\s,.<>?]*>)?\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: name },
      { match: /\$\d+|\$[A-Za-z_]\w*/, token: 'variable' }, // $0, $binding
      { match: /(?:0x[\da-fA-F_]+(?:\.[\da-fA-F_]*)?(?:[pP][+-]?\d+)?|0o[0-7_]+|0b[01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)/, token: 'number' },
      { match: /\.\.\.|\.\.<|->|===?|!==?|&&|\|\||\?\?|<<=?|>>=?|[-+*/%&|^<>!=]=?|[?~]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    string: [
      // The end: the quotes and the raw string's #.
      { match: (line, pos, arg) => { const [q, h] = parts(arg); const end = '"'.repeat(q) + '#'.repeat(h); return line.startsWith(end, pos) ? end.length : -1 }, token: 'string', pop: true },
      // \(expr), or \#(expr) in a raw string.
      { match: (line, pos, arg) => { const open = '\\' + '#'.repeat(parts(arg)[1]) + '('; return line.startsWith(open, pos) ? open.length : -1 }, token: 'escape', push: 'interpolation' },
      { match: (line, pos, arg) => { const h = parts(arg)[1]; const esc = '\\' + '#'.repeat(h); if (!line.startsWith(esc, pos)) return -1; const m = /u\{[\da-fA-F]{1,8}\}|./y; m.lastIndex = pos + esc.length; const e = m.exec(line); return e ? esc.length + e[0].length : esc.length }, token: 'escape' },
      { match: /[^"\\]+|["\\]/, token: 'string' },
      // A one-quote string ends with its line.
      { match: (line, pos, arg) => (pos === line.length && parts(arg)[0] === 1 ? 0 : -1), pop: true },
    ],
    interpolation: [
      { match: /\)/, token: 'escape', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { include: 'code' },
    ],
    parens: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { include: 'code' },
    ],
    blockComment: [
      { match: /[^*/]+/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*/]/, token: 'comment' },
    ],
  },
}
