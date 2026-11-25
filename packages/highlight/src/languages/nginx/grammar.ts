import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'

/** A directive's name starts a statement: at a line's start, or after ; { or }. */
const statementStart = (prev: Token | undefined) => !prev || /[;{}]$/.test(prev.text)

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      // location ~* \.(png|jpg)$ { … }: the pattern after ~ or ~* is a regex.
      { match: /(location)(\s+)(~\*?)(\s+)([^\s{]+)/, groups: ['keyword', undefined, 'operator', undefined, 'regexp'], after: statementStart },
      { match: /(location)(\s+)(=|\^~)?/, groups: ['keyword', undefined, 'operator'], after: statementStart },
      { match: /[A-Za-z_][\w-]*/, token: 'keyword', push: 'arguments', after: statementStart },
      { match: /[{}]/, token: 'punctuation' },
      { match: /;/, token: 'punctuation' },
      { include: 'value' },
    ],
    // A directive's arguments, to ; or {.
    arguments: [
      { match: /;/, token: 'punctuation', pop: true },
      { match: /(?=\{)/, pop: true },
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(\^)([^\s;]*)/, groups: ['regexp', 'regexp'] }, // rewrite ^/old/(.*)$ …
      { match: /(?<=\s)(?:on|off)(?=[\s;])/, token: 'constant' },
      { include: 'value' },
    ],
    value: [
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /\$\{?\w+\}?/, token: 'variable' },
      { match: /\d+(?:\.\d+)?(?:[kKmMgG]|ms|[smhdwMy])?(?=[\s;}]|$)/, token: 'number' },
      { match: /(?:=|!=|~\*?|!~\*?)(?=\s)/, token: 'operator' },
      { match: /[()]/, token: 'punctuation' },
      { match: /[^\s;{}"'$()#]+|[$#]/ },
    ],
    double: [
      { match: /[^"\\$]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /\$\{?\w+\}?/, token: 'variable' },
      { match: /\$/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { match: /[^'\\$]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /\$\{?\w+\}?/, token: 'variable' },
      { match: /\$/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
  },
}
