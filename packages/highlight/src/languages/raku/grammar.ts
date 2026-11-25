import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  my our has state constant let temp sub method submethod multi proto only class role grammar module
  package unit use need import require is does but trusts handles of returns where if elsif else unless
  with orwith without for loop while until repeat given when default return last next redo leave
  proceed succeed take gather supply react whenever emit start await do try CATCH CONTROL LEAST BEGIN
  END INIT ENTER LEAVE KEEP UNDO FIRST NEXT LAST PRE POST QUIT CLOSE die fail so not and or xor andthen
  orelse token rule regex enum subset self
`)
const TYPES = words(`
  Int Num Rat Str Bool Any Mu Cool Array Hash List Map Set Bag Seq Range Pair Code Block Sub Method
  Promise Channel Supply IO Proc Match Grammar Exception Failure Nil Duration Instant DateTime Date
  UInt Real Numeric Stringy Positional Associative Callable
`)
const CONSTANTS = words('True False Nil Inf NaN pi e tau')
/** Operators spelled as words: eq, cmp, xx. */
const OPERATORS = words('eq ne lt gt le ge leg cmp x xx Z X R min max div mod gcd lcm')
const BUILTINS = words(`
  say print put note dd prompt get lines words slurp spurt open close chars elems keys values kv pairs
  map grep sort reverse join split comb push pop shift unshift splice min max sum first uniq flat
  defined exit sleep run shell
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (OPERATORS.has(text)) return 'operator'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][a-z]/.test(text)) return 'type'
  return undefined
}

/** A slash starts a regex where a term can start. */
const termStarts = (p: Token | undefined) =>
  !p || p.type === 'operator' || p.type === 'keyword' || (p.type === 'punctuation' && /[([{,;]$/.test(p.text))

/** The closing bracket for an opening one. */
const CLOSE: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>', '/': '/', '|': '|', '!': '!' }
const closer = (text: string) => CLOSE[text.slice(-1)] ?? text.slice(-1)

// Raku: sigils with twigils ($!x, @*ARGS), subs and methods, interpolating
// strings, quoting forms (q{}, qq[], Q<>), regexes and Pod.
const VARIABLE = /[$@%&][!.*?^:=~]?[A-Za-z_][\w'-]*(?<!['-])|\$[\d/!¢]|@_|%_/
const ESC = /\\(?:x[\da-fA-F]+|x\[[^\]]*\]|c\[[^\]]*\]|.?)/

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /^=begin\s+\w+.*/, token: 'comment', push: 'pod', after: (p) => p === undefined },
      { match: /^=(?:head\d|item\d?|para|for|comment|pod|end)\b.*/, token: 'comment', after: (p) => p === undefined },
      { match: /#`[([{<]/, token: 'comment', push: (t) => `embeddedComment/${closer(t)}` },
      { match: /#[|=].*/, token: 'comment' }, // #| and #= declarator docs
      { match: /#.*/, token: 'comment' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /「[^」]*」/, token: 'string' },
      { match: /(?:qq|qqw|qqx)\s*[([{<|/!]/, token: 'string', push: (t) => `quoteInterpolated/${closer(t)}` },
      { match: /(?:Q|q|qw|qx)\s*[([{<|/!]/, token: 'string', push: (t) => `quote/${closer(t)}` },
      { match: /(?:rx|m|s|tr)\s*[/{]/, token: 'regexp', push: (t) => `regex/${closer(t)}` },
      { match: /\/(?![/=\s])/, token: 'regexp', push: 'regex//', after: termStarts },
      { match: /v\d+(?:\.[\w*]+)*/, token: 'number' }, // use v6.d
      // A grammar's token body is a regex: token name { \w+ }
      { match: /(token|rule|regex)(\s+)([A-Za-z_][\w'-]*)(\s*)(\{)/, groups: ['keyword', undefined, 'function', undefined, 'regexp'], push: 'regex/}' },
      { match: /(sub|method|submethod|token|rule|regex)(\s+)([A-Za-z_][\w'-]*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(class|role|grammar|module|package|enum|subset)(\s+)([A-Za-z_][\w:'-]*)/, groups: ['keyword', undefined, 'type'] },
      { match: VARIABLE, token: 'variable' },
      { match: /(\.\^?)([A-Za-z_][\w'-]*)/, groups: ['punctuation', 'function'] },
      { match: /<(?=[\w\s-]+>)/, token: 'string', push: 'angle' }, // <a b c> and %h<key>
      { match: /[A-Za-z_][\w-]*(?:::[A-Za-z_][\w-]*)+/, token: 'type' }, // IO::Path
      { match: /[A-Za-z_][\w'-]*(?<!['-])(?=\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_][\w'-]*(?<!['-])/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xob][\da-fA-F_]+|\d[\d_]*(?:\.(?!\.)\d[\d_]*)?(?:[eE][+-]?\d+)?i?/, token: 'number' },
      { match: /\.\.\.?\^?|\^\.\.\^?|=>|==>|<==|~~|!~~|===?|!==?|=:=|<=>|<=|>=|\+\+|--|\*\*|\/\/|&&|\|\||\^\^|::=|:=|[-+*/%~<>=!?^&|]=?|[»«]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { include: 'interpolated' },
    ],
    interpolated: [
      { match: ESC, token: 'escape' },
      { match: /[$@%&][!.*?^]?[A-Za-z_][\w'-]*(?<!['-])(?:\.[A-Za-z_][\w-]*\(\))?(?:\[[^\]]*\]|<[^>]*>|\{[^}]*\})?/, token: 'variable' },
      { match: /\{/, token: 'escape', push: 'block' },
      { match: /[^"\\$@%&{]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\[\\']/, token: 'escape' },
      { match: /[^'\\]+|\\/, token: 'string' },
    ],
    quote: [
      { match: (line, pos, close) => (line.startsWith(close, pos) ? close.length : -1), token: 'string', pop: true },
      { match: /./, token: 'string' },
    ],
    quoteInterpolated: [
      { match: (line, pos, close) => (line.startsWith(close, pos) ? close.length : -1), token: 'string', pop: true },
      { match: ESC, token: 'escape' },
      { match: /[$@%&][!.*?^]?[A-Za-z_][\w'-]*(?<!['-])/, token: 'variable' },
      { match: /./, token: 'string' },
    ],
    angle: [
      { match: />/, token: 'string', pop: true },
      { match: /[^>]+/, token: 'string' },
    ],
    regex: [
      { match: (line, pos, close) => (line.startsWith(close, pos) ? close.length : -1), token: 'regexp', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[$@][A-Za-z_]\w*|\$\d/, token: 'variable' },
      { match: /'[^']*'|"[^"]*"/, token: 'string' },
      { match: /<[\w:.-]+>/, token: 'type' }, // a named rule: <ident>
      { match: /./, token: 'regexp' },
    ],
    block: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    embeddedComment: [
      { match: (line, pos, close) => (line.startsWith(close, pos) ? close.length : -1), token: 'comment', pop: true },
      { match: /./, token: 'comment' },
    ],
    pod: [
      { match: /^=end\b.*/, token: 'comment', pop: true },
      { match: /.+/, token: 'comment' },
    ],
  },
}
