import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

// CMake. Commands are any case; arguments in CAPITALS are its keywords.
const CONTROL = words(`
  if elseif else endif foreach endforeach while endwhile function endfunction macro endmacro return
  break continue block endblock
`)

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#\[(=*)\[/, token: 'comment', push: (t) => `bracketComment/${t.length - 3}` },
      { match: /#.*/, token: 'comment' },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => (CONTROL.has(t.toLowerCase()) ? 'keyword' : 'function') },
      { match: /\(/, token: 'punctuation', push: 'arguments' },
    ],
    arguments: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\(/, token: 'punctuation', push: 'arguments' },
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /\[(=*)\[/, token: 'string', push: (t) => `bracket/${t.length - 2}` },
      { match: /"/, token: 'string', push: 'string' },
      { include: 'references' },
      { match: /(?:TRUE|FALSE|ON|OFF|YES|NO|Y|N|NOTFOUND|IGNORE)(?=[\s)])/i, token: 'constant' },
      { match: /(?:AND|OR|NOT|EQUAL|LESS|GREATER|STREQUAL|MATCHES|VERSION_LESS|VERSION_GREATER|VERSION_EQUAL|DEFINED|EXISTS|IS_DIRECTORY|IN_LIST|COMMAND|TARGET)(?=[\s)])/, token: 'operator' },
      { match: /[A-Z][A-Z\d_]+(?=[\s)])/, token: 'keyword' }, // PUBLIC, REQUIRED, VERSION
      { match: /-?\d+(?:\.\d+)*(?=[\s)])/, token: 'number' },
      { match: /[^\s()"#$\\[]+|[$\\[]/ },
    ],
    // ${VAR}, $ENV{VAR}, $CACHE{VAR} and generator expressions $<…>.
    references: [
      { match: /\$(?:ENV|CACHE)?\{/, token: 'variable', push: 'variable' },
      { match: /\$</, token: 'meta', push: 'generator' },
      { match: /\\[;"\\nrt$@]/, token: 'escape' },
    ],
    variable: [
      { match: /\}/, token: 'variable', pop: true },
      { include: 'references' },
      { match: /[^}$\\]+|[$\\]/, token: 'variable' },
    ],
    generator: [
      { match: />/, token: 'meta', pop: true },
      { include: 'references' },
      { match: /[^>$\\]+|[$\\]/, token: 'meta' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { include: 'references' },
      { match: /[^"$\\]+|[$\\]/, token: 'string' },
    ],
    bracket: [
      { match: (line, pos, n) => (line.startsWith(`]${'='.repeat(Number(n))}]`, pos) ? Number(n) + 2 : -1), token: 'string', pop: true },
      { match: /[^\]]+|\]/, token: 'string' },
    ],
    bracketComment: [
      { match: (line, pos, n) => (line.startsWith(`]${'='.repeat(Number(n))}]`, pos) ? Number(n) + 2 : -1), token: 'comment', pop: true },
      { match: /[^\]]+|\]/, token: 'comment' },
    ],
  },
}

