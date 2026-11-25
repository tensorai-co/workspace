import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  proc if then else elseif for foreach while switch break continue return error catch try finally throw
  namespace package source uplevel upvar global variable set unset incr append lappend eval expr
  after vwait default oo::class method constructor destructor
`)
const BUILTINS = words(`
  puts gets open close read file glob string list llength lindex lrange lsearch lsort linsert lreplace
  join split concat format scan regexp regsub array dict info exec exit clock binary encoding lmap
  subst trace interp rename chan socket fconfigure fileevent flush
`)

/** A command is the first word of a line, or after ; or [. */
const commandStarts = (p: Token | undefined) => !p || p.text === ';' || p.text === '['

function command(text: string): TokenType {
  if (KEYWORDS.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  return 'function'
}

// Tcl: commands and their words, $substitution, [command substitution] and
// braces that quote.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment', after: commandStarts },
      { match: /(proc)(\s+)([\w:]+)/, groups: ['keyword', undefined, 'function'], after: commandStarts },
      { match: /[A-Za-z_][\w:]*/, token: command, after: commandStarts },
      { include: 'words' },
    ],
    words: [
      { match: /\s+/ },
      { match: /"/, token: 'string', push: 'string' },
      { match: /\$\{[^}]*\}|\$(?:::)?[A-Za-z_]\w*(?:::\w+)*(?:\([^)]*\))?/, token: 'variable' },
      { match: /\[/, token: 'punctuation', push: 'command' },
      { match: /\{(?=\s*$)/, token: 'punctuation', push: 'script' }, // a body: proc, if, foreach
      { match: /\{/, token: 'punctuation', push: 'list' }, // a list or condition on one line
      { match: /\\./, token: 'escape' },
      { match: /-[A-Za-z]\w*/, token: 'constant' }, // -nocase, -exact
      { match: /[-+]?(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?![\w.])/, token: 'number' },
      { match: /==|!=|<=|>=|&&|\|\||\beq\b|\bne\b|\bin\b|\bni\b|[-+*/%<>!]/, token: 'operator' },
      { match: /[;}\]]/, token: 'punctuation' },
      { match: /[^\s$[\]{}";\\]+/ },
    ],
    // Braces quote. Ending a line, they open a body of commands; on one line, words.
    script: [
      { match: /\}/, token: 'punctuation', pop: true },
      { include: 'root' },
    ],
    list: [
      { match: /\}/, token: 'punctuation', pop: true },
      { include: 'words' },
    ],
    command: [
      { match: /\]/, token: 'punctuation', pop: true },
      { include: 'root' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\$\{[^}]*\}|\$(?:::)?[A-Za-z_]\w*(?:::\w+)*(?:\([^)]*\))?/, token: 'variable' },
      { match: /\[/, token: 'punctuation', push: 'command' },
      { match: /\\(?:x[\da-fA-F]+|u[\da-fA-F]{1,4}|.?)/, token: 'escape' },
      { match: /[^"$[\\]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
  },
}
