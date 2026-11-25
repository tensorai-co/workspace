import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { lengthAt, words } from '../../language.js'

const KEYWORDS = words(`
  my our local state sub if elsif else unless while until for foreach last next redo return use no
  require package do eval and or not xor eq ne lt gt le ge cmp x qw BEGIN END defined undef
  __PACKAGE__ __FILE__ __LINE__ __DATA__ __END__
`)
const BUILTINS = words(`
  print printf say die warn open close binmode chomp chop chdir mkdir unlink push pop shift unshift
  splice join split map grep sort reverse keys values each exists delete scalar ref bless length
  substr index lc uc lcfirst ucfirst sprintf time localtime sleep exit wantarray local
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  return undefined
}

/** A slash is a regex where a value is expected, as in Ruby and JavaScript. */
function valueExpected(prev: Token | undefined): boolean {
  if (!prev) return true
  if (prev.type === 'keyword' || prev.type === 'operator' || prev.type === 'builtin') return true
  return prev.type === 'punctuation' && /[([{,;]$/.test(prev.text)
}

/** q(…), qq{…}, m/…/, s{…}{…}: the closing delimiter for an opening one. */
const CLOSE: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' }

/**
 * A quote-like's state, with whether it interpolates and its closing:
 * "quote/i/)" for qq(…), "regex/i//" for m/…/, and for s/…/…/ and
 * tr{…}{…}, "subst" or "substPair" for the pattern before the replacement.
 */
function quoteLike(text: string): string {
  const op = /^[a-z]+/.exec(text)![0]
  const open = text.at(-1)!
  const close = CLOSE[open] ?? open
  const interpolates = op !== 'q' && op !== 'qw' && op !== 'tr' && op !== 'y' && open !== "'" ? 'i' : ''
  if (op === 'q' || op === 'qq' || op === 'qw') return `quote/${interpolates}/${close}`
  if (op === 's' || op === 'tr' || op === 'y') return `${close === open ? 'subst' : 'substPair'}/${interpolates}/${close}`
  return `regex/${interpolates}/${close}`
}

const closing = (arg: string) => arg.slice(arg.indexOf('/') + 1)
const VARIABLE = /[$@%&]\{\^?\w+\}|\$#?[A-Za-z_]\w*(?:::\w+)*|[@%][A-Za-z_]\w*(?:::\w+)*|\$[0-9&`'+!@\/\\,;.<>_]/y
/** In a pattern, only $name and @name interpolate: $ before the delimiter or ) is an anchor. */
const PATTERN_VARIABLE = /[$@]\{\w+\}|[$@][A-Za-z_]\w*(?:::\w+)*/y
const FLAGS = /[a-z]*/y

export const grammar: Grammar = {
  states: {
    root: [
      { match: /=[a-zA-Z]\w*.*/, token: 'comment', push: 'pod', after: (p) => p === undefined }, // =pod … =cut
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /<<~?(["']?)([A-Za-z_]\w*)\1/, token: 'string', push: (t) => `heredocStart/${t.includes("'") ? '' : 'i'}/${t.includes('~') ? '~' : ''}/${t.replace(/^<<~?["']?|["']$/g, '')}` },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /`[^`\n]*`?/, token: 'string' },
      { match: /\b(?:qq|qw|q)\s*[^\s\w]/, token: 'string', push: quoteLike },
      { match: /\b(?:m|qr|s|tr|y)\s*[^\s\w=,;)]/, token: 'regexp', push: quoteLike },
      { match: /\/(?=[^\s/])(?:\\.|[^/\\\n])*\/[msixpodualngcer]*/, token: 'regexp', after: valueExpected },
      { match: (line, pos) => lengthAt(VARIABLE, line, pos), token: 'variable' },
      { match: /(sub)(\s+)([A-Za-z_][\w:]*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(package|use|no|require)(\s+)([A-Za-z_][\w:]*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(->)([A-Za-z_]\w*)/, groups: ['operator', 'function'] },
      { match: /[A-Za-z_][\w:]*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*(?=\s*=>)/, token: 'property' }, // key => value
      { match: /[A-Za-z_][\w:]*/, token: name },
      { match: /0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /=~|!~|->|=>|\+\+|--|\*\*|\.\.\.?|<=>|\/\/=?|&&=?|\|\|=?|[-+*/.%x]=|==|!=|<=|>=|[-+*/%.<>=!?:~\\]/, token: 'operator' },
      { match: /[()[\]{},;]/, token: 'punctuation' },
    ],
    interpolated: [
      { match: /\\./, token: 'escape' },
      { match: (line, pos) => lengthAt(VARIABLE, line, pos), token: 'variable' },
    ],
    double: [
      { match: /[^"\\$@]+/, token: 'string' },
      { include: 'interpolated' },
      { match: /[$@]/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\['\\]/, token: 'escape' },
      { match: /\\/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    // q(…) and kin: "quote/i/)".
    quote: [
      { match: (line, pos, arg) => (line.startsWith(closing(arg), pos) ? 1 : -1), token: 'string', pop: true },
      { match: (line, pos, arg) => (arg.startsWith('i/') ? lengthAt(VARIABLE, line, pos) : -1), token: 'variable' },
      { match: /\\./, token: 'escape' },
      { match: /[^\\$@)\]}>/|!#'"]+|./, token: 'string' },
    ],
    regex: [
      { match: (line, pos, arg) => (line.startsWith(closing(arg), pos) ? 1 + lengthAt(FLAGS, line, pos + 1) : -1), token: 'regexp', pop: true },
      { include: 'pattern' },
    ],
    // s/a/b/: the middle delimiter ends the pattern and starts the replacement.
    subst: [
      { match: (line, pos, arg) => (line.startsWith(closing(arg), pos) ? 1 : -1), token: 'regexp', next: (_t, arg) => `regex/${arg}` },
      { include: 'pattern' },
    ],
    // s{a}{b}: the replacement has brackets of its own.
    substPair: [
      { match: (line, pos, arg) => (line.startsWith(closing(arg), pos) ? 1 : -1), token: 'regexp', next: (_t, arg) => `pairOpen/${arg.slice(0, arg.indexOf('/'))}` },
      { include: 'pattern' },
    ],
    pairOpen: [
      { match: /\s*[([{<]/, token: 'regexp', next: (t, i) => `regex/${i}/${CLOSE[t.trim()]}` },
      { match: /(?=.)|$/, pop: true },
    ],
    pattern: [
      { match: (line, pos, arg) => (arg.startsWith('i/') ? lengthAt(PATTERN_VARIABLE, line, pos) : -1), token: 'variable' },
      { match: /\\./, token: 'regexp' },
      { match: /[^\\$@)\]}>/|!#'"]+|./, token: 'regexp' },
    ],
    heredocStart: [
      { match: (line, pos) => (pos === line.length ? 0 : -1), next: (_t, arg) => `heredoc/${arg}` },
      { include: 'root' },
    ],
    // "heredoc/i/~/EOT": interpolates, indented, ends at EOT.
    heredoc: [
      {
        match: (line, pos, arg) => {
          const [, indented, word] = arg.split('/')
          return pos === 0 && (indented ? line.trim() : line) === word ? line.length : -1
        },
        token: 'string',
        pop: true,
      },
      { match: (line, pos, arg) => (arg.startsWith('i/') ? lengthAt(VARIABLE, line, pos) : -1), token: 'variable' },
      { match: /[^$@\\]+|./, token: 'string' },
    ],
    pod: [
      { match: /=cut\b.*/, token: 'comment', pop: true, after: (p) => p === undefined },
      { match: /.+/, token: 'comment' },
    ],
  },
}
